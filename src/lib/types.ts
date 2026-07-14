export type LeadStatus =
  | 'new'
  | 'knocked'
  | 'interested'
  | 'inspection'
  | 'claim'
  | 'closed'
  | 'not_qualified'

/** A single NWS Local Storm Report point — all fields sourced directly from IEM/NWS. */
export type LsrReport = {
  // NWS official fields
  lat: number
  lng: number
  type: 'HAIL' | 'WIND'
  magnitude: number     // inches (hail) or mph (wind) — as reported
  units: string         // "Inch" | "MPH" etc, from NWS
  city: string
  county: string
  state: string
  source: string        // e.g. "Trained Spotter", "Public", "Law Enforcement"
  wfo: string           // NWS Weather Forecast Office issuing the report
  remark: string
  validTime: string     // ISO UTC timestamp from NWS
}

export type Storm = {
  id: string            // "{wfo}-{YYYY-MM-DD}" — Vantage grouping key

  // --- NWS Official Fields (aggregated from LSR reports) ---
  wfo: string           // NWS Weather Forecast Office
  date: string          // UTC date of earliest report (YYYY-MM-DD)
  hailSize: number      // Max reported hail diameter, inches
  windSpeed: number     // Max reported wind gust, mph
  reportCount: number   // Total LSR reports in this group
  reports: LsrReport[]

  // --- Vantage Derived Fields (not from NWS) ---
  name: string          // Generated from county/state of highest-magnitude report
  location: string      // Generated from city/state of highest-magnitude report
  lat: number           // Centroid of report points — not an official storm location
  lng: number           // Centroid of report points — not an official storm location
  severity: number      // Vantage severity score (0–10), computed from magnitude
  radiusMeters: number  // Modeled impact radius — not an official storm path
  affectedZips: string[]
  hailCoreLat: number   // lat of max-magnitude hail LSR report (centroid fallback if wind-only)
  hailCoreLng: number   // lng of max-magnitude hail LSR report
}

export type Lead = {
  id: string
  territoryId: string
  osmId: string
  address: string
  lat: number
  lng: number
  status: LeadStatus
  baseScore: number
  stormScore?: number
  leadScore: number       // stormScore if storm nearby, else baseScore
  nearestStormId?: string
  distanceToStormKm?: number
  distanceToTerritoryKm?: number
  yearBuilt?: number
  roofAge?: number   // age proxy capped at 20, derived from yearBuilt
  dataSource: string
  deletedAt?: string | null
  createdAt: string
  // Aerial roof-vulnerability read (imagery may predate the storm — a prior, not damage detection)
  satelliteUrl?: string
  visualRoofScore?: number   // 0–100 vulnerability, null until assessed
  aiNotes?: string
  aiAnalyzedAt?: string
  // Per-home hail evidence — IDW over real data points (see lib/hail.ts)
  spotterHailIn?: number     // inches, from NWS Local Storm Reports
  radarHailIn?: number       // inches, from NOAA SWDI NEXRAD signatures
  nearestReportKm?: number   // distance to closest real data point used
  insideHailSwath?: boolean  // true if a real data point lies within storm radius × 1.5
  // Roof size (OSM footprint)
  footprintSqm?: number
  // Area-level enrichment signals (Census ACS + FEMA NRI)
  areaHousingAgeLabel?: string              // 'older' | 'mixed' | 'newer'
  areaHousingAgeScore?: number             // 0–10
  historicalHailRiskScore?: number         // 0–100 (FEMA HAIL_RISKS)
  historicalHailRiskLabel?: string         // FEMA HAIL_RISKR verbatim
  scoreConfidence?: 'high' | 'medium' | 'low'
  // Enriched by joins at query time
  territoryValue?: string
  nearestStormName?: string
  nearestStormSeverity?: number
}

export type Property = {
  // Always present
  id: string
  stormId: string
  address: string
  lat: number
  lng: number
  leadScore: number      // Vantage computed
  status: LeadStatus
  // Optional — not available from all sources
  distanceKm?: number    // Distance from storm centroid, Vantage computed
  roofAge?: number       // Years since construction
  aiNotes?: string
  satelliteUrl?: string
  dataSource?: string    // e.g. "OpenStreetMap"
}
