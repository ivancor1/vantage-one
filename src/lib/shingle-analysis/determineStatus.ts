import type { EvidenceItem, RegionalNote, ShingleStatus } from './types'
import type { ReplacementResult } from './evidenceClassifier'

// Bug 3: only purchase-intent signals confirm a product is currently being sold.
// Generic marketing signals (spec sheet, learn more) exist on archived pages too.
const PURCHASE_SIGNALS = [
  'where to buy', 'find a contractor', 'find a professional',
  'add to cart', 'buy now', 'available now', 'currently available', 'in stock',
]

const PLANT_SERVICE_SIGNALS = ['plant service area', 'psa', 'service area']

// Full US state abbreviation list for city-state extraction
const ALL_STATES = 'AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY'

// Context keywords that signal a list of discontinued plant service areas follows
const DISC_CONTEXT_WORDS = [
  'will be discontinued', 'are discontinued', 'being discontinued',
  'discontinu', 'no longer be available', 'will not be',
]
// Context keywords that signal a list of active/remaining plant service areas follows
const ACTIVE_CONTEXT_WORDS = [
  'will remain', 'will continue to be', 'will still be available',
  'remain available', 'still available', 'remain active', 'will be available',
  'continue to be available',
]

function extractCitiesFromSegment(segment: string): string[] {
  const re = new RegExp(`([A-Z][a-zA-Z]+(?:\\s[A-Z][a-zA-Z]+)?)\\s+(${ALL_STATES})\\b`, 'g')
  const cities: string[] = []
  for (const m of segment.matchAll(re)) {
    cities.push(`${m[1]} ${m[2]}`)
  }
  return cities
}

function detectRegional(items: EvidenceItem[]): RegionalNote | null {
  const discontinuedIn: string[] = []
  const activeIn: string[] = []

  for (const item of items) {
    const combined = `${item.title} ${item.snippet}`
    const lower = combined.toLowerCase()
    const hasPlantSignal = PLANT_SERVICE_SIGNALS.some((s) => lower.includes(s))
    if (!hasPlantSignal) continue

    // Extract cities that appear after discontinuation context keywords
    for (const ctx of DISC_CONTEXT_WORDS) {
      const idx = lower.indexOf(ctx)
      if (idx === -1) continue
      const windowStart = idx + ctx.length
      const segment = combined.slice(windowStart, windowStart + 200)
      for (const city of extractCitiesFromSegment(segment)) {
        if (!discontinuedIn.includes(city)) discontinuedIn.push(city)
      }
    }

    // Extract cities that appear after active/remaining context keywords
    for (const ctx of ACTIVE_CONTEXT_WORDS) {
      const idx = lower.indexOf(ctx)
      if (idx === -1) continue
      const windowStart = idx + ctx.length
      const segment = combined.slice(windowStart, windowStart + 200)
      for (const city of extractCitiesFromSegment(segment)) {
        if (!activeIn.includes(city) && !discontinuedIn.includes(city)) {
          activeIn.push(city)
        }
      }
    }

    // Fallback: PSA language detected but city extraction found nothing
    if (discontinuedIn.length === 0 && activeIn.length === 0) {
      discontinuedIn.push('Some plant service areas (see source for details)')
    }
  }

  if (discontinuedIn.length === 0) return null
  return { discontinuedIn, activeIn }
}

type ScoreMap = { discontinued: number; active: number }

