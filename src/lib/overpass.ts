import type { Property } from './types'

const stormCache = new Map<string, { data: Property[]; ts: number }>()
const territoryCache = new Map<string, { data: TerritoryBuilding[]; ts: number }>()
const CACHE_TTL_MS = 6 * 60 * 60 * 1000

export type TerritoryBuilding = {
  osmId: string
  address: string
  lat: number
  lng: number
  distanceKm: number
  yearBuilt?: number
  roofAge?: number   // capped at 20 for scoring — use yearBuilt for display
  footprintSqm?: number // OSM building footprint area — roof/job size estimate
  baseScore: number
}

function computeBaseScore(distanceKm: number, radiusKm: number, roofAge: number | null): number {
  const proximityScore = Math.max(0, 10 * (1 - distanceKm / Math.max(radiusKm, 0.1)))
  const ageScore = roofAge ? Math.min(10, roofAge / 2) : 5
  const raw = proximityScore * 0.5 + ageScore * 0.5
  return Math.min(100, Math.round(raw * 10))
}

type OverpassElement = {
  type: 'node' | 'way' | 'relation'
  id: number
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  geometry?: { lat: number; lon: number }[]  // present with `out geom` (ways)
  tags?: Record<string, string>
}

/** Shoelace area of a building footprint polygon, in m² (lat/lng → local meters). */
function polygonAreaSqm(geom: { lat: number; lon: number }[]): number {
  if (geom.length < 3) return 0
  const lat0 = (geom[0].lat * Math.PI) / 180
  const mPerDegLat = 111_320
  const mPerDegLng = 111_320 * Math.cos(lat0)
  let area = 0
  for (let i = 0; i < geom.length; i++) {
    const a = geom[i]
    const b = geom[(i + 1) % geom.length]
    area += (a.lon * mPerDegLng) * (b.lat * mPerDegLat) - (b.lon * mPerDegLng) * (a.lat * mPerDegLat)
  }
  return Math.abs(area / 2)
}

function formatAddress(tags: Record<string, string>): string {
  const street =
    tags['addr:housenumber'] && tags['addr:street']
      ? `${tags['addr:housenumber']} ${tags['addr:street']}`
      : tags['addr:street'] ?? null
  const city = tags['addr:city'] ?? null
  const state = tags['addr:state'] ?? null
  const zip = tags['addr:postcode'] ?? null
  return [street, city, state && zip ? `${state} ${zip}` : state ?? zip]
    .filter(Boolean)
    .join(', ')
}

function distKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dlat = (lat2 - lat1) * 111
  const dlng = (lng2 - lng1) * 111 * Math.cos((lat1 * Math.PI) / 180)
  return Math.sqrt(dlat * dlat + dlng * dlng)
}

// The public Overpass servers 504/429 under load. Try the main instance, then a mirror,
// with backoff — a scan that fails because a shared server hiccuped is not acceptable UX.
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass-api.de/api/interpreter',
]

async function fetchOverpass(query: string): Promise<{ elements: OverpassElement[] }> {
  let lastErr: Error = new Error('Overpass unavailable')
  for (let attempt = 0; attempt < OVERPASS_ENDPOINTS.length; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, attempt * 3000))
    try {
      const res = await fetch(`${OVERPASS_ENDPOINTS[attempt]}?data=${encodeURIComponent(query)}`, {
        headers: { 'Accept': '*/*', 'User-Agent': 'vantage-app/1.0' },
        // Must exceed the server-side [timeout:60] so the server's own timeout (and our
        // mirror fallback) fires before the client aborts.
        signal: AbortSignal.timeout(75_000),
      })
      if (!res.ok) { lastErr = new Error(`Overpass ${res.status}`); continue }
      const data = await res.json()
      // Overpass can 200 with zero elements + a "remark" when it ran out of time — retry those
      if (data?.remark && !(data.elements ?? []).length) {
        lastErr = new Error(`Overpass remark: ${data.remark}`)
        continue
      }
      return { elements: (data.elements ?? []) as OverpassElement[] }
    } catch (err) {
      lastErr = err as Error
    }
  }
  throw lastErr
}

/** Vantage lead score for an OSM property. Not an official damage assessment. */
function computeLeadScore(
  stormSeverity: number,
  distanceKm: number,
  radiusKm: number,
  buildYear: number | null
): number {
  const proximityScore = Math.max(0, 10 * (1 - distanceKm / Math.max(radiusKm, 0.1)))
  const currentYear = new Date().getFullYear()
  const ageScore = buildYear ? Math.min(10, (currentYear - buildYear) / 2) : 5
  const raw = stormSeverity * 0.5 + proximityScore * 0.35 + ageScore * 0.15
  return Math.min(100, Math.round(raw * 10))
}

