'use client'

import { usePathname } from 'next/navigation'
import { Bell, Activity } from 'lucide-react'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Command Center',
  '/map':       'World View',
  '/storms':    'Storm Feed',
  '/leads':     'Lead Intelligence',
  '/territories':'Territories',
  '/settings':  'Settings',
}

function resolveTitle(pathname: string) {
  for (const [key, title] of Object.entries(PAGE_TITLES)) {
    if (pathname === key || pathname.startsWith(key + '/')) return title
  }
  return 'Vantage'
}

export default function TopBar() {
  const pathname = usePathname()
  const title = resolveTitle(pathname)

  return (
    <header className="h-12 flex items-center justify-between px-5 bg-vantage-surface border-b border-vantage-border flex-shrink-0">
      {/* Left: page title */}
      <div className="flex items-center gap-3">
        <h1 className="text-sm font-semibold text-vantage-text tracking-wide">{title}</h1>
        <span className="hidden sm:block text-vantage-faint text-xs">|</span>
        <span className="hidden sm:block text-vantage-faint text-xs font-mono">
          {new Date().toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </span>
      </div>

      {/* Right: status chips + alerts */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-status-critical/30 bg-status-critical/10">
          <Activity className="w-3 h-3 text-status-critical animate-pulse" />
          <span className="text-[11px] font-semibold text-status-critical tracking-wide">
            3 ACTIVE STORMS
          </span>
        </div>

        <button className="relative p-1.5 rounded hover:bg-white/5 transition-colors text-vantage-muted hover:text-vantage-text">
          <Bell className="w-4 h-4" />
          <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-vantage-yellow" />
        </button>
      </div>
    </header>
  )
}