function scoreEvidence(items: EvidenceItem[], query: string): ScoreMap {
  let discontinued = 0
  let active = 0

  const queryLower = query.toLowerCase()
  const significantWords = queryLower.split(/\s+/).filter((w) => w.length >= 5)

  // Problem 5: only award baseline if the product name actually appears in that manufacturer page.
  // A generic Owens Corning newsroom page should not count as product evidence.
  function productMentionedIn(title: string, snippet: string): boolean {
    const combined = `${title} ${snippet}`.toLowerCase()
    if (combined.includes(queryLower)) return true
    return significantWords.some((w) => combined.includes(w))
  }

  // Bug 3: baseline fires on purchase signals OR a dedicated product-page URL.
  // Archived pages stay live for warranty reference but lack both signals.
  const hasMfgActiveSignal = (signals: string[]) =>
    signals.some((s) => PURCHASE_SIGNALS.includes(s)) || signals.includes('dedicated product page')

  const hasManufacturerProductPage = items.some(
    (item) =>
      item.sourceType === 'manufacturer_page' &&
      hasMfgActiveSignal(item.matchedSignals) &&
      productMentionedIn(item.title, item.snippet),
  )
  if (hasManufacturerProductPage) active = 4

  for (const item of items) {
    const combined = `${item.title} ${item.snippet}`.toLowerCase()
    const isDisc = item.matchedSignals.some((s) =>
      ['discontinued', 'no longer available', 'no longer sold', 'no longer manufactured', 'no longer produced', 'title: discontinuation'].includes(s)
    )
    const isMedDisc = !isDisc && item.matchedSignals.some((s) =>
      ['limited availability', 'special order only', 'out of production', 'replaced by', 'production paused', 'being phased out', 'title: manufacturer discontinued'].includes(s)
    )
    const isActive = item.matchedSignals.some((s) =>
      ['add to cart', 'in stock', 'buy now', 'available now', 'currently available'].includes(s)
    ) || (
      item.sourceType === 'manufacturer_page' &&
      hasMfgActiveSignal(item.matchedSignals) &&
      productMentionedIn(item.title, item.snippet)
    )
    const isMedActive = !isActive && item.matchedSignals.includes('price+sku listed')

    if (isDisc) {
      if (item.sourceType === 'manufacturer_psa') discontinued += 6
      else if (item.sourceType === 'manufacturer_page') discontinued += 4
      else if (item.sourceType === 'distributor') discontinued += 3
      else discontinued += 1
    } else if (isMedDisc) {
      if (item.sourceType === 'manufacturer_psa') discontinued += 3
      else if (item.sourceType === 'manufacturer_page') discontinued += 2
      else discontinued += 1
    }

    if (isActive) {
      if (item.sourceType === 'manufacturer_page') active += 4
      else if (item.sourceType === 'distributor') active += 3
      else if (item.sourceType === 'retailer') active += 2
    } else if (isMedActive) {
      active += 1
    }

    // Explicit discontinued mention on retailer page (rare but valid)
    if (item.sourceType === 'retailer' && combined.includes('discontinued')) {
      discontinued += 2
    }
  }

  return { discontinued, active }
}

function hasLimitedSignal(items: EvidenceItem[]): boolean {
  return items.some((item) => {
    const combined = `${item.title} ${item.snippet}`.toLowerCase()
    return combined.includes('special order only') || combined.includes('limited batches') || combined.includes('limited availability')
  })
}

// Confidence is computed as a single final pass after status is determined — not inline per branch.
function computeConfidence(items: EvidenceItem[], totalScore: number): 'high' | 'medium' | 'low' {
  const hasStrongAuthoritativeSource = items.some(
    (item) =>
      item.strength === 'strong' &&
      (item.sourceType === 'manufacturer_psa' || item.sourceType === 'manufacturer_page'),
  )
  const hasMediumOrStrongEvidence = items.some(
    (item) => item.strength === 'strong' || item.strength === 'medium',
  )
  if (totalScore >= 6 && hasStrongAuthoritativeSource) return 'high'
  if (totalScore >= 3 && hasMediumOrStrongEvidence) return 'medium'
  return 'low'
}

export type StatusDecision = {
  status: ShingleStatus
  confidence: 'high' | 'medium' | 'low'
  reasoning: string[]
  replacedBy: string | null
  replacedByNote: string | null
  regionalNote: RegionalNote | null
}

