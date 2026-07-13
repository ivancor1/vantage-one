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

type PropertyWithStorm = Property & { stormName: string }

export function useAllProperties(storms: Storm[]) {
  const [properties, setProperties] = useState<PropertyWithStorm[]>([])
  const [loading, setLoading]       = useState(true)
  const [progress, setProgress]     = useState({ done: 0, total: 0 })

  const stormKey = storms.map((s) => s.id).join(',')

  useEffect(() => {
    if (storms.length === 0) {
      setProperties([])
      setLoading(false)
      setProgress({ done: 0, total: 0 })
      return
    }

    let cancelled = false
    setLoading(true)
    setProperties([])
    setProgress({ done: 0, total: storms.length })

    ;(async () => {
      const acc: PropertyWithStorm[] = []
      for (const s of storms) {
        if (cancelled) return
        try {
          const r = await fetch(buildUrl(s))
          if (!r.ok) throw new Error(`HTTP ${r.status}`)
          const props = (await r.json()) as Property[]
          acc.push(...props.map((p) => ({ ...p, stormName: s.name })))
        } catch {
          // skip failed storm, continue with the rest
        }
        if (cancelled) return
        setProgress((prev) => ({ ...prev, done: prev.done + 1 }))
        setProperties(acc.slice().sort((a, b) => b.leadScore - a.leadScore))
      }
      if (!cancelled) setLoading(false)
    })()

    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stormKey])

  return { properties, loading, progress }
}
