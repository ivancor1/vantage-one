const REGRID_BASE = 'https://app.regrid.com/api/v2/parcels/point'

type RegridFields = {
  yearbuilt:   number | null
  parcelnumb:  string | null
  usedesc:     string | null
  ll_gisacre:  number | null
}

export type RegridResult = {
  year_built:        number | null
  home_age:          number | null
  parcel_id:         string | null
  land_acres:        number | null
  property_type:     string | null
  enrichment_status: 'found' | 'not_found' | 'error'
}

export async function queryRegrid(lat: number, lng: number): Promise<RegridResult> {
  const apiKey = process.env.REGRID_API_KEY
  if (!apiKey) {
    return { year_built: null, home_age: null, parcel_id: null, land_acres: null, property_type: null, enrichment_status: 'error' }
  }

  const params = new URLSearchParams({
    lat:              String(lat),
    lon:              String(lng),
    token:            apiKey,
    return_geometry:  'false',
    return_custom:    'false',
  })

  try {
    const res = await fetch(`${REGRID_BASE}?${params}`, {
      headers: { 'User-Agent': 'vantage-app/1.0 (property-enrichment)' },
    })
    if (!res.ok) return nullResult('not_found')

    const data = await res.json() as { features?: { properties: { fields: RegridFields } }[] }
    const fields = data.features?.[0]?.properties?.fields
    if (!fields) return nullResult('not_found')

    const currentYear = new Date().getFullYear()
    const rawYear = fields.yearbuilt ? parseInt(String(fields.yearbuilt)) : null
    const year_built = rawYear && rawYear > 1800 && rawYear <= currentYear ? rawYear : null
    const home_age = year_built ? currentYear - year_built : null

    return {
      year_built,
      home_age,
      parcel_id:     fields.parcelnumb  ?? null,
      land_acres:    fields.ll_gisacre  ?? null,
      property_type: fields.usedesc     ?? null,
      enrichment_status: 'found',
    }
  } catch {
    return nullResult('error')
  }
}

function nullResult(status: RegridResult['enrichment_status']): RegridResult {
  return { year_built: null, home_age: null, parcel_id: null, land_acres: null, property_type: null, enrichment_status: status }
}
