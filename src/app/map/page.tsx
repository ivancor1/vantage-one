'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Layers } from 'lucide-react'
import type { Storm } from '@/lib/types'
import { useStorms } from '@/lib/storm-api'
import { useTerritoriesStore } from '@/lib/territories'
import { useLeads } from '@/lib/leads-api'
import LayerControls from '@/components/map/LayerControls'
import StormDetailPanel from '@/components/map/StormDetailPanel'

const MapView = dynamic(() => import('@/components/map/MapView'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center bg-vantage-black">
      <div className="flex flex-col items-center gap-3">
        <Layers className="w-6 h-6 text-vantage-yellow animate-pulse" />
        <p className="text-vantage-muted text-xs font-mono">LOADING MAP...</p>
      </div>
    </div>
  ),
})

type LayerState = { storms: boolean }

export default function MapPage() {
  const [selectedStorm, setSelectedStorm] = useState<Storm | null>(null)
  const [layers, setLayers] = useState<LayerState>({ storms: true })
  const { storms } = useStorms()
  const { territories } = useTerritoriesStore()
  const { leads } = useLeads()
  const router = useRouter()

  const analyzedLeads = leads.filter((l) => l.visualRoofScore != null)

  function handleLeadClick(leadId: string) {
    router.push(`/leads?highlight=${leadId}`)
  }

  return (
    <div className="relative overflow-hidden" style={{ height: 'calc(100vh - 48px)' }}>
      <MapView
        storms={storms}
        territories={territories}
        analyzedLeads={analyzedLeads}
        layers={layers}
        selectedStormId={selectedStorm?.id ?? null}
        onStormSelect={setSelectedStorm}
        onLeadClick={handleLeadClick}
      />

      <LayerControls layers={layers} onChange={setLayers} />

      {selectedStorm && (
        <StormDetailPanel
          storm={selectedStorm}
          onClose={() => setSelectedStorm(null)}
        />
      )}

      <div className="absolute bottom-4 left-4 z-[1000] bg-vantage-surface/90 backdrop-blur-sm border border-vantage-border rounded-lg px-3 py-2.5 space-y-1.5">
        <p className="text-[10px] font-mono text-vantage-faint uppercase tracking-widest">
          Severity
        </p>
        {[
          { color: '#EF4444', label: '9.0+  Critical' },
          { color: '#F97316', label: '7.0–9.0  High' },
          { color: '#F0C020', label: '5.0–7.0  Elevated' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
            <span className="text-[11px] font-mono text-vantage-muted">{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
