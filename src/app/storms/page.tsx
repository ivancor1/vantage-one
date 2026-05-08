import Link from 'next/link'
import { CloudLightning, Wind, Home, ArrowRight } from 'lucide-react'
import { MOCK_STORMS, MOCK_PROPERTIES } from '@/lib/mock-data'

function severityBadge(s: number) {
  if (s >= 9) return { label: 'CRITICAL', cls: 'bg-status-critical/15 text-status-critical border-status-critical/30' }
  if (s >= 7) return { label: 'HIGH',     cls: 'bg-status-high/15 text-status-high border-status-high/30' }
  return          { label: 'ELEVATED',   cls: 'bg-vantage-yellow-dim text-vantage-yellow border-vantage-yellow/30' }
}

export default function StormsPage() {
  const stormsWithCounts = MOCK_STORMS.map((storm) => ({
    ...storm,
    propertyCount: MOCK_PROPERTIES.filter((p) => p.stormId === storm.id).length,
    dateFormatted: new Date(storm.date).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    }),
  })).sort((a, b) => b.severity - a.severity)

  return (
    <div className="p-8 space-y-4 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-mono text-vantage-faint uppercase tracking-widest mb-1">
            Monitored Territories
          </p>
          <h2 className="text-lg font-semibold text-vantage-text">Storm Feed</h2>
        </div>
        <span className="text-vantage-faint text-xs">{stormsWithCounts.length} events · Last 90 days</span>
      </div>

      <div className="space-y-3">
        {stormsWithCounts.map((storm) => {
          const badge = severityBadge(storm.severity)
          return (
            <Link
              key={storm.id}
              href={`/storms/${storm.id}`}
              className="block bg-vantage-card border border-vantage-border rounded-lg hover:border-vantage-bright transition-colors group"
            >
              <div className="flex items-stretch">
                {/* Severity bar */}
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
                        <span className="text-sm font-semibold text-vantage-text">
                          {storm.name}
                        </span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${badge.cls} tracking-wider`}>
                          {badge.label}
                        </span>
                      </div>
                      <p className="text-xs text-vantage-muted">
                        {storm.location} · {storm.dateFormatted}
                      </p>
                    </div>

                    <ArrowRight className="w-4 h-4 text-vantage-faint group-hover:text-vantage-yellow transition-colors flex-shrink-0 mt-0.5" />
                  </div>

                  {/* Metrics row */}
                  <div className="flex items-center gap-8 mt-4">
                    <div>
                      <p className="text-[10px] text-vantage-faint uppercase tracking-widest mb-1">Severity</p>
                      <p className="text-xl font-bold font-mono text-vantage-yellow">{storm.severity}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-vantage-faint uppercase tracking-widest mb-1">Hail Size</p>
                      <p className="text-xl font-bold font-mono text-vantage-text">{storm.hailSize}"</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-vantage-faint uppercase tracking-widest mb-1">Wind</p>
                      <p className="text-xl font-bold font-mono text-vantage-text">{storm.windSpeed} mph</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-vantage-faint uppercase tracking-widest mb-1">Est. Homes</p>
                      <p className="text-xl font-bold font-mono text-vantage-text">{storm.estimatedHomes.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-vantage-faint uppercase tracking-widest mb-1">Leads</p>
                      <p className="text-xl font-bold font-mono text-status-high">{storm.propertyCount}</p>
                    </div>
                  </div>

                  {/* ZIP codes */}
                  <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                    {storm.affectedZips.map((zip) => (
                      <span
                        key={zip}
                        className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-vantage-surface border border-vantage-border text-vantage-faint"
                      >
                        {zip}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
