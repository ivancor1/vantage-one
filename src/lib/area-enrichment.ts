export type AreaEnrichment = {
  censusPctPre2000: number | null
  censusPctPre1980: number | null
  areaHousingAgeLabel: 'older' | 'mixed' | 'newer' | null
  areaHousingAgeScore: number | null  // 0–10
  hailRiskScore: number | null        // HAIL_RISKS 0–100
  hailRiskLabel: string | null        // HAIL_RISKR verbatim
}

const NULL_ENRICHMENT: AreaEnrichment = {
  censusPctPre2000: null,
  censusPctPre1980: null,
  areaHousingAgeLabel: null,
  areaHousingAgeScore: null,
  hailRiskScore: null,
  hailRiskLabel: null,
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))
  return Promise.race([promise, timeout])
}

// Step 1: lat/lng → Census tract FIPS
export async function getCensusTract(lat: number, lng: number): Promise<{
  stateFp: string; countyFp: string; tract: string
} | null> {
  const url = `https://geocoding.geo.census.gov/geocoder/geographies/coordinates?x=${lng}&y=${lat}&benchmark=Public_AR_Current&vintage=ACS2022_Current&layers=Census%20Tracts&format=json`
  const res = await fetch(url, { headers: { 'User-Agent': 'vantage-app/1.0' } })
  if (!res.ok) {
    console.error('[census] Geocoder HTTP', res.status, url)
    return null
  }
  const data = await res.json()
  const tract = data?.result?.geographies?.['Census Tracts']?.[0]
  if (!tract) {
    console.error('[census] No tract returned. Keys:', JSON.stringify(Object.keys(data?.result?.geographies ?? {})))
    return null
  }
  console.log('[census] Tract found:', tract.STATE, tract.COUNTY, tract.TRACT)
  return {
    stateFp: tract.STATE,
    countyFp: tract.COUNTY,
    tract: tract.TRACT,
  }
}

// Step 2: fetch B25034 housing-age buckets for a Census tract
async function fetchCensusHousingAge(stateFp: string, countyFp: string, tract: string): Promise<{
  censusPctPre2000: number
  censusPctPre1980: number
  areaHousingAgeLabel: 'older' | 'mixed' | 'newer'
  areaHousingAgeScore: number
} | null> {
  const fields = [
    'B25034_001E', // total
    'B25034_002E', // 2020+
    'B25034_003E', // 2010-19
    'B25034_004E', // 2000-09
    'B25034_005E', // 1990-99
    'B25034_006E', // 1980-89
    'B25034_007E', // 1970-79
    'B25034_008E', // 1960-69
    'B25034_009E', // 1950-59
    'B25034_010E', // 1940-49
    'B25034_011E', // pre-1940
  ].join(',')

  // The ACS data API now REQUIRES a free key — without it, requests 302-redirect to a
  // "Missing Key" HTML page (which silently broke all housing-age enrichment). Get one free
  // at https://api.census.gov/data/key_signup.html and set CENSUS_API_KEY.
  const key = process.env.CENSUS_API_KEY
  const url = `https://api.census.gov/data/2022/acs/acs5?get=${fields}&for=tract:${tract}&in=state:${stateFp}%20county:${countyFp}${key ? `&key=${key}` : ''}`
  const res = await fetch(url, { headers: { 'User-Agent': 'vantage-app/1.0' } })
  if (!res.ok) {
    console.error('[census] ACS HTTP', res.status, url)
    return null
  }

  // Detect the missing-key redirect (and other HTML error pages) before trying to parse JSON.
  if (res.redirected || !(res.headers.get('content-type') ?? '').includes('json')) {
    console.error(key
      ? '[census] ACS returned non-JSON (unsupported FIPS or bad key)'
      : '[census] ACS requires a key — set CENSUS_API_KEY (free: https://api.census.gov/data/key_signup.html)')
    return null
  }

  // Census returns [[header_row], [data_row]].
  let rows: string[][]
  try {
    rows = await res.json()
  } catch {
    console.error('[census] ACS returned non-JSON', url)
    return null
  }
  if (!rows || rows.length < 2) return null

  const headers = rows[0]
  const values = rows[1]
  const get = (field: string) => parseInt(values[headers.indexOf(field)] ?? '0') || 0

  const total = get('B25034_001E')
  if (!total) return null

  // pre-2000: buckets 005 (1990-99) through 011 (pre-1940)
  const pre2000Count = [5, 6, 7, 8, 9, 10, 11]
    .map((n) => get(`B25034_00${n}E`))
    .reduce((a, b) => a + b, 0)

  // pre-1980: buckets 007 (1970-79) through 011 (pre-1940)
  const pre1980Count = [7, 8, 9, 10, 11]
    .map((n) => get(`B25034_00${n}E`))
    .reduce((a, b) => a + b, 0)

  const pre2000 = pre2000Count / total
  const pre1980 = pre1980Count / total

  const label: 'older' | 'mixed' | 'newer' =
    pre2000 > 0.60 ? 'older' :
    pre2000 > 0.35 ? 'mixed' : 'newer'

  const ageScore = Math.round(pre2000 * 10 * 10) / 10  // 0–10

  return { censusPctPre2000: pre2000, censusPctPre1980: pre1980, areaHousingAgeLabel: label, areaHousingAgeScore: ageScore }
}

