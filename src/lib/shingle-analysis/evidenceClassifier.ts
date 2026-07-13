import type { SearchResult } from './searchProvider'
import type { EvidenceItem, EvidenceStrength, SourceType } from './types'

const MANUFACTURER_DOMAINS = [
  'certainteed.com', 'gaf.com', 'owenscorning.com', 'iko.com',
  'tamko.com', 'atlasroofing.com', 'malarkeyroofing.com',
]
const DISTRIBUTOR_DOMAINS = [
  'abcsupply.com', 'becn.com', 'srsdistribution.com',
  'roofingsupplygroup.com', 'roofhub.com',
]
const RETAILER_DOMAINS = ['homedepot.com', 'lowes.com', 'menards.com']

const STRONG_DISC_SIGNALS = [
  'discontinued', 'no longer available', 'no longer sold',
  'no longer manufactured', 'no longer produced',
]
const MEDIUM_DISC_SIGNALS = [
  'limited availability', 'special order only', 'out of production',
  'replaced by', 'production paused', 'being phased out',
]
const WEAK_DISC_SIGNALS = ['out of stock', 'limited quantities', 'hard to find']

const STRONG_ACTIVE_SIGNALS = ['add to cart', 'in stock', 'buy now', 'available now', 'currently available']

export const MANUFACTURER_ACTIVE_SIGNALS = [
  '#1-selling', "america's #1", 'best-selling', 'now available',
  'new colors', 'launches', 'expands', 'available in', 'built to last',
  'where to buy', 'find a contractor', 'find a professional',
  'spec sheet', 'data sheet', 'product data', 'technical data',
  'learn more', 'view product',
]

const PRICE_PATTERN = /\$\d+(?:\.\d{2})?|\d+(?:\.\d{2})?\s*(?:per|\/)\s*(?:sq(?:uare)?|bundle|piece|pc)/i
const SKU_PATTERN   = /(?:sku|item\s*[#no]|model\s*[#no]|product\s*id|upc)[:\s#.]+[a-z0-9-]{3,}/i

function hasPriceAndSku(text: string): boolean {
  return PRICE_PATTERN.test(text) && SKU_PATTERN.test(text)
}

const PSA_SIGNALS = [
  'product service announcement', 'psa', 'plant service area',
  'discontinuation notice', 'discontinuation letter',
]

// Problem 2: replacement signal words that indicate context, not actual "replaced by [product]"
const REPLACEMENT_SIGNALS = ['replaced by', 'successor', 'new formulation', 'now called', 'replacement product']

// Problem 3: results must mention shingle/roofing terminology to be relevant
const SHINGLE_RELEVANCE_TERMS = [
  'shingle', 'asphalt', '3-tab', 'architectural shingle', 'roof shingle', 'roofing product',
]

// Manufacturer name words used to isolate the product-line portion of a query
const MFG_NAME_WORDS = new Set(['certainteed', 'owens', 'corning', 'malarkey', 'tamko', 'atlasroofing', 'atlas'])

// Phrases that unambiguously identify off-topic siding/other product content
const SIDING_REJECT_PHRASES = ['siding products group', 'siding discontinuation', 'vinyl siding group']

function isRelevantResult(title: string, content: string): boolean {
  const combined = `${title} ${content}`.toLowerCase()
  const titleLower = title.toLowerCase()
  // Reject pages about siding products that happen to mention shingles in navigation
  if (SIDING_REJECT_PHRASES.some((p) => combined.includes(p))) return false
  if (titleLower.includes('siding') && !titleLower.includes('shingle') && !titleLower.includes('roofing')) return false
  return SHINGLE_RELEVANCE_TERMS.some((t) => combined.includes(t))
}

// Bug 2: a dedicated product page has the product name in the URL path, not just the domain.
// Distinguishes certainteed.com/xt-25 (product page) from certainteed.com/news (general page).
function isDedicatedProductPage(url: string, query: string): boolean {
  try {
    const path = new URL(url).pathname.toLowerCase()
    const productWords = query.toLowerCase().split(/\s+/).filter((w) => !MFG_NAME_WORDS.has(w))
    return productWords.some((w) => {
      if (w.length >= 4) return path.includes(w)
      // Short codes like "xt" or "hd": match only at path segment boundaries (e.g. "xt-25")
      return path.split('/').some((seg) => seg === w || seg.startsWith(`${w}-`) || seg.endsWith(`-${w}`))
    })
  } catch {
    return false
  }
}

// Bug 1: manufacturer pages must mention the specific product being searched.
// Filters out siding, insulation, and other off-topic manufacturer pages that share navigation text.
function isMfgPageRelevant(combined: string, query: string): boolean {
  const lower = combined.toLowerCase()
  const productWords = query.toLowerCase().split(/\s+/)
    .filter((w) => w.length >= 4 && !MFG_NAME_WORDS.has(w))
  if (productWords.length === 0) return SHINGLE_RELEVANCE_TERMS.some((t) => lower.includes(t))
  return productWords.some((w) => lower.includes(w))
}

export function cleanContent(raw: string): string {
  return raw
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[.*?\]\(.*?\)/g, '')
    .replace(/data:image\/[^)]+\)/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 2000)
}

