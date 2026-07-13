import type { Property, Storm } from './types'

const INSURANCE_SCORE: Record<string, number> = {
  'State Farm':    10,
  'Allstate':      9,
  'Farmers':       8,
  'Nationwide':    8,
  'Liberty Mutual':7,
  'USAA':          6,
  'Progressive':   5,
}

const CLAIM_TYPE_SCORE: Record<string, number> = {
  'Wind/Hail': 10,
  'Hail Only':  9,
  'Wind Only':  6,
}

function roofAgeFactor(years: number): number {
  return Math.min(years * 0.65, 10)
}

export function computeLeadScore(property: Property, storm: Storm): number {
  const damage    = property.damageScore ?? 5
  const severity  = storm.severity
  const roofAge   = roofAgeFactor(property.roofAge ?? 0)
  const insurance = INSURANCE_SCORE[property.insuranceCarrier ?? ''] ?? 5
  const claimType = CLAIM_TYPE_SCORE[property.claimType ?? ''] ?? 5

  const raw =
    severity  * 0.30 +
    damage    * 0.35 +
    roofAge   * 0.20 +
    insurance * 0.10 +
    claimType * 0.05

  return Math.round(raw * 10)
}

export function leadScoreLabel(score: number): { label: string; cls: string } {
  if (score >= 80) return { label: 'CRITICAL', cls: 'text-status-critical' }
  if (score >= 65) return { label: 'HIGH',     cls: 'text-status-high' }
  if (score >= 50) return { label: 'ELEVATED', cls: 'text-vantage-yellow' }
  return               { label: 'STANDARD',   cls: 'text-vantage-muted' }
}

export function computeCompositeScore(signals: {
  stormSeverity?: number         // 0–10 (Vantage severity, encodes hail size via min(10, inches*3.5))
  distanceToHailCoreKm?: number  // km from lead to max-hail LSR report
  stormRadiusKm?: number         // storm radius, used for proximity + swath check
  stormProximity?: number        // 0–10 legacy fallback when no hail core data
  roofAge?: number               // years — only if OSM year_built present
  areaHousingAgeScore?: number   // 0–10 from Census ACS
  hailRiskScore?: number         // 0–100 from FEMA NRI
  visualRoofScore?: number       // 0–100 from OpenAI Vision
}): number {
  const ageComponent =
    signals.roofAge != null ? Math.min(10, signals.roofAge / 2) :
    signals.areaHousingAgeScore ?? 5

  const visualComponent = signals.visualRoofScore != null
    ? signals.visualRoofScore / 10 : null

  const hailContext = signals.hailRiskScore != null
    ? signals.hailRiskScore / 10 : 5

  let raw: number

  if (signals.stormSeverity != null) {
    // Hail core proximity — preferred over centroid-based stormProximity
    const coreProximity =
      signals.distanceToHailCoreKm != null && signals.stormRadiusKm != null
        ? Math.max(0, 10 * (1 - signals.distanceToHailCoreKm / Math.max(signals.stormRadiusKm, 0.1)))
        : signals.stormProximity ?? 5

    // Leads outside the 1.5× swath buffer get a penalty on storm contribution
    const insideSwath =
      signals.distanceToHailCoreKm == null || signals.stormRadiusKm == null ||
      signals.distanceToHailCoreKm <= signals.stormRadiusKm * 1.5

    const stormComponent =
      (signals.stormSeverity * 0.55 + coreProximity * 0.45) * (insideSwath ? 1.0 : 0.6)

    if (visualComponent != null) {
      raw = stormComponent * 0.40 + visualComponent * 0.20 + ageComponent * 0.25 + hailContext * 0.15
    } else {
      raw = stormComponent * 0.50 + ageComponent * 0.30 + hailContext * 0.20
    }
  } else {
    if (visualComponent != null) {
      raw = visualComponent * 0.45 + ageComponent * 0.35 + hailContext * 0.20
    } else {
      raw = ageComponent * 0.50 + hailContext * 0.50
    }
  }

  return Math.min(100, Math.round(raw * 10))
}

export function recomputeWithVisualScore(lead: {
  stormScore?: number
  baseScore: number
  roofAge?: number
  visualRoofScore: number  // 0–100
}): number {
  const ageScore = lead.roofAge ? Math.min(10, lead.roofAge / 2) : 5
  const visualComponent = lead.visualRoofScore / 10
  if (lead.stormScore != null) {
    const storm = (lead.stormScore / 100) * 10
    const raw = storm * 0.50 + visualComponent * 0.35 + ageScore * 0.15
    return Math.min(100, Math.round(raw * 10))
  }
  const raw = visualComponent * 0.50 + ageScore * 0.50
  return Math.min(100, Math.round(raw * 10))
}

export const STATUS_META: Record<
  string,
  { label: string; cls: string }
> = {
  new:           { label: 'New',               cls: 'bg-vantage-card text-vantage-muted border-vantage-bright' },
  knocked:       { label: 'Knocked',           cls: 'bg-blue-900/20 text-blue-400 border-blue-700/30' },
  interested:    { label: 'Interested',        cls: 'bg-vantage-yellow-dim text-vantage-yellow border-vantage-yellow/30' },
  inspection:    { label: 'Inspection Booked', cls: 'bg-status-high/15 text-status-high border-status-high/30' },
  claim:         { label: 'Claim Filed',       cls: 'bg-status-success/15 text-status-success border-status-success/30' },
  closed:        { label: 'Closed',            cls: 'bg-status-success/25 text-status-success border-status-success/40' },
  not_qualified: { label: 'Not Qualified',     cls: 'bg-status-critical/10 text-status-critical/60 border-status-critical/20' },
}
