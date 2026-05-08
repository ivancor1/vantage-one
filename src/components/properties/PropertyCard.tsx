'use client'

import Image from 'next/image'
import { ShieldCheck, CalendarDays, Plus } from 'lucide-react'
import type { Property, LeadStatus } from '@/lib/mock-data'
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
  const pct = (score / 10) * 100
  const color =
    score >= 8 ? '#EF4444' :
    score >= 6 ? '#F97316' :
    score >= 4 ? '#F0C020' : '#6B7280'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-vantage-border rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs font-mono text-vantage-muted w-7 text-right">{score}</span>
    </div>
  )
}

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

      {/* Satellite image */}
      <div className="w-[140px] flex-shrink-0 relative bg-vantage-surface">
        <Image
          src={property.satelliteUrl}
          alt={streetAddress}
          fill
          className="object-cover opacity-80"
          unoptimized
        />
        <div className="absolute inset-0 bg-gradient-to-r from-transparent to-vantage-card/30" />
      </div>

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
          <p className="text-xs text-vantage-muted">{cityLine}</p>
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-4 text-xs text-vantage-faint">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" />
            {property.insuranceCarrier}
          </span>
          <span className="flex items-center gap-1">
            <CalendarDays className="w-3 h-3" />
            Roof: {property.roofAge} yrs
          </span>
          <span className="px-1.5 py-0.5 rounded border border-vantage-border font-mono text-[10px]">
            {property.claimType}
          </span>
        </div>

        {/* AI notes */}
        <p className="text-xs text-vantage-muted leading-relaxed line-clamp-2">
          {property.aiNotes}
        </p>

        {/* Damage bar */}
        <div>
          <p className="text-[10px] text-vantage-faint uppercase tracking-widest mb-1">Damage Score</p>
          <DamageBar score={property.damageScore} />
        </div>
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
        </div>

        <div className="w-full">
          <p className="text-[10px] text-vantage-faint uppercase tracking-widest mb-1.5 text-center">Status</p>
          <div className={`w-full px-2 py-1 rounded border text-center ${statusMeta.cls}`}>
            <select
              value={status}
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

        <button className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded border border-vantage-yellow/30 text-vantage-yellow text-xs font-semibold hover:bg-vantage-yellow-dim transition-colors">
          <Plus className="w-3 h-3" />
          Add Route
        </button>
      </div>
    </div>
  )
}
