'use client'

import { Map, CloudLightning, Users } from 'lucide-react'
import { useTerritoriesStore } from '@/lib/territories'
import { MOCK_STORMS, MOCK_PROPERTIES } from '@/lib/mock-data'
import Link from 'next/link'

const RECENT_STORMS = MOCK_STORMS
  .sort((a, b) => b.severity - a.severity)
  .map((storm) => ({
    ...storm,
    dateFormatted: new Date(storm.date).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    }),
    badge: storm.severity >= 9 ? 'CRITICAL' : storm.severity >= 7 ? 'HIGH' : 'ELEVATED',
    badgeColor:
      storm.severity >= 9
        ? 'bg-status-critical/15 text-status-critical border-status-critical/30'
        : storm.severity >= 7
        ? 'bg-status-high/15 text-status-high border-status-high/30'
        : 'bg-vantage-yellow-dim text-vantage-yellow border-vantage-yellow/30',
  }))

export default function DashboardPage() {
  const { territories, hydrated } = useTerritoriesStore()

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
      value: String(MOCK_STORMS.length),
      icon: CloudLightning,
      color: 'text-status-critical',
      border: 'border-status-critical/20',
      href: '/storms',
    },
    {
      label: 'High-Priority Leads',
      value: String(MOCK_PROPERTIES.filter((p) => p.leadScore >= 80).length),
      icon: Users,
      color: 'text-status-high',
      border: 'border-status-high/20',
      href: '/leads',
    },
  ]

  return (
    <div className="p-8 space-y-8 max-w-4xl">

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

        <div className="divide-y divide-vantage-border">
          {RECENT_STORMS.map((storm) => (
            <Link
              key={storm.id}
              href={`/storms/${storm.id}`}
              className="flex items-center justify-between px-6 py-5 hover:bg-white/[0.02] transition-colors"
            >
              <div className="flex flex-col gap-1.5 min-w-0">
                <div className="flex items-center gap-2.5">
                  <span className="text-sm font-semibold text-vantage-text">{storm.name}</span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${storm.badgeColor} tracking-wider`}>
                    {storm.badge}
                  </span>
                </div>
                <p className="text-xs text-vantage-muted">
                  {storm.location} · {storm.dateFormatted}
                </p>
              </div>

              <div className="flex items-center gap-8 flex-shrink-0 pl-6">
                <div className="text-right">
                  <p className="text-[11px] text-vantage-faint mb-0.5">Hail</p>
                  <p className="text-sm font-mono font-semibold text-vantage-text">{storm.hailSize}"</p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] text-vantage-faint mb-0.5">Severity</p>
                  <p className="text-sm font-mono font-bold text-vantage-yellow">{storm.severity}</p>
                </div>
                <div className="text-right hidden md:block">
                  <p className="text-[11px] text-vantage-faint mb-0.5">Est. Homes</p>
                  <p className="text-sm font-mono font-semibold text-vantage-text">{storm.estimatedHomes.toLocaleString()}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

    </div>
  )
}
