import { NextResponse } from 'next/server'
import { fetchStorms } from '@/lib/iem'
import { supabase, isSupabaseReady } from '@/lib/supabase'
import { computeCompositeScore } from '@/lib/lead-scoring'
import { interpolateHail, fetchRadarHail, bboxAround, stormDateRange, distKm, type HailPoint } from '@/lib/hail'
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

// When a brand-new storm arrives, re-score existing leads near it using the same two real
// signals as the scrape path: IDW of the storm's NWS spotter reports + NOAA radar signatures.
async function boostLeadsForNewStorm(storm: Storm) {
  const radiusKm = storm.radiusMeters / 1000

  const { data: leads } = await supabase
    .from('leads')
    .select('id, lat, lng, base_score, roof_age, visual_roof_score, area_housing_age_score, historical_hail_risk_score')
    .is('deleted_at', null)

  if (!leads?.length) return

  const spotterPts: HailPoint[] = storm.reports
    .filter((r) => r.type === 'HAIL' && r.magnitude > 0)
    .map((r) => ({ lat: r.lat, lng: r.lng, inches: r.magnitude }))

  const [start, end] = stormDateRange(storm.date)
  const radarPts = await fetchRadarHail(
    bboxAround(storm.lat, storm.lng, Math.min(radiusKm * 1.5 + 10, 60)), start, end
  )

  if (!spotterPts.length && !radarPts.length) return

  const updates: {
    id: string
    storm_score: number
    lead_score: number
    nearest_storm_id: string
    distance_to_storm_km: number
    spotter_hail_in: number | null
    radar_hail_in: number | null
    nearest_report_km: number
    inside_hail_swath: boolean
  }[] = []

  for (const lead of leads) {
    // Cheap eligibility gate before interpolating
    const distToCentroid = distKm(storm.lat, storm.lng, lead.lat, lead.lng)
    if (distToCentroid > radiusKm * 1.5 + 25) continue

    const spotterEst = interpolateHail(spotterPts, lead.lat, lead.lng)
    const radarEst = interpolateHail(radarPts, lead.lat, lead.lng)
    if (!spotterEst && !radarEst) continue

    const nearestKm = Math.min(spotterEst?.nearestKm ?? Infinity, radarEst?.nearestKm ?? Infinity)
    if (nearestKm > Math.max(radiusKm * 1.5, 25)) continue

    const stormScore = computeCompositeScore({
      spotterHailIn: spotterEst?.hailInches,
      radarHailIn: radarEst?.hailInches,
      vulnerabilityScore: lead.visual_roof_score ?? undefined,
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
      spotter_hail_in: spotterEst?.hailInches ?? null,
      radar_hail_in: radarEst?.hailInches ?? null,
      nearest_report_km: nearestKm,
      inside_hail_swath: nearestKm <= radiusKm * 1.5,
    })
  }

  if (!updates.length) return

  const BATCH = 200
  for (let i = 0; i < updates.length; i += BATCH) {
    await supabase.from('leads').upsert(updates.slice(i, i + BATCH))
  }
}
