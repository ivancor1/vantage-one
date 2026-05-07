'use client'

import { X, CloudLightning, Wind, Home, Hash } from 'lucide-react'
import type { Storm } from '@/lib/mock-data'

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
            Storm Event
          </p>
          <h3 className="text-sm font-semibold text-vantage-text leading-snug">
            {storm.name}
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-vantage-muted">{storm.location}</span>
            <span
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${badge.cls} tracking-wider`}
            >
              {badge.label}
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded text-vantage-faint hover:text-vantage-text hover:bg-white/5 transition-colors flex-shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Date */}
      <div className="px-5 py-3 border-b border-vantage-border">
        <p className="text-[11px] text-vantage-faint uppercase tracking-widest mb-1">Date</p>
        <p className="text-sm text-vantage-text font-medium">{dateStr}</p>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 border-b border-vantage-border">
        {[
          { icon: CloudLightning, label: 'Hail Size',  value: `${storm.hailSize}"`,              color: 'text-status-critical' },
          { icon: Wind,           label: 'Wind Speed', value: `${storm.windSpeed} mph`,           color: 'text-status-high' },
          { icon: Hash,           label: 'Severity',   value: storm.severity.toString(),          color: 'text-vantage-yellow' },
          { icon: Home,           label: 'Est. Homes', value: storm.estimatedHomes.toLocaleString(), color: 'text-vantage-text' },
        ].map(({ icon: Icon, label, value, color }, i) => (
          <div
            key={label}
            className={`flex flex-col gap-1.5 px-5 py-4 ${i % 2 === 0 ? 'border-r border-vantage-border' : ''} ${i < 2 ? 'border-b border-vantage-border' : ''}`}
          >
            <div className="flex items-center gap-1.5">
              <Icon className={`w-3 h-3 ${color} opacity-60`} />
              <p className="text-[10px] text-vantage-faint uppercase tracking-wider">{label}</p>
            </div>
            <p className={`text-lg font-bold font-mono ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Affected zips */}
      <div className="px-5 py-4 border-b border-vantage-border">
        <p className="text-[10px] text-vantage-faint uppercase tracking-widest mb-2.5">
          Affected ZIP Codes
        </p>
        <div className="flex flex-wrap gap-1.5">
          {storm.affectedZips.map((zip) => (
            <span
              key={zip}
              className="text-xs font-mono px-2 py-0.5 rounded bg-vantage-card border border-vantage-border text-vantage-muted"
            >
              {zip}
            </span>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="p-5 mt-auto">
        <a
          href={`/storms/${storm.id}`}
          className="flex items-center justify-center w-full py-2.5 rounded bg-vantage-yellow text-vantage-black text-sm font-bold tracking-wide hover:bg-vantage-yellow/90 transition-colors"
        >
          View Affected Properties →
        </a>
      </div>
    </div>
  )
}
