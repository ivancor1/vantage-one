'use client'

import { MapContainer, TileLayer, Circle, CircleMarker, Tooltip } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { MOCK_STORMS, MOCK_PROPERTIES, type Storm } from '@/lib/mock-data'

function severityColor(s: number) {
  if (s >= 9) return '#EF4444'
  if (s >= 7) return '#F97316'
  return '#F0C020'
}

function leadColor(score: number) {
  if (score >= 80) return '#EF4444'
  if (score >= 65) return '#F97316'
  if (score >= 50) return '#F0C020'
  return '#6B7280'
}

type Props = {
  layers: { storms: boolean; properties: boolean }
  selectedStormId: string | null
  onStormSelect: (storm: Storm) => void
}

export default function MapView({ layers, selectedStormId, onStormSelect }: Props) {
  return (
    <MapContainer
      center={[36.5, -98.5]}
      zoom={6}
      className="h-full w-full"
      zoomControl={false}
      style={{ background: '#07090C' }}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://carto.com/">CARTO</a>'
        maxZoom={19}
      />

      {/* Storm zone circles */}
      {layers.storms && MOCK_STORMS.map((storm) => {
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
              fillOpacity: selected ? 0.22 : 0.1,
              weight: selected ? 2 : 1.5,
              opacity: selected ? 1 : 0.65,
            }}
            eventHandlers={{ click: () => onStormSelect(storm) }}
          >
            <Tooltip
              permanent
              direction="center"
              className="vantage-storm-label"
            >
              {storm.severity}
            </Tooltip>
          </Circle>
        )
      })}

      {/* Property markers */}
      {layers.properties && MOCK_PROPERTIES.map((prop) => {
        const color = leadColor(prop.leadScore)
        return (
          <CircleMarker
            key={prop.id}
            center={[prop.lat, prop.lng]}
            radius={5}
            pathOptions={{
              color,
              fillColor: color,
              fillOpacity: 0.85,
              weight: 1,
            }}
          >
            <Tooltip className="vantage-prop-tooltip">
              <div>
                <p className="font-semibold text-xs">{prop.address.split(',')[0]}</p>
                <p className="text-[11px] opacity-75">Lead Score: {prop.leadScore}</p>
              </div>
            </Tooltip>
          </CircleMarker>
        )
      })}
    </MapContainer>
  )
}
