import { NextRequest, NextResponse } from 'next/server'
import { supabase, isSupabaseReady } from '@/lib/supabase'
import { distKm } from '@/lib/hail'
import type { LsrReport } from '@/lib/types'

// Storm-first lead generation: turn a storm from the feed into a worked lead list.
// Picks the storm's strongest hail-report locations, scrapes real addressed homes around
// them (reusing the territory scrape pipeline, which also applies radar+spotter hail
// scoring), and returns the territory to view on the Leads page. Rural report points often
// have zero addressed OSM buildings, so we try up to 3 distinct report locations.
const RADIUS_MILES = 3
const MAX_ATTEMPTS = 3

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ stormId: string }> }
) {
  if (!isSupabaseReady()) {
    return NextResponse.json({ ok: false, error: 'Supabase not configured' }, { status: 503 })
  }
  const { stormId } = await params

  const { data: storm, error: sErr } = await supabase
    .from('storms')
    .select('id, name, location, date, lat, lng, reports')
    .eq('id', stormId)
    .single()

  if (sErr || !storm) {
    return NextResponse.json({ ok: false, error: 'Storm not found — open the Storms tab once to sync, then retry' }, { status: 404 })
  }

  // One territory per storm (unique on type+value) — re-clicks reuse it, and a previously
  // trashed storm-territory is resurrected (deleted_at cleared) rather than staying invisible
  const { data: territory, error: tErr } = await supabase
    .from('territories')
    .upsert(
      { type: 'city', value: storm.name, place_name: storm.location, radius_miles: RADIUS_MILES, lat: storm.lat, lng: storm.lng, deleted_at: null },
      { onConflict: 'type,value' }
    )
    .select('id')
    .single()

  if (tErr || !territory) {
    return NextResponse.json({ ok: false, error: tErr?.message ?? 'Could not create territory' }, { status: 500 })
  }

  // Already generated? Return immediately — the button doubles as "view leads".
  const { count: existing } = await supabase
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .eq('territory_id', territory.id)
    .is('deleted_at', null)

  if ((existing ?? 0) > 0) {
    return NextResponse.json({ ok: true, territoryId: territory.id, count: existing, existing: true })
  }

  // Candidate scrape centers: strongest hail reports first (deduped, ≥3 km apart),
  // storm centroid as the final fallback.
  const hailReports = ((storm.reports ?? []) as LsrReport[])
    .filter((r) => r.type === 'HAIL' && r.magnitude > 0)
    .sort((a, b) => b.magnitude - a.magnitude)

  const centers: { lat: number; lng: number }[] = []
  for (const r of hailReports) {
    if (centers.every((c) => distKm(c.lat, c.lng, r.lat, r.lng) >= 3)) {
      centers.push({ lat: r.lat, lng: r.lng })
    }
    if (centers.length >= MAX_ATTEMPTS) break
  }
  if (!centers.length) centers.push({ lat: storm.lat, lng: storm.lng })

  // Reuse the one scrape pipeline (OSM homes + Census/FEMA enrichment + hail scoring)
  const scrapeUrl = new URL('/api/territories/scrape', req.nextUrl.origin)
  let lastError = ''

  for (const center of centers.slice(0, MAX_ATTEMPTS)) {
    await supabase.from('territories').update({ lat: center.lat, lng: center.lng }).eq('id', territory.id)

    try {
      const res = await fetch(scrapeUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ territoryId: territory.id, lat: center.lat, lng: center.lng, radiusMiles: RADIUS_MILES }),
      })
      const data = await res.json()
      if (!res.ok) { lastError = data?.error ?? `scrape ${res.status}`; continue }
      if ((data?.count ?? 0) > 0) {
        return NextResponse.json({ ok: true, territoryId: territory.id, count: data.count, existing: false })
      }
      lastError = 'No addressed homes at this report location'
    } catch (err) {
      lastError = (err as Error).message
    }
  }

  return NextResponse.json({
    ok: false,
    territoryId: territory.id,
    error: `No addressed homes found near this storm's report points (rural area or thin OSM coverage). ${lastError}`,
  }, { status: 422 })
}