// FEMA NRI hail risk by state abbreviation + county name
async function fetchFemaHailRisk(stateAbbr: string, countyName: string): Promise<{
  hailRiskScore: number
  hailRiskLabel: string
} | null> {
  // Strip "County" / "Parish" / etc. suffix — FEMA stores just the name
  const bare = countyName.replace(/\s+(County|Parish|Borough|Census Area|Municipality|City and Borough)$/i, '').trim()
  const where = encodeURIComponent(`STATEABBRV='${stateAbbr}' AND COUNTY='${bare}'`)
  const fields = 'COUNTY,STATEABBRV,HAIL_RISKS,HAIL_RISKR,HAIL_AFREQ'
  const url = `https://services.arcgis.com/XG15cJAlne2vxtgt/arcgis/rest/services/National_Risk_Index_Counties/FeatureServer/0/query?where=${where}&outFields=${fields}&returnGeometry=false&f=json&resultRecordCount=1`

  const res = await fetch(url, { headers: { 'User-Agent': 'vantage-app/1.0' } })
  if (!res.ok) return null
  const data = await res.json()
  const attrs = data?.features?.[0]?.attributes
  if (!attrs) return null

  return {
    hailRiskScore: attrs.HAIL_RISKS as number,
    hailRiskLabel: attrs.HAIL_RISKR as string,
  }
}

/**
 * Enrich a territory with Census ACS housing-age + FEMA hail-risk signals.
 * Both calls are non-blocking — failure returns null for that signal.
 * stateAbbr + countyName come from Nominatim reverse geocode (address.state / address.county).
 */
export async function enrichTerritory(
  lat: number,
  lng: number,
  stateAbbr: string,
  countyName: string,
): Promise<AreaEnrichment> {
  const [censusResult, femaResult] = await Promise.all([
    withTimeout(
      (async () => {
        const fips = await getCensusTract(lat, lng)
        if (!fips) return null
        return fetchCensusHousingAge(fips.stateFp, fips.countyFp, fips.tract)
      })(),
      12000  // two serial Census calls — geocoder alone can take 3-5s
    ),
    withTimeout(fetchFemaHailRisk(stateAbbr, countyName), 6000),
  ])

  return {
    censusPctPre2000: censusResult?.censusPctPre2000 ?? null,
    censusPctPre1980: censusResult?.censusPctPre1980 ?? null,
    areaHousingAgeLabel: censusResult?.areaHousingAgeLabel ?? null,
    areaHousingAgeScore: censusResult?.areaHousingAgeScore ?? null,
    hailRiskScore: femaResult?.hailRiskScore ?? null,
    hailRiskLabel: femaResult?.hailRiskLabel ?? null,
  }
}
