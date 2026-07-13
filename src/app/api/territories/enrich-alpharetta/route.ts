import { NextResponse } from 'next/server'
import { fetchBuildingsInTerritory } from '@/lib/overpass'
import { enrichProperty } from '@/lib/fulton-enrichment'
import type { EnrichedLead } from '@/lib/fulton-enrichment'

const ALPHARETTA_LAT    = 34.0754
const ALPHARETTA_LNG    = -84.2941
const ALPHARETTA_RADIUS = 4000   // meters
const MAX_CANDIDATES    = 50     // enrich this many, then filter for residential
const MAX_LEADS         = 25
const DELAY_MS          = 200

const RESIDENTIAL_TERMS = [
  'residential', 'single family', 'townhouse', 'condominium', 'condo',
  'multi-family', 'multifamily', 'duplex', 'triplex',
]

function isResidential(lead: EnrichedLead): boolean {
  if (lead.enrichment_status === 'not_found') return false
  const pt = lead.property_type?.toLowerCase() ?? ''
  return RESIDENTIAL_TERMS.some((t) => pt.includes(t))
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

export async function GET() {
  const buildings = await fetchBuildingsInTerritory(ALPHARETTA_LAT, ALPHARETTA_LNG, ALPHARETTA_RADIUS)
  const batch = buildings.slice(0, MAX_CANDIDATES)

  const leads: EnrichedLead[] = []
  for (const b of batch) {
    const enrichment = await enrichProperty(b.address, b.lat, b.lng)

    const home_age_score = enrichment.home_age !== null
      ? Math.min(100, Math.round((enrichment.home_age / 30) * 100))
      : null

    const enriched_score = home_age_score !== null
      ? Math.round((b.baseScore + home_age_score) / 2)
      : b.baseScore

    leads.push({
      address:    b.address,
      lat:        b.lat,
      lng:        b.lng,
      distanceKm: b.distanceKm,
      baseScore:  b.baseScore,
      ...enrichment,
      home_age_score,
      enriched_score,
    })

    await sleep(DELAY_MS)
  }

  const residential = leads.filter(isResidential).slice(0, MAX_LEADS)

  return NextResponse.json({
    leads:       residential,
    total:       buildings.length,
    enriched:    leads.length,
    residential: residential.length,
  })
}
