'use client'

import { useState, useEffect } from 'react'
import { MOCK_STORMS } from './mock-data'

export type TerritoryType = 'zip' | 'city' | 'neighborhood'

export type Territory = {
  id: string
  type: TerritoryType
  value: string
  addedAt: string
}

const STORAGE_KEY = 'vantage_territories'

const DEFAULTS: Territory[] = [
  { id: 'd1', type: 'zip',  value: '75023', addedAt: '2024-04-01T00:00:00Z' },
  { id: 'd2', type: 'zip',  value: '75024', addedAt: '2024-04-01T00:00:00Z' },
  { id: 'd3', type: 'city', value: 'Plano, TX', addedAt: '2024-04-01T00:00:00Z' },
  { id: 'd4', type: 'zip',  value: '73012', addedAt: '2024-04-15T00:00:00Z' },
  { id: 'd5', type: 'zip',  value: '80013', addedAt: '2024-05-01T00:00:00Z' },
]

export function activeStormsForTerritory(territory: Territory): number {
  return MOCK_STORMS.filter((storm) =>
    storm.affectedZips.includes(territory.value) ||
    storm.location.toLowerCase().includes(territory.value.toLowerCase())
  ).length
}

export function useTerritoriesStore() {
  const [territories, setTerritories] = useState<Territory[]>([])
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    setTerritories(stored ? JSON.parse(stored) : DEFAULTS)
    setHydrated(true)
  }, [])

  function save(updated: Territory[]) {
    setTerritories(updated)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  }

  function add(type: TerritoryType, value: string) {
    const trimmed = value.trim()
    if (!trimmed) return
    const already = territories.some(
      (t) => t.type === type && t.value.toLowerCase() === trimmed.toLowerCase()
    )
    if (already) return
    save([
      ...territories,
      { id: Date.now().toString(), type, value: trimmed, addedAt: new Date().toISOString() },
    ])
  }

  function remove(id: string) {
    save(territories.filter((t) => t.id !== id))
  }

  return { territories, add, remove, hydrated }
}
