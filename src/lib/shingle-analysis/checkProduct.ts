// Reusable server-side discontinuation check for one shingle product line — the same
// real (Tavily-backed, cited) pipeline the manual lookup uses, callable from area analysis.
import { createSearchProvider } from './searchProvider'
import { runSearchPatterns } from './liveSearch'
import { classifyEvidence, detectReplacement } from './evidenceClassifier'
import { determineStatus } from './determineStatus'
import { STATUS_LABELS } from './types'
import type { ShingleStatus } from './types'

export type ProductCheck = {
  product: string
  status: ShingleStatus
  statusLabel: string
  confidence: 'high' | 'medium' | 'low'
  replacedBy: string | null
  searchProvider: 'tavily' | 'mock'
}

// A discontinued/regional/limited product is one that likely can't be matched → full re-cover.
export function isUnmatchable(status: ShingleStatus): boolean {
  return status === 'discontinued' || status === 'regional' || status === 'limited'
}

export async function checkProductStatus(product: string): Promise<ProductCheck> {
  const provider = createSearchProvider()
  const raw = await runSearchPatterns(product, provider)
  const evidence = classifyEvidence(raw, product)
  const replacement = detectReplacement(raw, product)
  const { status, confidence, replacedBy } = determineStatus(evidence, replacement, product)
  return {
    product,
    status,
    statusLabel: STATUS_LABELS[status],
    confidence,
    replacedBy,
    searchProvider: provider.name,
  }
}
