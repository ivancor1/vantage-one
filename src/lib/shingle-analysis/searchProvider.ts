export interface SearchResult {
  title: string
  url: string
  content: string
}

export interface SearchProvider {
  readonly name: 'tavily' | 'mock'
  search(query: string): Promise<SearchResult[]>
}

export class TavilySearchProvider implements SearchProvider {
  readonly name = 'tavily' as const
  private apiKey: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async search(query: string): Promise<SearchResult[]> {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: this.apiKey,
        query,
        search_depth: 'advanced',
        max_results: 5,
        include_raw_content: true,
      }),
    })
    if (!res.ok) throw new Error(`Tavily API error: ${res.status}`)
    const data = await res.json() as {
      results: Array<{ title: string; url: string; content?: string; raw_content?: string }>
    }
    return (data.results ?? []).map((r) => ({
      title: r.title,
      url: r.url,
      content: r.raw_content ?? r.content ?? '',
    }))
  }
}

export class MockSearchProvider implements SearchProvider {
  readonly name = 'mock' as const

  async search(query: string): Promise<SearchResult[]> {
    const q = query.toLowerCase()

    // Return mock results that exercise all source types
    return [
      {
        title: `[MOCK] ${query} — Product Service Announcement`,
        url: 'https://www.certainteed.com/resources/psa-shingle-discontinuation.pdf',
        content: `[MOCK] Dear Valued Customer, effective January 2025, CertainTeed is discontinuing the ${query} shingle line across all plant service areas. This product service announcement (PSA) confirms no longer available status. Replacement option: Patriot XL offers similar performance.`,
      },
      {
        title: `[MOCK] ${query} Product Page`,
        url: 'https://www.owenscorning.com/roofing/shingles/supreme',
        content: `[MOCK] Owens Corning ${query} — This product is no longer available. We recommend Duration Series as a comparable replacement.`,
      },
      {
        title: `[MOCK] ${query} — ABC Supply Distributor Notice`,
        url: 'https://www.abcsupply.com/products/shingles/notice',
        content: `[MOCK] ABC Supply has been notified that ${query} is discontinued and no longer manufactured. Limited remaining inventory may be available as special order only.`,
      },
      {
        title: `[MOCK] Is ${q.includes('gaf') || q.includes('royal sovereign') ? 'GAF Royal Sovereign' : query} still available? — Roofing Forum`,
        url: 'https://www.roofingcontractormagazine.com/forums/shingles',
        content: `[MOCK] Contractor blog: Several roofers confirm ${query} is hard to find in some regions. Plant service area changes mean some markets still have inventory while others are fully discontinued.`,
      },
    ]
  }
}

export function createSearchProvider(): SearchProvider {
  return process.env.TAVILY_API_KEY
    ? new TavilySearchProvider(process.env.TAVILY_API_KEY)
    : new MockSearchProvider()
}
