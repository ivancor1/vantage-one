'use client'

import { X, CloudLightning, Wind, FlaskConical, FileText } from 'lucide-react'
import type { Storm } from '@/lib/types'

function severityBadge(s: number) {
  if (s >= 9) return { label: 'CRITICAL', cls: 'bg-status-critical/15 text-status-critical border-status-critical/30' }
  if (s >= 7) return { label: 'HIGH',     cls: 'bg-status-high/15 text-status-high border-status-high/30' }
  return          { label: 'ELEVATED',   cls: 'bg-vantage-yellow-dim text-vantage-yellow border-vantage-yellow/30' }
}

type Props = {
  storm: Storm
  onClose: () => void
}

export default function StormDetailPanel({ storm, onClose }: Props) {
  const badge = severityBadge(storm.severity)
  const dateStr = new Date(storm.date).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })

  return (
    <div className="absolute top-0 right-0 h-full w-[300px] bg-vantage-surface border-l border-vantage-border z-[1000] flex flex-col shadow-2xl">

      {/* Header */}
      <div className="flex items-start justify-between px-5 py-4 border-b border-vantage-border">
        <div className="flex flex-col gap-1.5">
          <p className="text-[10px] font-mono text-vantage-faint uppercase tracking-widest">
            NWS Local Storm Report · WFO {storm.wfo}
          </p>
          <h3 className="text-sm font-semibold text-vantage-text leading-snug">
            {storm.name}
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-vantage-muted">{storm.location}</span>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${badge.cls} tracking-wider`}>
              {badge.label}
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded text-vantage-faint hover:text-vantage-text hover:bg-black/[0.04] transition-colors flex-shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Date */}
      <div className="px-5 py-3 border-b border-vantage-border">
        <p className="text-[11px] text-vantage-faint uppercase tracking-widest mb-1">Date</p>
        <p className="text-sm text-vantage-text font-medium">{dateStr}</p>
      </div>

      {/* NWS official metrics */}
      <div className="px-5 py-3 border-b border-vantage-border">
        <p className="text-[9px] font-mono text-vantage-faint uppercase tracking-widest mb-2.5">
          NWS Official
        </p>
        <div className="grid grid-cols-2 gap-3">
          {storm.hailSize > 0 && (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1">
                <CloudLightning className="w-3 h-3 text-status-critical opacity-60" />
                <p className="text-[10px] text-vantage-faint uppercase tracking-wider">Max Hail</p>
              </div>
              <p className="text-lg font-bold font-mono text-status-critical">{storm.hailSize}"</p>
            </div>
          )}
          {storm.windSpeed > 0 && (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1">
                <Wind className="w-3 h-3 text-status-high opacity-60" />
                <p className="text-[10px] text-vantage-faint uppercase tracking-wider">Max Wind</p>
              </div>
              <p className="text-lg font-bold font-mono text-status-high">{storm.windSpeed} mph</p>
            </div>
          )}
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1">
              <FileText className="w-3 h-3 text-vantage-faint opacity-60" />
              <p className="text-[10px] text-vantage-faint uppercase tracking-wider">Reports</p>
            </div>
            <p className="text-lg font-bold font-mono text-vantage-text">{storm.reportCount}</p>
          </div>
        </div>
      </div>

      {/* Vantage modeled metrics */}
      <div className="px-5 py-3 border-b border-vantage-border">
        <div className="flex items-center gap-1.5 mb-2.5">
          <FlaskConical className="w-3 h-3 text-vantage-yellow opacity-60" />
          <p className="text-[9px] font-mono text-vantage-faint uppercase tracking-widest">
            Modeled by Vantage
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <p className="text-[10px] text-vantage-faint uppercase tracking-wider">Severity</p>
            <p className="text-lg font-bold font-mono text-vantage-yellow">{storm.severity}</p>
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-[10px] text-vantage-faint uppercase tracking-wider">Hail Reports</p>
            <p className="text-lg font-bold font-mono text-vantage-text">{storm.reports.filter((r) => r.type === 'HAIL').length}</p>
          </div>
        </div>
        <p className="text-[9px] text-vantage-faint mt-2 leading-relaxed">
          Estimate only. Not an official storm path.
        </p>
      </div>

      {/* CTA */}
      <div className="p-5 mt-auto">
        <a
          href={`/storms/${storm.id}`}
          className="flex items-center justify-center w-full py-2.5 rounded bg-vantage-yellow text-vantage-black text-sm font-bold tracking-wide hover:bg-vantage-yellow/90 transition-colors"
        >
          View Storm Reports →
        </a>
      </div>
    </div>
  )
}
