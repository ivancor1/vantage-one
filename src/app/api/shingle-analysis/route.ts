import { NextRequest, NextResponse } from 'next/server'
import { createSearchProvider } from '@/lib/shingle-analysis/searchProvider'
import { runSearchPatterns } from '@/lib/shingle-analysis/liveSearch'
import { classifyEvidence, detectReplacement } from '@/lib/shingle-analysis/evidenceClassifier'
import { determineStatus } from '@/lib/shingle-analysis/determineStatus'
import { validateQueryWithAI } from '@/lib/shingle-analysis/validateWithAI'
import { STATUS_LABELS } from '@/lib/shingle-analysis/types'
import type { ShingleAnalysisResult } from '@/lib/shingle-analysis/types'

const MANUFACTURERS = [
  'CertainTeed', 'GAF', 'Owens Corning', 'IKO', 'TAMKO', 'Atlas', 'Malarkey',
]

const SHINGLE_TYPES = ['3-tab', 'architectural', 'luxury', 'designer', 'impact-resistant']

const COMMON_COLORS = [
  'charcoal', 'driftwood', 'weatherwood', 'pewter', 'slate', 'brownwood',
  'barkwood', 'hickory', 'desert tan', 'teak', 'onyx', 'shakewood',
  'antique silver', 'harvest gold', 'sand dune', 'seal brown',
]

// Problem 1: example suggestions shown when a query is too vague
const MANUFACTURER_SUGGESTIONS: Record<string, string[]> = {
  'CertainTeed':   ['CertainTeed Landmark Charcoal', 'CertainTeed Patriot Weathered Wood', 'CertainTeed Grand Manor Autumn Blend'],
  'GAF':           ['GAF Timberline HDZ Charcoal', 'GAF Royal Sovereign Charcoal', 'GAF Timberline CS Barkwood'],
  'Owens Corning': ['Owens Corning Duration Driftwood', 'Owens Corning Supreme Driftwood', 'Owens Corning TruDefinition Duration Teak'],
  'IKO':           ['IKO Cambridge Charcoal Gray', 'IKO Marathon Weatherwood', 'IKO Dynasty Arctic White'],
  'TAMKO':         ['TAMKO Heritage Weathered Wood', 'TAMKO Elite Glass-Seal Rustic Redwood'],
  'Atlas':         ['Atlas Pinnacle Pristine Weathered Wood', 'Atlas StormMaster Shake Charcoal'],
  'Malarkey':      ['Malarkey Vista Weathered Wood', 'Malarkey Legacy Driftwood'],
}

function validateQuery(query: string): { tooVague: boolean; suggestions: string[] } {
  const lower = query.toLowerCase()
  const manufacturer = MANUFACTURERS.find((m) => lower.includes(m.toLowerCase())) ?? null
  if (!manufacturer) return { tooVague: false, suggestions: [] }

  let remainder = query.replace(new RegExp(manufacturer, 'i'), '').trim()
  for (const c of COMMON_COLORS) remainder = remainder.replace(new RegExp(c, 'i'), '').trim()
  for (const t of SHINGLE_TYPES) remainder = remainder.replace(new RegExp(t, 'i'), '').trim()
  remainder = remainder.replace(/\s+/g, ' ').trim()

  if (remainder.length >= 2) return { tooVague: false, suggestions: [] }

  return {
    tooVague: true,
    suggestions: MANUFACTURER_SUGGESTIONS[manufacturer] ?? [],
  }
}

function parseQuery(query: string): {
  manufacturer: string | null
  productLine: string | null
  color: string | null
  type: string | null
  normalized: string
} {
  const normalized = query.trim()
  const lower = normalized.toLowerCase()

  const manufacturer = MANUFACTURERS.find((m) =>
    lower.includes(m.toLowerCase())
  ) ?? null

  const type = SHINGLE_TYPES.find((t) => lower.includes(t)) ?? null

  const color = COMMON_COLORS.find((c) => lower.includes(c)) ?? null

  // Product line = query minus manufacturer, color, and type fragments
  let productLineStr = normalized
  if (manufacturer) productLineStr = productLineStr.replace(new RegExp(manufacturer, 'i'), '').trim()
  if (color) productLineStr = productLineStr.replace(new RegExp(color, 'i'), '').trim()
  if (type) productLineStr = productLineStr.replace(new RegExp(type, 'i'), '').trim()
  const productLine: string | null = productLineStr.replace(/\s+/g, ' ').trim() || null

  return { manufacturer, productLine, color, type, normalized }
}

function buildEvidenceSummary(
  status: string,
  confidence: string,
  itemCount: number,
  manufacturer: string | null,
  productLine: string | null,
): string {
  const product = [manufacturer, productLine].filter(Boolean).join(' ') || 'This product'

  if (status === 'discontinued') {
    return `${product} appears to be discontinued based on ${itemCount} source${itemCount !== 1 ? 's' : ''}. ${confidence === 'high' ? 'Manufacturer or distributor confirmation was found.' : 'Evidence is present but may not be definitive.'}`
  }
  if (status === 'active') {
    return `${product} appears to be currently active and available. ${itemCount} source${itemCount !== 1 ? 's' : ''} show the product available for purchase.`
  }
  if (status === 'regional') {
    return `${product} has been discontinued in some plant service areas while remaining active in others. Regional availability varies — check with your local distributor.`
  }
  if (status === 'limited') {
    return `${product} may still be available but only as a special order or in limited quantities. Confirm availability with your distributor before committing.`
  }
  return `Not enough evidence found to determine the current status of ${product}. Checked ${itemCount} source${itemCount !== 1 ? 's' : ''} without finding a clear signal.`
}

export async function POST(req: NextRequest) {
  const body = await req.json() as { query?: string }
  const query = body.query?.trim()

  if (!query || query.length < 3) {
    return NextResponse.json({ error: 'Query must be at least 3 characters' }, { status: 400 })
  }

  // Problem 1: reject queries that are just manufacturer + color with no product line
  const { tooVague, suggestions } = validateQuery(query)
  if (tooVague) {
    return NextResponse.json({ error: 'too_vague', suggestions }, { status: 422 })
  }

  // AI pre-check: catch invalid queries before spending Tavily credits
  const aiCheck = await validateQueryWithAI(query)
  if (!aiCheck.valid) {
    return NextResponse.json({ error: 'invalid_query', message: aiCheck.message }, { status: 422 })
  }

  const provider = createSearchProvider()

  const rawResults = await runSearchPatterns(query, provider)
  const evidenceItems = classifyEvidence(rawResults, query)
  const replacementResult = detectReplacement(rawResults, query)
  const { status, confidence, reasoning, replacedBy, replacedByNote, regionalNote } =
    determineStatus(evidenceItems, replacementResult, query)

  const { manufacturer, productLine, color, type, normalized } = parseQuery(query)

  const result: ShingleAnalysisResult = {
    query,
    normalizedQuery: normalized,
    manufacturer,
    productLine,
    color,
    type,
    status,
    statusLabel: STATUS_LABELS[status],
    confidence,
    evidenceSummary: buildEvidenceSummary(status, confidence, evidenceItems.length, manufacturer, productLine),
    evidenceItems,
    regionalNote,
    replacedBy,
    replacedByNote,
    reasoning,
    searchedAt: new Date().toISOString(),
    searchProvider: provider.name,
  }

  return NextResponse.json(result)
}
