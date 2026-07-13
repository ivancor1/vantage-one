'use client'

import clsx from 'clsx'
import { ExternalLink, Download, AlertTriangle } from 'lucide-react'
import type { ShingleAnalysisResult, EvidenceItem, ShingleStatus, SourceType } from '@/lib/shingle-analysis/types'

const STATUS_CONFIG: Record<ShingleStatus, { label: string; cls: string; badgeCls: string }> = {
  discontinued: {
    label: 'DISCONTINUED',
    cls: 'text-status-critical',
    badgeCls: 'bg-status-critical/15 border-status-critical/40 text-status-critical',
  },
  active: {
    label: 'ACTIVE / NOT DISCONTINUED',
    cls: 'text-status-success',
    badgeCls: 'bg-status-success/15 border-status-success/40 text-status-success',
  },
  regional: {
    label: 'PARTIALLY DISCONTINUED — REGIONAL',
    cls: 'text-status-high',
    badgeCls: 'bg-status-high/15 border-status-high/40 text-status-high',
  },
  limited: {
    label: 'LIMITED — SPECIAL ORDER ONLY',
    cls: 'text-vantage-yellow',
    badgeCls: 'bg-vantage-yellow-dim border-vantage-yellow/40 text-vantage-yellow',
  },
  unknown: {
    label: 'UNKNOWN / NOT ENOUGH EVIDENCE',
    cls: 'text-vantage-muted',
    badgeCls: 'bg-vantage-card border-vantage-border text-vantage-muted',
  },
}

const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  manufacturer_psa:  'Manufacturer PSA',
  manufacturer_page: 'Manufacturer Page',
  distributor:       'Distributor',
  retailer:          'Retailer',
  contractor_blog:   'Contractor Blog',
  other:             'Other',
}

const SOURCE_TYPE_CLS: Record<SourceType, string> = {
  manufacturer_psa:  'bg-status-critical/10 text-status-critical border-status-critical/30',
  manufacturer_page: 'bg-blue-900/20 text-blue-400 border-blue-700/30',
  distributor:       'bg-status-success/10 text-status-success border-status-success/30',
  retailer:          'bg-vantage-card text-vantage-muted border-vantage-border',
  contractor_blog:   'bg-vantage-card text-vantage-faint border-vantage-border',
  other:             'bg-vantage-card text-vantage-faint border-vantage-border',
}

const STRENGTH_CLS = {
  strong: 'text-status-success',
  medium: 'text-vantage-yellow',
  weak:   'text-vantage-faint',
}

const CONFIDENCE_DOT = {
  high:   'bg-status-success',
  medium: 'bg-vantage-yellow',
  low:    'bg-vantage-faint',
}

function getDomain(url: string): string {
  try { return new URL(url).hostname.replace('www.', '') } catch { return url }
}

function buildExportText(result: ShingleAnalysisResult): string {
  const lines: string[] = [
    'SHINGLE ANALYSIS REPORT',
    '=======================',
    `Query:       ${result.query}`,
    `Status:      ${result.statusLabel}`,
    `Confidence:  ${result.confidence.toUpperCase()}`,
    `Searched at: ${new Date(result.searchedAt).toLocaleString()}`,
    `Provider:    ${result.searchProvider}`,
    '',
    'EVIDENCE SUMMARY',
    '----------------',
    result.evidenceSummary,
    '',
  ]

  if (result.regionalNote) {
    lines.push('REGIONAL NOTE', '-------------')
    if (result.regionalNote.discontinuedIn.length) {
      lines.push(`Discontinued in: ${result.regionalNote.discontinuedIn.join(', ')}`)
    }
    if (result.regionalNote.activeIn.length) {
      lines.push(`Still active in: ${result.regionalNote.activeIn.join(', ')}`)
    }
    lines.push('')
  }

  if (result.replacedBy) {
    lines.push('REPLACEMENT', '-----------', `Replaced by: ${result.replacedBy}`)
    if (result.replacedByNote) lines.push(`Note: ${result.replacedByNote}`)
    lines.push('')
  }

  lines.push('REASONING', '---------')
  result.reasoning.forEach((r) => lines.push(`- ${r}`))
  lines.push('')

  lines.push('EVIDENCE SOURCES', '----------------')
  result.evidenceItems.forEach((item, i) => {
    lines.push(
      `[${i + 1}] ${item.title}`,
      `    URL:         ${item.url}`,
      `    Source type: ${SOURCE_TYPE_LABELS[item.sourceType]}`,
      `    Finding:     ${item.finding}`,
      `    Strength:    ${item.strength}`,
      '',
    )
  })

  lines.push(
    'DISCLAIMER',
    '----------',
    'This analysis is based on available online sources including manufacturer announcements,',
    'distributor notices, and retailer data. It does not guarantee insurance approval or roof',
    'replacement. Use this as supporting evidence alongside photos, supplier quotes, and your',
    "state's matching guidelines.",
  )

  return lines.join('\n')
}

function exportReport(result: ShingleAnalysisResult) {
  const text = buildExportText(result)
  const blob = new Blob([text], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const slug = result.query.replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 40)
  a.download = `shingle-analysis-${slug}.txt`
  a.click()
  URL.revokeObjectURL(url)
}

