export type ShingleStatus =
  | 'discontinued'
  | 'active'
  | 'regional'
  | 'limited'
  | 'unknown'

export type EvidenceStrength = 'strong' | 'medium' | 'weak'

export type SourceType =
  | 'manufacturer_psa'
  | 'manufacturer_page'
  | 'distributor'
  | 'retailer'
  | 'contractor_blog'
  | 'other'

export type EvidenceItem = {
  title: string
  url: string
  sourceType: SourceType
  snippet: string
  finding: string
  strength: EvidenceStrength
  matchedSignals: string[]
}

export type RegionalNote = {
  discontinuedIn: string[]
  activeIn: string[]
}

export type ShingleAnalysisResult = {
  query: string
  normalizedQuery: string
  manufacturer: string | null
  productLine: string | null
  color: string | null
  type: string | null
  status: ShingleStatus
  statusLabel: string
  confidence: 'high' | 'medium' | 'low'
  evidenceSummary: string
  evidenceItems: EvidenceItem[]
  regionalNote: RegionalNote | null
  replacedBy: string | null
  replacedByNote: string | null
  reasoning: string[]
  searchedAt: string
  searchProvider: 'tavily' | 'mock'
}

export const STATUS_LABELS: Record<ShingleStatus, string> = {
  discontinued: 'Discontinued',
  active:       'Active / Not Discontinued',
  regional:     'Partially Discontinued — Regional',
  limited:      'Limited Availability — Special Order Only',
  unknown:      'Unknown / Not Enough Evidence',
}
