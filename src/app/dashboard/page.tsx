import {
  Map,
  CloudLightning,
  Users,
  Route,
  AlertTriangle,
  TrendingUp,
  Clock,
} from 'lucide-react'

const STATS = [
  {
    label: 'Monitored Territories',
    value: '7',
    sub: '4 zip codes · 3 cities',
    icon: Map,
    color: 'text-vantage-yellow',
    border: 'border-vantage-yellow/20',
  },
  {
    label: 'Active Storms',
    value: '3',
    sub: 'Last 30 days',
    icon: CloudLightning,
    color: 'text-status-critical',
    border: 'border-status-critical/20',
  },
  {
    label: 'High-Priority Leads',
    value: '124',
    sub: '18 new since yesterday',
    icon: Users,
    color: 'text-status-high',
    border: 'border-status-high/20',
  },
  {
    label: 'Pending Routes',
    value: '2',
    sub: '47 stops total',
    icon: Route,
    color: 'text-status-success',
    border: 'border-status-success/20',
  },
]

const RECENT_STORMS = [
  {
    id: '1',
    name: 'North Dallas Supercell',
    location: 'Plano, TX',
    date: 'May 3, 2024',
    hail: '2.25"',
    severity: 9.2,
    homes: '3,400',
    badge: 'CRITICAL',
    badgeColor: 'bg-status-critical/15 text-status-critical border-status-critical/30',
  },
  {
    id: '2',
    name: 'Edmond Hail Event',
    location: 'Edmond, OK',
    date: 'Apr 27, 2024',
    hail: '3.0"',
    severity: 9.8,
    homes: '2,200',
    badge: 'CRITICAL',
    badgeColor: 'bg-status-critical/15 text-status-critical border-status-critical/30',
  },
  {
    id: '3',
    name: 'Aurora Front Range Storm',
    location: 'Aurora, CO',
    date: 'Jun 15, 2024',
    hail: '1.75"',
    severity: 7.8,
    homes: '1,800',
    badge: 'HIGH',
    badgeColor: 'bg-status-high/15 text-status-high border-status-high/30',
  },
]

export default function DashboardPage() {
  return (
    <div className="p-6 space-y-6 max-w-screen-2xl">
      {/* Header row */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-vantage-faint text-xs font-mono uppercase tracking-widest mb-1">
            VANTAGE INTELLIGENCE PLATFORM
          </p>
          <h2 className="text-vantage-text text-xl font-semibold">Command Center</h2>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded border border-vantage-yellow/25 bg-vantage-yellow-dim">
          <AlertTriangle className="w-3.5 h-3.5 text-vantage-yellow" />
          <span className="text-vantage-yellow text-xs font-semibold tracking-wide">
            STORM SEASON ACTIVE
          </span>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {STATS.map(({ label, value, sub, icon: Icon, color, border }) => (
          <div
            key={label}
            className={`bg-vantage-card border ${border} rounded-lg p-4 flex flex-col gap-3`}
          >
            <div className="flex items-center justify-between">
              <span className="text-vantage-muted text-xs font-medium uppercase tracking-wider">
                {label}
              </span>
              <Icon className={`w-4 h-4 ${color} opacity-70`} />
            </div>
            <div>
              <p className={`text-3xl font-bold ${color}`}>{value}</p>
              <p className="text-vantage-faint text-xs mt-0.5">{sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Recent storms + activity */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Recent storms */}
        <div className="xl:col-span-2 bg-vantage-card border border-vantage-border rounded-lg">
          <div className="flex items-center justify-between px-4 py-3 border-b border-vantage-border">
            <div className="flex items-center gap-2">
              <CloudLightning className="w-4 h-4 text-vantage-yellow" />
              <span className="text-sm font-semibold text-vantage-text">Recent Storm Events</span>
            </div>
            <span className="text-vantage-faint text-xs">Last 90 days</span>
          </div>
          <div className="divide-y divide-vantage-border">
            {RECENT_STORMS.map((storm) => (
              <div
                key={storm.id}
                className="flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition-colors cursor-pointer"
              >
                <div className="flex flex-col gap-0.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-vantage-text truncate">
                      {storm.name}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${storm.badgeColor} tracking-wider flex-shrink-0`}
                    >
                      {storm.badge}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-vantage-muted">
                    <span>{storm.location}</span>
                    <span className="text-vantage-faint">·</span>
                    <span>{storm.date}</span>
                  </div>
                </div>
                <div className="flex items-center gap-6 flex-shrink-0 pl-4">
                  <div className="text-right">
                    <p className="text-xs text-vantage-faint">Hail</p>
                    <p className="text-sm font-mono font-semibold text-vantage-text">{storm.hail}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-vantage-faint">Severity</p>
                    <p className="text-sm font-mono font-semibold text-vantage-yellow">{storm.severity}</p>
                  </div>
                  <div className="text-right hidden sm:block">
                    <p className="text-xs text-vantage-faint">Est. Homes</p>
                    <p className="text-sm font-mono font-semibold text-vantage-text">{storm.homes}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="px-4 py-3 border-t border-vantage-border">
            <p className="text-vantage-faint text-xs">
              Full storm feed and property lists available in{' '}
              <span className="text-vantage-yellow">Storms</span> — coming in Step 2.
            </p>
          </div>
        </div>

        {/* Activity feed */}
        <div className="bg-vantage-card border border-vantage-border rounded-lg">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-vantage-border">
            <TrendingUp className="w-4 h-4 text-vantage-yellow" />
            <span className="text-sm font-semibold text-vantage-text">Activity</span>
          </div>
          <div className="divide-y divide-vantage-border">
            {[
              { icon: Users,          color: 'text-status-high',    msg: 'Lead status updated',         sub: '3842 Elm Ridge Dr, Plano',   time: '4m ago' },
              { icon: Route,          color: 'text-status-success',  msg: 'Route generated',             sub: '12 stops · Plano North',     time: '1h ago' },
              { icon: CloudLightning, color: 'text-status-critical', msg: 'New storm detected',          sub: 'Edmond, OK · Sev 9.8',       time: '3h ago' },
              { icon: Map,            color: 'text-vantage-yellow',  msg: 'Territory added',             sub: 'ZIP 75023 · Plano, TX',      time: '1d ago' },
              { icon: Clock,          color: 'text-vantage-muted',   msg: 'Inspection booked',           sub: '1804 Foxcroft Ln, Aurora',   time: '2d ago' },
            ].map(({ icon: Icon, color, msg, sub, time }, i) => (
              <div key={i} className="flex items-start gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors">
                <div className="mt-0.5 flex-shrink-0">
                  <Icon className={`w-3.5 h-3.5 ${color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-vantage-text">{msg}</p>
                  <p className="text-[11px] text-vantage-faint truncate">{sub}</p>
                </div>
                <span className="text-[11px] text-vantage-faint flex-shrink-0">{time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Coming soon note */}
      <div className="border border-dashed border-vantage-border rounded-lg px-5 py-4">
        <p className="text-vantage-faint text-xs font-mono">
          STEP 1 COMPLETE — Foundation scaffold only. Storms, Map, Leads, Route Builder, and
          Territory management will be built in subsequent steps.
        </p>
      </div>
    </div>
  )
}
