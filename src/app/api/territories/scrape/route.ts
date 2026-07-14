import { NextRequest, NextResponse } from 'next/server'
import { fetchBuildingsInTerritory } from '@/lib/overpass'
import { supabase } from '@/lib/supabase'
import { enrichTerritory } from '@/lib/area-enrichment'
import { computeCompositeScore } from '@/lib/lead-scoring'
import { interpolateHail, fetchRadarHail, bboxAround, stormDateRange, distKm, type HailPoint } from '@/lib/hail'
import type { LsrReport } from '@/lib/types'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as {
    territoryId: string
    lat: number
    lng: number
    radiusMiles: number
  } | null

  const { territoryId, lat, lng, radiusMiles } = body ?? {}
  if (!territoryId || lat == null || lng == null || !radiusMiles) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 })
  }

  const radiusMeters = Math.min(Number(radiusMiles), 10) * 1609.34

  try {
    // Gather everything FIRST, write ONCE. The old flow did an insert plus one UPDATE per
    // lead per signal (N+1) — hundreds of serial round-trips and ~60s scrapes. Now: fetch
    // buildings, enrich the area, compute per-home hail, then a single batched upsert of
    // fully-formed rows keyed on (territory_id, osm_id). Lead status is never in the
    // payload, so re-scans can't clobber a rep's pipeline.
    const buildings = await fetchBuildingsInTerritory(lat, lng, radiusMeters)

    if (buildings.length === 0) {
      return NextResponse.json({ count: 0 })
    }

    // Area enrichment (Census tract age + FEMA county hail history)
    const { stateAbbr, countyName } = await reverseGeocodeCounty(lat, lng)
    const enrichment = await enrichTerritory(lat, lng, stateAbbr, countyName)

    await supabase.from('territories').update({
      census_pct_pre2000: enrichment.censusPctPre2000,
      census_pct_pre1980: enrichment.censusPctPre1980,
      area_housing_age_label: enrichment.areaHousingAgeLabel,
      area_housing_age_score: enrichment.areaHousingAgeScore,
      historical_hail_risk_score: enrichment.hailRiskScore,
      historical_hail_risk_label: enrichment.hailRiskLabel,
      enriched_at: new Date().toISOString(),
    }).eq('id', territoryId)

    // Per-home hail evidence from every nearby active storm (pure computation, no writes)
    const stormFields = await computeStormHailFields(lat, lng, buildings, enrichment)

    const hasCensus = enrichment.areaHousingAgeLabel != null
    const hasFema = enrichment.hailRiskScore != null
    const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ''

    const rows = buildings.map((b) => {
      const storm = stormFields.get(b.osmId)
      const confidence: 'high' | 'medium' | 'low' =
        b.yearBuilt != null ? 'high' :
        (hasCensus || hasFema) ? 'medium' : 'low'

      return {
        territory_id: territoryId,
        osm_id: b.osmId,
        address: b.address,
        lat: b.lat,
        lng: b.lng,
        base_score: b.baseScore,
        lead_score: storm?.storm_score ?? b.baseScore,
        distance_to_territory_km: b.distanceKm,
        year_built: b.yearBuilt ?? null,
        roof_age: b.roofAge ?? null,
        footprint_sqm: b.footprintSqm ?? null,
        satellite_url: mapboxToken
          ? `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/${b.lng},${b.lat},19,0/400x300?access_token=${mapboxToken}`
          : null,
        area_housing_age_label: enrichment.areaHousingAgeLabel,
        area_housing_age_score: enrichment.areaHousingAgeScore,
        historical_hail_risk_score: enrichment.hailRiskScore,
        historical_hail_risk_label: enrichment.hailRiskLabel,
        score_confidence: confidence,
        storm_score: storm?.storm_score ?? null,
        nearest_storm_id: storm?.nearest_storm_id ?? null,
        distance_to_storm_km: storm?.distance_to_storm_km ?? null,
        spotter_hail_in: storm?.spotter_hail_in ?? null,
        radar_hail_in: storm?.radar_hail_in ?? null,
        nearest_report_km: storm?.nearest_report_km ?? null,
        inside_hail_swath: storm?.inside_hail_swath ?? null,
        deleted_at: null, // a fresh scan resurrects previously trashed rows for this area
      }
    })

    // ONE write pass — batched upsert of complete rows
    const BATCH = 500
    for (let i = 0; i < rows.length; i += BATCH) {
      const { error } = await supabase
        .from('leads')
        .upsert(rows.slice(i, i + BATCH), { onConflict: 'territory_id,osm_id' })
      if (error) throw error
    }

    return NextResponse.json({ count: buildings.length })
  } catch (err) {
    console.error('[territories/scrape]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

async function reverseGeocodeCounty(lat: number, lng: number): Promise<{
  stateAbbr: string; countyName: string
}> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'vantage-app/1.0', 'Accept': 'application/json' },
    })
    if (!res.ok) return { stateAbbr: '', countyName: '' }
    const data = await res.json()
    const addr = data?.address ?? {}
    // Nominatim returns state name; convert to abbreviation via the STATE_ABBR map in geocode route
    const stateAbbr = STATE_ABBR[addr.state ?? ''] ?? ''
    const countyName = addr.county ?? addr.state_district ?? ''
    return { stateAbbr, countyName }
  } catch {
    return { stateAbbr: '', countyName: '' }
  }
}

