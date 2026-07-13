'use client'

import { useState } from 'react'
import { MapPin, Plus, Trash2, CloudLightning, AlertCircle, Loader2, CheckCircle2, XCircle, Building2, Zap, Sparkles } from 'lucide-react'
import clsx from 'clsx'
import { useTerritoriesStore, activeStormsForTerritory, type TerritoryType } from '@/lib/territories'
import type { EnrichedLead } from '@/lib/fulton-enrichment'
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
  const [radius, setRadius] = useState(3)
  const [error, setError] = useState('')
  const [adding, setAdding] = useState(false)

  // Per-territory enrich state
  type EnrichResult = { supported: boolean; county: string; enriched?: number; year_built_found?: number; reason?: string }
  const [enrichingId, setEnrichingId] = useState<string | null>(null)
  const [enrichResults, setEnrichResults] = useState<Record<string, EnrichResult>>({})

  async function runTerritoryEnrich(territoryId: string) {
    setEnrichingId(territoryId)
    try {
      const res = await fetch(`/api/territories/${territoryId}/enrich`)
      const data = await res.json() as EnrichResult
      setEnrichResults((prev) => ({ ...prev, [territoryId]: data }))
    } catch {
      setEnrichResults((prev) => ({ ...prev, [territoryId]: { supported: false, county: '', reason: 'Request failed' } }))
    } finally {
      setEnrichingId(null)
    }
  }

  const [enrichedLeads, setEnrichedLeads] = useState<EnrichedLead[]>([])
  const [enrichmentLoading, setEnrichmentLoading] = useState(false)
  const [enrichmentError, setEnrichmentError] = useState('')
  const [enrichmentMeta, setEnrichmentMeta] = useState<{ total: number; enriched: number; residential: number } | null>(null)

  async function runEnrichment() {
    setEnrichmentLoading(true)
    setEnrichmentError('')
    setEnrichedLeads([])
    setEnrichmentMeta(null)
    try {
      const res = await fetch('/api/territories/enrich-alpharetta')
      if (!res.ok) throw new Error(`API returned ${res.status}`)
      const data = await res.json() as { leads: EnrichedLead[]; total: number; enriched: number; residential: number }
      setEnrichedLeads(data.leads)
      setEnrichmentMeta({ total: data.total, enriched: data.enriched, residential: data.residential })
    } catch (e) {
      setEnrichmentError(e instanceof Error ? e.message : 'Failed to enrich leads')
    } finally {
      setEnrichmentLoading(false)
    }
  }

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

  return (
    <div className="p-8 space-y-6 max-w-3xl">
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
            <span className="text-vantage-faint/60">up to 50 leads · larger radius = wider search</span>
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
            <span className="text-xs text-vantage-faint">{territories.length} active</span>
          )}
        </div>

        {!hydrated ? (
          <div className="px-5 py-8 text-center text-vantage-faint text-xs font-mono">LOADING...</div>
        ) : territories.length === 0 ? (
          <div className="px-5 py-10 text-center space-y-2">
            <MapPin className="w-6 h-6 text-vantage-faint mx-auto" />
            <p className="text-vantage-muted text-sm">No territories yet.</p>
            <p className="text-vantage-faint text-xs">Add a ZIP code or city above to start generating leads.</p>
          </div>
        ) : (
          <div className="divide-y divide-vantage-border">
            {territories.map((territory) => {
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

                  {/* Enrich button + result */}
                  {(() => {
                    const result = enrichResults[territory.id]
                    const isEnriching = enrichingId === territory.id
                    return (
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {result && (
                          <span className={clsx(
                            'text-[10px] font-mono',
                            result.supported ? 'text-status-success' : 'text-vantage-faint'
                          )}>
                            {result.supported
                              ? `${result.year_built_found}/${result.enriched} enriched`
                              : 'not supported'}
                          </span>
                        )}
                        <button
                          onClick={() => runTerritoryEnrich(territory.id)}
                          disabled={isEnriching || enrichingId !== null}
                          className="p-1.5 rounded text-vantage-faint hover:text-vantage-yellow hover:bg-vantage-yellow/10 transition-colors flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                          title="Enrich leads with property age data"
                        >
                          {isEnriching
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <Sparkles className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    )
                  })()}

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
      {/* Enhanced Territory Test — Alpharetta, GA */}
      <div className="bg-vantage-card border border-vantage-border rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-vantage-border">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-vantage-yellow" />
            <span className="text-sm font-semibold text-vantage-text">Enhanced Territory Test</span>
            <span className="text-[10px] font-mono text-vantage-faint bg-vantage-surface border border-vantage-border px-1.5 py-0.5 rounded">
              Alpharetta, GA · ArcGIS Fulton County
            </span>
          </div>
          <button
            onClick={runEnrichment}
            disabled={enrichmentLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-vantage-yellow text-vantage-black text-xs font-bold hover:bg-vantage-yellow/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {enrichmentLoading
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Zap className="w-3.5 h-3.5" />}
            {enrichmentLoading ? 'Enriching...' : 'Run Enrichment'}
          </button>
        </div>

        {!enrichmentLoading && enrichedLeads.length === 0 && !enrichmentError && (
          <div className="px-5 py-8 text-center space-y-1">
            <Building2 className="w-6 h-6 text-vantage-faint mx-auto" />
            <p className="text-vantage-muted text-sm">No data yet.</p>
            <p className="text-vantage-faint text-xs">
              Fetches up to 25 Alpharetta buildings from OpenStreetMap, then enriches each
              with year built and property type from Fulton County&apos;s public ArcGIS API.
            </p>
          </div>
        )}

        {enrichmentLoading && (
          <div className="px-5 py-8 text-center space-y-2">
            <Loader2 className="w-6 h-6 text-vantage-yellow animate-spin mx-auto" />
            <p className="text-vantage-muted text-sm">Querying Fulton County ArcGIS...</p>
            <p className="text-vantage-faint text-xs">Enriching up to 25 properties — this takes ~10 seconds.</p>
          </div>
        )}

        {enrichmentError && (
          <div className="px-5 py-4 flex items-center gap-2 text-status-critical text-xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {enrichmentError}
          </div>
        )}

        {enrichedLeads.length > 0 && (
          <>
            {enrichmentMeta && (
              <div className="px-5 py-2 border-b border-vantage-border flex items-center gap-4 text-[11px] text-vantage-faint font-mono">
                <span>{enrichmentMeta.residential} residential leads</span>
                <span className="text-vantage-faint/40">·</span>
                <span>screened from {enrichmentMeta.enriched} candidates</span>
                <span className="text-vantage-faint/40">·</span>
                <span>{enrichedLeads.filter(l => l.year_built).length} with year built</span>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-vantage-border text-vantage-faint font-mono text-[10px] uppercase tracking-wider">
                    <th className="text-left px-4 py-2.5 font-medium">Address</th>
                    <th className="text-right px-3 py-2.5 font-medium">Score</th>
                    <th className="text-right px-3 py-2.5 font-medium">Year Built</th>
                    <th className="text-right px-3 py-2.5 font-medium">Age</th>
                    <th className="text-left px-3 py-2.5 font-medium">Property Type</th>
                    <th className="text-right px-3 py-2.5 font-medium">Acres</th>
                    <th className="text-left px-3 py-2.5 font-medium">Parcel ID</th>
                    <th className="text-center px-3 py-2.5 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-vantage-border/50">
                  {enrichedLeads.map((lead, i) => (
                    <tr key={i} className="hover:bg-black/[0.035] transition-colors">
                      <td className="px-4 py-2.5 text-vantage-text font-mono max-w-[220px]">
                        <span className="truncate block" title={lead.address}>{lead.address}</span>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <span className={clsx(
                          'font-bold font-mono',
                          lead.enriched_score >= 70 ? 'text-status-success' :
                          lead.enriched_score >= 40 ? 'text-vantage-yellow' :
                          'text-vantage-muted'
                        )}>
                          {lead.enriched_score}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-vantage-text">
                        {lead.year_built ?? <span className="text-vantage-faint">—</span>}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-vantage-muted">
                        {lead.home_age ? `${lead.home_age}y` : <span className="text-vantage-faint">—</span>}
                      </td>
                      <td className="px-3 py-2.5 text-vantage-muted max-w-[140px]">
                        <span className="truncate block" title={lead.property_type ?? undefined}>
                          {lead.property_type ?? <span className="text-vantage-faint">—</span>}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-vantage-muted">
                        {lead.land_acres != null ? lead.land_acres.toFixed(2) : <span className="text-vantage-faint">—</span>}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[10px] text-vantage-faint">
                        {lead.parcel_id ?? '—'}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {lead.enrichment_status === 'found'
                          ? <CheckCircle2 className="w-3.5 h-3.5 text-status-success inline" />
                          : <XCircle className="w-3.5 h-3.5 text-vantage-faint inline" />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
