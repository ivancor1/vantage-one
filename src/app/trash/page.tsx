'use client'

import { Trash2, Clock } from 'lucide-react'
import { useTrashLeads } from '@/lib/leads-api'

function timeUntilPurge(deletedAt: string): string {
  const deletedMs = new Date(deletedAt).getTime()
  const purgeMs = deletedMs + 24 * 60 * 60 * 1000
  const remaining = purgeMs - Date.now()
  if (remaining <= 0) return 'Purging soon'
  const h = Math.floor(remaining / 3600000)
  const m = Math.floor((remaining % 3600000) / 60000)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export default function TrashPage() {
  const { leads, loading } = useTrashLeads()

  return (
    <div className="p-8 space-y-6 max-w-6xl mx-auto">
      <div>
        <p className="text-[10px] font-mono text-vantage-faint uppercase tracking-widest mb-1">
          Deleted Territories · Leads
        </p>
        <h2 className="text-lg font-semibold text-vantage-text">Trash</h2>
        <p className="text-xs text-vantage-muted mt-1">
          Leads from deleted territories. Automatically purged 24 hours after deletion.
        </p>
      </div>

      {loading && (
        <div className="py-16 text-center text-vantage-faint text-xs font-mono">LOADING...</div>
      )}

      {!loading && leads.length === 0 && (
        <div className="py-24 flex flex-col items-center gap-3 text-center">
          <Trash2 className="w-8 h-8 text-vantage-faint" />
          <p className="text-sm text-vantage-muted">Trash is empty.</p>
        </div>
      )}

      {!loading && leads.length > 0 && (
        <div className="bg-vantage-card border border-vantage-border rounded-lg overflow-hidden">
          <div className="grid grid-cols-[1fr_120px_100px_80px] gap-4 px-5 py-2.5 border-b border-vantage-border bg-vantage-surface">
            {['Address', 'Territory', 'Score', 'Purges In'].map((h) => (
              <p key={h} className="text-[10px] font-mono text-vantage-faint uppercase tracking-widest">{h}</p>
            ))}
          </div>
          <div className="divide-y divide-vantage-border">
            {leads.map((lead) => (
              <div
                key={lead.id}
                className="grid grid-cols-[1fr_120px_100px_80px] gap-4 px-5 py-3 items-center"
              >
                <div>
                  <p className="text-sm text-vantage-muted">{lead.address.split(',')[0]}</p>
                  <p className="text-xs text-vantage-faint">{lead.address.split(',').slice(1).join(',').trim()}</p>
                </div>
                <p className="text-xs font-mono text-vantage-faint">{lead.territoryValue ?? '—'}</p>
                <p className="text-sm font-mono font-semibold text-vantage-muted">{lead.leadScore}</p>
                <div className="flex items-center gap-1 text-xs text-vantage-faint">
                  <Clock className="w-3 h-3 flex-shrink-0" />
                  {lead.deletedAt ? timeUntilPurge(lead.deletedAt) : '—'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && leads.length > 0 && (
        <p className="text-[10px] text-vantage-faint font-mono text-center">
          {leads.length} lead{leads.length !== 1 ? 's' : ''} · Auto-purged 24 hours after territory deletion
        </p>
      )}
    </div>
  )
}
