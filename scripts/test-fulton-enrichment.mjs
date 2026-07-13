/**
 * Standalone test: Fulton County property enrichment via ArcGIS REST API.
 * No scraping. No authentication. Pure JSON API calls.
 *
 * Tests one real Alpharetta address through the full enrichment flow:
 *   1. Nominatim geocode → lat/lng
 *   2. Tax_Parcels query by address → ParcelID, Owner, LandAcres, LUCode
 *   3. Structures spatial query by lat/lng → YearBuilt, FeatType, LUCDesc
 */

const BASE = 'https://services1.arcgis.com/AQDHTHDrZzfsFsB5/arcgis/rest/services'
const TAX_PARCELS_URL  = `${BASE}/Tax_Parcels/FeatureServer/0/query`
const STRUCTURES_URL   = `${BASE}/Structures/FeatureServer/0/query`

const TEST_ADDRESSES = [
  { address: '1115 Kilmington Ct', city: 'Alpharetta', state: 'GA', zip: '30004', lat: 34.0648634, lng: -84.3015992 },
  { address: '1195 Kilmington Ct', city: 'Alpharetta', state: 'GA', zip: '30004', lat: 34.0648572, lng: -84.3009847 },
  { address: '1320 Kilmington Ct', city: 'Alpharetta', state: 'GA', zip: '30004', lat: 34.0651693, lng: -84.2999682 },
]

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function queryTaxParcels(address) {
  // Normalize: strip unit/apt, uppercase, match OSM format
  const normalized = address.toUpperCase().replace(/\s+/g, ' ').trim()
  const streetPart = normalized.split(',')[0]
  const params = new URLSearchParams({
    where:       `Address LIKE '%${streetPart}%'`,
    outFields:   'ParcelID,Address,Owner,LandAcres,LUCode,NbrHood',
    resultRecordCount: '1',
    f:           'json',
  })
  const res = await fetch(`${TAX_PARCELS_URL}?${params}`, {
    headers: { 'User-Agent': 'vantage-app/1.0 (property-enrichment-test)' },
  })
  if (!res.ok) return null
  const data = await res.json()
  const feat = data.features?.[0]?.attributes
  return feat ?? null
}

async function queryStructures(lat, lng) {
  const params = new URLSearchParams({
    geometry:     `${lng},${lat}`,
    geometryType: 'esriGeometryPoint',
    spatialRel:   'esriSpatialRelWithin',
    outFields:    'FeatureID,YearBuilt,AreaSqFt,Stories,FeatType,LUCDesc,LiveUnits',
    f:            'json',
    inSR:         '4326',
  })
  const res = await fetch(`${STRUCTURES_URL}?${params}`, {
    headers: { 'User-Agent': 'vantage-app/1.0 (property-enrichment-test)' },
  })
  if (!res.ok) return null
  const data = await res.json()
  const feat = data.features?.[0]?.attributes
  return feat ?? null
}

async function enrichAddress(entry) {
  const fullAddress = `${entry.address}, ${entry.city}, ${entry.state} ${entry.zip}`
  console.log(`\n--- Enriching: ${fullAddress} ---`)

  const [parcel, structure] = await Promise.all([
    queryTaxParcels(entry.address),
    queryStructures(entry.lat, entry.lng),
  ])

  const currentYear = new Date().getFullYear()
  const yearBuilt   = structure?.YearBuilt ? parseInt(structure.YearBuilt) : null
  const homeAge     = yearBuilt ? currentYear - yearBuilt : null

  const result = {
    address:           fullAddress,
    lat:               entry.lat,
    lng:               entry.lng,
    // From Tax_Parcels
    parcel_id:         parcel?.ParcelID    ?? null,
    owner:             parcel?.Owner       ?? null,
    land_acres:        parcel?.LandAcres   ?? null,
    lu_code:           parcel?.LUCode      ?? null,
    neighborhood:      parcel?.NbrHood     ?? null,
    // From Structures
    year_built:        yearBuilt,
    home_age:          homeAge,
    property_type:     structure?.LUCDesc  ?? null,
    feat_type:         structure?.FeatType ?? null,
    area_sqft:         structure?.AreaSqFt > 0 ? structure.AreaSqFt : null,
    stories:           structure?.Stories  > 0 ? structure.Stories  : null,
    live_units:        structure?.LiveUnits ?? null,
    // Meta
    enrichment_status: (parcel || structure) ? 'found' : 'not_found',
    source_tax:        `${TAX_PARCELS_URL}?where=Address+LIKE+%25${encodeURIComponent(entry.address)}%25`,
    source_structures: `${STRUCTURES_URL}?geometry=${entry.lng},${entry.lat}`,
  }

  console.log(JSON.stringify(result, null, 2))
  return result
}

async function main() {
  console.log('=== Fulton County Property Enrichment Test ===')
  console.log(`Testing ${TEST_ADDRESSES.length} Alpharetta addresses\n`)

  const results = []
  for (const entry of TEST_ADDRESSES) {
    const result = await enrichAddress(entry)
    results.push(result)
    await sleep(500) // be polite between requests
  }

  console.log('\n=== SUMMARY ===')
  const found    = results.filter((r) => r.enrichment_status === 'found').length
  const withYear = results.filter((r) => r.year_built !== null).length
  console.log(`Enriched: ${found}/${results.length}`)
  console.log(`Year built found: ${withYear}/${results.length}`)
  console.log(`Fields available: parcel_id, owner, land_acres, year_built, home_age, property_type, feat_type`)
  console.log(`Fields unavailable: bedrooms, bathrooms, sqft (often 0 in this dataset)`)
}

main().catch(console.error)
