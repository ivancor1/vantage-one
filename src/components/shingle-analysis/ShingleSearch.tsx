'use client'

import { useState, useRef, type KeyboardEvent } from 'react'
import { Layers, Search, Loader2, AlertCircle } from 'lucide-react'
import type { ShingleAnalysisResult } from '@/lib/shingle-analysis/types'
import ResultCard from './ResultCard'

type PageState = 'idle' | 'loading' | 'result' | 'error' | 'too_vague' | 'invalid_query'

const EXAMPLE_QUERIES = [
  'Owens Corning Supreme Driftwood',
  'CertainTeed Patriot',
  'GAF Royal Sovereign Charcoal',
  'IKO Marathon Weatherwood',
]

export default function ShingleSearch() {
  const [query, setQuery] = useState('')
  const [state, setState] = useState<PageState>('idle')
  const [result, setResult] = useState<ShingleAnalysisResult | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleSearch() {
    const trimmed = query.trim()
    if (!trimmed || trimmed.length < 3) return
    setState('loading')
    setResult(null)
    setErrorMsg('')
    setSuggestions([])
    try {
      const res = await fetch('/api/shingle-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: trimmed }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string; suggestions?: string[]; message?: string }
        if (res.status === 422 && data.error === 'too_vague') {
          setSuggestions(data.suggestions ?? [])
          setState('too_vague')
          return
        }
        if (res.status === 422 && data.error === 'invalid_query') {
          setErrorMsg(data.message ?? 'That query doesn\'t look like a specific shingle product.')
          setState('invalid_query')
          return
        }
        throw new Error(data.error ?? `HTTP ${res.status}`)
      }
      const data = await res.json() as ShingleAnalysisResult
      setResult(data)
      setState('result')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err))
      setState('error')
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleSearch()
  }

  function handleExample(q: string) {
    setQuery(q)
    inputRef.current?.focus()
  }

  return (
    <div className="min-h-screen bg-vantage-black p-6">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Layers className="w-6 h-6 text-vantage-yellow flex-shrink-0" />
            <h1 className="text-2xl font-bold text-vantage-text tracking-tight">Shingle Analysis</h1>
          </div>
          <p className="text-sm text-vantage-muted leading-relaxed">
            Search a shingle by manufacturer, product line, color, or type. We check manufacturer,
            distributor, and retailer sources and give you the answer.
          </p>
        </div>

        {/* Search input */}
        <div className="flex gap-2 mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-vantage-faint pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder='e.g. "CertainTeed XT 30" or "Owens Corning Supreme Driftwood"'
              disabled={state === 'loading'}
              className="w-full pl-9 pr-4 py-3 bg-vantage-card border border-vantage-border rounded-lg text-sm text-vantage-text placeholder:text-vantage-faint focus:outline-none focus:border-vantage-bright transition-colors disabled:opacity-50"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={state === 'loading' || query.trim().length < 3}
            className="flex items-center gap-2 px-5 py-3 bg-vantage-yellow text-vantage-black text-sm font-semibold rounded-lg hover:bg-vantage-yellow/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
          >
            {state === 'loading'
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Search className="w-4 h-4" />
            }
            Analyze
          </button>
        </div>

        {/* Example queries */}
        {state === 'idle' && (
          <div className="flex flex-wrap gap-2 mb-8">
            <span className="text-xs text-vantage-faint self-center">Try:</span>
            {EXAMPLE_QUERIES.map((q) => (
              <button
                key={q}
                onClick={() => handleExample(q)}
                className="text-xs text-vantage-muted border border-vantage-border rounded px-2.5 py-1 hover:border-vantage-bright hover:text-vantage-text transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {/* Loading state */}
        {state === 'loading' && (
          <div className="flex items-center gap-3 py-12 text-vantage-muted">
            <Loader2 className="w-5 h-5 animate-spin flex-shrink-0 text-vantage-yellow" />
            <p className="text-sm">
              Checking manufacturer catalogs, distributor announcements, and retailer sources...
            </p>
          </div>
        )}

        {/* Error state */}
        {state === 'error' && (
          <div className="flex items-start gap-3 p-4 bg-status-critical/10 border border-status-critical/30 rounded-lg">
            <AlertCircle className="w-4 h-4 text-status-critical flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-status-critical">Analysis failed</p>
              <p className="text-xs text-vantage-muted mt-0.5">{errorMsg}</p>
            </div>
          </div>
        )}

        {/* AI validation rejection */}
        {state === 'invalid_query' && (
          <div className="flex items-start gap-3 p-4 bg-vantage-card border border-yellow-500/30 rounded-lg">
            <AlertCircle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-vantage-text">Try a more specific query</p>
              <p className="text-xs text-vantage-muted mt-0.5">{errorMsg}</p>
            </div>
          </div>
        )}

        {/* Too vague */}
        {state === 'too_vague' && (
          <div className="p-4 bg-vantage-card border border-vantage-border rounded-lg space-y-3">
            <p className="text-sm font-medium text-vantage-text">
              Your search didn&apos;t match a specific product.
            </p>
            <p className="text-xs text-vantage-muted">
              Include the product line name — not just the manufacturer and color.
            </p>
            {suggestions.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <p className="text-[10px] text-vantage-faint uppercase tracking-widest font-mono">Try one of these</p>
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => { setQuery(s); setState('idle'); inputRef.current?.focus() }}
                    className="block w-full text-left text-xs text-vantage-muted border border-vantage-border rounded px-3 py-2 hover:border-vantage-bright hover:text-vantage-text transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Result */}
        {state === 'result' && result && (
          <ResultCard result={result} />
        )}

        {/* Empty state */}
        {state === 'idle' && (
          <div className="py-16 text-center">
            <Layers className="w-10 h-10 text-vantage-faint mx-auto mb-4" />
            <p className="text-sm text-vantage-faint max-w-xs mx-auto leading-relaxed">
              Enter a shingle name above and Vantage will check manufacturer, distributor,
              and retailer sources to determine its current status.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
