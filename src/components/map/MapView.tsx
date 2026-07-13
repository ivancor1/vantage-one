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

function roofScoreColor(score: number) {
  if (score >= 70) return '#EF4444'
  if (score >= 50) return '#F97316'
  if (score >= 30) return '#F0C020'
  return '#4ADE80'
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
  analyzedLeads: Lead[]
  layers: { storms: boolean }
  selectedStormId: string | null
  onStormSelect: (storm: Storm) => void
  onLeadClick: (leadId: string) => void
}

// Zoom threshold: above this, houses take priority; below, storms/territories do
const HOUSE_PRIORITY_ZOOM = 11

export default function MapView({ storms, territories, analyzedLeads, layers, selectedStormId, onStormSelect, onLeadClick }: Props) {
  const [zoom, setZoom] = useState(5)
  const housePriority = zoom >= HOUSE_PRIORITY_ZOOM

  return (
    <MapContainer
      center={[36.5, -98.5]}
      zoom={5}
      className="h-full w-full"
      zoomControl={false}
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

      {/* Lead dots — in markerPane (z-index 600) so always above overlay circles (z-index 400) */}
      {analyzedLeads.map((lead) => {
        const color = roofScoreColor(lead.visualRoofScore!)
        const radius = zoom >= 14 ? 9 : zoom >= 12 ? 7 : 5
        return (
          <CircleMarker
            key={lead.id}
            center={[lead.lat, lead.lng]}
            radius={radius}
            pane="markerPane"
            pathOptions={{
              color,
              fillColor: color,
              fillOpacity: 0.9,
              weight: 1.5,
            }}
            eventHandlers={{ click: () => onLeadClick(lead.id) }}
          >
            <Tooltip direction="top" offset={[0, -radius - 2]}>
              <span className="text-xs font-mono">
                {lead.address.split(',')[0]} · AI score {lead.visualRoofScore}
              </span>
            </Tooltip>
          </CircleMarker>
        )
      })}
    </MapContainer>
  )
}
