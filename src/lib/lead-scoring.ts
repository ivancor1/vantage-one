export function leadScoreLabel(score: number): { label: string; cls: string } {
  if (score >= 80) return { label: 'CRITICAL', cls: 'text-status-critical' }
  if (score >= 65) return { label: 'HIGH',     cls: 'text-status-high' }
  if (score >= 50) return { label: 'ELEVATED', cls: 'text-vantage-yellow' }
  return               { label: 'STANDARD',   cls: 'text-vantage-muted' }
}

/**
 * The one lead score. Everything real, nothing modeled beyond interpolation:
 *  - spotterHailIn / radarHailIn — per-home IDW estimates from NWS reports + NOAA radar
 *    signatures (see lib/hail.ts). Two independent sources agreeing is the strongest
 *    evidence this tool can honestly claim.
 *  - vulnerabilityScore — aerial wear/age read (imagery may predate the storm; it is a
 *    damage-PROBABILITY prior, never damage detection).
 *  - roofAge / areaHousingAgeScore / hailRiskScore — assessor-or-OSM age, Census area age,
 *    FEMA historical hail risk.
 * With hail evidence: hail dominates (worn old roof under confirmed hail = top of list).
 * Without: age + FEMA context only, and the UI says so plainly.
 */
export function computeCompositeScore(signals: {
  spotterHailIn?: number        // inches, IDW of NWS Local Storm Reports
  radarHailIn?: number          // inches, IDW of NOAA SWDI nx3hail signatures
  vulnerabilityScore?: number   // 0–100 aerial roof-vulnerability read
  roofAge?: number              // years — OSM tag or county assessor
  areaHousingAgeScore?: number  // 0–10 from Census ACS (tract-level)
  hailRiskScore?: number        // 0–100 from FEMA NRI (county-level)
}): number {
  const age =
    signals.roofAge != null ? Math.min(10, signals.roofAge / 2) :
    signals.areaHousingAgeScore ?? 5

  const fema = signals.hailRiskScore != null ? signals.hailRiskScore / 10 : 5
  const vuln = signals.vulnerabilityScore != null ? signals.vulnerabilityScore / 10 : null

  const spotter = signals.spotterHailIn ?? 0
  const radar = signals.radarHailIn ?? 0

  let raw: number
  if (spotter > 0 || radar > 0) {
    let hail = Math.min(10, Math.max(spotter, radar) * 3.5)
    if (spotter > 0 && radar > 0) hail = Math.min(10, hail + 1) // independent sources corroborate
    raw = vuln != null
      ? hail * 0.60 + vuln * 0.15 + age * 0.15 + fema * 0.10
      : hail * 0.60 + age * 0.30 + fema * 0.10
  } else {
    raw = vuln != null
      ? vuln * 0.30 + age * 0.40 + fema * 0.30
      : age * 0.50 + fema * 0.50
    // PRODUCT RULE: without hail evidence a lead can never reach the HIGH band (65+).
    // Age/context alone must not outrank a home with confirmed hail overhead.
    raw = Math.min(raw, 6.0)
  }

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
