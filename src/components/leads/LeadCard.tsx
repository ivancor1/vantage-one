'use client'

// Clay-style condensed lead row: one scannable line per home — address, hail evidence,
// roof state, score, status — with the full plain-English detail (sources, roof notes,
// deliverable actions) one click away. Roofers decide from the row; the expand builds trust.

import { useState } from 'react'
import {
  Home, CloudLightning, ScanLine, Loader2, ChevronDown,
  FileText, PenLine, Eye, Layers, X, Copy, Check,
} from 'lucide-react'
import clsx from 'clsx'
import Link from 'next/link'
import type { Lead, LeadStatus } from '@/lib/types'
import { leadScoreLabel, STATUS_META } from '@/lib/lead-scoring'

const STATUS_OPTIONS: { value: LeadStatus; label: string }[] = [
  { value: 'new',           label: 'New' },
  { value: 'knocked',       label: 'Knocked' },
  { value: 'interested',    label: 'Interested' },
  { value: 'inspection',    label: 'Inspection Booked' },
  { value: 'claim',         label: 'Claim Filed' },
  { value: 'closed',        label: 'Closed' },
  { value: 'not_qualified', label: 'Not Qualified' },
]

// Shared grid so the header and every row line up: pick · rank · photo · home · hail · roof · score · status · chevron
const GRID = 'grid grid-cols-[20px_24px_44px_minmax(0,1fr)_128px_100px_56px_128px_24px] items-center gap-3'

export function LeadListHeader() {
  return (
    <div className={clsx(GRID, 'px-4 py-2 border-b border-vantage-border bg-vantage-surface')}>
      <span />
      <span />
      <span />
      <span className="text-[9px] font-mono text-vantage-faint uppercase tracking-widest">Home</span>
      <span className="text-[9px] font-mono text-vantage-faint uppercase tracking-widest">Hail evidence</span>
      <span className="text-[9px] font-mono text-vantage-faint uppercase tracking-widest">Roof</span>
      <span className="text-[9px] font-mono text-vantage-faint uppercase tracking-widest text-right">Score</span>
      <span className="text-[9px] font-mono text-vantage-faint uppercase tracking-widest text-center">Status</span>
      <span />
    </div>
  )
}

function roofRead(score: number): { label: string; cls: string } {
  if (score >= 60) return { label: 'worn',      cls: 'text-status-high' }
  if (score >= 35) return { label: 'some wear', cls: 'text-status-elevated' }
  return               { label: 'looks ok',   cls: 'text-vantage-muted' }
}

type Props = {
  lead: Lead
  rank: number
  onStatusChange: (status: LeadStatus) => void
  analyzing: boolean
  onAnalyze: () => void
  // visualRoofScore null = the check FAILED — clear the spinner, change nothing
  onAnalyzed: (id: string, visualRoofScore: number | null, aiNotes: string, leadScore: number) => void
  selected: boolean
  onSelectChange: (selected: boolean) => void
}