// Minimal state name → abbreviation map (US only)
const STATE_ABBR: Record<string, string> = {
  Alabama: 'AL', Alaska: 'AK', Arizona: 'AZ', Arkansas: 'AR', California: 'CA',
  Colorado: 'CO', Connecticut: 'CT', Delaware: 'DE', Florida: 'FL', Georgia: 'GA',
  Hawaii: 'HI', Idaho: 'ID', Illinois: 'IL', Indiana: 'IN', Iowa: 'IA',
  Kansas: 'KS', Kentucky: 'KY', Louisiana: 'LA', Maine: 'ME', Maryland: 'MD',
  Massachusetts: 'MA', Michigan: 'MI', Minnesota: 'MN', Mississippi: 'MS',
  Missouri: 'MO', Montana: 'MT', Nebraska: 'NE', Nevada: 'NV', 'New Hampshire': 'NH',
  'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC',
  'North Dakota': 'ND', Ohio: 'OH', Oklahoma: 'OK', Oregon: 'OR', Pennsylvania: 'PA',
  'Rhode Island': 'RI', 'South Carolina': 'SC', 'South Dakota': 'SD', Tennessee: 'TN',
  Texas: 'TX', Utah: 'UT', Vermont: 'VT', Virginia: 'VA', Washington: 'WA',
  'West Virginia': 'WV', Wisconsin: 'WI', Wyoming: 'WY',
}

type StormHailFields = {
  storm_score: number
  nearest_storm_id: string
  distance_to_storm_km: number
  spotter_hail_in: number | null
  radar_hail_in: number | null
  nearest_report_km: number
  inside_hail_swath: boolean
}

// For each active storm, give every home a REAL hail estimate: inverse-distance-weighted
// over (1) the storm's actual NWS spotter reports and (2) NOAA SWDI radar hail signatures
// fetched for the territory area on the storm's date. No single "hail core" point.
// PURE COMPUTATION — returns a map keyed by osm_id (best-scoring storm wins per home);
// the caller folds it into one batched upsert.
async function computeStormHailFields(
  tLat: number,
  tLng: number,
  buildings: Awaited<ReturnType<typeof fetchBuildingsInTerritory>>,
  enrichment: Awaited<ReturnType<typeof enrichTerritory>>
): Promise<Map<string, StormHailFields>> {
  const best = new Map<string, StormHailFields>()

  const { data: storms } = await supabase
    .from('storms')
    .select('id, name, date, lat, lng, radius_meters, reports')
    .eq('active', true)

  if (!storms?.length) return best

  for (const storm of storms) {
    const stormRadiusKm = storm.radius_meters / 1000

    // Skip storms nowhere near this territory before doing any work
    const distTerritoryToStorm = distKm(storm.lat, storm.lng, tLat, tLng)
    if (distTerritoryToStorm > stormRadiusKm * 1.5 + 25) continue

    // Signal 1: the storm's real NWS hail reports
    const spotterPts: HailPoint[] = ((storm.reports ?? []) as LsrReport[])
      .filter((r) => r.type === 'HAIL' && r.magnitude > 0)
      .map((r) => ({ lat: r.lat, lng: r.lng, inches: r.magnitude }))

    // Signal 2: NOAA radar hail signatures over the territory on the storm's date
    const [start, end] = stormDateRange(storm.date as string)
    const radarPts = await fetchRadarHail(bboxAround(tLat, tLng, 40), start, end)

    if (!spotterPts.length && !radarPts.length) continue

    for (const b of buildings) {
      const spotterEst = interpolateHail(spotterPts, b.lat, b.lng)
      const radarEst = interpolateHail(radarPts, b.lat, b.lng)
      if (!spotterEst && !radarEst) continue

      const nearestKm = Math.min(spotterEst?.nearestKm ?? Infinity, radarEst?.nearestKm ?? Infinity)
      if (nearestKm > Math.max(stormRadiusKm * 1.5, 25)) continue

      const stormScore = computeCompositeScore({
        spotterHailIn: spotterEst?.hailInches,
        radarHailIn: radarEst?.hailInches,
        roofAge: b.roofAge,
        areaHousingAgeScore: enrichment.areaHousingAgeScore ?? undefined,
        hailRiskScore: enrichment.hailRiskScore ?? undefined,
      })

      const prev = best.get(b.osmId)
      if (prev && prev.storm_score >= stormScore) continue

      best.set(b.osmId, {
        storm_score: stormScore,
        nearest_storm_id: storm.id,
        distance_to_storm_km: Math.round(distKm(storm.lat, storm.lng, b.lat, b.lng) * 10) / 10,
        spotter_hail_in: spotterEst?.hailInches ?? null,
        radar_hail_in: radarEst?.hailInches ?? null,
        nearest_report_km: nearestKm,
        inside_hail_swath: nearestKm <= stormRadiusKm * 1.5,
      })
    }
  }

  return best
}
