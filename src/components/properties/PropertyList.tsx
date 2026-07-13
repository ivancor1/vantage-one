'use client'

import { Home, AlertCircle } from 'lucide-react'
import type { Storm, LeadStatus } from '@/lib/types'
import { useProperties } from '@/lib/property-api'
import { useLeadStatuses } from '@/lib/leads-store'
import PropertyCard from './PropertyCard'

type Props = {
  storm: Pick<Storm, 'id' | 'lat' | 'lng' | 'radiusMeters' | 'severity' | 'name'>
}

export default function PropertyList({ storm }: Props) {
  const { properties, loading, error } = useProperties(storm as Storm)
  const { statuses, updateStatus } = useLeadStatuses()

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-[10px] font-mono text-vantage-faint uppercase tracking-widest mb-1">
            OSM Buildings · Ranked by Vantage Lead Score
          </p>
          <h2 className="text-sm font-semibold text-vantage-text">
            Properties in Storm Area
            {!loading && (
              <span className="ml-2 text-vantage-faint font-normal">({properties.length})</span>
            )}
          </h2>
        </div>
        {!loading && properties.length > 0 && (
          <p className="text-[10px] text-vantage-faint font-mono">
            Source: OpenStreetMap · Score: Vantage model
          </p>
        )}
      </div>

      {loading && (
        <div className="py-10 text-center text-vantage-faint text-xs font-mono">
          QUERYING OVERPASS API...
        </div>
      )}

      {error && (
        <div className="py-8 flex flex-col items-center gap-2 text-center">
          <AlertCircle className="w-5 h-5 text-status-critical" />
          <p className="text-status-critical text-sm">Could not load property data.</p>
          <p className="text-vantage-faint text-xs">{error}</p>
        </div>
      )}

      {!loading && !error && properties.length === 0 && (
        <div className="py-10 flex flex-col items-center gap-2 text-center">
          <Home className="w-5 h-5 text-vantage-faint" />
          <p className="text-vantage-muted text-sm">No addressed buildings found in OpenStreetMap for this area.</p>
          <p className="text-vantage-faint text-xs">
            OSM coverage varies by region. Rural or newly-developed areas may have limited data.
          </p>
        </div>
      )}

      {!loading && !error && properties.length > 0 && (
        <div className="space-y-3">
          {properties.map((property, i) => (
            <PropertyCard
              key={property.id}
              property={property}
              rank={i + 1}
              status={(statuses[property.id] ?? property.status) as LeadStatus}
              onStatusChange={(s) => updateStatus(property.id, s)}
              stormName={storm.name}
            />
          ))}
        </div>
      )}
    </div>
  )
}
