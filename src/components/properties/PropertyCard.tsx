'use client'

import { Home, CalendarDays, Plus, MapPin } from 'lucide-react'
import type { Property, LeadStatus } from '@/lib/types'
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

type Props = {
  property: Property
  rank: number
  status: LeadStatus
  onStatusChange: (status: LeadStatus) => void
  stormName?: string
}

export default function PropertyCard({ property, rank, status, onStatusChange, stormName }: Props) {
  const { label: scoreLabel, cls: scoreCls } = leadScoreLabel(property.leadScore)
  const statusMeta = STATUS_META[status]
  const streetAddress = property.address.split(',')[0]
  const cityLine = property.address.split(',').slice(1).join(',').trim()

  return (
    <div className="bg-vantage-card border border-vantage-border rounded-lg overflow-hidden flex hover:border-vantage-bright transition-colors">

      {/* Rank stripe */}
      <div className="w-8 flex-shrink-0 flex items-start justify-center pt-4 bg-vantage-surface border-r border-vantage-border">
        <span className="text-xs font-mono text-vantage-faint">{rank}</span>
      </div>

      {/* Image or placeholder */}
      {property.satelliteUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <div className="w-[120px] flex-shrink-0 relative bg-vantage-surface overflow-hidden">
          <img
            src={property.satelliteUrl}
            alt={streetAddress}
            className="absolute inset-0 w-full h-full object-cover opacity-80"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent to-vantage-card/30" />
        </div>
      ) : (
        <div className="w-[80px] flex-shrink-0 bg-vantage-surface flex items-center justify-center border-r border-vantage-border">
          <Home className="w-5 h-5 text-vantage-faint" />
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 min-w-0 px-4 py-3 flex flex-col gap-2.5">
        {/* Address + storm badge */}
        <div>
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-vantage-text">{streetAddress}</p>
            {stormName && (
              <span className="text-[10px] font-mono text-vantage-faint border border-vantage-border rounded px-1.5 py-0.5 flex-shrink-0 whitespace-nowrap">
                {stormName}
              </span>
            )}
          </div>
          {cityLine && <p className="text-xs text-vantage-muted">{cityLine}</p>}
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-4 text-xs text-vantage-faint flex-wrap">
          <span className="flex items-center gap-1">
            <CalendarDays className="w-3 h-3" />
            {property.roofAge != null ? `Roof: ~${property.roofAge} yrs` : 'Roof age unknown'}
          </span>
          {property.distanceKm != null && (
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {property.distanceKm} km from centroid
            </span>
          )}
        </div>

        {/* Notes or source attribution */}
        {property.aiNotes ? (
          <p className="text-xs text-vantage-muted leading-relaxed line-clamp-2">
            {property.aiNotes}
          </p>
        ) : (
          <p className="text-[10px] text-vantage-faint font-mono">
            Address: {property.dataSource ?? 'Unknown source'} · Lead score: Vantage model (proximity + severity + age)
          </p>
        )}

      </div>

      {/* Right panel */}
      <div className="w-[140px] flex-shrink-0 flex flex-col items-center justify-between py-4 px-3 border-l border-vantage-border gap-3">
        <div className="text-center">
          <p className={`text-4xl font-bold font-mono leading-none ${scoreCls}`}>
            {property.leadScore}
          </p>
          <p className={`text-[10px] font-bold tracking-widest mt-1 ${scoreCls}`}>
            {scoreLabel}
          </p>
          <p className="text-[9px] text-vantage-faint mt-0.5 font-mono">Vantage score</p>
        </div>

        <div className="w-full">
          <p className="text-[10px] text-vantage-faint uppercase tracking-widest mb-1.5 text-center">Status</p>
          <div className="relative">
            {/* Visible pill — a plain div centers reliably; native selects never quite do */}
            <div className={`w-full px-2 py-1 rounded border text-center text-[11px] font-semibold ${statusMeta.cls}`}>
              {statusMeta.label}
            </div>
            <select
              value={status}
              onChange={(e) => onStatusChange(e.target.value as LeadStatus)}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-vantage-card text-vantage-text">
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded border border-vantage-yellow/30 text-vantage-yellow text-xs font-semibold hover:bg-vantage-yellow-dim transition-colors">
          <Plus className="w-3 h-3" />
          Add Route
        </button>
      </div>
    </div>
  )
}