export default function LeadCard({ lead, rank, onStatusChange, analyzing, onAnalyze, onAnalyzed, selected, onSelectChange }: Props) {
  const { label: scoreLabel, cls: scoreCls } = leadScoreLabel(lead.leadScore)
  const streetAddress = lead.address.split(',')[0]
  const cityLine = lead.address.split(',').slice(1).join(',').trim()
  const hasHail = lead.radarHailIn != null || lead.spotterHailIn != null
  const hasAI = lead.visualRoofScore != null
  const maxHail = Math.max(lead.radarHailIn ?? 0, lead.spotterHailIn ?? 0)
  const twoSources = lead.radarHailIn != null && lead.spotterHailIn != null

  const [expanded, setExpanded] = useState(false)
  const [imgOk, setImgOk] = useState(true) // expired/broken Mapbox tile → house icon, not a broken img
  const [letterOpen, setLetterOpen] = useState(false)
  const [letterText, setLetterText] = useState<string | null>(null)
  const [letterLoading, setLetterLoading] = useState(false)
  const [letterCopied, setLetterCopied] = useState(false)

  async function handleAnalyze(e?: React.MouseEvent) {
    e?.stopPropagation()
    onAnalyze()
    try {
      const res = await fetch(`/api/leads/${lead.id}/analyze`, { method: 'POST' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as { visualRoofScore: number; aiNotes?: string; leadScore?: number }
      onAnalyzed(lead.id, data.visualRoofScore, data.aiNotes ?? '', data.leadScore ?? lead.leadScore)
    } catch (err) {
      console.error('[analyze]', err)
      // Failed check ≠ "score 0 / looks ok" — report failure so nothing is written
      onAnalyzed(lead.id, lead.visualRoofScore ?? null, lead.aiNotes ?? '', lead.leadScore)
    }
  }

  async function openLetter(e: React.MouseEvent) {
    e.stopPropagation()
    setLetterOpen(true)
    if (letterText || letterLoading) return
    setLetterLoading(true)
    try {
      const res = await fetch(`/api/leads/${lead.id}/letter`, { method: 'POST' })
      const data = await res.json()
      setLetterText(res.ok && data.letter ? data.letter : 'Could not draft the notice — try again.')
    } catch {
      setLetterText('Could not draft the notice — try again.')
    } finally {
      setLetterLoading(false)
    }
  }

  async function copyLetter() {
    if (!letterText) return
    try {
      await navigator.clipboard.writeText(letterText)
      setLetterCopied(true)
      setTimeout(() => setLetterCopied(false), 1300)
    } catch { /* ignore */ }
  }

  return (
    <div className="bg-vantage-card">

      {/* ── The row ─────────────────────────────────────────────── */}
      <div
        onClick={() => setExpanded((v) => !v)}
        className={clsx(GRID, 'px-4 py-2.5 cursor-pointer hover:bg-black/[0.03] transition-colors', selected && 'bg-vantage-yellow-dim')}
      >
        <span onClick={(e) => e.stopPropagation()} className="flex items-center justify-center">
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) => onSelectChange(e.target.checked)}
            title="Pick this home for a route"
            className="w-3.5 h-3.5 accent-vantage-yellow cursor-pointer"
          />
        </span>
        <span className="text-xs font-mono text-vantage-faint text-center">{rank}</span>

        {lead.satelliteUrl && imgOk ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={lead.satelliteUrl} alt="" onError={() => setImgOk(false)} className="w-11 h-11 rounded object-cover border border-vantage-border" />
        ) : (
          <span className="w-11 h-11 rounded bg-vantage-surface border border-vantage-border flex items-center justify-center">
            <Home className="w-4 h-4 text-vantage-faint" />
          </span>
        )}

        <span className="min-w-0">
          <span className="block text-sm font-semibold text-vantage-text truncate">{streetAddress}</span>
          <span className="block text-[10px] text-vantage-faint truncate">{cityLine}</span>
        </span>

        {hasHail ? (
          <span className="flex items-center gap-1.5 text-xs text-vantage-text">
            <CloudLightning className="w-3.5 h-3.5 text-status-critical/70 flex-shrink-0" />
            <span className="font-mono font-semibold">{maxHail.toFixed(1)}″</span>
            <span className="text-vantage-muted">{twoSources ? '· 2 sources' : lead.radarHailIn != null ? '· radar' : '· reported'}</span>
          </span>
        ) : (
          <span className="text-xs text-vantage-faint">—</span>
        )}

        {analyzing ? (
          <span className="flex items-center gap-1.5 text-[11px] text-vantage-muted">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> checking…
          </span>
        ) : hasAI ? (
          <span className={clsx('flex items-center gap-1 text-[11px] font-medium', roofRead(lead.visualRoofScore!).cls)}>
            <Check className="w-3 h-3" /> {roofRead(lead.visualRoofScore!).label}
          </span>
        ) : lead.satelliteUrl ? (
          <button
            onClick={handleAnalyze}
            className="justify-self-start flex items-center gap-1 px-2 py-1 rounded border border-vantage-border text-[10px] text-vantage-muted hover:border-vantage-bright hover:text-vantage-text transition-colors"
          >
            <ScanLine className="w-3 h-3" /> Check
          </button>
        ) : (
          <span className="text-xs text-vantage-faint">—</span>
        )}

        <span className="text-right">
          <span className={clsx('block text-lg font-bold font-mono leading-none', scoreCls)}>{lead.leadScore}</span>
          <span className={clsx('block text-[8px] font-bold tracking-widest', scoreCls)}>{scoreLabel}</span>
        </span>

        <span onClick={(e) => e.stopPropagation()} className="relative block">
          {/* Visible pill — a plain span centers reliably; native selects never quite do */}
          <span className={clsx('block w-full px-1.5 py-1 rounded border text-center text-[10px] font-semibold', STATUS_META[lead.status].cls)}>
            {STATUS_META[lead.status].label}
          </span>
          <select
            value={lead.status}
            onChange={(e) => onStatusChange(e.target.value as LeadStatus)}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-vantage-card text-vantage-text">
                {opt.label}
              </option>
            ))}
          </select>
        </span>

        <ChevronDown className={clsx('w-4 h-4 text-vantage-faint transition-transform', expanded && 'rotate-180')} />
      </div>

      {/* ── Expanded detail — plain English, sources in the fine print ── */}
      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-vantage-border/60 bg-vantage-surface/50">
          <div className="flex gap-5 items-start pt-3">
            {lead.satelliteUrl && imgOk && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={lead.satelliteUrl} alt="Aerial view" onError={() => setImgOk(false)} className="w-[140px] rounded border border-vantage-border flex-shrink-0" />
            )}

            <div className="flex-1 min-w-0 space-y-2.5 text-xs">
              {hasHail && (
                <div>
                  <p className="text-vantage-text">
                    <span className="font-semibold">Hail at this address:</span>
                    {lead.radarHailIn != null && ` radar estimate ${lead.radarHailIn}″`}
                    {lead.radarHailIn != null && lead.spotterHailIn != null && ' · '}
                    {lead.spotterHailIn != null && `spotter report ${lead.spotterHailIn}″`}
                    {lead.nearestReportKm != null && ` · nearest data point ${lead.nearestReportKm} km away`}
                  </p>
                  <p className="text-[9px] font-mono text-vantage-faint mt-0.5">
                    NOAA NEXRAD radar · NWS storm reports · interpolated to this address
                  </p>
                </div>
              )}
              {!hasHail && (
                <p className="text-vantage-muted">No hail evidence near this home — score is from property &amp; area factors only.</p>
              )}

              {hasAI && (
                <div>
                  <p className="text-vantage-text">
                    <span className="font-semibold">Roof from above:</span> {lead.aiNotes || roofRead(lead.visualRoofScore!).label}
                  </p>
                  <p className="text-[9px] font-mono text-vantage-faint mt-0.5">
                    AI read of aerial imagery · may predate the storm · not an inspection
                  </p>
                </div>
              )}

              <div>
                <p className="text-vantage-muted">
                  {lead.yearBuilt ? `Built ${lead.yearBuilt}` : 'Build year unknown'}
                  {lead.footprintSqm != null && ` · ≈ ${Math.round((lead.footprintSqm * 1.15) / 9.29)} roofing squares`}
                  {lead.areaHousingAgeLabel && ` · area housing: ${lead.areaHousingAgeLabel}`}
                  {lead.historicalHailRiskLabel && ` · hail history: ${lead.historicalHailRiskLabel.toLowerCase()}`}
                </p>
                <p className="text-[9px] font-mono text-vantage-faint mt-0.5">
                  OpenStreetMap · Census ACS (area) · FEMA National Risk Index (county)
                </p>
              </div>

              {lead.nearestStormName && (
                <p className="text-[10px] font-mono text-status-critical/80">
                  Storm: {lead.nearestStormName}
                </p>
              )}
            </div>

            {/* Actions — labeled, since there's room here */}
            <div className="flex flex-col gap-1.5 flex-shrink-0 w-[150px]" onClick={(e) => e.stopPropagation()}>
              <Link
                href={`/leads/${lead.id}/report`}
                target="_blank"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-vantage-border text-[11px] text-vantage-muted hover:border-vantage-bright hover:text-vantage-text transition-colors"
              >
                <FileText className="w-3.5 h-3.5" /> Evidence report
              </Link>
              <button
                onClick={openLetter}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-vantage-border text-[11px] text-vantage-muted hover:border-vantage-bright hover:text-vantage-text transition-colors"
              >
                <PenLine className="w-3.5 h-3.5" /> Draft letter
              </button>
              <a
                href={`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lead.lat},${lead.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-vantage-border text-[11px] text-vantage-muted hover:border-vantage-bright hover:text-vantage-text transition-colors"
              >
                <Eye className="w-3.5 h-3.5" /> Street view
              </a>
              <Link
                href="/shingle-analysis"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-vantage-border text-[11px] text-vantage-muted hover:border-vantage-bright hover:text-vantage-text transition-colors"
              >
                <Layers className="w-3.5 h-3.5" /> Shingle lookup
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ── Homeowner-notice modal ── */}
      {letterOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/40" onClick={() => setLetterOpen(false)}>
          <div
            className="bg-vantage-card border border-vantage-border rounded-lg w-[480px] max-w-[92vw] p-5 space-y-3 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-vantage-text">Homeowner notice — {streetAddress}</p>
              <button onClick={() => setLetterOpen(false)} className="p-1 rounded text-vantage-faint hover:text-vantage-text">
                <X className="w-4 h-4" />
              </button>
            </div>
            {letterLoading ? (
              <div className="py-8 text-center text-vantage-faint text-xs font-mono flex items-center justify-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> drafting from this home&apos;s hail data…
              </div>
            ) : (
              <>
                <textarea
                  readOnly
                  value={letterText ?? ''}
                  className="w-full h-48 bg-vantage-surface border border-vantage-border rounded p-3 text-xs text-vantage-text leading-relaxed resize-none outline-none"
                />
                <div className="flex items-center justify-between">
                  <p className="text-[9px] text-vantage-faint font-mono">drafted from NOAA/NWS data · review before use</p>
                  <button
                    onClick={copyLetter}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-vantage-yellow text-vantage-black text-xs font-bold hover:opacity-90 transition-opacity"
                  >
                    {letterCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {letterCopied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
