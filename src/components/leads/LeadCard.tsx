'use client'

import { CalendarDays, CloudLightning, FlaskConical, Home, ScanLine, Loader2 } from 'lucide-react'
import clsx from 'clsx'
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

function DamageBar({ score }: { score: number }) {
  const pct = score
  const color = score >= 70 ? '#EF4444' : score >= 50 ? '#F97316' : score >= 30 ? '#F0C020' : '#4ADE80'
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-1.5 bg-vantage-border rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-[10px] font-mono font-semibold flex-shrink-0" style={{ color }}>{score}</span>
    </div>
  )
}

type Props = {
  lead: Lead
  rank: number
  onStatusChange: (status: LeadStatus) => void
  analyzing: boolean
  onAnalyze: () => void
  onAnalyzed: (id: string, visualRoofScore: number, aiNotes: string, leadScore: number) => void
}

export default function LeadCard({ lead, rank, onStatusChange, analyzing, onAnalyze, onAnalyzed }: Props) {
  const { label: scoreLabel, cls: scoreCls } = leadScoreLabel(lead.leadScore)
  const statusMeta = STATUS_META[lead.status]
  const streetAddress = lead.address.split(',')[0]
  const cityLine = lead.address.split(',').slice(1).join(',').trim()
  const hasStorm = lead.stormScore != null && lead.nearestStormName
  const hasAI = lead.visualRoofScore != null
  const hasCensus = lead.areaHousingAgeLabel != null
  const hasFema = lead.historicalHailRiskLabel != null

  const scoreSubLabel =
    hasStorm && hasAI && hasFema ? 'Storm + AI + Hail risk' :
    hasStorm && hasAI            ? 'Storm + AI score' :
    hasStorm && hasCensus        ? 'Storm + Area signal' :
    hasStorm                     ? 'Storm score' :
    hasAI                        ? 'AI visual score' :
    hasCensus                    ? 'Area signal score' :
                                   'Base score'

  const confidenceDot =
    lead.scoreConfidence === 'high'   ? 'bg-status-success' :
    lead.scoreConfidence === 'medium' ? 'bg-vantage-yellow' :
    lead.scoreConfidence === 'low'    ? 'bg-vantage-faint' : null

  async function handleAnalyze() {
    onAnalyze()
    try {
      const res = await fetch(`/api/leads/${lead.id}/analyze`, { method: 'POST' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as { cached?: boolean; visualRoofScore: number; aiNotes?: string; leadScore?: number }
      onAnalyzed(
        lead.id,
        data.visualRoofScore,
        data.aiNotes ?? '',
        data.leadScore ?? lead.leadScore,
      )
    } catch (err) {
      console.error('[analyze]', err)
      // signal done with no change so spinner clears
      onAnalyzed(lead.id, lead.visualRoofScore ?? 0, lead.aiNotes ?? '', lead.leadScore)
    }
  }

  return (
    <div className="bg-vantage-card border border-vantage-border rounded-lg overflow-hidden flex hover:border-vantage-bright transition-colors">

      {/* Rank stripe */}
      <div className="w-8 flex-shrink-0 flex items-start justify-center pt-4 bg-vantage-surface border-r border-vantage-border">
        <span className="text-xs font-mono text-vantage-faint">{rank}</span>
      </div>

      {/* Satellite thumbnail */}
      <div className="w-[100px] flex-shrink-0 border-r border-vantage-border overflow-hidden">
        {lead.satelliteUrl ? (
          <img
            src={lead.satelliteUrl}
            alt="Current roof view"
            className="w-full h-full object-cover"
            style={{ minHeight: '100px' }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-vantage-surface" style={{ minHeight: '100px' }}>
            <Home className="w-6 h-6 text-vantage-faint" />
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0 px-4 py-3 flex flex-col gap-2">

        {/* Address + territory badge */}
        <div>
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-vantage-text">{streetAddress}</p>
            {lead.territoryValue && (
              <span className="text-[10px] font-mono text-vantage-faint border border-vantage-border rounded px-1.5 py-0.5 flex-shrink-0 whitespace-nowrap">
                {lead.territoryValue}
              </span>
            )}
          </div>
          {cityLine && <p className="text-xs text-vantage-muted">{cityLine}</p>}
        </div>

        {/* Meta row */}
        <div className="flex flex-col gap-1 text-xs text-vantage-faint">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="flex items-center gap-1">
              <CalendarDays className="w-3 h-3" />
              {lead.yearBuilt
                ? `Built ${lead.yearBuilt} · Age est. ${new Date().getFullYear() - lead.yearBuilt} yrs`
                : lead.areaHousingAgeLabel
                  ? `Area housing stock: ${lead.areaHousingAgeLabel.charAt(0).toUpperCase() + lead.areaHousingAgeLabel.slice(1)}`
                  : 'Year unknown'}
            </span>
            {lead.distanceToHailCoreKm != null ? (
              <span className="flex items-center gap-1">
                <CloudLightning className="w-3 h-3 text-status-critical/60" />
                {lead.distanceToHailCoreKm} km from hail core
                {lead.insideHailSwath === false && (
                  <span className="text-[9px] font-mono text-vantage-faint/60 ml-1">outside primary swath</span>
                )}
              </span>
            ) : lead.distanceToStormKm != null ? (
              <span className="flex items-center gap-1">
                <CloudLightning className="w-3 h-3 text-status-critical/60" />
                {lead.distanceToStormKm} km from storm
              </span>
            ) : null}
          </div>
          {!lead.yearBuilt && lead.areaHousingAgeLabel && (
            <span className="text-[9px] font-mono text-vantage-faint/60">source: Census ACS 5-yr · area-level</span>
          )}
          {lead.historicalHailRiskLabel && (
            <div className="flex flex-col gap-0.5">
              <span className="flex items-center gap-1">
                <CloudLightning className="w-3 h-3 text-vantage-yellow/70" />
                Historical hail: {lead.historicalHailRiskLabel}
              </span>
              <span className="text-[9px] font-mono text-vantage-faint/60">source: FEMA National Risk Index</span>
            </div>
          )}
        </div>

        {/* Score context */}
        {hasStorm ? (
          <div className="flex items-center gap-1.5">
            <CloudLightning className="w-3 h-3 text-status-critical flex-shrink-0" />
            <p className="text-[10px] text-status-critical/80 font-mono">
              Storm-adjusted · {lead.nearestStormName}
              {lead.nearestStormSeverity != null && ` · severity ${lead.nearestStormSeverity}`}
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <FlaskConical className="w-3 h-3 text-vantage-faint flex-shrink-0" />
            <p className="text-[10px] text-vantage-faint font-mono">
              No recent storm match · Score based on property &amp; roof factors only
            </p>
          </div>
        )}

        {/* AI analysis block */}
        {hasAI ? (
          <div className="space-y-1.5 pt-0.5">
            <DamageBar score={lead.visualRoofScore!} />
            {lead.aiNotes && (
              <p className="text-[10px] text-vantage-muted leading-snug line-clamp-2">{lead.aiNotes}</p>
            )}
            <p className="text-[9px] text-vantage-faint font-mono">
              AI visual assessment · not a confirmed inspection
            </p>
          </div>
        ) : lead.satelliteUrl ? (
          <button
            onClick={handleAnalyze}
            disabled={analyzing}
            className="flex items-center gap-1.5 self-start px-2.5 py-1 rounded border border-vantage-border text-[10px] text-vantage-muted hover:border-vantage-bright hover:text-vantage-text transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {analyzing
              ? <Loader2 className="w-3 h-3 animate-spin" />
              : <ScanLine className="w-3 h-3" />
            }
            {analyzing ? 'Analyzing...' : 'Analyze Roof'}
          </button>
        ) : null}
      </div>

      {/* Right panel */}
      <div className="w-[140px] flex-shrink-0 flex flex-col items-center justify-between py-4 px-3 border-l border-vantage-border gap-3">
        <div className="text-center">
          <p className={clsx('text-4xl font-bold font-mono leading-none', scoreCls)}>
            {lead.leadScore}
          </p>
          <p className={clsx('text-[10px] font-bold tracking-widest mt-1', scoreCls)}>
            {scoreLabel}
          </p>
          <p className="text-[9px] text-vantage-faint mt-0.5 font-mono">
            {scoreSubLabel}
          </p>
          {confidenceDot && (
            <div className="flex items-center justify-center gap-1 mt-1" title="Score confidence based on available data signals">
              <div className={clsx('w-1.5 h-1.5 rounded-full', confidenceDot)} />
              <span className="text-[9px] font-mono text-vantage-faint uppercase tracking-widest">
                {lead.scoreConfidence}
              </span>
            </div>
          )}
        </div>

        <div className="w-full">
          <p className="text-[10px] text-vantage-faint uppercase tracking-widest mb-1.5 text-center">Status</p>
          <div className={clsx('w-full px-2 py-1 rounded border text-center', statusMeta.cls)}>
            <select
              value={lead.status}
              onChange={(e) => onStatusChange(e.target.value as LeadStatus)}
              className="w-full bg-transparent text-[11px] font-semibold text-center appearance-none cursor-pointer outline-none"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-vantage-card text-vantage-text">
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  )
}
