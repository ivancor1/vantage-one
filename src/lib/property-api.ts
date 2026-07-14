'use client'

import { useState, useEffect } from 'react'
import type { Property, Storm } from './types'

function buildUrl(storm: Storm): string {
  const p = new URLSearchParams({
    stormId:  storm.id,
    lat:      String(storm.lat),
    lng:      String(storm.lng),
    radius:   String(storm.radiusMeters),
    severity: String(storm.severity),
  })
  return `/api/properties?${p}`
}

export function useProperties(storm: Storm) {
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch(buildUrl(storm))
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json() as Promise<Property[]>
      })
      .then((data) => { setProperties(data); setLoading(false) })
      .catch((e: Error) => { setError(e.message); setLoading(false) })
  }, [storm.id])

  return { properties, loading, error }
}

