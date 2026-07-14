// Real per-home hail evidence from two independent public sources:
//   1. NWS Local Storm Reports — spotters/sheriffs/public report hail size to the National
//      Weather Service; already ingested with each storm (see iem.ts, storm.reports).
//   2. NOAA NCEI Severe Weather Data Inventory (SWDI) — NEXRAD radar hail signatures
//      (dataset nx3hail): per-point max estimated size, free, no API key, ~1-day lag.
// Each home gets an inverse-distance-weighted estimate over every nearby real data point —
// no single "hail core", nothing modeled beyond the interpolation itself.

export type HailPoint = { lat: number; lng: number; inches: number }

export type HailEstimate = {
  hailInches: number   // IDW-estimated hail size at the home, inches
  nearestKm: number    // distance to the closest real data point used
  n: number            // how many real points informed the estimate
}

/** Flat-earth distance in km — fine at door-knocking scales. */
export function distKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dlat = (lat2 - lat1) * 111
  const dlng = (lng2 - lng1) * 111 * Math.cos((lat1 * Math.PI) / 180)
  return Math.sqrt(dlat * dlat + dlng * dlng)
}

/**
 * Inverse-distance-weighted hail estimate at (lat, lng) from real report/signature points.
 * p=2 with a 0.5 km floor so a report on the doorstep doesn't blow up the weights.
 * Returns null when there are no usable points — callers treat that as "no hail signal".
 */
export function interpolateHail(points: HailPoint[], lat: number, lng: number): HailEstimate | null {
  const pts = points.filter((p) => p.inches > 0)
  if (!pts.length) return null

  let wSum = 0
  let vSum = 0
  let nearest = Infinity
  for (const p of pts) {
    const d = distKm(lat, lng, p.lat, p.lng)
    if (d < nearest) nearest = d
    const dw = Math.max(d, 0.5)
    const w = 1 / (dw * dw)
    wSum += w
    vSum += w * p.inches
  }

  return {
    hailInches: Math.round((vSum / wSum) * 100) / 100,
    nearestKm: Math.round(nearest * 10) / 10,
    n: pts.length,
  }
}

// ---- NOAA SWDI nx3hail (radar hail signatures) ----

const SWDI_BASE = 'https://www.ncei.noaa.gov/swdiws/json/nx3hail'
const swdiCache = new Map<string, { pts: HailPoint[]; ts: number }>()
const SWDI_CACHE_TTL_MS = 6 * 60 * 60 * 1000
const MIN_RADAR_SIZE_IN = 0.75 // below this, radar signatures are rarely claim-relevant

export type Bbox = { w: number; s: number; e: number; n: number }

/** Bounding box around a center point, half-width in km (capped — SWDI queries stay small). */
export function bboxAround(lat: number, lng: number, halfWidthKm: number): Bbox {
  const hw = Math.min(halfWidthKm, 60)
  const dLat = hw / 111
  const dLng = hw / (111 * Math.max(Math.cos((lat * Math.PI) / 180), 0.2))
  return { w: lng - dLng, s: lat - dLat, e: lng + dLng, n: lat + dLat }
}

/**
 * Fetch NEXRAD hail signatures from NOAA SWDI for a bbox and date range (inclusive start,
 * exclusive-ish end — pass storm date and date+2d to cover UTC spillover).
 * Radar is an ENHANCER: any failure returns [] and the pipeline continues on spotter data.
 */
export async function fetchRadarHail(bbox: Bbox, startDate: string, endDate: string): Promise<HailPoint[]> {
  const fmt = (d: string) => d.replaceAll('-', '')
  const key = `${fmt(startDate)}:${fmt(endDate)}|${bbox.w.toFixed(2)},${bbox.s.toFixed(2)},${bbox.e.toFixed(2)},${bbox.n.toFixed(2)}`
  const cached = swdiCache.get(key)
  if (cached && Date.now() - cached.ts < SWDI_CACHE_TTL_MS) return cached.pts

  try {
    const url = `${SWDI_BASE}/${fmt(startDate)}:${fmt(endDate)}?bbox=${bbox.w.toFixed(4)},${bbox.s.toFixed(4)},${bbox.e.toFixed(4)},${bbox.n.toFixed(4)}`
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) })
    if (!res.ok) throw new Error(`SWDI ${res.status}`)
    const data = await res.json()

    const pts: HailPoint[] = []
    for (const row of data?.result ?? []) {
      const m = /POINT \(([-\d.]+) ([-\d.]+)\)/.exec(row.SHAPE ?? '')
      const size = parseFloat(row.MAXSIZE)
      if (!m || !Number.isFinite(size) || size < MIN_RADAR_SIZE_IN) continue
      pts.push({ lng: parseFloat(m[1]), lat: parseFloat(m[2]), inches: size })
    }

    swdiCache.set(key, { pts, ts: Date.now() })
    return pts
  } catch (err) {
    console.warn('[swdi] radar hail fetch failed (continuing on spotter data):', (err as Error).message)
    return []
  }
}

/** Storm date string (YYYY-MM-DD) → [start, end] covering UTC spillover into the next day. */
export function stormDateRange(date: string): [string, string] {
  const d = new Date(`${date}T00:00:00Z`)
  const end = new Date(d.getTime() + 2 * 24 * 60 * 60 * 1000)
  return [date, end.toISOString().slice(0, 10)]
}
