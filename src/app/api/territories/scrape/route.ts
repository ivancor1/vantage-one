import { NextRequest, NextResponse } from 'next/server'
import { fetchBuildingsInTerritory } from '@/lib/overpass'
import { supabase } from '@/lib/supabase'
import { enrichTerritory } from '@/lib/area-enrichment'
import { computeCompositeScore } from '@/lib/lead-scoring'

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    territoryId: string
    lat: number
    lng: number
    radiusMiles: number
  }

  const { territoryId, lat, lng, radiusMiles } = body
  if (!territoryId || lat == null || lng == null || !radiusMiles) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 })
  }

  const radiusMeters = Math.min(Number(radiusMiles), 10) * 1609.34

  try {
    const buildings = await fetchBuildingsInTerritory(lat, lng, radiusMeters)

    if (buildings.length === 0) {
      return NextResponse.json({ count: 0 })
    }

    const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ''
    const rows = buildings.map((b) => ({
      territory_id: territoryId,
      osm_id: b.osmId,
      address: b.address,
      lat: b.lat,
      lng: b.lng,
      base_score: b.baseScore,
      lead_score: b.baseScore,
      distance_to_territory_km: b.distanceKm,
      year_built: b.yearBuilt ?? null,
      roof_age: b.roofAge ?? null,
      satellite_url: mapboxToken
        ? `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/${b.lng},${b.lat},19,0/400x300?access_token=${mapboxToken}`
        : null,
    }))

    // Batch upsert leads
    const BATCH = 500
    for (let i = 0; i < rows.length; i += BATCH) {
      const { error } = await supabase
        .from('leads')
        .upsert(rows.slice(i, i + BATCH), { onConflict: 'territory_id,osm_id', ignoreDuplicates: true })
      if (error) throw error
    }

    // Reverse geocode the territory centroid to get state/county for enrichment
    const { stateAbbr, countyName } = await reverseGeocodeCounty(lat, lng)

    // Enrich territory with Census ACS + FEMA NRI (non-blocking)
    const enrichment = await enrichTerritory(lat, lng, stateAbbr, countyName)

    // Persist enrichment onto the territory row
    await supabase.from('territories').update({
      census_pct_pre2000: enrichment.censusPctPre2000,
      census_pct_pre1980: enrichment.censusPctPre1980,
      area_housing_age_label: enrichment.areaHousingAgeLabel,
      area_housing_age_score: enrichment.areaHousingAgeScore,
      historical_hail_risk_score: enrichment.hailRiskScore,
      historical_hail_risk_label: enrichment.hailRiskLabel,
      enriched_at: new Date().toISOString(),
    }).eq('id', territoryId)

    // Determine per-lead confidence and denormalize area signals
    // Upgrade confidence to 'high' later when AI visual analysis is run
    const hasCensus = enrichment.areaHousingAgeLabel != null
    const hasFema = enrichment.hailRiskScore != null

    const leadUpdates = rows.map((r) => {
      const hasParcelAge = r.year_built != null
      const confidence: 'high' | 'medium' | 'low' =
        hasParcelAge ? 'high' :
        (hasCensus || hasFema) ? 'medium' : 'low'

      return {
        territory_id: r.territory_id,
        osm_id: r.osm_id,
        area_housing_age_label: enrichment.areaHousingAgeLabel,
        area_housing_age_score: enrichment.areaHousingAgeScore,
        historical_hail_risk_score: enrichment.hailRiskScore,
        historical_hail_risk_label: enrichment.hailRiskLabel,
        score_confidence: confidence,
      }
    })

    for (let i = 0; i < leadUpdates.length; i += BATCH) {
      const chunk = leadUpdates.slice(i, i + BATCH)
      for (const u of chunk) {
        await supabase.from('leads').update({
          area_housing_age_label: u.area_housing_age_label,
          area_housing_age_score: u.area_housing_age_score,
          historical_hail_risk_score: u.historical_hail_risk_score,
          historical_hail_risk_label: u.historical_hail_risk_label,
          score_confidence: u.score_confidence,
        })
          .eq('territory_id', u.territory_id)
          .eq('osm_id', u.osm_id)
      }
    }

    // Apply storm scores using composite formula
    await applyNearbyStormScores(territoryId, lat, lng, buildings, enrichment)

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

function distKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dlat = (lat2 - lat1) * 111
  const dlng = (lng2 - lng1) * 111 * Math.cos((lat1 * Math.PI) / 180)
  return Math.sqrt(dlat * dlat + dlng * dlng)
}

async function applyNearbyStormScores(
  territoryId: string,
  tLat: number,
  tLng: number,
  buildings: Awaited<ReturnType<typeof fetchBuildingsInTerritory>>,
  enrichment: Awaited<ReturnType<typeof enrichTerritory>>
) {
  const { data: storms } = await supabase
    .from('storms')
    .select('id, name, lat, lng, severity, radius_meters, hail_core_lat, hail_core_lng')
    .eq('active', true)

  if (!storms?.length) return

  for (const storm of storms) {
    const stormRadiusKm = storm.radius_meters / 1000
    const hailCoreLat = (storm.hail_core_lat as number | null) ?? storm.lat
    const hailCoreLng = (storm.hail_core_lng as number | null) ?? storm.lng

    const rows: {
      osm_id: string
      storm_score: number
      lead_score: number
      nearest_storm_id: string
      distance_to_storm_km: number
      distance_to_hail_core_km: number
      inside_hail_swath: boolean
    }[] = []

    for (const b of buildings) {
      const distToCentroid = distKm(storm.lat, storm.lng, b.lat, b.lng)
      if (distToCentroid > stormRadiusKm * 1.5) continue

      const distToCore = distKm(hailCoreLat, hailCoreLng, b.lat, b.lng)
      const insideHailSwath = distToCore <= stormRadiusKm * 1.5

      const stormScore = computeCompositeScore({
        stormSeverity: storm.severity,
        distanceToHailCoreKm: distToCore,
        stormRadiusKm: stormRadiusKm,
        roofAge: b.roofAge,
        areaHousingAgeScore: enrichment.areaHousingAgeScore ?? undefined,
        hailRiskScore: enrichment.hailRiskScore ?? undefined,
      })

      rows.push({
        osm_id: b.osmId,
        storm_score: stormScore,
        lead_score: stormScore,
        nearest_storm_id: storm.id,
        distance_to_storm_km: Math.round(distToCentroid * 10) / 10,
        distance_to_hail_core_km: Math.round(distToCore * 10) / 10,
        inside_hail_swath: insideHailSwath,
      })
    }

    if (!rows.length) continue

    for (const row of rows) {
      await supabase
        .from('leads')
        .update({
          storm_score: row.storm_score,
          lead_score: row.lead_score,
          nearest_storm_id: row.nearest_storm_id,
          distance_to_storm_km: row.distance_to_storm_km,
          distance_to_hail_core_km: row.distance_to_hail_core_km,
          inside_hail_swath: row.inside_hail_swath,
        })
        .eq('territory_id', territoryId)
        .eq('osm_id', row.osm_id)
    }
  }
}
