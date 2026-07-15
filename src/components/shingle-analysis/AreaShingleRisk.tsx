'use client'

// Area shingle-risk — surfaced in the Shingle tab. Pick a territory → it reads that area's
// real Census housing-age, estimates likely shingle lines, verifies each against live web
// search, and gives a plain full-re-cover verdict. Frictionless: one click per territory.

import { useState } from 'react'
import { ChevronDown, MapPin, Loader2, Home, AlertCircle, CheckCircle2, XCircle } from 'lucide-react'
import { useTerritoriesStore } from '@/lib/territories'

type ProductCheck = {
  product: string
  status: string
  statusLabel: string
  confidence: 'high' | 'medium' | 'low'
  replacedBy: string | null
}
type Intel = {
  ok: boolean
  territory: string
  region: string
  era: string
  pctPre2000: number
  pctPre1980: number
  housingLabel: string | null
  hailRisk: string | null
  risk: 'elevated' | 'moderate' | 'low'
  verdict: string
  products: ProductCheck[]
  searchProvider: 'tavily' | 'mock'
}
type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; intel: Intel }
  | { status: 'error'; message: string; needsScan?: boolean }

const RISK_META: Record<Intel['risk'], { label: string; cls: string; dot: string }> = {
  elevated: { label: 'ELEVATED', cls: 'text-status-critical', dot: 'bg-status-critical' },
  moderate: { label: 'MODERATE', cls: 'text-status-high',     dot: 'bg-status-high' },
  low:      { label: 'LOW',      cls: 'text-vantage-muted',   dot: 'bg-vantage-faint' },
}

function statusIcon(status: string) {
  if (status === 'discontinued' || status === 'regional' || status === 'limited')
    return <XCircle className="w-3.5 h-3.5 text-status-critical flex-shrink-0" />
  if (status === 'active')
    return <CheckCircle2 className="w-3.5 h-3.5 text-status-success flex-shrink-0" />
  return <AlertCircle className="w-3.5 h-3.5 text-vantage-faint flex-shrink-0" />
}

export default function AreaShingleRisk() {
  const { territories, hydrated } = useTerritoriesStore()
  const [selected, setSelected] = useState<string>('')
  const [state, setState] = useState<State>({ status: 'idle' })

  async function analyze(territoryId: string) {
    setSelected(territoryId)
    if (!territoryId) { setState({ status: 'idle' }); return }
    setState({ status: 'loading' })
    try {
      const res = await fetch(`/api/territories/${territoryId}/shingle-intel`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        setState({ status: 'error', message: data.error ?? `HTTP ${res.status}`, needsScan: data.needsScan })
        return
      }
      setState({ status: 'done', intel: data as Intel })
    } catch (err) {
      setState({ status: 'error', message: err instanceof Error ? err.message : 'Failed' })
    }
  }

  return (
    <div className="bg-vantage-card border border-vantage-border rounded-lg p-5 space-y-4">
      <div>
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-vantage-yellow" />
          <h2 className="text-sm font-semibold text-vantage-text">Area shingle risk</h2>
        </div>
        <p className="text-xs text-vantage-muted mt-1 leading-relaxed">
          Which of your territories are more likely to need a <span className="text-vantage-text">full re-cover</span>?
          Reads the area&apos;s real Census housing age, estimates the shingle lines likely used, and checks which are discontinued.
        </p>
      </div>

      {/* Territory picker */}
      <div className="relative">
        <select
          value={selected}
          onChange={(e) => analyze(e.target.value)}
          disabled={!hydrated || state.status === 'loading'}
          className="w-full appearance-none bg-vantage-surface border border-vantage-border rounded px-3 py-2.5 pr-8 text-sm text-vantage-text outline-none cursor-pointer hover:border-vantage-bright transition-colors disabled:opacity-50"
        >
          <option value="">{hydrated ? 'Choose a territory to analyze…' : 'Loading territories…'}</option>
          {territories.map((t) => (
            <option key={t.id} value={t.id}>{t.placeName ?? t.value}</option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-vantage-faint pointer-events-none" />
      </div>

      {state.status === 'loading' && (
        <div className="flex items-center gap-3 py-4 text-vantage-muted">
          <Loader2 className="w-4 h-4 animate-spin flex-shrink-0 text-vantage-yellow" />
          <p className="text-sm">
            Reading housing age, estimating shingles, checking discontinuation…
          </p>
        </div>
      )}

      {state.status === 'error' && (
        <div className="flex items-start gap-2.5 p-3 rounded bg-vantage-surface border border-vantage-border text-xs">
          <Home className="w-4 h-4 text-vantage-faint flex-shrink-0 mt-0.5" />
          <p className="text-vantage-muted">{state.message}</p>
        </div>
      )}

      {state.status === 'done' && (() => {
        const x = state.intel
        const r = RISK_META[x.risk]
        return (
          <div className="space-y-3 pt-1">
            {/* Verdict headline */}
            <div className="flex items-start gap-2.5">
              <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${r.dot}`} />
              <div>
                <p className={`text-[11px] font-mono font-bold tracking-widest ${r.cls}`}>
                  {r.label} FULL-RE-COVER POTENTIAL
                </p>
                <p className="text-sm text-vantage-text leading-relaxed mt-0.5">{x.verdict}</p>
              </div>
            </div>

            {/* Area facts */}
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-vantage-muted font-mono pl-[18px]">
              <span>{x.pctPre2000}% built pre-2000</span>
              <span>· {x.era} era</span>
              {x.housingLabel && <span>· {x.housingLabel} stock</span>}
              {x.hailRisk && <span>· FEMA hail: {x.hailRisk.toLowerCase()}</span>}
            </div>

            {/* Likely products + verified status */}
            <div className="space-y-1.5">
              <p className="text-[10px] font-mono text-vantage-faint uppercase tracking-widest">
                Likely shingle lines here · discontinuation checked
              </p>
              {x.products.map((p) => (
                <div key={p.product} className="flex items-center gap-2 text-xs">
                  {statusIcon(p.status)}
                  <span className="text-vantage-text">{p.product}</span>
                  <span className="text-vantage-muted">— {p.statusLabel.toLowerCase()}</span>
                  {p.replacedBy && <span className="text-vantage-faint">· replaced by {p.replacedBy}</span>}
                </div>
              ))}
            </div>

            <p className="text-[9px] font-mono text-vantage-faint leading-relaxed">
              &ldquo;Likely&rdquo; products are AI-estimated from area age &amp; region — not identified on any specific roof;
              verify on site. Discontinuation status from {x.searchProvider === 'tavily' ? 'live web search' : 'DEMO data (set TAVILY_API_KEY)'}.
            </p>
          </div>
        )
      })()}
    </div>
  )
}