export async function fetchPropertiesNearStorm(
  stormId: string,
  stormLat: number,
  stormLng: number,
  radiusMeters: number,
  severity: number
): Promise<Property[]> {
  const cached = stormCache.get(stormId)
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.data

  // Cap at 8 km — beyond that, door-knocking is impractical and the query gets slow
  const queryRadius = Math.min(radiusMeters, 8000)
  const radiusKm = queryRadius / 1000

  const query = `[out:json][timeout:25];
(
  way["building"]["addr:housenumber"]["addr:street"](around:${queryRadius},${stormLat},${stormLng});
  node["building"]["addr:housenumber"]["addr:street"](around:${queryRadius},${stormLat},${stormLng});
);
out center qt 75;`

  const { elements } = await fetchOverpass(query)

  const properties: Property[] = []

  for (const el of elements) {
    const tags = el.tags ?? {}
    const address = formatAddress(tags)
    if (!address) continue

    const lat = el.lat ?? el.center?.lat
    const lng = el.lon ?? el.center?.lon
    if (lat == null || lng == null) continue

    const dist = distKm(stormLat, stormLng, lat, lng)

    // Build year from OSM tags (not always present)
    const rawYear =
      tags['start_date']?.slice(0, 4) ??
      tags['building:start_date']?.slice(0, 4) ??
      tags['construction_date']?.slice(0, 4) ??
      null
    const buildYear = rawYear ? parseInt(rawYear) : null
    const currentYear = new Date().getFullYear()
    const roofAge = buildYear && buildYear > 1800 && buildYear <= currentYear
      ? currentYear - buildYear
      : undefined

    properties.push({
      id: `osm-${el.type}-${el.id}`,
      stormId,
      address,
      lat,
      lng,
      leadScore: computeLeadScore(severity, dist, radiusKm, buildYear),
      status: 'new',
      distanceKm: Math.round(dist * 10) / 10,
      roofAge,
      dataSource: 'OpenStreetMap',
    })
  }

  const sorted = properties.sort((a, b) => b.leadScore - a.leadScore)
  stormCache.set(stormId, { data: sorted, ts: Date.now() })
  return sorted
}

/** Fetch all addressed buildings within a territory radius. No storm data — base scores only. */
export async function fetchBuildingsInTerritory(
  lat: number,
  lng: number,
  radiusMeters: number,
): Promise<TerritoryBuilding[]> {
  const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)},${radiusMeters}`
  const cached = territoryCache.get(cacheKey)
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.data

  // Hard cap: 10 miles = 16,093 m
  const queryRadius = Math.min(radiusMeters, 16093)
  const radiusKm = queryRadius / 1000

  // `out center` returns just a centroid per building — light enough to pull EVERY addressed
  // home in a ~3 mi territory (~1.8k) in one shot. `out geom` (full polygons, needed for the
  // footprint/roofing-squares estimate) is ~20× heavier and stalls the public servers past
  // ~400 homes, which is what made the map look sparse and qt-lopsided. Density is the point
  // here; footprint is dropped for territory scrapes. Ceiling is OSM address coverage
  // (~60–70 addressed homes/sq mi in most US suburbs).
  const query = `[out:json][timeout:60];
(
  way["building"]["addr:housenumber"]["addr:street"](around:${queryRadius},${lat},${lng});
  node["building"]["addr:housenumber"]["addr:street"](around:${queryRadius},${lat},${lng});
);
out center qt 2000;`

  const { elements } = await fetchOverpass(query)
  const currentYear = new Date().getFullYear()
  const buildings: TerritoryBuilding[] = []

  for (const el of elements) {
    const tags = el.tags ?? {}
    const address = formatAddress(tags)
    if (!address) continue

    // `out geom` gives way vertices (no center) — use the vertex mean as the point
    const geom = el.geometry?.length ? el.geometry : undefined
    const elLat = el.lat ?? el.center?.lat ??
      (geom ? geom.reduce((s, p) => s + p.lat, 0) / geom.length : undefined)
    const elLng = el.lon ?? el.center?.lon ??
      (geom ? geom.reduce((s, p) => s + p.lon, 0) / geom.length : undefined)
    if (elLat == null || elLng == null) continue

    const footprint = geom ? Math.round(polygonAreaSqm(geom)) : undefined

    const dist = distKm(lat, lng, elLat, elLng)

    const rawYear =
      tags['start_date']?.slice(0, 4) ??
      tags['building:start_date']?.slice(0, 4) ??
      tags['construction_date']?.slice(0, 4) ??
      tags['year_of_construction']?.slice(0, 4) ??
      null
    const buildYear = rawYear ? parseInt(rawYear) : null
    const yearBuilt = buildYear && buildYear > 1800 && buildYear <= currentYear ? buildYear : undefined
    // Cap at 20 for scoring — most roofs replaced by then; older ages aren't more predictive
    const roofAge = yearBuilt ? Math.min(currentYear - yearBuilt, 20) : undefined

    buildings.push({
      osmId: `${el.type}-${el.id}`,
      address,
      lat: elLat,
      lng: elLng,
      distanceKm: Math.round(dist * 10) / 10,
      yearBuilt,
      roofAge,
      // Ignore implausibly small polygons (sheds, bad tags)
      footprintSqm: footprint && footprint >= 40 ? footprint : undefined,
      baseScore: computeBaseScore(dist, radiusKm, roofAge ?? null),
    })
  }

  const sorted = buildings.sort((a, b) => b.baseScore - a.baseScore)
  territoryCache.set(cacheKey, { data: sorted, ts: Date.now() })
  return sorted
}
