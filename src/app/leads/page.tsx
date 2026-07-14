'use client'

import { useState, useMemo, useEffect, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Users, ChevronDown, Database, MapPin, Sparkles, Loader2, Navigation, Download, Radar } from 'lucide-react'
import clsx from 'clsx'
import type { LeadStatus } from '@/lib/types'
import { useLeads } from '@/lib/leads-api'
import { useStorms } from '@/lib/storm-api'
import { supabase } from '@/lib/supabase'
import { useStormLeadStates } from '@/lib/storm-leads'
import { STATUS_META } from '@/lib/lead-scoring'
import LeadCard, { LeadListHeader } from '@/components/leads/LeadCard'
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
  return (
    <Suspense fallback={<div className="p-8 text-vantage-faint text-xs font-mono">LOADING…</div>}>
      <LeadsPageInner />
    </Suspense>
  )
}

function LeadsPageInner() {
  const { leads, loading, hydrated, updateStatus, reload } = useLeads()
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

  // Land filtered to a specific territory (e.g. arriving from a storm's "Find leads")
  useEffect(() => {
    const t = searchParams.get('territory')
    if (t) setTerritory(t)
  }, [searchParams])

  // Arriving mid-scan from a storm page (?storm=): show a live "finding homes…" banner,
  // let the user browse other territories, then drop into the new territory when it lands.
  const stormParam = searchParams.get('storm')
  const genStates = useStormLeadStates()
  const scanState = stormParam ? genStates[stormParam] : undefined
  const { storms } = useStorms()
  const scanActive = Boolean(stormParam) && scanState?.status === 'running'
  const scanStormName = storms.find((s) => s.id === stormParam)?.name ?? 'this storm'
  const landedRef = useRef<string | null>(null)
  const scanLandedRef = useRef<string | null>(null)
  useEffect(() => {
    if (!stormParam || scanState?.status !== 'done') return
    if (landedRef.current === stormParam) return
    landedRef.current = stormParam
    reload().then(() => setTerritory(scanState.territoryId))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stormParam, scanState])

  // Arriving via Find Leads → land on the live "collecting homes" scan view (a pseudo-tab)
  useEffect(() => {
    if (scanActive && stormParam && scanLandedRef.current !== stormParam) {
      scanLandedRef.current = stormParam
      setTerritory('__scan__')
    }
  }, [scanActive, stormParam])

  // The most sellable filter there is: homes where two independent government sources
  // (NOAA radar + NWS spotters) both confirm hail
  const [corroboratedOnly, setCorroboratedOnly] = useState(false)

  // High-priority view (from the dashboard card): only score ≥ 65, workable status
  const [priorityOnly, setPriorityOnly] = useState(false)
  useEffect(() => {
    if (searchParams.get('priority') === 'high') setPriorityOnly(true)
  }, [searchParams])

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

  // While a storm scan is "running", hide its territory so its lead count can't leak into the
  // tabs / All view before the reveal — it should feel like the homes are being found live.
  const scanningTerritoryId = scanState?.status === 'running' ? scanState.territoryId : null
  const displayLeads = scanningTerritoryId
    ? (localLeads ?? leads).filter((l) => l.territoryId !== scanningTerritoryId)
    : (localLeads ?? leads)

  function handleAnalyze(id: string) {
    setAnalyzingIds((prev) => new Set(prev).add(id))
  }

  function handleAnalyzed(id: string, visualRoofScore: number | null, aiNotes: string, leadScore: number) {
    setAnalyzingIds((prev) => { const s = new Set(prev); s.delete(id); return s })
    // null = the check failed — clear the spinner but write NOTHING (a failed vision call
    // must never render as "score 0 / looks ok")
    if (visualRoofScore == null) return
    setLocalLeads((prev) => {
      const base = prev ?? leads
      return base.map((l) =>
        l.id === id ? { ...l, visualRoofScore, aiNotes, leadScore } : l
      )
    })
  }

  // Batch: assess a FIXED top-N of the highest-scoring un-read roofs in the selected tab —
  // NOT the whole territory (800+ would be slow, costly, and never "finish" on camera).
  // The count is locked when you click, so a still-running scrape can't grow the batch.
  // Pooled so cards fill in live. Per-lead endpoint (gpt-4o-mini vision) — ~$0.002/roof.
  const ASSESS_BATCH = 30
  async function analyzeAll() {
    if (batch.running) return
    const targets = (localLeads ?? leads)
      .filter((l) => (territory === 'all' || l.territoryId === territory) && l.visualRoofScore == null)
      .sort((a, b) => b.leadScore - a.leadScore)
      .slice(0, ASSESS_BATCH)
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
          handleAnalyzed(lead.id, lead.visualRoofScore ?? null, lead.aiNotes ?? '', lead.leadScore) // clear spinner, write nothing
        }
        done += 1
        setBatch((b) => ({ ...b, done }))
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, targets.length) }, worker))
    setBatch((b) => ({ ...b, running: false }))
  }

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

  // Batch-assess button reflects only the selected territory tab, capped at the batch size
  const unanalyzedCount = byTerritory.filter((l) => l.visualRoofScore == null).length
  const assessBatchCount = Math.min(unanalyzedCount, ASSESS_BATCH)

  const counts: Record<string, number> = { all: byTerritory.length }
  for (const lead of byTerritory) {
    counts[lead.status] = (counts[lead.status] ?? 0) + 1
  }

  const WORKABLE = new Set<LeadStatus>(['new', 'knocked', 'interested', 'inspection'])
  const visible = byTerritory
    .filter((l) => filter === 'all' || l.status === filter)
    .filter((l) => !priorityOnly || (l.leadScore >= 65 && WORKABLE.has(l.status)))
    .filter((l) => !corroboratedOnly || (l.radarHailIn != null && l.spotterHailIn != null))
    .sort((a, b) => {
      if (sort === 'score')    return b.leadScore - a.leadScore
      if (sort === 'distance') return (a.distanceToTerritoryKm ?? 99) - (b.distanceToTerritoryKm ?? 99)
      return (b.roofAge ?? 0) - (a.roofAge ?? 0)
    })

  // Search wider: re-scan the selected territory at +2 mi (max 10). The scrape upserts
  // with ignoreDuplicates, so this only ADDS homes it hasn't seen — nothing is re-scored away.
  const [widening, setWidening] = useState<{ running: boolean; note: string }>({ running: false, note: '' })
  async function searchWider() {
    if (widening.running || territory === 'all') return
    setWidening({ running: true, note: '' })
    try {
      const { data: t } = await supabase
        .from('territories')
        .select('lat, lng, radius_miles')
        .eq('id', territory)
        .single()
      if (!t?.lat || !t?.lng) throw new Error('Territory has no saved center')
      const newRadius = Math.min((t.radius_miles ?? 3) + 2, 10)
      const before = displayLeads.filter((l) => l.territoryId === territory).length
      const res = await fetch('/api/territories/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ territoryId: territory, lat: t.lat, lng: t.lng, radiusMiles: newRadius }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d?.error ?? `HTTP ${res.status}`)
      await supabase.from('territories').update({ radius_miles: newRadius }).eq('id', territory)
      await reload()
      setWidening({ running: false, note: `now scanning ${newRadius} mi · ${Math.max((d?.count ?? 0) - before, 0)} new` })
      setTimeout(() => setWidening((w) => ({ ...w, note: '' })), 4000)
    } catch (err) {
      setWidening({ running: false, note: err instanceof Error ? err.message : 'failed' })
      setTimeout(() => setWidening((w) => ({ ...w, note: '' })), 4000)
    }
  }

  // ── Pick homes → optimal route ─────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  function toggleSelect(id: string, on: boolean) {
    setSelectedIds((prev) => {
      const s = new Set(prev)
      if (on) s.add(id); else s.delete(id)
      return s
    })
  }

  // Order stops with nearest-neighbor so the drive doesn't zig-zag (fine at ≤10 stops)
  function orderStops<T extends { lat: number; lng: number }>(stops: T[]): T[] {
    if (stops.length <= 2) return stops
    const rem = [...stops]
    const path = [rem.shift()!]
    while (rem.length) {
      const last = path[path.length - 1]
      const cos = Math.cos((last.lat * Math.PI) / 180)
      let bi = 0, bd = Infinity
      rem.forEach((s, i) => {
        const d = (s.lat - last.lat) ** 2 + ((s.lng - last.lng) * cos) ** 2
        if (d < bd) { bd = d; bi = i }
      })
      path.push(rem.splice(bi, 1)[0])
    }
    return path
  }

  // Route: your picked homes (checkboxes) in an optimized order — or, with nothing
  // picked, the top 9 fresh leads. Google Maps consumer limit: 10 stops total.
  function openKnockRoute() {
    const picked = visible.filter((l) => selectedIds.has(l.id))
    const stops = orderStops(picked.length ? picked.slice(0, 10) : visible.filter((l) => l.status === 'new').slice(0, 9))
    if (!stops.length) return
    const pt = (l: typeof stops[number]) => `${l.lat},${l.lng}`
    const destination = pt(stops[stops.length - 1])
    const waypoints = stops.slice(0, -1).map(pt).join('|')
    const url = `https://www.google.com/maps/dir/?api=1&destination=${destination}${waypoints ? `&waypoints=${encodeURIComponent(waypoints)}` : ''}&travelmode=driving`
    window.open(url, '_blank', 'noopener')
  }

  // CSV of the currently visible leads — headers match what roofing CRMs import
  function exportCsv() {
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const header = 'address,score,radar_hail_in,spotter_hail_in,nearest_report_km,roof_squares_est,year_built,status,lat,lng'
    const lines = visible.map((l) => [
      esc(l.address), l.leadScore, l.radarHailIn ?? '', l.spotterHailIn ?? '', l.nearestReportKm ?? '',
      l.footprintSqm ? Math.round((l.footprintSqm * 1.15) / 9.29) : '', l.yearBuilt ?? '', l.status, l.lat, l.lng,
    ].join(','))
    const blob = new Blob([[header, ...lines].join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'vantage-leads.csv'
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-mono text-vantage-faint uppercase tracking-widest mb-1">
            Territory Leads · OSM Buildings + Vantage Score
          </p>
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg font-semibold text-vantage-text">Lead Intelligence</h2>
            {priorityOnly && (
              <button
                onClick={() => setPriorityOnly(false)}
                title="Showing only high-priority leads (score 65+, still workable) — click to show all"
                className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-status-high/15 border border-status-high/30 text-[11px] font-semibold text-status-high hover:bg-status-high/25 transition-colors"
              >
                High-priority only <span className="text-status-high/60">✕</span>
              </button>
            )}
          </div>
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
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Assessing roofs… {batch.done}/{batch.total}</>
                ) : (
                  <><Sparkles className="w-3.5 h-3.5" /> Assess top {assessBatchCount} roofs</>
                )}
              </span>
            </button>
          )}
          {!batch.running && unanalyzedCount === 0 && byTerritory.length > 0 && (
            <span className="flex items-center gap-1.5 text-xs text-status-success font-medium">
              <Sparkles className="w-3.5 h-3.5" /> All roofs assessed
            </span>
          )}

          {/* Deliverables — quiet icons, tooltips carry the labels */}
          {visible.length > 0 && (
            <div className="flex items-center gap-0.5">
              {territory !== 'all' && (
                <span className="flex items-center gap-1">
                  <button
                    onClick={searchWider}
                    disabled={widening.running}
                    title="Search wider — re-scan this territory at +2 miles and add new homes (max 10 mi)"
                    className="p-2 rounded text-vantage-faint hover:text-vantage-text hover:bg-black/[0.04] transition-colors disabled:opacity-50"
                  >
                    {widening.running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radar className="w-4 h-4" />}
                  </button>
                  {widening.note && (
                    <span className="text-[10px] font-mono text-vantage-faint whitespace-nowrap">{widening.note}</span>
                  )}
                </span>
              )}
              {selectedIds.size > 0 ? (
                <span className="flex items-center gap-1.5">
                  <button
                    onClick={openKnockRoute}
                    title={selectedIds.size > 10 ? 'Google Maps caps routes at 10 stops — routing your 10 best-ranked picks' : 'Opens Google Maps with your picked homes in an optimized driving order'}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-vantage-yellow text-vantage-black text-xs font-bold hover:opacity-90 transition-opacity"
                  >
                    <Navigation className="w-3.5 h-3.5" />
                    Route {Math.min(selectedIds.size, 10)} stops
                  </button>
                  <button
                    onClick={() => setSelectedIds(new Set())}
                    className="text-[10px] font-mono text-vantage-faint hover:text-vantage-text"
                  >
                    clear
                  </button>
                </span>
              ) : (
                <button
                  onClick={openKnockRoute}
                  title="Knock route — pick homes with the checkboxes, or this routes the top 9 fresh leads"
                  className="p-2 rounded text-vantage-faint hover:text-vantage-text hover:bg-black/[0.04] transition-colors"
                >
                  <Navigation className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={exportCsv}
                title="Export visible leads as CSV (imports into AccuLynx / JobNimbus)"
                className="p-2 rounded text-vantage-faint hover:text-vantage-text hover:bg-black/[0.04] transition-colors"
              >
                <Download className="w-4 h-4" />
              </button>
            </div>
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

      {/* Live scan banner — arriving from a storm's "Find leads" */}
      {scanActive && scanState?.status === 'running' && territory !== '__scan__' && (
        <div className="p-4 rounded-lg bg-vantage-card border border-vantage-yellow/40 space-y-2.5">
          <div className="flex items-center gap-3">
            <Loader2 className="w-4 h-4 animate-spin text-vantage-yellow flex-shrink-0" />
            <p className="text-sm font-semibold text-vantage-text flex-1">Still collecting homes near {scanStormName}…</p>
            <span className="font-mono text-sm font-bold text-vantage-yellow tabular-nums">
              {scanState.found.toLocaleString()} homes
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-vantage-surface overflow-hidden">
            <div
              className="h-full bg-vantage-yellow transition-[width] duration-150 ease-out"
              style={{ width: `${Math.round(scanState.progress * 100)}%` }}
            />
          </div>
          <p className="text-xs font-mono text-vantage-muted">{scanState.stage}</p>
          <p className="text-[11px] text-vantage-faint">
            Browse your other territories below — this drops in automatically when it lands.
          </p>
        </div>
      )}
      {stormParam && scanState?.status === 'error' && (
        <div className="p-4 rounded-lg bg-vantage-card border border-status-critical/40">
          <p className="text-sm font-semibold text-status-critical">Couldn&apos;t find homes for this storm</p>
          <p className="text-xs text-vantage-muted mt-0.5">{scanState.message}</p>
        </div>
      )}

      {/* Territory tabs */}
      {!loading && (territories.length > 0 || scanActive) && (
        <div className="flex items-center gap-1 flex-wrap">
          {scanActive && (
            <button
              onClick={() => setTerritory('__scan__')}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold border transition-colors',
                territory === '__scan__'
                  ? 'bg-vantage-yellow text-vantage-black border-vantage-yellow'
                  : 'text-vantage-muted border-vantage-border hover:border-vantage-bright hover:text-vantage-text'
              )}
            >
              <Loader2 className="w-3 h-3 animate-spin" />
              {scanStormName}
              <span className="text-[10px] font-bold rounded px-1 opacity-70">collecting…</span>
            </button>
          )}
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

          {/* Two independent government sources agreeing — the strongest evidence filter */}
          {byTerritory.some((l) => l.radarHailIn != null && l.spotterHailIn != null) && (
            <button
              onClick={() => setCorroboratedOnly((v) => !v)}
              title="Only homes where NOAA radar AND NWS spotter reports both confirm hail"
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold border transition-colors ml-2',
                corroboratedOnly
                  ? 'bg-status-critical/15 text-status-critical border-status-critical/40'
                  : 'text-vantage-muted border-vantage-border hover:border-vantage-bright hover:text-vantage-text'
              )}
            >
              ⚡ Radar + spotter confirmed
              <span className={clsx('text-[10px] font-bold rounded px-1', corroboratedOnly ? 'text-status-critical' : 'text-vantage-faint')}>
                {byTerritory.filter((l) => l.radarHailIn != null && l.spotterHailIn != null).length}
              </span>
            </button>
          )}
        </div>
      )}

      {/* Live "collecting homes" scan view — the Find-leads pseudo-tab */}
      {scanActive && territory === '__scan__' && scanState?.status === 'running' && (
        <div className="bg-vantage-card border border-vantage-yellow/30 rounded-lg p-8">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-center gap-2.5">
              <Loader2 className="w-5 h-5 animate-spin text-vantage-yellow flex-shrink-0" />
              <div>
                <p className="text-base font-semibold text-vantage-text">Collecting homes near {scanStormName}…</p>
                <p className="text-xs text-vantage-muted mt-0.5">
                  Real addressed homes from OpenStreetMap, scored against NOAA radar + NWS spotter hail.
                </p>
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-3xl font-bold font-mono text-vantage-yellow tabular-nums leading-none">
                {scanState.found.toLocaleString()}
              </p>
              <p className="text-[10px] font-mono text-vantage-faint uppercase tracking-widest mt-1">homes found</p>
            </div>
          </div>
          <div className="h-2 rounded-full bg-vantage-surface overflow-hidden">
            <div
              className="h-full bg-vantage-yellow transition-[width] duration-150 ease-out"
              style={{ width: `${Math.round(scanState.progress * 100)}%` }}
            />
          </div>
          <p className="text-xs font-mono text-vantage-muted mt-3">{scanState.stage}</p>
          {/* Shimmer skeleton rows — homes streaming in */}
          <div className="mt-6 space-y-2.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3"
                style={{ animation: 'leadRowIn 600ms ease-out both', animationDelay: `${i * 90}ms` }}
              >
                <div className="w-11 h-11 rounded bg-vantage-surface animate-pulse" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-44 rounded bg-vantage-surface animate-pulse" />
                  <div className="h-2 w-24 rounded bg-vantage-surface animate-pulse" />
                </div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-vantage-faint mt-5">
            Browse a finished territory in the tabs above while this runs — it keeps collecting in the background.
          </p>
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

      {/* Lead list — one Clay-style table, best lead first. Rows expand for detail;
          a ✓ in the ROOF column marks checked roofs (they pop in live during batch). */}
      {!loading && hydrated && visible.length > 0 && (
        <div className="bg-vantage-card border border-vantage-border rounded-lg overflow-hidden">
          <LeadListHeader />
          <div className="divide-y divide-vantage-border/60">
            {visible.map((lead, i) => (
              <div
                key={lead.id}
                id={`lead-${lead.id}`}
                // Stagger only the top rows so a pre-built list visibly "populates" on the
                // Find-Leads click; rows below the fold appear immediately.
                className={clsx('transition-all duration-700', i < 28 && 'lead-row-in', highlightId === lead.id && 'ring-2 ring-inset ring-vantage-yellow')}
                style={i < 28 ? { animationDelay: `${i * 45}ms` } : undefined}
              >
                <LeadCard
                  lead={lead}
                  rank={i + 1}
                  onStatusChange={(s) => updateStatus(lead.id, s)}
                  analyzing={analyzingIds.has(lead.id)}
                  onAnalyze={() => handleAnalyze(lead.id)}
                  onAnalyzed={handleAnalyzed}
                  selected={selectedIds.has(lead.id)}
                  onSelectChange={(on) => toggleSelect(lead.id, on)}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && visible.length > 0 && (
        <p className="text-[10px] text-vantage-faint font-mono text-center pb-4">
          Address data: OpenStreetMap contributors · Lead scores: Vantage model · Not official damage assessments
        </p>
      )}
    </div>
  )
}
