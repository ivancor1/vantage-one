import type { CountyArcGISConfig } from './county-arcgis-registry'

type ArcGISAttrs = Record<string, string | number | null>

export type EnrichmentResult = {
  parcel_id:         string | null
  land_acres:        number | null
  year_built:        number | null
  home_age:          number | null
  property_type:     string | null
  enrichment_status: 'found' | 'not_found'
}

async function queryByAddress(
  address: string,
  url: string,
  addressField: string,
  outFields: string,
): Promise<ArcGISAttrs | null> {
  // Strip everything after the first comma (city, state, zip)
  const streetPart = address.toUpperCase().replace(/\s+/g, ' ').trim().split(',')[0]
  const params = new URLSearchParams({
    where:             `${addressField} LIKE '%${streetPart}%'`,
    outFields,
    resultRecordCount: '1',
    returnGeometry:    'false',
    f:                 'json',
  })
  try {
    const res = await fetch(`${url}?${params}`, {
      headers: { 'User-Agent': 'vantage-app/1.0 (property-enrichment)' },
    })
    if (!res.ok) return null
    const data = await res.json() as { features?: { attributes: ArcGISAttrs }[] }
    return data.features?.[0]?.attributes ?? null
  } catch {
    return null
  }
}

async function queryByPoint(
  lat: number,
  lng: number,
  url: string,
  outFields: string,
): Promise<ArcGISAttrs | null> {
  const params = new URLSearchParams({
    geometry:       `${lng},${lat}`,
    geometryType:   'esriGeometryPoint',
    spatialRel:     'esriSpatialRelWithin',
    outFields,
    returnGeometry: 'false',
    f:              'json',
    inSR:           '4326',
  })
  try {
    const res = await fetch(`${url}?${params}`, {
      headers: { 'User-Agent': 'vantage-app/1.0 (property-enrichment)' },
    })
    if (!res.ok) return null
    const data = await res.json() as { features?: { attributes: ArcGISAttrs }[] }
    return data.features?.[0]?.attributes ?? null
  } catch {
    return null
  }
}

function parseYear(raw: string | number | null | undefined): number | null {
  if (!raw) return null
  const n = parseInt(String(raw))
  const currentYear = new Date().getFullYear()
  return n > 1800 && n <= currentYear ? n : null
}

export function isResidential(propertyType: string | null, config: CountyArcGISConfig): boolean {
  if (!propertyType) return false
  const lower = propertyType.toLowerCase()
  return config.residentialTerms.some((t) => lower.includes(t))
}

export async function enrichProperty(
  address: string,
  lat: number,
  lng: number,
  config: CountyArcGISConfig,
): Promise<EnrichmentResult> {
  // Build outFields for the primary parcel query
  const parcelOutFields = [
    config.parcelIdField,
    ...(config.yearBuiltField   ? [config.yearBuiltField]   : []),
    ...(config.landUseField     ? [config.landUseField]     : []),
    ...(config.acresField       ? [config.acresField]       : []),
    ...(config.sqftField        ? [config.sqftField]        : []),
  ].join(',')

  // Run parcel query + optional structures query in parallel
  const [parcel, structure] = await Promise.all([
    queryByAddress(address, config.parcelsUrl, config.addressField, parcelOutFields),
    config.structuresUrl
      ? queryByPoint(lat, lng, config.structuresUrl, 'YearBuilt,LUCDesc,FeatType')
      : Promise.resolve(null),
  ])

  // Year built: prefer structures layer (Fulton pattern), fall back to parcel field
  const rawYear = config.yearBuiltField
    ? parcel?.[config.yearBuiltField]
    : structure?.YearBuilt

  const year_built = parseYear(rawYear)
  const currentYear = new Date().getFullYear()
  const home_age = year_built ? currentYear - year_built : null

  // Parcel ID
  const parcel_id = parcel?.[config.parcelIdField]
    ? String(parcel[config.parcelIdField])
    : null

  // Acres: prefer dedicated acres field, convert sqft if needed
  let land_acres: number | null = null
  if (config.acresField && parcel?.[config.acresField] != null) {
    land_acres = Number(parcel[config.acresField]) || null
  } else if (config.sqftField && parcel?.[config.sqftField] != null) {
    const sqft = Number(parcel[config.sqftField])
    land_acres = sqft > 0 ? Math.round((sqft / 43560) * 1000) / 1000 : null
  }

  // Land use: prefer structures LUCDesc (Fulton), fall back to parcel field
  const rawLandUse = config.structuresUrl
    ? structure?.LUCDesc
    : (config.landUseField ? parcel?.[config.landUseField] : null)
  const property_type = rawLandUse ? String(rawLandUse) : null

  return {
    parcel_id,
    land_acres,
    year_built,
    home_age,
    property_type,
    enrichment_status: (parcel || structure) ? 'found' : 'not_found',
  }
}
