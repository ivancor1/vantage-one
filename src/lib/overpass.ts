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
  tags?: Record<string, string>
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

  const url =
    `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`

  const res = await fetch(url, {
    headers: { 'Accept': '*/*', 'User-Agent': 'vantage-app/1.0' },
    next: { revalidate: 21600 }, // 6-hour cache — building data is stable
  })

  if (!res.ok) throw new Error(`Overpass API returned ${res.status}`)

  const data = await res.json()
  const elements: OverpassElement[] = data.elements ?? []

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

  const query = `[out:json][timeout:30];
(
  way["building"]["addr:housenumber"]["addr:street"](around:${queryRadius},${lat},${lng});
  node["building"]["addr:housenumber"]["addr:street"](around:${queryRadius},${lat},${lng});
);
out center qt 50;`

  const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`
  const res = await fetch(url, {
    headers: { 'Accept': '*/*', 'User-Agent': 'vantage-app/1.0' },
  })

  if (!res.ok) throw new Error(`Overpass API returned ${res.status}`)

  const data = await res.json()
  const elements: OverpassElement[] = data.elements ?? []
  const currentYear = new Date().getFullYear()
  const buildings: TerritoryBuilding[] = []

  for (const el of elements) {
    const tags = el.tags ?? {}
    const address = formatAddress(tags)
    if (!address) continue

    const elLat = el.lat ?? el.center?.lat
    const elLng = el.lon ?? el.center?.lon
    if (elLat == null || elLng == null) continue

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
      baseScore: computeBaseScore(dist, radiusKm, roofAge ?? null),
    })
  }

  const sorted = buildings.sort((a, b) => b.baseScore - a.baseScore)
  territoryCache.set(cacheKey, { data: sorted, ts: Date.now() })
  return sorted
}
