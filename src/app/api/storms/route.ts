import { NextResponse } from 'next/server'
import { fetchStorms } from '@/lib/iem'
import { supabase, isSupabaseReady } from '@/lib/supabase'
import { computeCompositeScore } from '@/lib/lead-scoring'
import type { Storm } from '@/lib/types'

export const revalidate = 1800

export async function GET() {
  try {
    const storms = await fetchStorms()

    if (isSupabaseReady()) {
      // Fire-and-forget — don't let a sync failure block the response
      syncStormsToSupabase(storms).catch((err) =>
        console.warn('[storms] Supabase sync failed:', err)
      )
    }

    return NextResponse.json(storms)
  } catch (err) {
    console.error('[api/storms]', err)
    return NextResponse.json({ error: 'Failed to fetch storm data' }, { status: 500 })
  }
}

function distKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dlat = (lat2 - lat1) * 111
  const dlng = (lng2 - lng1) * 111 * Math.cos((lat1 * Math.PI) / 180)
  return Math.sqrt(dlat * dlat + dlng * dlng)
}

async function syncStormsToSupabase(freshStorms: Storm[]) {
  // 1. Snapshot active storm IDs before we upsert (to detect new arrivals)
  const { data: existing } = await supabase
    .from('storms')
    .select('id')
    .eq('active', true)
  const existingIds = new Set((existing ?? []).map((r) => r.id))

  const freshIds = freshStorms.map((s) => s.id)

  // 2. Upsert all fresh storms
  if (freshStorms.length > 0) {
    const rows = freshStorms.map((s) => ({
      id: s.id,
      wfo: s.wfo,
      date: s.date,
      name: s.name,
      location: s.location,
      lat: s.lat,
      lng: s.lng,
      hail_size: s.hailSize,
      wind_speed: s.windSpeed,
      report_count: s.reportCount,
      severity: s.severity,
      radius_meters: Math.round(s.radiusMeters),
      estimated_homes: s.estimatedHomes,
      reports: s.reports,
      hail_core_lat: s.hailCoreLat,
      hail_core_lng: s.hailCoreLng,
      active: true,
      last_seen_at: new Date().toISOString(),
    }))
    const { error } = await supabase.from('storms').upsert(rows, { onConflict: 'id' })
    if (error) throw error
  }

  // 3. Mark storms gone from IEM as inactive — scores on affected leads are intentionally kept.
  // A storm passing doesn't mean damage is gone; the boost stays so the roofer can still work those leads.
  const goneIds = [...existingIds].filter((id) => !freshIds.includes(id))
  if (goneIds.length > 0) {
    await supabase.from('storms').update({ active: false }).in('id', goneIds)
  }

  // 4. For brand-new storms: boost leads in nearby territories
  const newStorms = freshStorms.filter((s) => !existingIds.has(s.id))
  for (const storm of newStorms) {
    await boostLeadsForNewStorm(storm)
  }
}

async function boostLeadsForNewStorm(storm: Storm) {
  const radiusKm = storm.radiusMeters / 1000

  const { data: leads } = await supabase
    .from('leads')
    .select('id, lat, lng, base_score, roof_age, area_housing_age_score, historical_hail_risk_score')
    .is('deleted_at', null)

  if (!leads?.length) return

  const updates: {
    id: string
    storm_score: number
    lead_score: number
    nearest_storm_id: string
    distance_to_storm_km: number
    distance_to_hail_core_km: number
    inside_hail_swath: boolean
  }[] = []

  for (const lead of leads) {
    // Filter by centroid distance — keeps the existing eligibility logic
    const distToCentroid = distKm(storm.lat, storm.lng, lead.lat, lead.lng)
    if (distToCentroid > radiusKm * 1.5) continue

    const distToCore = distKm(storm.hailCoreLat, storm.hailCoreLng, lead.lat, lead.lng)
    const insideHailSwath = distToCore <= radiusKm * 1.5

    const stormScore = computeCompositeScore({
      stormSeverity: storm.severity,
      distanceToHailCoreKm: distToCore,
      stormRadiusKm: radiusKm,
      roofAge: lead.roof_age ?? undefined,
      areaHousingAgeScore: lead.area_housing_age_score ?? undefined,
      hailRiskScore: lead.historical_hail_risk_score ?? undefined,
    })

    if (stormScore <= (lead.base_score ?? 0)) continue

    updates.push({
      id: lead.id,
      storm_score: stormScore,
      lead_score: stormScore,
      nearest_storm_id: storm.id,
      distance_to_storm_km: Math.round(distToCentroid * 10) / 10,
      distance_to_hail_core_km: Math.round(distToCore * 10) / 10,
      inside_hail_swath: insideHailSwath,
    })
  }

  if (!updates.length) return

  const BATCH = 200
  for (let i = 0; i < updates.length; i += BATCH) {
    await supabase.from('leads').upsert(updates.slice(i, i + BATCH))
  }
}
