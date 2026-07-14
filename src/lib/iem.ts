import type { Storm, LsrReport } from './types'

type IemProps = {
  valid: string
  magf: number | null
  typetext: string
  wfo: string
  city: string | null
  county: string | null
  st: string
  unit: string | null
  source: string | null
  remark: string | null
}

type IemFeature = {
  geometry: { coordinates: [number, number] }
  properties: IemProps
}

function isHail(t: string) {
  return t.toUpperCase() === 'HAIL'
}

function isWind(t: string) {
  const u = t.toUpperCase()
  return u === 'TSTM WND GST' || u === 'TSTM WND DMG' || u === 'HIGH WIND' || u === 'WIND'
}

/** Vantage-derived severity score (0–10). Not an NWS product. */
function computeSeverity(hailInches: number, windMph: number): number {
  const hailScore = hailInches > 0 ? Math.min(10, hailInches * 3.5) : 0
  const windScore = windMph > 40 ? Math.min(10, (windMph - 40) / 6) : 0
  return Math.round(Math.max(hailScore, windScore) * 10) / 10
}

function distKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dlat = (lat2 - lat1) * 111
  const dlng = (lng2 - lng1) * 111 * Math.cos((lat1 * Math.PI) / 180)
  return Math.sqrt(dlat * dlat + dlng * dlng)
}

export async function fetchStorms(): Promise<Storm[]> {
  const now = new Date()
  const cutoff = new Date(now.getTime() - 72 * 60 * 60 * 1000)
  const fmt = (d: Date) => d.toISOString().slice(0, 19) + 'Z'

  const url =
    `https://mesonet.agron.iastate.edu/geojson/lsr.php` +
    `?sts=${fmt(cutoff)}&ets=${fmt(now)}&inc_ap=0`

  const res = await fetch(url, { next: { revalidate: 1800 } })
  if (!res.ok) throw new Error(`IEM LSR API returned ${res.status}`)

  const data = await res.json()
  const features = (data.features ?? []) as IemFeature[]

  // Filter to significant hail/wind events within the 72-hour window.
  // Belt-and-suspenders time check in case IEM returns out-of-window records.
  const cutoffMs = cutoff.getTime()
  const nowMs = now.getTime()

  const relevant = features.filter((f) => {
    const t = f.properties.typetext ?? ''
    const mag = f.properties.magf ?? 0
    const validMs = new Date(f.properties.valid ?? '').getTime()
    if (isNaN(validMs) || validMs < cutoffMs || validMs > nowMs) return false
    if (isHail(t)) return mag >= 0.5
    if (isWind(t)) return mag >= 50
    return false
  })

  // Group by WFO + UTC date. Each group becomes one Storm event.
  const groups = new Map<string, IemFeature[]>()
  for (const f of relevant) {
    const date = (f.properties.valid ?? '').slice(0, 10)
    const key = `${f.properties.wfo}-${date}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(f)
  }

  const storms: Storm[] = []

  for (const [id, gf] of groups) {
    const wfo = gf[0].properties.wfo

    // Build official LsrReport records from raw IEM features
    const reports: LsrReport[] = gf.map((f) => ({
      lat: f.geometry.coordinates[1],
      lng: f.geometry.coordinates[0],
      type: isHail(f.properties.typetext) ? 'HAIL' : 'WIND',
      magnitude: f.properties.magf ?? 0,
      units: f.properties.unit ?? (isHail(f.properties.typetext) ? 'Inch' : 'MPH'),
      city: f.properties.city ?? '',
      county: f.properties.county ?? '',
      state: f.properties.st ?? '',
      source: f.properties.source ?? '',
      wfo,
      remark: f.properties.remark ?? '',
      validTime: f.properties.valid ?? '',
    }))

    const hail = reports.filter((r) => r.type === 'HAIL').sort((a, b) => b.magnitude - a.magnitude)
    const wind = reports.filter((r) => r.type === 'WIND').sort((a, b) => b.magnitude - a.magnitude)

    const maxHail = hail[0]?.magnitude ?? 0
    const maxWind = wind[0]?.magnitude ?? 0
    const hero = hail[0] ?? wind[0] ?? reports[0]

    // Centroid of all report points
    const lat = reports.reduce((s, r) => s + r.lat, 0) / reports.length
    const lng = reports.reduce((s, r) => s + r.lng, 0) / reports.length

    // Vantage-derived fields — clearly modeled, not official NWS output
    const maxDist = Math.max(...reports.map((r) => distKm(lat, lng, r.lat, r.lng)), 5)
    const radiusMeters = Math.max(maxDist * 1000, 5000)
    const severity = computeSeverity(maxHail, maxWind)

    const date = gf[0]?.properties.valid?.slice(0, 10) ?? id.slice(id.indexOf('-') + 1)

    storms.push({
      id,
      wfo,
      date,
      hailSize: maxHail,
      windSpeed: maxWind,
      reportCount: reports.length,
      reports,
      // Vantage derived — centroid of report points, modeled radius, etc.
      name: `${hero?.county ?? ''} County, ${hero?.state ?? ''} Storm`,
      location: `${hero?.city ?? ''}, ${hero?.state ?? ''}`,
      lat,
      lng,
      severity,
      radiusMeters,
      affectedZips: [],
      hailCoreLat: hail[0]?.lat ?? lat,  // strongest hail report; centroid fallback for wind-only
      hailCoreLng: hail[0]?.lng ?? lng,
    })
  }

  return storms.sort((a, b) => b.severity - a.severity)
}
