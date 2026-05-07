import { Settings } from 'lucide-react'

export default function SettingsPage() {
  return (
    <div className="p-6 space-y-4 max-w-screen-xl">
      <div className="flex items-center gap-2">
        <Settings className="w-4 h-4 text-vantage-yellow" />
        <h2 className="text-sm font-semibold text-vantage-text">Settings</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Account',      desc: 'Profile, password, and security.' },
          { label: 'Company',      desc: 'Roofing company info and team members.' },
          { label: 'Territories',  desc: 'Manage monitored zip codes and regions.' },
          { label: 'Integrations', desc: 'Connect CRM, Supabase, and mapping APIs.' },
          { label: 'Notifications',desc: 'Alert thresholds and delivery preferences.' },
          { label: 'Billing',      desc: 'Subscription plan and usage.' },
        ].map(({ label, desc }) => (
          <div
            key={label}
            className="bg-vantage-card border border-vantage-border rounded-lg p-4 space-y-1"
          >
            <p className="text-sm font-medium text-vantage-text">{label}</p>
            <p className="text-xs text-vantage-muted">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
