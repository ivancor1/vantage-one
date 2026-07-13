import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, CloudLightning, Wind, Hash, MapPin, FileText, FlaskConical } from 'lucide-react'
import { fetchStorms } from '@/lib/iem'
import PropertyList from '@/components/properties/PropertyList'

export const revalidate = 1800

type Props = { params: { stormId: string } }

function severityColor(s: number) {
  if (s >= 9) return '#EF4444'
  if (s >= 7) return '#F97316'
  return '#F0C020'
}

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit',
      timeZone: 'UTC', timeZoneName: 'short',
    })
  } catch {
    return iso
  }
}

export default async function StormDetailPage({ params }: Props) {
  const storms = await fetchStorms()
  const storm = storms.find((s) => s.id === params.stormId)
  if (!storm) notFound()

  const dateStr = new Date(storm.date).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })
  const color = severityColor(storm.severity)
  const sortedReports = [...storm.reports].sort((a, b) => b.magnitude - a.magnitude)

  return (
    <div className="p-8 space-y-6 max-w-4xl">

      <Link
        href="/storms"
        className="inline-flex items-center gap-1.5 text-xs text-vantage-faint hover:text-vantage-muted transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Storm Feed
      </Link>

      {/* Storm header */}
      <div className="bg-vantage-card border border-vantage-border rounded-lg overflow-hidden">
        <div className="flex items-stretch">
          <div className="w-1 flex-shrink-0" style={{ backgroundColor: color }} />

          <div className="flex-1 px-6 py-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-mono text-vantage-faint uppercase tracking-widest mb-2">
                  NWS Local Storm Report · WFO {storm.wfo}
                </p>
                <h1 className="text-lg font-bold text-vantage-text">{storm.name}</h1>
                <div className="flex items-center gap-2 mt-1.5">
                  <MapPin className="w-3 h-3 text-vantage-faint" />
                  <p className="text-sm text-vantage-muted">{storm.location}</p>
                  <span className="text-vantage-faint">·</span>
                  <p className="text-sm text-vantage-muted">{dateStr}</p>
                </div>
              </div>
            </div>

            {/* Two-section metrics row */}
            <div className="mt-5 space-y-4">

              {/* NWS official metrics */}
              <div>
                <p className="text-[9px] font-mono text-vantage-faint uppercase tracking-widest mb-2.5">
                  NWS Official · Source Data
                </p>
                <div className="flex items-center gap-10">
                  {storm.hailSize > 0 && (
                    <div>
                      <div className="flex items-center gap-1 mb-1">
                        <CloudLightning className="w-3 h-3 text-vantage-faint" />
                        <p className="text-[10px] text-vantage-faint uppercase tracking-widest">Max Hail</p>
                      </div>
                      <p className="text-2xl font-bold font-mono text-vantage-text">{storm.hailSize}"</p>
                    </div>
                  )}
                  {storm.windSpeed > 0 && (
                    <div>
                      <div className="flex items-center gap-1 mb-1">
                        <Wind className="w-3 h-3 text-vantage-faint" />
                        <p className="text-[10px] text-vantage-faint uppercase tracking-widest">Max Wind</p>
                      </div>
                      <p className="text-2xl font-bold font-mono text-vantage-text">{storm.windSpeed} mph</p>
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-1 mb-1">
                      <FileText className="w-3 h-3 text-vantage-faint" />
                      <p className="text-[10px] text-vantage-faint uppercase tracking-widest">LSR Reports</p>
                    </div>
                    <p className="text-2xl font-bold font-mono text-vantage-text">{storm.reportCount}</p>
                  </div>
                </div>
              </div>

              <div className="border-t border-vantage-border" />

              {/* Vantage modeled metrics */}
              <div>
                <div className="flex items-center gap-1.5 mb-2.5">
                  <FlaskConical className="w-3 h-3 text-vantage-yellow opacity-60" />
                  <p className="text-[9px] font-mono text-vantage-faint uppercase tracking-widest">
                    Modeled by Vantage · Not official NWS data
                  </p>
                </div>
                <div className="flex items-center gap-10">
                  <div>
                    <div className="flex items-center gap-1 mb-1">
                      <Hash className="w-3 h-3 text-vantage-faint" />
                      <p className="text-[10px] text-vantage-faint uppercase tracking-widest">Severity Score</p>
                    </div>
                    <p className="text-2xl font-bold font-mono" style={{ color }}>{storm.severity}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-vantage-faint uppercase tracking-widest mb-1">Homes in Modeled Radius</p>
                    <p className="text-2xl font-bold font-mono text-vantage-text">{storm.estimatedHomes.toLocaleString()}</p>
                  </div>
                </div>
                <p className="text-[10px] text-vantage-faint mt-2.5">
                  Radius and home count are estimates based on report point density — not exact storm paths or confirmed damage counts.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Individual LSR reports */}
      <div>
        <div className="mb-3">
          <p className="text-[10px] font-mono text-vantage-faint uppercase tracking-widest mb-1">
            NWS Local Storm Reports · Sorted by Magnitude
          </p>
          <h2 className="text-sm font-semibold text-vantage-text">
            Raw Reports
            <span className="ml-2 text-vantage-faint font-normal">({storm.reportCount})</span>
          </h2>
        </div>

        <div className="bg-vantage-card border border-vantage-border rounded-lg overflow-hidden">
          <div className="grid grid-cols-[100px_70px_150px_140px_1fr] gap-4 px-5 py-2.5 border-b border-vantage-border bg-vantage-surface">
            {['Time (UTC)', 'Type', 'Magnitude', 'Location', 'Remarks / Source'].map((h) => (
              <p key={h} className="text-[10px] font-mono text-vantage-faint uppercase tracking-widest">
                {h}
              </p>
            ))}
          </div>

          <div className="divide-y divide-vantage-border">
            {sortedReports.map((r, i) => (
              <div
                key={i}
                className="grid grid-cols-[100px_70px_150px_140px_1fr] gap-4 px-5 py-3 hover:bg-black/[0.035] transition-colors items-start"
              >
                <p className="text-xs font-mono text-vantage-muted">{formatTime(r.validTime)}</p>

                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border w-fit ${
                  r.type === 'HAIL'
                    ? 'bg-status-critical/15 text-status-critical border-status-critical/30'
                    : 'bg-blue-900/20 text-blue-400 border-blue-700/30'
                }`}>
                  {r.type}
                </span>

                <p className="text-sm font-mono font-semibold text-vantage-text">
                  {r.type === 'HAIL'
                    ? `${r.magnitude}" (${r.units})`
                    : `${r.magnitude} ${r.units}`}
                </p>

                <p className="text-xs text-vantage-muted">
                  {r.city}, {r.state}
                  <br />
                  <span className="text-vantage-faint">{r.county} County</span>
                </p>

                <div>
                  <p className="text-xs text-vantage-faint leading-relaxed">
                    {r.remark || '—'}
                  </p>
                  <p className="text-[10px] text-vantage-faint mt-1 font-mono">{r.source}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-[10px] text-vantage-faint mt-2 font-mono">
          Source: NWS Local Storm Reports via Iowa State IEM · WFO {storm.wfo} · Data as of report time
        </p>
      </div>

      {/* Properties section — client-side, fetches from Overpass */}
      <PropertyList
        storm={{
          id: storm.id,
          lat: storm.lat,
          lng: storm.lng,
          radiusMeters: storm.radiusMeters,
          severity: storm.severity,
          name: storm.name,
        }}
      />

    </div>
  )
}
