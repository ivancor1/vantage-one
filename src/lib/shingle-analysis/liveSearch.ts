import type { SearchProvider, SearchResult } from './searchProvider'

// Bug 4: map manufacturer names to their domains so we prioritize the right site
const MANUFACTURER_DOMAIN_MAP: Record<string, string> = {
  'gaf':           'gaf.com',
  'certainteed':   'certainteed.com',
  'owens corning': 'owenscorning.com',
  'iko':           'iko.com',
  'tamko':         'tamko.com',
  'atlas':         'atlasroofing.com',
  'malarkey':      'malarkeyroofing.com',
}

function detectManufacturerDomain(query: string): string | null {
  const lower = query.toLowerCase()
  for (const [name, domain] of Object.entries(MANUFACTURER_DOMAIN_MAP)) {
    if (lower.includes(name)) return domain
  }
  return null
}

// Build search patterns dynamically so GAF searches hit gaf.com first,
// not certainteed.com or other irrelevant manufacturer sites.
function buildSearchPatterns(query: string): string[] {
  const detectedDomain = detectManufacturerDomain(query)

  return [
    // PSA/discontinuation letters — highest value, always first
    `"${query}" "product service announcement"`,
    `"${query}" discontinuation notice`,
    `"${query}" "plant service area" discontinued`,
    // Manufacturer-specific search: use detected domain, else fall back to general discontinued
    detectedDomain
      ? `"${query}" site:${detectedDomain}`
      : `"${query}" discontinued shingle`,
    // General availability signal
    `"${query}" "no longer available"`,
  ]
}

export async function runSearchPatterns(
  query: string,
  provider: SearchProvider,
): Promise<SearchResult[]> {
  const patterns = buildSearchPatterns(query)
  const seen = new Set<string>()
  const results: SearchResult[] = []

  for (const pattern of patterns) {
    try {
      const batch = await provider.search(pattern)
      for (const r of batch) {
        const normalizedUrl = r.url.toLowerCase().replace(/\/+$/, '').split('?')[0]
        if (!seen.has(normalizedUrl)) {
          seen.add(normalizedUrl)
          results.push(r)
          if (results.length >= 15) return results
        }
      }
    } catch (err) {
      console.warn('[shingle-search] Pattern failed:', pattern, err)
    }
  }

  return results
}
