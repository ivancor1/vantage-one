'use client'

import { useState } from 'react'
import Link from 'next/link'
import { MapPin, Plus, Trash2, CloudLightning, AlertCircle, Loader2, CheckCircle2, XCircle, Layers } from 'lucide-react'
import clsx from 'clsx'
import { useTerritoriesStore, activeStormsForTerritory, type TerritoryType } from '@/lib/territories'
import { useStorms } from '@/lib/storm-api'

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
  const { territories, add, remove, hydrated, scanStates } = useTerritoriesStore()
  const { storms } = useStorms()
  const [type, setType] = useState<TerritoryType>('zip')
  const [value, setValue] = useState('')
  const [radius, setRadius] = useState(2)
  const [error, setError] = useState('')
  const [adding, setAdding] = useState(false)

  async function handleAdd() {
    const trimmed = value.trim()
    if (!trimmed) { setError('Enter a value.'); return }
    setAdding(true)
    setError('')
    const err = await add(type, trimmed, radius)
    if (err) {
      setError(err)
    } else {
      setValue('')
    }
    setAdding(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleAdd()
  }

  const placeholder =
    type === 'zip'          ? 'e.g. 75023' :
    type === 'city'         ? 'e.g. Plano, TX' :
                              'e.g. Heritage Oak'

  // Storm-generated territories (auto-named "… Storm") are live-scan artifacts, not user-monitored
  // places — keep them out of the Monitored Territories list and count.
  const monitored = territories.filter((t) => !t.value.endsWith(' Storm'))

  return (
    <div className="p-8 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-mono text-vantage-faint uppercase tracking-widest mb-1">
            Lead Generation
          </p>
          <h2 className="text-lg font-semibold text-vantage-text">Territories</h2>
          <p className="text-xs text-vantage-muted mt-1">
            Add a ZIP code, city, or neighborhood. Vantage will scrape all addressed buildings
            in your selected radius and add them as leads.
          </p>
        </div>
        <Link
          href="/shingle-analysis"
          className="flex items-center gap-1.5 flex-shrink-0 px-3.5 py-2 rounded border border-vantage-border text-xs font-semibold text-vantage-text hover:border-vantage-bright hover:bg-black/[0.03] transition-colors"
        >
          <Layers className="w-3.5 h-3.5 text-vantage-yellow" />
          Shingle probability analysis
        </Link>
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
            disabled={adding}
            className="flex-1 bg-vantage-surface border border-vantage-border rounded px-3 py-2 text-sm text-vantage-text placeholder-vantage-faint outline-none focus:border-vantage-yellow/50 transition-colors font-mono disabled:opacity-50"
          />
          <button
            onClick={handleAdd}
            disabled={adding}
            className="flex items-center gap-1.5 px-4 py-2 rounded bg-vantage-yellow text-vantage-black text-xs font-bold hover:bg-vantage-yellow/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            {adding ? 'Adding...' : 'Add'}
          </button>
        </div>

        {/* Radius slider */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs text-vantage-faint">Search radius</label>
            <span className="text-xs font-mono font-semibold text-vantage-text">{radius} mi</span>
          </div>
          <input
            type="range"
            min={1}
            max={10}
            step={1}
            value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
            className="w-full accent-vantage-yellow"
          />
          <div className="flex justify-between text-[10px] text-vantage-faint font-mono">
            <span>1 mi</span>
            <span className="text-vantage-faint/60">every addressed home in the radius · 2 mi ≈ 800 · widen later from the Leads page</span>
            <span>10 mi</span>
          </div>
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
            <span className="text-xs text-vantage-faint">{monitored.length} active</span>
          )}
        </div>

        {!hydrated ? (
          <div className="px-5 py-8 text-center text-vantage-faint text-xs font-mono">LOADING...</div>
        ) : monitored.length === 0 ? (
          <div className="px-5 py-10 text-center space-y-2">
            <MapPin className="w-6 h-6 text-vantage-faint mx-auto" />
            <p className="text-vantage-muted text-sm">No territories yet.</p>
            <p className="text-vantage-faint text-xs">Add a ZIP code or city above to start generating leads.</p>
          </div>
        ) : (
          <div className="divide-y divide-vantage-border">
            {monitored.map((territory) => {
              const meta = TYPE_META[territory.type]
              const stormCount = activeStormsForTerritory(territory, storms)
              const addedDate = new Date(territory.addedAt).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric',
              })
              const scan = scanStates[territory.id]

              return (
                <div
                  key={territory.id}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-black/[0.035] transition-colors"
                >
                  {/* Type badge */}
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${meta.cls} tracking-wider flex-shrink-0 w-12 text-center`}>
                    {meta.label}
                  </span>

                  {/* Value + place name + radius */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 min-w-0">
                      <span className="text-sm font-mono font-semibold text-vantage-text truncate">
                        {territory.placeName ?? territory.value}
                      </span>
                      {territory.placeName && territory.placeName !== territory.value && (
                        <span className="text-[11px] font-mono text-vantage-faint flex-shrink-0">
                          {territory.value}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-vantage-faint">{territory.radiusMiles} mi radius</span>
                  </div>

                  {/* Scan status — only shown during active scan or error */}
                  {scan?.status === 'scanning' && (
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <Loader2 className="w-3.5 h-3.5 text-vantage-yellow animate-spin" />
                      <span className="text-xs text-vantage-yellow">Scanning...</span>
                    </div>
                  )}
                  {scan?.status === 'error' && (
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <XCircle className="w-3.5 h-3.5 text-status-critical" />
                      <span className="text-xs text-status-critical">Scan failed</span>
                    </div>
                  )}

                  {/* Lead count — always shown when scan is idle or done */}
                  {scan?.status !== 'scanning' && (
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {(territory.leadCount ?? 0) > 0 ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-status-success" />
                          <span className="text-xs text-status-success">{territory.leadCount} leads</span>
                        </>
                      ) : stormCount > 0 ? (
                        <>
                          <CloudLightning className="w-3.5 h-3.5 text-status-critical" />
                          <span className="text-xs font-semibold text-status-critical">
                            {stormCount} storm{stormCount > 1 ? 's' : ''}
                          </span>
                        </>
                      ) : (
                        <span className="text-xs text-vantage-faint">No leads yet</span>
                      )}
                    </div>
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
      {/* Honest data note */}
      <p className="text-[10px] text-vantage-faint font-mono leading-relaxed">
        Roof age comes from OSM building tags where present, otherwise the Census area estimate —
        the lead card says which was used.
      </p>
    </div>
  )
}