function isContextualMatch(snippet: string, query: string, signal: string): boolean {
  const lower = snippet.toLowerCase()
  const idx = lower.indexOf(signal)
  if (idx === -1) return false

  const queryLower = query.toLowerCase()
  let productIdx = lower.indexOf(queryLower)

  if (productIdx === -1) {
    const words = queryLower.split(/\s+/).filter((w) => w.length >= 5)
    for (const word of words) {
      productIdx = lower.indexOf(word)
      if (productIdx !== -1) break
    }
  }

  if (productIdx === -1) return false
  return Math.abs(idx - productIdx) < 150
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '')
  } catch {
    return url
  }
}

function classifySourceType(url: string, combined: string): SourceType {
  const domain = getDomain(url)
  const lower = combined.toLowerCase()

  if (PSA_SIGNALS.some((s) => lower.includes(s))) return 'manufacturer_psa'
  if (MANUFACTURER_DOMAINS.some((d) => domain.includes(d))) return 'manufacturer_page'
  if (DISTRIBUTOR_DOMAINS.some((d) => domain.includes(d))) return 'distributor'
  if (RETAILER_DOMAINS.some((d) => domain.includes(d))) return 'retailer'
  return 'contractor_blog'
}

function detectSignals(combined: string, query: string, sourceType: SourceType): {
  discontinuedStrength: EvidenceStrength | null
  activeStrength: EvidenceStrength | null
  matchedSignals: string[]
} {
  const lower = combined.toLowerCase()
  const matched: string[] = []

  const hasStrongDisc = STRONG_DISC_SIGNALS.filter((s) =>
    lower.includes(s) && isContextualMatch(combined, query, s)
  )
  const hasMedDisc = MEDIUM_DISC_SIGNALS.filter((s) => lower.includes(s))
  const hasWeakDisc = WEAK_DISC_SIGNALS.filter((s) => lower.includes(s))

  const hasStrongActive = STRONG_ACTIVE_SIGNALS.filter((s) => lower.includes(s))

  const hasManufacturerSignals = sourceType === 'manufacturer_page'
    ? MANUFACTURER_ACTIVE_SIGNALS.filter((s) => lower.includes(s))
    : []

  matched.push(
    ...hasStrongDisc, ...hasMedDisc, ...hasWeakDisc,
    ...hasStrongActive, ...hasManufacturerSignals,
  )

  let discontinuedStrength: EvidenceStrength | null = null
  if (hasStrongDisc.length > 0) discontinuedStrength = 'strong'
  else if (hasMedDisc.length > 0) discontinuedStrength = 'medium'
  else if (hasWeakDisc.length > 0) discontinuedStrength = 'weak'

  let activeStrength: EvidenceStrength | null = null
  if (hasStrongActive.length > 0) {
    activeStrength = 'strong'
  } else if (hasManufacturerSignals.length > 0) {
    activeStrength = 'strong'
  }

  return { discontinuedStrength, activeStrength, matchedSignals: matched }
}

