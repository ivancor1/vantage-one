'use client'

import { useState } from 'react'
import { MapPin, Plus, Trash2, CloudLightning, AlertCircle } from 'lucide-react'
import clsx from 'clsx'
import { useTerritoriesStore, activeStormsForTerritory, type TerritoryType } from '@/lib/territories'

const TYPE_OPTIONS: { value: TerritoryType; label: string }[] = [
  { value: 'zip',          label: 'ZIP Code' },
  { value: 'city',         label: 'City' },
  { value: 'neighborhood', label: 'Neighborhood' },
]

const TYPE_META: Record<TerritoryType, { label: string; cls: string }> = {
  zip:          { label: 'ZIP',  cls: 'bg-blue-900/20 text-blue-400 border-blue-700/30' },
  city:         { label: 'CITY', cls: 'bg-vantage-yellow-dim text-vantage-yellow border-vantage-yellow/30' },
  neighborhood: { label: 'NBHD', cls: 'bg-status-success/15 text-status-success border-status-success/30' },
}

export default function TerritoriesPage() {
  const { territories, add, remove, hydrated } = useTerritoriesStore()
  const [type, setType] = useState<TerritoryType>('zip')
  const [value, setValue] = useState('')
  const [error, setError] = useState('')

  function handleAdd() {
    const trimmed = value.trim()
    if (!trimmed) { setError('Enter a value.'); return }
    const already = territories.some(
      (t) => t.type === type && t.value.toLowerCase() === trimmed.toLowerCase()
    )
    if (already) { setError('Already in your territories.'); return }
    add(type, trimmed)
    setValue('')
    setError('')
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleAdd()
  }

  const placeholder =
    type === 'zip'          ? 'e.g. 75023' :
    type === 'city'         ? 'e.g. Plano, TX' :
                              'e.g. Heritage Oak'

  return (
    <div className="p-8 space-y-6 max-w-3xl">
      <div>
        <p className="text-[10px] font-mono text-vantage-faint uppercase tracking-widest mb-1">
          Storm Coverage
        </p>
        <h2 className="text-lg font-semibold text-vantage-text">Territories</h2>
        <p className="text-xs text-vantage-muted mt-1">
          Add zip codes, cities, or neighborhoods to monitor for storm activity.
        </p>
      </div>

      {/* Add form */}
      <div className="bg-vantage-card border border-vantage-border rounded-lg p-5 space-y-4">
        <p className="text-xs font-semibold text-vantage-text uppercase tracking-wider">
          Add Territory
        </p>

        {/* Type toggle */}
        <div className="flex gap-1">
          {TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { setType(opt.value); setError('') }}
              className={clsx(
                'px-3 py-1.5 rounded text-xs font-semibold border transition-colors',
                type === opt.value
                  ? 'bg-vantage-yellow text-vantage-black border-vantage-yellow'
                  : 'text-vantage-muted border-vantage-border hover:border-vantage-bright hover:text-vantage-text'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Input + button */}
        <div className="flex gap-2">
          <input
            type="text"
            value={value}
            onChange={(e) => { setValue(e.target.value); setError('') }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="flex-1 bg-vantage-surface border border-vantage-border rounded px-3 py-2 text-sm text-vantage-text placeholder-vantage-faint outline-none focus:border-vantage-yellow/50 transition-colors font-mono"
          />
          <button
            onClick={handleAdd}
            className="flex items-center gap-1.5 px-4 py-2 rounded bg-vantage-yellow text-vantage-black text-xs font-bold hover:bg-vantage-yellow/90 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-1.5 text-xs text-status-critical">
            <AlertCircle className="w-3.5 h-3.5" />
            {error}
          </div>
        )}
      </div>

      {/* Territory list */}
      <div className="bg-vantage-card border border-vantage-border rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-vantage-border">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-vantage-yellow" />
            <span className="text-sm font-semibold text-vantage-text">Monitored Territories</span>
          </div>
          {hydrated && (
            <span className="text-xs text-vantage-faint">{territories.length} active</span>
          )}
        </div>

        {!hydrated ? (
          <div className="px-5 py-8 text-center text-vantage-faint text-xs font-mono">
            LOADING...
          </div>
        ) : territories.length === 0 ? (
          <div className="px-5 py-10 text-center space-y-2">
            <MapPin className="w-6 h-6 text-vantage-faint mx-auto" />
            <p className="text-vantage-muted text-sm">No territories yet.</p>
            <p className="text-vantage-faint text-xs">Add a ZIP code or city above to start monitoring.</p>
          </div>
        ) : (
          <div className="divide-y divide-vantage-border">
            {territories.map((territory) => {
              const meta = TYPE_META[territory.type]
              const stormCount = activeStormsForTerritory(territory)
              const addedDate = new Date(territory.addedAt).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric',
              })

              return (
                <div
                  key={territory.id}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-white/[0.02] transition-colors"
                >
                  {/* Type badge */}
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${meta.cls} tracking-wider flex-shrink-0 w-12 text-center`}>
                    {meta.label}
                  </span>

                  {/* Value */}
                  <span className="text-sm font-mono font-semibold text-vantage-text flex-1 min-w-0 truncate">
                    {territory.value}
                  </span>

                  {/* Active storms */}
                  {stormCount > 0 ? (
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <CloudLightning className="w-3.5 h-3.5 text-status-critical" />
                      <span className="text-xs font-semibold text-status-critical">
                        {stormCount} storm{stormCount > 1 ? 's' : ''}
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-vantage-faint flex-shrink-0">No activity</span>
                  )}

                  {/* Added date */}
                  <span className="text-xs text-vantage-faint flex-shrink-0 hidden sm:block w-28 text-right">
                    Added {addedDate}
                  </span>

                  {/* Remove */}
                  <button
                    onClick={() => remove(territory.id)}
                    className="p-1.5 rounded text-vantage-faint hover:text-status-critical hover:bg-status-critical/10 transition-colors flex-shrink-0"
                    title="Remove territory"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
