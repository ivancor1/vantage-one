'use client'

import { useLeadStatuses } from '@/lib/leads-store'
import PropertyCard from './PropertyCard'
import type { Property } from '@/lib/types'

type Props = { properties: Property[] }

export default function StormPropertyList({ properties }: Props) {
  const { statuses, updateStatus } = useLeadStatuses()

  return (
    <div className="space-y-3">
      {properties.map((property, i) => (
        <PropertyCard
          key={property.id}
          property={property}
          rank={i + 1}
          status={statuses[property.id] ?? property.status}
          onStatusChange={(s) => updateStatus(property.id, s)}
        />
      ))}
    </div>
  )
}
