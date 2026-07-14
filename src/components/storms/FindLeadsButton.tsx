'use client'

// Storm-detail "Find leads" — starts the scan and IMMEDIATELY takes you to the Leads page,
// which shows a live "finding homes…" state and drops you into the new territory when the
// scan lands. The scan itself runs via the module-scoped storm-leads store, so it survives
// navigation.

import { useRouter } from 'next/navigation'
import { Users, Loader2, Check } from 'lucide-react'
import { useStormLeadStates, startFindLeads } from '@/lib/storm-leads'

export default function FindLeadsButton({ stormId }: { stormId: string }) {
  const router = useRouter()
  const gen = useStormLeadStates()[stormId]

  if (gen?.status === 'done') {
    return (
      <button
        onClick={() => router.push(`/leads?territory=${gen.territoryId}`)}
        className="flex items-center gap-1.5 px-4 py-2 rounded bg-status-success/15 border border-status-success/30 text-xs font-semibold text-status-success hover:bg-status-success/25 transition-colors flex-shrink-0"
      >
        <Check className="w-3.5 h-3.5" />
        {gen.count} leads found — view →
      </button>
    )
  }

  if (gen?.status === 'running') {
    return (
      <button
        onClick={() => router.push(`/leads?storm=${stormId}`)}
        className="flex items-center gap-1.5 px-4 py-2 rounded bg-vantage-surface border border-vantage-border text-xs font-semibold text-vantage-muted flex-shrink-0"
      >
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Finding homes… view progress →
      </button>
    )
  }

  return (
    <div className="flex flex-col items-end gap-1 flex-shrink-0">
      <button
        onClick={() => { startFindLeads(stormId); router.push(`/leads?storm=${stormId}`) }}
        className="flex items-center gap-1.5 px-4 py-2 rounded bg-vantage-yellow text-vantage-black text-xs font-bold hover:opacity-90 transition-opacity"
      >
        <Users className="w-3.5 h-3.5" />
        Find leads in this area
      </button>
      {gen?.status === 'error' && (
        <span className="text-[10px] text-status-critical font-mono max-w-[260px] text-right">{gen.message}</span>
      )}
    </div>
  )
}
