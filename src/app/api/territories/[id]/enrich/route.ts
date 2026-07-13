import { NextRequest, NextResponse } from 'next/server'
import { supabase, isSupabaseReady } from '@/lib/supabase'
import { getCensusTract } from '@/lib/area-enrichment'
import { getCountyConfig } from '@/lib/county-arcgis-registry'
import { enrichProperty, isResidential } from '@/lib/property-enrichment'

const DELAY_MS = 200

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!isSupabaseReady()) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 })
  }

  const { id } = params

  // 1. Verify territory exists
  const { data: territory, error: tErr } = await supabase
    .from('territories')
    .select('id, lat, lng, place_name')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (tErr || !territory) {
    return NextResponse.json({ error: 'Territory not found' }, { status: 404 })
  }

  // 2. Resolve county FIPS from territory center
  const tractInfo = await getCensusTract(territory.lat, territory.lng)
  if (!tractInfo) {
    return NextResponse.json({ supported: false, reason: 'Could not resolve county from coordinates' })
  }

  const fips = tractInfo.stateFp + tractInfo.countyFp
  const config = getCountyConfig(fips)
  if (!config) {
    return NextResponse.json({ supported: false, county: fips, reason: 'County not in registry' })
  }

  // 3. Fetch all active leads for this territory
  const { data: leads, error: lErr } = await supabase
    .from('leads')
    .select('id, lat, lng, address')
    .eq('territory_id', id)
    .is('deleted_at', null)

  if (lErr || !leads?.length) {
    return NextResponse.json({ supported: true, county: config.name, enriched: 0, year_built_found: 0, total_leads: 0 })
  }

  // 4. Enrich each lead sequentially to respect rate limits
  let year_built_found = 0

  for (const lead of leads as { id: string; lat: number; lng: number; address: string }[]) {
    const result = await enrichProperty(lead.address ?? '', lead.lat, lead.lng, config)

    if (!isResidential(result.property_type, config)) {
      await sleep(DELAY_MS)
      continue
    }

    if (result.year_built) {
      await supabase.from('leads').update({
        year_built: result.year_built,
        roof_age:   Math.min(result.home_age ?? 0, 20),
      }).eq('id', lead.id)
      year_built_found++
    }

    await sleep(DELAY_MS)
  }

  return NextResponse.json({
    supported:       true,
    county:          config.name,
    enriched:        leads.length,
    year_built_found,
    total_leads:     leads.length,
  })
}