function EvidenceRow({ item }: { item: EvidenceItem }) {
  return (
    <div className="border border-vantage-border rounded-lg p-3 space-y-1.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-vantage-text leading-snug">{item.title}</p>
          <p className="text-[10px] text-vantage-faint font-mono mt-0.5">{getDomain(item.url)}</p>
        </div>
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-shrink-0 text-vantage-faint hover:text-vantage-text transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <span className={clsx('text-[9px] font-mono font-semibold border rounded px-1.5 py-0.5 uppercase tracking-widest', SOURCE_TYPE_CLS[item.sourceType])}>
          {SOURCE_TYPE_LABELS[item.sourceType]}
        </span>
        <span className={clsx('text-[9px] font-mono uppercase tracking-widest', STRENGTH_CLS[item.strength])}>
          {item.strength} signal
        </span>
      </div>
      <p className="text-[10px] text-vantage-muted leading-snug">{item.finding}</p>
      {item.snippet && (
        <p className="text-[9px] text-vantage-faint font-mono leading-snug line-clamp-2 border-l-2 border-vantage-border pl-2">
          {item.snippet}
        </p>
      )}
    </div>
  )
}

export default function ResultCard({ result }: { result: ShingleAnalysisResult }) {
  const statusConfig = STATUS_CONFIG[result.status]

  return (
    <div className="space-y-4">

      {/* Mock mode banner */}
      {result.searchProvider === 'mock' && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-vantage-yellow-dim border border-vantage-yellow/40 rounded-lg">
          <AlertTriangle className="w-4 h-4 text-vantage-yellow flex-shrink-0" />
          <p className="text-xs font-medium text-vantage-yellow">
            Mock mode — no live search API key configured. Results are illustrative only.
          </p>
        </div>
      )}

      {/* Status badge */}
      <div className={clsx('w-full py-4 px-5 border rounded-lg text-center', statusConfig.badgeCls)}>
        <p className="text-xl font-bold tracking-wider">{statusConfig.label}</p>
        {result.query && (
          <p className="text-sm mt-1 opacity-70 font-mono">{result.query}</p>
        )}
      </div>

      {/* Confidence */}
      <div className="flex items-center gap-2">
        <div className={clsx('w-2 h-2 rounded-full', CONFIDENCE_DOT[result.confidence])} />
        <span className="text-[11px] font-mono text-vantage-faint uppercase tracking-widest">
          {result.confidence} confidence
        </span>
        {result.manufacturer && (
          <span className="text-[10px] text-vantage-faint border border-vantage-border rounded px-1.5 py-0.5 font-mono ml-auto">
            {result.manufacturer}
            {result.productLine && ` · ${result.productLine}`}
          </span>
        )}
      </div>

      {/* Regional callout */}
      {result.regionalNote && (
        <div className="p-4 bg-status-high/10 border border-status-high/30 rounded-lg space-y-2">
          <p className="text-xs font-semibold text-status-high">Regional Availability</p>
          {result.regionalNote.discontinuedIn.length > 0 && (
            <div>
              <p className="text-[10px] text-vantage-faint uppercase tracking-widest font-mono mb-1">Discontinued in</p>
              <p className="text-xs text-vantage-muted">{result.regionalNote.discontinuedIn.join(', ')}</p>
            </div>
          )}
          {result.regionalNote.activeIn.length > 0 && (
            <div>
              <p className="text-[10px] text-vantage-faint uppercase tracking-widest font-mono mb-1">Still active in</p>
              <p className="text-xs text-vantage-muted">{result.regionalNote.activeIn.join(', ')}</p>
            </div>
          )}
          <p className="text-[10px] text-vantage-faint">Check with your local distributor to confirm availability in your market.</p>
        </div>
      )}

      {/* Replacement callout */}
      {result.replacedBy && (
        <div className="p-4 bg-blue-900/15 border border-blue-700/30 rounded-lg space-y-1">
          <p className="text-xs font-semibold text-blue-400">Replaced by: {result.replacedBy}</p>
          {result.replacedByNote && (
            <p className="text-[10px] text-vantage-muted leading-snug">{result.replacedByNote}</p>
          )}
        </div>
      )}

      {/* Evidence summary */}
      <div className="bg-vantage-card border border-vantage-border rounded-lg px-4 py-3">
        <p className="text-[10px] text-vantage-faint uppercase tracking-widest font-mono mb-1.5">Evidence Summary</p>
        <p className="text-sm text-vantage-text leading-relaxed">{result.evidenceSummary}</p>
      </div>

      {/* Reasoning */}
      {result.reasoning.length > 0 && (
        <div className="bg-vantage-card border border-vantage-border rounded-lg px-4 py-3">
          <p className="text-[10px] text-vantage-faint uppercase tracking-widest font-mono mb-2">How we decided</p>
          <ul className="space-y-1">
            {result.reasoning.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-vantage-muted">
                <span className="text-vantage-faint flex-shrink-0 font-mono">—</span>
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Evidence sources */}
      {result.evidenceItems.length > 0 && (
        <div>
          <p className="text-[10px] text-vantage-faint uppercase tracking-widest font-mono mb-2">
            Evidence Sources ({result.evidenceItems.length})
          </p>
          <div className="space-y-2">
            {result.evidenceItems.map((item, i) => (
              <EvidenceRow key={i} item={item} />
            ))}
          </div>
        </div>
      )}

      {/* Export + disclaimer */}
      <div className="space-y-3 pt-2 border-t border-vantage-border">
        <button
          onClick={() => exportReport(result)}
          className="flex items-center gap-2 text-xs text-vantage-muted border border-vantage-border rounded-lg px-3 py-2 hover:border-vantage-bright hover:text-vantage-text transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          Export Evidence Report
        </button>
        <p className="text-[9px] text-vantage-faint leading-relaxed font-mono">
          This analysis is based on available online sources including manufacturer announcements, distributor notices,
          and retailer data. It does not guarantee insurance approval or roof replacement. Use this as supporting evidence
          alongside photos, supplier quotes, and your state&apos;s matching guidelines.
        </p>
      </div>
    </div>
  )
}