function buildFinding(
  discontinuedStrength: EvidenceStrength | null,
  activeStrength: EvidenceStrength | null,
  matchedSignals: string[],
  sourceType: SourceType,
): string {
  if (discontinuedStrength === 'strong') {
    const signals = matchedSignals.filter((s) => STRONG_DISC_SIGNALS.includes(s) || s.startsWith('title:'))
    return `This source provides strong evidence the product is discontinued (signals: ${signals.join(', ')})`
  }
  if (discontinuedStrength === 'medium') {
    const signals = matchedSignals.filter((s) => MEDIUM_DISC_SIGNALS.includes(s) || s === 'title: manufacturer discontinued')
    return `This source suggests the product may have limited or no availability (signals: ${signals.join(', ')})`
  }
  if (discontinuedStrength === 'weak') {
    return 'This source mentions stock/availability issues but does not confirm discontinuation'
  }
  if (activeStrength === 'strong') {
    const mktSignals = matchedSignals.filter((s) => MANUFACTURER_ACTIVE_SIGNALS.includes(s))
    if (mktSignals.length > 0) {
      return `This ${sourceType} source has an actively maintained product page (signals: ${mktSignals.join(', ')})`
    }
    return `This ${sourceType} source shows the product is currently available`
  }
  if (activeStrength === 'medium') {
    return 'This source lists the product with price and SKU, suggesting current availability'
  }
  return 'No clear availability signal found in this source'
}

export type ReplacementResult = { name: string; fromManufacturer: boolean }

// Problem 2: replacement must be near the product name AND look like a product name
export function detectReplacement(results: SearchResult[], query: string): ReplacementResult | null {
  const queryLower = query.toLowerCase()
  const significantWords = queryLower.split(/\s+/).filter((w) => w.length >= 5)

  for (const r of results) {
    const raw = `${r.title} ${r.content}`
    const lower = raw.toLowerCase()

    for (const signal of REPLACEMENT_SIGNALS) {
      const signalIdx = lower.indexOf(signal)
      if (signalIdx === -1) continue

      // Rule 1: signal must be within 100 chars of the product name
      let productIdx = lower.indexOf(queryLower)
      if (productIdx === -1) {
        for (const word of significantWords) {
          productIdx = lower.indexOf(word)
          if (productIdx !== -1) break
        }
      }
      if (productIdx === -1) continue
      if (Math.abs(signalIdx - productIdx) > 100) continue

      // Extract from original case (not lowercase)
      const after = raw.slice(signalIdx + signal.length, signalIdx + signal.length + 60).trim()
      const match = after.match(/[:\s]+([A-Za-z][A-Za-z0-9\s]{2,40})/)
      if (!match) continue

      const candidate = match[1].trim()

      // Rule 2: must look like a product name — capital letter, 1–4 words, not generic
      const words = candidate.split(/\s+/)
      if (words.length < 1 || words.length > 4) continue
      if (!/[A-Z]/.test(candidate)) continue
      const GENERIC_REJECT = [
        'screens', 'perforations', 'indicated', 'following', 'above', 'below',
        'similar', 'another', 'other', 'different', 'new', 'this', 'that',
      ]
      if (GENERIC_REJECT.some((w) => candidate.toLowerCase().includes(w))) continue

      const domain = getDomain(r.url)
      const fromManufacturer = MANUFACTURER_DOMAINS.some((d) => domain.includes(d))
      return { name: candidate, fromManufacturer }
    }
  }

  // Bug 2: successor pattern — same-manufacturer page has [product] + XL/Plus/Pro in title
  const SUCCESSOR_SUFFIXES = ['XL', 'Plus', 'Pro', 'HD', 'Max', 'Ultra']
  const MFG_WORDS = new Set(['certainteed', 'owens', 'corning', 'gaf', 'iko', 'tamko', 'atlas', 'malarkey'])
  const productWords = significantWords.filter((w) => !MFG_WORDS.has(w))
  for (const r of results) {
    const domain = getDomain(r.url)
    if (!MANUFACTURER_DOMAINS.some((d) => domain.includes(d))) continue
    for (const word of productWords) {
      for (const suffix of SUCCESSOR_SUFFIXES) {
        const pattern = new RegExp(`(${word}\\s+${suffix})\\b`, 'i')
        const match = r.title.match(pattern)
        if (match) return { name: match[1].trim(), fromManufacturer: true }
      }
    }
  }

  return null
}

