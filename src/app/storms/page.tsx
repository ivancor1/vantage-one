'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CloudLightning, ArrowRight, Users, Loader2, Check } from 'lucide-react'
import { useStorms } from '@/lib/storm-api'
import { useStormLeadStates, startFindLeads } from '@/lib/storm-leads'

function severityBadge(s: number) {
  if (s >= 9) return { label: 'CRITICAL', cls: 'bg-status-critical/15 text-status-critical border-status-critical/30' }
  if (s >= 7) return { label: 'HIGH',     cls: 'bg-status-high/15 text-status-high border-status-high/30' }
  return          { label: 'ELEVATED',   cls: 'bg-vantage-yellow-dim text-vantage-yellow border-vantage-yellow/30' }
}

export default function StormsPage() {
  const { storms, loading, error } = useStorms()
  const router = useRouter()
  // Module-scoped store: state survives tab switches; fetch keeps running in background
  const genStates = useStormLeadStates()

  // NOTE: we intentionally do NOT restore "N leads found" from the DB on load. Every storm
  // shows its "Find leads in this area" CTA until you click it this session — so a pre-built
  // territory (e.g. the demo storm) still presents the button, and clicking it returns the
  // existing leads instantly. A page refresh resets the CTA, keeping the flow repeatable.
  function findLeads(e: React.MouseEvent, stormId: string) {
    e.preventDefault()
    e.stopPropagation()
    startFindLeads(stormId)
  }

  function viewLeads(e: React.MouseEvent, territoryId: string) {
    e.preventDefault()
    e.stopPropagation()
    router.push(`/leads?territory=${territoryId}`)
  }

  const sorted = [...storms].sort((a, b) => b.severity - a.severity).map((storm) => ({
    ...storm,
    badge: severityBadge(storm.severity),
    dateFormatted: new Date(storm.date).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    }),
  }))

  return (
    <div className="p-8 space-y-4 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-mono text-vantage-faint uppercase tracking-widest mb-1">
            NWS Local Storm Reports · Last 72 Hours
          </p>
          <h2 className="text-lg font-semibold text-vantage-text">Storm Feed</h2>
        </div>
        {!loading && (
          <span className="text-vantage-faint text-xs">{sorted.length} WFO groups · Refreshes every 30 min</span>
        )}
      </div>

      {loading && (
        <div className="py-16 text-center text-vantage-faint text-xs font-mono">
          FETCHING LIVE DATA...
        </div>
      )}

      {error && (
        <div className="py-10 text-center space-y-2">
          <CloudLightning className="w-6 h-6 text-status-critical mx-auto" />
          <p className="text-status-critical text-sm">Failed to load storm data.</p>
          <p className="text-vantage-faint text-xs">{error}</p>
        </div>
      )}

      {!loading && !error && sorted.length === 0 && (
        <div className="py-16 text-center space-y-2">
          <CloudLightning className="w-6 h-6 text-vantage-faint mx-auto" />
          <p className="text-vantage-muted text-sm">No significant storm reports in the last 72 hours.</p>
        </div>
      )}

      <div className="space-y-3">
        {sorted.map((storm) => (
          <Link
            key={storm.id}
            href={`/storms/${storm.id}`}
            className="block bg-vantage-card border border-vantage-border rounded-lg hover:border-vantage-bright transition-colors group"
          >
            <div className="flex items-stretch">
              <div
                className="w-1 rounded-l-lg flex-shrink-0"
                style={{
                  backgroundColor:
                    storm.severity >= 9 ? '#EF4444' :
                    storm.severity >= 7 ? '#F97316' : '#F0C020',
                }}
              />

              <div className="flex-1 px-5 py-4">
                {/* Top row */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2.5">
                      <span className="text-sm font-semibold text-vantage-text">{storm.name}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${storm.badge.cls} tracking-wider`}>
                        {storm.badge.label}
                      </span>
                      <span className="text-[10px] font-mono text-vantage-faint border border-vantage-border rounded px-1.5 py-0.5">
                        Vantage
                      </span>
                    </div>
                    <p className="text-xs text-vantage-muted">
                      {storm.location} · {storm.dateFormatted}
                    </p>
                  </div>

                  <ArrowRight className="w-4 h-4 text-vantage-faint group-hover:text-vantage-yellow transition-colors flex-shrink-0 mt-0.5" />
                </div>

                {/* Metrics row — NWS official */}
                <div className="flex items-end gap-8 mt-4">
                  <div className="space-y-3">
                    <p className="text-[9px] font-mono text-vantage-faint uppercase tracking-widest">
                      NWS Official
                    </p>
                    <div className="flex items-center gap-8">
                      {storm.hailSize > 0 && (
                        <div>
                          <p className="text-[10px] text-vantage-faint uppercase tracking-widest mb-1">Max Hail</p>
                          <p className="text-xl font-bold font-mono text-vantage-text">{storm.hailSize}"</p>
                        </div>
                      )}
                      {storm.windSpeed > 0 && (
                        <div>
                          <p className="text-[10px] text-vantage-faint uppercase tracking-widest mb-1">Max Wind</p>
                          <p className="text-xl font-bold font-mono text-vantage-text">{storm.windSpeed} mph</p>
                        </div>
                      )}
                      <div>
                        <p className="text-[10px] text-vantage-faint uppercase tracking-widest mb-1">Reports</p>
                        <p className="text-xl font-bold font-mono text-vantage-text">{storm.reportCount}</p>
                      </div>
                    </div>
                  </div>

                  <div className="w-px h-10 bg-vantage-border self-end mb-1" />

                  <div className="space-y-3">
                    <p className="text-[9px] font-mono text-vantage-faint uppercase tracking-widest">
                      Modeled by Vantage
                    </p>
                    <div className="flex items-center gap-8">
                      <div>
                        <p className="text-[10px] text-vantage-faint uppercase tracking-widest mb-1">Severity</p>
                        <p className="text-xl font-bold font-mono text-vantage-yellow">{storm.severity}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-vantage-faint uppercase tracking-widest mb-1">Hail Reports</p>
                        <p className="text-xl font-bold font-mono text-vantage-text">{storm.reports.filter((r) => r.type === 'HAIL').length}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Find leads — the storm-first action */}
                <div className="flex items-center gap-3 mt-4">
                  {(() => {
                    const gen = genStates[storm.id]
                    if (gen?.status === 'running') {
                      return (
                        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-vantage-surface border border-vantage-border text-xs font-semibold text-vantage-muted">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Finding homes under this storm… ~1 min
                        </span>
                      )
                    }
                    if (gen?.status === 'done') {
                      return (
                        <button
                          onClick={(e) => viewLeads(e, gen.territoryId)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-status-success/15 border border-status-success/30 text-xs font-semibold text-status-success hover:bg-status-success/25 transition-colors"
                        >
                          <Check className="w-3.5 h-3.5" />
                          {gen.count} leads found — view →
                        </button>
                      )
                    }
                    return (
                      <button
                        onClick={(e) => findLeads(e, storm.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-vantage-yellow text-vantage-black text-xs font-bold hover:opacity-90 transition-opacity"
                      >
                        <Users className="w-3.5 h-3.5" />
                        Find leads in this area
                      </button>
                    )
                  })()}
                  {genStates[storm.id]?.status === 'error' && (
                    <span className="text-[10px] text-status-critical font-mono">
                      {(genStates[storm.id] as { message: string }).message}
                    </span>
                  )}
                </div>

                {/* Source attribution */}
                <p className="text-[10px] text-vantage-faint font-mono mt-3">
                  Source: NWS Local Storm Report · WFO {storm.wfo} · Point reports + modeled radius — not an official storm path
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
