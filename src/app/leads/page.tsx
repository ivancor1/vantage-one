'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { Users, ChevronDown, Database, MapPin, Sparkles, Loader2 } from 'lucide-react'
import clsx from 'clsx'
import type { LeadStatus } from '@/lib/types'
import { useLeads } from '@/lib/leads-api'
import { STATUS_META } from '@/lib/lead-scoring'
import LeadCard from '@/components/leads/LeadCard'
import Link from 'next/link'

type StatusFilter = 'all' | LeadStatus
type SortKey = 'score' | 'distance' | 'age'

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'score', label: 'Lead Score' },
  { value: 'age',   label: 'Roof Age' },
]

const STATUS_FILTER_ORDER: StatusFilter[] = [
  'all', 'new', 'knocked', 'interested', 'inspection', 'claim', 'closed', 'not_qualified',
]

export default function LeadsPage() {
  const { leads, loading, hydrated, updateStatus } = useLeads()
  const [territory, setTerritory] = useState<string>('all')
  const [filter, setFilter]       = useState<StatusFilter>('all')
  const [sort, setSort]           = useState<SortKey>('score')
  const [analyzingIds, setAnalyzingIds] = useState<Set<string>>(new Set())
  const [localLeads, setLocalLeads] = useState<typeof leads | null>(null)
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const [batch, setBatch] = useState<{ running: boolean; done: number; total: number }>({ running: false, done: 0, total: 0 })
  const searchParams = useSearchParams()
  const didScrollRef = useRef(false)

  // Keep localLeads in sync when Supabase data reloads
  useEffect(() => { setLocalLeads(null) }, [leads])

  // Scroll to + highlight lead when navigated from map
  useEffect(() => {
    const id = searchParams.get('highlight')
    if (!id || !hydrated || didScrollRef.current) return
    didScrollRef.current = true
    setHighlightId(id)
    // Switch to "all" territory and analyzed column is visible by default
    setTerritory('all')
    setFilter('all')
    setTimeout(() => {
      document.getElementById(`lead-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setTimeout(() => setHighlightId(null), 2000)
    }, 100)
  }, [searchParams, hydrated])

  const displayLeads = localLeads ?? leads

  function handleAnalyze(id: string) {
    setAnalyzingIds((prev) => new Set(prev).add(id))
  }

  function handleAnalyzed(id: string, visualRoofScore: number, aiNotes: string, leadScore: number) {
    setAnalyzingIds((prev) => { const s = new Set(prev); s.delete(id); return s })
    setLocalLeads((prev) => {
      const base = prev ?? leads
      return base.map((l) =>
        l.id === id ? { ...l, visualRoofScore, aiNotes, leadScore } : l
      )
    })
  }

  // Batch: analyze every unanalyzed roof, pooled so cards fill in live.
  // Reuses the existing per-lead endpoint (gpt-4o-mini vision) — ~$0.002/roof.
  async function analyzeAll() {
    if (batch.running) return
    const targets = (localLeads ?? leads).filter((l) => l.visualRoofScore == null)
    if (!targets.length) return
    setBatch({ running: true, done: 0, total: targets.length })
    const queue = [...targets]
    let done = 0
    const CONCURRENCY = 6
    async function worker() {
      while (queue.length) {
        const lead = queue.shift()!
        handleAnalyze(lead.id) // per-card spinner
        try {
          const res = await fetch(`/api/leads/${lead.id}/analyze`, { method: 'POST' })
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          const d = await res.json() as { visualRoofScore: number; aiNotes?: string; leadScore?: number }
          handleAnalyzed(lead.id, d.visualRoofScore, d.aiNotes ?? '', d.leadScore ?? lead.leadScore)
        } catch (err) {
          console.error('[analyze-all]', lead.id, err)
          handleAnalyzed(lead.id, lead.visualRoofScore ?? 0, lead.aiNotes ?? '', lead.leadScore) // clear spinner, no change
        }
        done += 1
        setBatch((b) => ({ ...b, done }))
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, targets.length) }, worker))
    setBatch((b) => ({ ...b, running: false }))
  }

  const unanalyzedCount = displayLeads.filter((l) => l.visualRoofScore == null).length

  // Unique territories derived from loaded leads
  const territories = useMemo(() => {
    const seen = new Map<string, string>()
    for (const l of displayLeads) {
      if (l.territoryId && !seen.has(l.territoryId)) {
        seen.set(l.territoryId, l.territoryValue ?? l.territoryId)
      }
    }
    return [...seen.entries()].map(([id, value]) => ({ id, value }))
  }, [displayLeads])

  // Apply territory filter first, then status filter
  const byTerritory = territory === 'all' ? displayLeads : displayLeads.filter((l) => l.territoryId === territory)

  const counts: Record<string, number> = { all: byTerritory.length }
  for (const lead of byTerritory) {
    counts[lead.status] = (counts[lead.status] ?? 0) + 1
  }

  const visible = byTerritory
    .filter((l) => filter === 'all' || l.status === filter)
    .sort((a, b) => {
      if (sort === 'score')    return b.leadScore - a.leadScore
      if (sort === 'distance') return (a.distanceToTerritoryKm ?? 99) - (b.distanceToTerritoryKm ?? 99)
      return (b.roofAge ?? 0) - (a.roofAge ?? 0)
    })

  return (
    <div className="p-8 space-y-6 max-w-7xl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-mono text-vantage-faint uppercase tracking-widest mb-1">
            Territory Leads · OSM Buildings + Vantage Score
          </p>
          <h2 className="text-lg font-semibold text-vantage-text">Lead Intelligence</h2>
        </div>

        <div className="flex items-center gap-3">
          {/* Batch roof analysis */}
          {(unanalyzedCount > 0 || batch.running) && (
            <button
              onClick={analyzeAll}
              disabled={batch.running}
              className="relative overflow-hidden flex items-center gap-1.5 px-4 py-1.5 rounded bg-vantage-yellow text-vantage-black text-xs font-bold hover:opacity-90 transition-opacity disabled:cursor-default"
            >
              {batch.running && (
                <span
                  className="absolute inset-y-0 left-0 bg-white/20 transition-[width] duration-300"
                  style={{ width: `${batch.total ? (batch.done / batch.total) * 100 : 0}%` }}
                />
              )}
              <span className="relative flex items-center gap-1.5">
                {batch.running ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Analyzing roofs… {batch.done}/{batch.total}</>
                ) : (
                  <><Sparkles className="w-3.5 h-3.5" /> Analyze all {unanalyzedCount} roofs</>
                )}
              </span>
            </button>
          )}
          {!batch.running && unanalyzedCount === 0 && displayLeads.length > 0 && (
            <span className="flex items-center gap-1.5 text-xs text-status-success font-medium">
              <Sparkles className="w-3.5 h-3.5" /> All roofs analyzed
            </span>
          )}

          <span className="text-xs text-vantage-faint">Sort:</span>
          <div className="relative">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="appearance-none bg-vantage-card border border-vantage-border rounded px-3 py-1.5 pr-7 text-xs text-vantage-text outline-none cursor-pointer hover:border-vantage-bright transition-colors"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-vantage-faint pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Territory tabs */}
      {!loading && territories.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap">
          <button
            onClick={() => { setTerritory('all'); setFilter('all') }}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold border transition-colors',
              territory === 'all'
                ? 'bg-vantage-yellow text-vantage-black border-vantage-yellow'
                : 'text-vantage-muted border-vantage-border hover:border-vantage-bright hover:text-vantage-text'
            )}
          >
            <MapPin className="w-3 h-3" />
            All Territories
            <span className={clsx('text-[10px] font-bold rounded px-1', territory === 'all' ? 'bg-black/10' : 'text-vantage-faint')}>
              {displayLeads.length}
            </span>
          </button>

          {territories.map((t) => {
            const count = displayLeads.filter((l) => l.territoryId === t.id).length
            const active = territory === t.id
            return (
              <button
                key={t.id}
                onClick={() => { setTerritory(t.id); setFilter('all') }}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold border transition-colors',
                  active
                    ? 'bg-vantage-yellow text-vantage-black border-vantage-yellow'
                    : 'text-vantage-muted border-vantage-border hover:border-vantage-bright hover:text-vantage-text'
                )}
              >
                {t.value}
                <span className={clsx('text-[10px] font-bold rounded px-1', active ? 'bg-black/10' : 'text-vantage-faint')}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* Status filter tabs */}
      {byTerritory.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap">
          {STATUS_FILTER_ORDER.filter((f) => f === 'all' || (counts[f] ?? 0) > 0).map((f) => {
            const label = f === 'all' ? 'All' : STATUS_META[f].label
            const count = counts[f] ?? 0
            const active = filter === f
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold border transition-colors',
                  active
                    ? 'bg-vantage-bright/20 text-vantage-text border-vantage-bright'
                    : 'text-vantage-muted border-vantage-border hover:border-vantage-bright hover:text-vantage-text'
                )}
              >
                {label}
                <span className={clsx('text-[10px] font-bold rounded px-1', active ? 'text-vantage-text' : 'text-vantage-faint')}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="py-16 text-center text-vantage-faint text-xs font-mono">LOADING LEADS...</div>
      )}

      {/* No territories */}
      {!loading && hydrated && displayLeads.length === 0 && (
        <div className="py-24 flex flex-col items-center gap-4 text-center">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-vantage-card border border-vantage-border">
            <Database className="w-5 h-5 text-vantage-faint" />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-semibold text-vantage-text">No leads yet</p>
            <p className="text-xs text-vantage-muted max-w-xs">
              Leads are generated from your monitored territories. Add a ZIP code or city to get started.
            </p>
            <Link
              href="/territories"
              className="inline-flex items-center gap-1.5 mt-2 px-4 py-2 rounded bg-vantage-yellow text-vantage-black text-xs font-bold hover:bg-vantage-yellow/90 transition-colors"
            >
              <MapPin className="w-3.5 h-3.5" />
              Add Territory
            </Link>
          </div>
        </div>
      )}

      {/* Filter empty */}
      {!loading && hydrated && visible.length === 0 && byTerritory.length > 0 && (
        <div className="py-16 text-center space-y-2">
          <Users className="w-6 h-6 text-vantage-faint mx-auto" />
          <p className="text-vantage-muted text-sm">No leads match this filter.</p>
        </div>
      )}

      {/* Lead list — two columns: unanalyzed left, analyzed right */}
      {!loading && hydrated && visible.length > 0 && (() => {
        const unanalyzed = visible.filter((l) => l.visualRoofScore == null)
        const analyzed   = visible.filter((l) => l.visualRoofScore != null)
        return (
          <div className="grid grid-cols-2 gap-6 items-start">
            {/* Left: unanalyzed */}
            <div className="space-y-3">
              <p className="text-[10px] font-mono text-vantage-faint uppercase tracking-widest">
                Unanalyzed · {unanalyzed.length}
              </p>
              {unanalyzed.length === 0 ? (
                <p className="text-xs text-vantage-faint py-4 text-center">All leads analyzed</p>
              ) : unanalyzed.map((lead, i) => (
                <div key={lead.id} id={`lead-${lead.id}`} className={clsx('rounded-lg transition-all duration-700', highlightId === lead.id && 'ring-2 ring-vantage-yellow')}>
                  <LeadCard
                    lead={lead}
                    rank={i + 1}
                    onStatusChange={(s) => updateStatus(lead.id, s)}
                    analyzing={analyzingIds.has(lead.id)}
                    onAnalyze={() => handleAnalyze(lead.id)}
                    onAnalyzed={handleAnalyzed}
                  />
                </div>
              ))}
            </div>

            {/* Right: analyzed */}
            <div className="space-y-3">
              <p className="text-[10px] font-mono text-vantage-faint uppercase tracking-widest">
                AI Analyzed · {analyzed.length}
              </p>
              {analyzed.length === 0 ? (
                <p className="text-xs text-vantage-faint py-4 text-center">No analyzed leads yet · click Analyze Roof on any card</p>
              ) : analyzed.map((lead, i) => (
                <div key={lead.id} id={`lead-${lead.id}`} className={clsx('rounded-lg transition-all duration-700', highlightId === lead.id && 'ring-2 ring-vantage-yellow')}>
                  <LeadCard
                    lead={lead}
                    rank={i + 1}
                    onStatusChange={(s) => updateStatus(lead.id, s)}
                    analyzing={analyzingIds.has(lead.id)}
                    onAnalyze={() => handleAnalyze(lead.id)}
                    onAnalyzed={handleAnalyzed}
                  />
                </div>
              ))}
            </div>
          </div>
        )
      })()}

      {!loading && visible.length > 0 && (
        <p className="text-[10px] text-vantage-faint font-mono text-center pb-4">
          Address data: OpenStreetMap contributors · Lead scores: Vantage model · Not official damage assessments
        </p>
      )}
    </div>
  )
}
