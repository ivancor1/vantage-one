'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Map,
  CloudLightning,
  Users,
  MapPin,
  Settings,
  ShieldAlert,
} from 'lucide-react'
import clsx from 'clsx'

const NAV = [
  { href: '/dashboard',  label: 'Dashboard',   icon: LayoutDashboard },
  { href: '/map',        label: 'Map',          icon: Map },
  { href: '/storms',     label: 'Storms',       icon: CloudLightning },
  { href: '/leads',      label: 'Leads',        icon: Users },
  { href: '/territories',label: 'Territories',  icon: MapPin },
]

const BOTTOM_NAV = [
  { href: '/settings',  label: 'Settings',   icon: Settings },
]

export default function Sidebar() {
  const pathname = usePathname()

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + '/')

  return (
    <aside className="flex flex-col w-[220px] min-h-screen bg-vantage-surface border-r border-vantage-border flex-shrink-0">
      {/* Wordmark */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-vantage-border">
        <ShieldAlert className="w-5 h-5 text-vantage-yellow flex-shrink-0" />
        <span className="text-vantage-yellow font-bold tracking-[0.18em] text-sm uppercase">
          VANTAGE
        </span>
      </div>

      {/* Main nav */}
      <nav className="flex flex-col gap-0.5 px-2 pt-3 flex-1">
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={clsx(
              'flex items-center gap-3 px-3 py-2.5 rounded text-sm font-medium transition-colors',
              isActive(href)
                ? 'bg-vantage-yellow-dim text-vantage-yellow border-l-2 border-vantage-yellow pl-[10px]'
                : 'text-vantage-muted hover:text-vantage-text hover:bg-white/5 border-l-2 border-transparent pl-[10px]'
            )}
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            {label}
          </Link>
        ))}
      </nav>

      {/* Bottom nav */}
      <div className="flex flex-col gap-0.5 px-2 pb-4 border-t border-vantage-border pt-3 mt-3">
        {BOTTOM_NAV.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={clsx(
              'flex items-center gap-3 px-3 py-2.5 rounded text-sm font-medium transition-colors border-l-2',
              isActive(href)
                ? 'bg-vantage-yellow-dim text-vantage-yellow border-vantage-yellow pl-[10px]'
                : 'text-vantage-muted hover:text-vantage-text hover:bg-white/5 border-transparent pl-[10px]'
            )}
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            {label}
          </Link>
        ))}

        {/* User chip */}
        <div className="mt-3 mx-1 flex items-center gap-2.5 p-2.5 rounded bg-vantage-card border border-vantage-border">
          <div className="w-7 h-7 rounded-full bg-vantage-yellow/20 border border-vantage-yellow/30 flex items-center justify-center flex-shrink-0">
            <span className="text-vantage-yellow text-xs font-bold">IC</span>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-vantage-text truncate">Ivan C.</p>
            <p className="text-[11px] text-vantage-faint truncate">Storm Rep</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
