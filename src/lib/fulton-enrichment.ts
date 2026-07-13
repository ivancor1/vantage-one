const BASE = 'https://services1.arcgis.com/AQDHTHDrZzfsFsB5/arcgis/rest/services'
const TAX_PARCELS_URL = `${BASE}/Tax_Parcels/FeatureServer/0/query`
const STRUCTURES_URL  = `${BASE}/Structures/FeatureServer/0/query`

type ArcGISAttrs = Record<string, string | number | null>

export type EnrichmentResult = {
  parcel_id:         string | null
  land_acres:        number | null
  year_built:        number | null
  home_age:          number | null
  property_type:     string | null
  feat_type:         string | null
  enrichment_status: 'found' | 'not_found'
}

export type EnrichedLead = {
  address:           string
  lat:               number
  lng:               number
  distanceKm:        number
  baseScore:         number
  parcel_id:         string | null
  land_acres:        number | null
  year_built:        number | null
  home_age:          number | null
  property_type:     string | null
  feat_type:         string | null
  home_age_score:    number | null
  enriched_score:    number
  enrichment_status: 'found' | 'not_found'
}

async function queryTaxParcels(address: string): Promise<ArcGISAttrs | null> {
  const streetPart = address.toUpperCase().replace(/\s+/g, ' ').trim().split(',')[0]
  const params = new URLSearchParams({
    where:             `Address LIKE '%${streetPart}%'`,
    outFields:         'ParcelID,LandAcres',
    resultRecordCount: '1',
    f:                 'json',
  })
  try {
    const res = await fetch(`${TAX_PARCELS_URL}?${params}`, {
      headers: { 'User-Agent': 'vantage-app/1.0 (fulton-enrichment)' },
    })
    if (!res.ok) return null
    const data = await res.json() as { features?: { attributes: ArcGISAttrs }[] }
    return data.features?.[0]?.attributes ?? null
  } catch {
    return null
  }
}

async function queryStructures(lat: number, lng: number): Promise<ArcGISAttrs | null> {
  const params = new URLSearchParams({
    geometry:     `${lng},${lat}`,
    geometryType: 'esriGeometryPoint',
    spatialRel:   'esriSpatialRelWithin',
    outFields:    'YearBuilt,FeatType,LUCDesc',
    f:            'json',
    inSR:         '4326',
  })
  try {
    const res = await fetch(`${STRUCTURES_URL}?${params}`, {
      headers: { 'User-Agent': 'vantage-app/1.0 (fulton-enrichment)' },
    })
    if (!res.ok) return null
    const data = await res.json() as { features?: { attributes: ArcGISAttrs }[] }
    return data.features?.[0]?.attributes ?? null
  } catch {
    return null
  }
}

export async function enrichProperty(address: string, lat: number, lng: number): Promise<EnrichmentResult> {
  const [parcel, structure] = await Promise.all([
    queryTaxParcels(address),
    queryStructures(lat, lng),
  ])

  const currentYear = new Date().getFullYear()
  const rawYear = structure?.YearBuilt ? parseInt(String(structure.YearBuilt)) : null
  const year_built = rawYear && rawYear > 1800 && rawYear <= currentYear ? rawYear : null
  const home_age = year_built ? currentYear - year_built : null

  return {
    parcel_id:         parcel?.ParcelID  ? String(parcel.ParcelID)  : null,
    land_acres:        parcel?.LandAcres ? Number(parcel.LandAcres) : null,
    year_built,
    home_age,
    property_type:     structure?.LUCDesc  ? String(structure.LUCDesc)  : null,
    feat_type:         structure?.FeatType ? String(structure.FeatType) : null,
    enrichment_status: (parcel || structure) ? 'found' : 'not_found',
  }
}
