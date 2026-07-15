'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import { Map, CloudLightning, Users, ArrowRight } from 'lucide-react'
import { useTerritoriesStore } from '@/lib/territories'
import { useStorms } from '@/lib/storm-api'
import { supabase, isSupabaseReady } from '@/lib/supabase'
import Link from 'next/link'

// Live map preview — same MapView as /map, non-interactive, click-through to the full map
const MapView = dynamic(() => import('@/components/map/MapView'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center bg-vantage-black">
      <p className="text-vantage-faint text-xs font-mono">LOADING MAP…</p>
    </div>
  ),
})

function severityBadge(s: number) {
  if (s >= 9) return { label: 'CRITICAL', cls: 'bg-status-critical/15 text-status-critical border-status-critical/30' }
  if (s >= 7) return { label: 'HIGH',     cls: 'bg-status-high/15 text-status-high border-status-high/30' }
  return          { label: 'ELEVATED',   cls: 'bg-vantage-yellow-dim text-vantage-yellow border-vantage-yellow/30' }
}

export default function DashboardPage() {
  const { territories, hydrated } = useTerritoriesStore()
  const { storms, loading } = useStorms()

  // High-priority = score ≥ 65 (the HIGH/CRITICAL bands: real hail evidence + roof factors)
  // and still workable (not closed/disqualified). Was a hardcoded "—" stub before.
  const [highPriority, setHighPriority] = useState<number | null>(null)
  useEffect(() => {
    if (!isSupabaseReady()) return
    supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .is('deleted_at', null)
      .gte('lead_score', 65)
      .in('status', ['new', 'knocked', 'interested', 'inspection'])
      .then(({ count }) => setHighPriority(count ?? 0))
  }, [])

  const recentStorms = [...storms]
    .sort((a, b) => b.severity - a.severity)
    .map((storm) => ({
      ...storm,
      dateFormatted: new Date(storm.date).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
      }),
      badge: severityBadge(storm.severity),
    }))

  const stats = [
    {
      label: 'Monitored Territories',
      value: hydrated ? String(territories.length) : '—',
      icon: Map,
      color: 'text-vantage-yellow',
      border: 'border-vantage-yellow/20',
      href: '/territories',
    },
    {
      label: 'Active Storms',
      value: loading ? '—' : String(storms.length),
      icon: CloudLightning,
      color: 'text-status-critical',
      border: 'border-status-critical/20',
      href: '/storms',
    },
    {
      label: 'High-Priority Leads',
      value: highPriority == null ? '—' : String(highPriority),
      icon: Users,
      color: 'text-status-high',
      border: 'border-status-high/20',
      href: '/leads?priority=high',
    },
  ]

  return (
    <div className="p-8 space-y-8 max-w-6xl mx-auto">

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4">
        {stats.map(({ label, value, icon: Icon, color, border, href }) => (
          <Link
            key={label}
            href={href}
            className={`bg-vantage-card border ${border} rounded-lg p-5 flex flex-col gap-4 hover:border-opacity-50 transition-colors`}
          >
            <Icon className={`w-4 h-4 ${color} opacity-60`} />
            <div>
              <p className={`text-4xl font-bold tracking-tight ${color}`}>{value}</p>
              <p className="text-vantage-muted text-xs mt-1.5 leading-snug">{label}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Live map preview — click anywhere to open the full map */}
      <Link href="/map" className="block bg-vantage-card border border-vantage-border rounded-lg overflow-hidden group">
        <div className="flex items-center justify-between px-6 py-3 border-b border-vantage-border">
          <div className="flex items-center gap-2">
            <Map className="w-4 h-4 text-vantage-yellow" />
            <span className="text-sm font-semibold text-vantage-text">Live Map</span>
            {!loading && storms.length > 0 && (
              <span className="text-[10px] font-mono text-vantage-faint">{storms.length} active storms</span>
            )}
          </div>
          <span className="text-vantage-yellow text-xs flex items-center gap-1 group-hover:underline">
            Open map <ArrowRight className="w-3 h-3" />
          </span>
        </div>
        <div className="relative h-[300px]">
          <div className="absolute inset-0 pointer-events-none">
            <MapView
              storms={storms}
              territories={territories}
              leads={[]}
              layers={{ storms: true }}
              selectedStormId={null}
              onStormSelect={() => {}}
              onLeadClick={() => {}}
            />
          </div>
          {/* click shield — the whole preview is one link */}
          <div className="absolute inset-0 z-[1000]" />
        </div>
      </Link>

      {/* Recent storms */}
      <div className="bg-vantage-card border border-vantage-border rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-vantage-border">
          <div className="flex items-center gap-2">
            <CloudLightning className="w-4 h-4 text-vantage-yellow" />
            <span className="text-sm font-semibold text-vantage-text">Recent Storms</span>
          </div>
          <Link href="/storms" className="text-vantage-yellow text-xs hover:underline">
            View all →
          </Link>
        </div>

        {loading ? (
          <div className="px-6 py-10 text-center text-vantage-faint text-xs font-mono">
            FETCHING LIVE DATA...
          </div>
        ) : recentStorms.length === 0 ? (
          <div className="px-6 py-10 text-center text-vantage-faint text-xs">
            No storm events in the last 72 hours.
          </div>
        ) : (
          <div className="divide-y divide-vantage-border">
            {recentStorms.slice(0, 8).map((storm) => (
              <Link
                key={storm.id}
                href={`/storms/${storm.id}`}
                className="flex items-center justify-between px-6 py-5 hover:bg-black/[0.035] transition-colors"
              >
                <div className="flex flex-col gap-1.5 min-w-0">
                  <div className="flex items-center gap-2.5">
                    <span className="text-sm font-semibold text-vantage-text">{storm.name}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${storm.badge.cls} tracking-wider`}>
                      {storm.badge.label}
                    </span>
                  </div>
                  <p className="text-xs text-vantage-muted">
                    {storm.location} · {storm.dateFormatted}
                  </p>
                </div>

                <div className="flex items-center gap-8 flex-shrink-0 pl-6">
                  {storm.hailSize > 0 && (
                    <div className="text-right">
                      <p className="text-[11px] text-vantage-faint mb-0.5">Hail</p>
                      <p className="text-sm font-mono font-semibold text-vantage-text">{storm.hailSize}"</p>
                    </div>
                  )}
                  <div className="text-right">
                    <p className="text-[11px] text-vantage-faint mb-0.5">Severity</p>
                    <p className="text-sm font-mono font-bold text-vantage-yellow">{storm.severity}</p>
                  </div>
                  <div className="text-right hidden md:block">
                    <p className="text-[11px] text-vantage-faint mb-0.5">LSR Reports</p>
                    <p className="text-sm font-mono font-semibold text-vantage-text">{storm.reportCount}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}
