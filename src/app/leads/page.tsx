'use client'

import { useState } from 'react'
import { Users, ChevronDown } from 'lucide-react'
import clsx from 'clsx'
import { MOCK_PROPERTIES, MOCK_STORMS, type LeadStatus } from '@/lib/mock-data'
import { useLeadStatuses } from '@/lib/leads-store'
import { STATUS_META } from '@/lib/lead-scoring'
import PropertyCard from '@/components/properties/PropertyCard'

type Filter = 'all' | LeadStatus
type SortKey = 'score' | 'damage' | 'age'

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'score',  label: 'Lead Score' },
  { value: 'damage', label: 'Damage Score' },
  { value: 'age',    label: 'Roof Age' },
]

const STATUS_FILTER_ORDER: Filter[] = [
  'all', 'new', 'knocked', 'interested', 'inspection', 'claim', 'closed', 'not_qualified',
]

export default function LeadsPage() {
  const { statuses, updateStatus, hydrated } = useLeadStatuses()
  const [filter, setFilter] = useState<Filter>('all')
  const [sort, setSort]   = useState<SortKey>('score')

  const enriched = MOCK_PROPERTIES.map((p) => ({
    ...p,
    status: (statuses[p.id] ?? p.status) as LeadStatus,
    storm: MOCK_STORMS.find((s) => s.id === p.stormId)!,
  }))

  const counts: Record<string, number> = { all: enriched.length }
  for (const lead of enriched) {
    counts[lead.status] = (counts[lead.status] ?? 0) + 1
  }

  const visible = enriched
    .filter((l) => filter === 'all' || l.status === filter)
    .sort((a, b) => {
      if (sort === 'score')  return b.leadScore  - a.leadScore
      if (sort === 'damage') return b.damageScore - a.damageScore
      return b.roofAge - a.roofAge
    })

  return (
    <div className="p-8 space-y-6 max-w-4xl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-mono text-vantage-faint uppercase tracking-widest mb-1">
            All Territories
          </p>
          <h2 className="text-lg font-semibold text-vantage-text">Lead Intelligence</h2>
        </div>

        {/* Sort */}
        <div className="relative flex items-center gap-2">
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

      {/* Status filter tabs */}
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
                  ? 'bg-vantage-yellow text-vantage-black border-vantage-yellow'
                  : 'text-vantage-muted border-vantage-border hover:border-vantage-bright hover:text-vantage-text'
              )}
            >
              {label}
              <span className={clsx(
                'text-[10px] font-bold rounded px-1',
                active ? 'bg-black/20' : 'text-vantage-faint'
              )}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Lead list */}
      {!hydrated ? (
        <div className="py-16 text-center text-vantage-faint text-xs font-mono">
          LOADING...
        </div>
      ) : visible.length === 0 ? (
        <div className="py-16 text-center space-y-2">
          <Users className="w-6 h-6 text-vantage-faint mx-auto" />
          <p className="text-vantage-muted text-sm">No leads match this filter.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((lead, i) => (
            <PropertyCard
              key={lead.id}
              property={lead}
              rank={i + 1}
              status={lead.status}
              onStatusChange={(s) => updateStatus(lead.id, s)}
              stormName={lead.storm.name}
            />
          ))}
        </div>
      )}
    </div>
  )
}
