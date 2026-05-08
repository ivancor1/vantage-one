import type { Property, Storm } from './mock-data'

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
  const damage    = property.damageScore
  const severity  = storm.severity
  const roofAge   = roofAgeFactor(property.roofAge)
  const insurance = INSURANCE_SCORE[property.insuranceCarrier] ?? 5
  const claimType = CLAIM_TYPE_SCORE[property.claimType] ?? 5

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
