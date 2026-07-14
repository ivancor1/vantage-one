'use client'

import { useState } from 'react'
import { MapContainer, TileLayer, Circle, CircleMarker, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import type { Storm, Lead } from '@/lib/types'
import type { Territory } from '@/lib/territories'

function severityColor(s: number) {
  if (s >= 9) return '#EF4444'
  if (s >= 7) return '#F97316'
  return '#F0C020'
}

// Colour every home by its lead score (HIGH/ELEVATED/… bands). Un-assessed homes still
// show — they're real door-knockable addresses, just not roof-read yet.
function leadColor(score: number) {
  if (score >= 65) return '#EF4444' // HIGH / CRITICAL
  if (score >= 50) return '#F97316' // ELEVATED
  if (score >= 40) return '#F0C020'
  return '#9ca3af'                   // STANDARD — muted grey
}

// Tracks zoom level; must live inside MapContainer
function ZoomTracker({ onChange }: { onChange: (z: number) => void }) {
  const map = useMap()
  useMapEvents({ zoom: () => onChange(map.getZoom()) })
  return null
}

type Props = {
  storms: Storm[]
  territories: Territory[]
  leads: Lead[]   // ALL leads in view (assessed or not) — every real addressed home
  layers: { storms: boolean }
  selectedStormId: string | null
  onStormSelect: (storm: Storm) => void
  onLeadClick: (leadId: string) => void
}

// Zoom threshold: above this, houses take priority; below, storms/territories do
const HOUSE_PRIORITY_ZOOM = 11

export default function MapView({ storms, territories, leads, layers, selectedStormId, onStormSelect, onLeadClick }: Props) {
  const [zoom, setZoom] = useState(5)
  const housePriority = zoom >= HOUSE_PRIORITY_ZOOM

  return (
    <MapContainer
      center={[36.5, -98.5]}
      zoom={5}
      className="h-full w-full"
      zoomControl={false}
      // Canvas renderer: ~900 lead dots draw on one canvas instead of 900 SVG paths —
      // much smoother pan/zoom, and it sidesteps the per-path Leaflet tooltip race.
      preferCanvas
      style={{ background: '#eae7e1' }}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://carto.com/">CARTO</a>'
        maxZoom={19}
      />
      <ZoomTracker onChange={setZoom} />

      {/* Territory circles */}
      {territories.filter((t) => t.lat != null && t.lng != null).map((t) => (
        <Circle
          key={t.id}
          center={[t.lat!, t.lng!]}
          radius={t.radiusMiles * 1609.34}
          pathOptions={{
            color: '#3B82F6',
            fillColor: '#3B82F6',
            fillOpacity: 0.08,
            weight: 1.5,
            opacity: housePriority ? 0.3 : 0.7,
            interactive: !housePriority,
          }}
        >
          {!housePriority && (
            <Tooltip direction="center" className="vantage-storm-label">
              {t.value} · {t.radiusMiles} mi
            </Tooltip>
          )}
        </Circle>
      ))}

      {/* Storm circles — fade and become non-interactive when zoomed in */}
      {layers.storms && storms.map((storm) => {
        const color = severityColor(storm.severity)
        const selected = storm.id === selectedStormId
        return (
          <Circle
            key={storm.id}
            center={[storm.lat, storm.lng]}
            radius={storm.radiusMeters}
            pathOptions={{
              color,
              fillColor: color,
              fillOpacity: housePriority ? 0.04 : (selected ? 0.22 : 0.1),
              weight: housePriority ? 1 : (selected ? 2 : 1.5),
              opacity: housePriority ? 0.25 : (selected ? 1 : 0.65),
              interactive: !housePriority,
            }}
            eventHandlers={housePriority ? {} : { click: () => onStormSelect(storm) }}
          >
            {!housePriority && (
              <Tooltip permanent direction="center" className="vantage-storm-label">
                {storm.severity}
              </Tooltip>
            )}
          </Circle>
        )
      })}

      {/* Lead dots — every home in view. markerPane (z 600) keeps them above overlay circles. */}
      {leads.map((lead) => {
        const color = leadColor(lead.leadScore)
        const radius = zoom >= 14 ? 8 : zoom >= 12 ? 6 : 4
        const assessed = lead.visualRoofScore != null
        return (
          <CircleMarker
            key={lead.id}
            center={[lead.lat, lead.lng]}
            radius={radius}
            pane="markerPane"
            pathOptions={{
              color,
              fillColor: color,
              fillOpacity: assessed ? 0.95 : 0.5, // roof-assessed homes read solid; others softer
              weight: assessed ? 1.5 : 1,
            }}
            eventHandlers={{ click: () => onLeadClick(lead.id) }}
          >
            <Tooltip direction="top" offset={[0, -radius - 2]}>
              <span className="text-xs font-mono">
                {lead.address.split(',')[0]} · score {lead.leadScore}
                {assessed ? ' · roof read' : ''}
              </span>
            </Tooltip>
          </CircleMarker>
        )
      })}
    </MapContainer>
  )
}