export function classifyEvidence(results: SearchResult[], query: string): EvidenceItem[] {
  return results.flatMap((r) => {
    if (!isRelevantResult(r.title, r.content)) return []

    const cleanedContent = cleanContent(r.content)
    const combined = `${r.title} ${cleanedContent}`
    const sourceType = classifySourceType(r.url, combined)

    // Bug 1: manufacturer pages must mention the specific product — filters out siding, insulation, etc.
    if (sourceType === 'manufacturer_page' && !isMfgPageRelevant(combined, query)) return []

    const { discontinuedStrength, activeStrength, matchedSignals } = detectSignals(combined, query, sourceType)

    const signals = [...matchedSignals]

    // Bug 2: mark dedicated product pages so the scorer can restore full active signal detection
    if (sourceType === 'manufacturer_page' && isDedicatedProductPage(r.url, query)) {
      signals.push('dedicated product page')
    }

    let effectiveDiscStrength = discontinuedStrength

    // Problem 4: PSA title override — if the title alone says "discontinuation", trust it
    // even if body content extraction failed (common with PDFs)
    if (sourceType === 'manufacturer_psa' && effectiveDiscStrength == null) {
      const titleLower = r.title.toLowerCase()
      if (['discontinu', 'no longer', 'end of production', 'phasing out'].some((s) => titleLower.includes(s))) {
        effectiveDiscStrength = 'strong'
        signals.push('title: discontinuation')
      }
    }

    // Bug 4: contractor blog with manufacturer name + "discontinued" in title → medium disc signal
    if (sourceType === 'contractor_blog' && effectiveDiscStrength == null) {
      const titleLower = r.title.toLowerCase()
      if (titleLower.includes('discontinu')) {
        const queryWords = query.toLowerCase().split(/\s+/).filter((w) => w.length >= 4)
        if (queryWords.some((w) => titleLower.includes(w))) {
          effectiveDiscStrength = 'medium'
          signals.push('title: manufacturer discontinued')
        }
      }
    }

    // Retailer disc rule: only strong disc signals count
    if (sourceType === 'retailer' && effectiveDiscStrength !== 'strong') {
      effectiveDiscStrength = null
    }

    // Retailer active rule
    let effectiveActiveStrength: EvidenceStrength | null
    if (sourceType === 'retailer') {
      if (activeStrength === 'strong') {
        effectiveActiveStrength = 'strong'
      } else if (hasPriceAndSku(combined)) {
        effectiveActiveStrength = 'medium'
        signals.push('price+sku listed')
      } else {
        effectiveActiveStrength = null
      }
    } else {
      effectiveActiveStrength = activeStrength
    }

    const strength: EvidenceStrength =
      effectiveDiscStrength === 'strong' || effectiveActiveStrength === 'strong' ? 'strong' :
      effectiveDiscStrength === 'medium' || effectiveActiveStrength === 'medium' ? 'medium' : 'weak'

    const finding = buildFinding(effectiveDiscStrength, effectiveActiveStrength, signals, sourceType)

    return [{
      title: r.title,
      url: r.url,
      sourceType,
      snippet: cleanedContent.slice(0, 300),
      finding,
      strength,
      matchedSignals: signals,
    }]
  })
}