export function determineStatus(items: EvidenceItem[], replacementResult: ReplacementResult | null, query: string): StatusDecision {
  const replacedBy = replacementResult?.name ?? null
  const regionalNote = detectRegional(items)
  const { discontinued: baseDiscScore, active: activeScore } = scoreEvidence(items, query)

  // Wire replacement detection into scoring: a manufacturer successor page is a strong discontinuation signal
  let discontinuedScore = baseDiscScore
  if (replacementResult?.fromManufacturer) {
    discontinuedScore += 4
  }

  const totalScore = discontinuedScore + activeScore
  const reasoning: string[] = []

  reasoning.push(`Discontinued signal score: ${discontinuedScore}, Active signal score: ${activeScore}`)
  if (replacementResult?.fromManufacturer) {
    reasoning.push(`Manufacturer has a successor product (${replacementResult.name}) — original is likely discontinued (+4 discontinued points)`)
  }

  // Determine status first, then compute confidence as a single final pass.
  let status: ShingleStatus
  let selectedReplacedBy: string | null = replacedBy
  let selectedRegionalNote: RegionalNote | null = null

  if (regionalNote) {
    reasoning.push('Plant service area language detected in an official manufacturer PSA — this overrides the overall score and triggers Regional status')
    reasoning.push('Product is active in some regions but discontinued in others')
    status = 'regional'
    selectedRegionalNote = regionalNote
  } else if (discontinuedScore >= 5 && discontinuedScore > activeScore + 2) {
    reasoning.push(`Strong discontinued evidence (score ${discontinuedScore}) outweighs active evidence (score ${activeScore})`)
    status = 'discontinued'
  } else if (activeScore >= 4 && activeScore > discontinuedScore + 2) {
    reasoning.push(`Strong active evidence (score ${activeScore}) outweighs discontinued evidence (score ${discontinuedScore})`)
    status = 'active'
    selectedReplacedBy = null
  } else if (discontinuedScore >= 3 && activeScore <= 1) {
    reasoning.push(`Moderate discontinued signal (score ${discontinuedScore}) with little active counter-evidence`)
    status = 'discontinued'
  } else if (activeScore === 0 && discontinuedScore >= 2) {
    // Guard: if a manufacturer page exists that mentions this product, there IS active evidence —
    // it just isn't scoring (e.g. due to missing purchase signals). Safer to return Unknown.
    const qLower = query.toLowerCase()
    const qSigWords = qLower.split(/\s+/).filter((w) => w.length >= 5)
    const hasMfgPageWithProduct = items.some((item) => {
      if (item.sourceType !== 'manufacturer_page') return false
      const c = `${item.title} ${item.snippet}`.toLowerCase()
      return c.includes(qLower) || qSigWords.some((w) => c.includes(w))
    })
    if (hasMfgPageWithProduct) {
      reasoning.push('Manufacturer page evidence present but no clear purchase or discontinued signal — insufficient data to determine status')
      status = 'unknown'
      selectedReplacedBy = null
    } else {
      reasoning.push(`No active evidence found — ${discontinuedScore} discontinued points with nothing to dispute them`)
      status = 'discontinued'
    }
  } else if (hasLimitedSignal(items)) {
    reasoning.push('Sources mention "special order only" or limited batch availability')
    status = 'limited'
  } else {
    if (items.length === 0) {
      reasoning.push('No search results found for this product')
    } else {
      reasoning.push(`Found ${items.length} sources but no conclusive discontinued or active signal`)
    }
    status = 'unknown'
    selectedReplacedBy = null
  }

  const confidence = computeConfidence(items, totalScore)
  return buildDecision(status, confidence, reasoning, selectedReplacedBy, selectedRegionalNote)
}

function buildDecision(
  status: ShingleStatus,
  confidence: 'high' | 'medium' | 'low',
  reasoning: string[],
  replacedBy: string | null,
  regionalNote: RegionalNote | null,
): StatusDecision {
  const replacedByNote = replacedBy
    ? `${replacedBy} is a different formulation and may not be an exact match for repair or insurance purposes.`
    : null
  return { status, confidence, reasoning, replacedBy, replacedByNote, regionalNote }
}
