'use client'

import { useState, useEffect } from 'react'
import { supabase, isSupabaseReady } from './supabase'
import { MOCK_STORMS } from './mock-data'

export type TerritoryType = 'zip' | 'city' | 'neighborhood'

export type Territory = {
  id: string
  type: TerritoryType
  value: string
  addedAt: string
}

const LS_KEY = 'vantage_territories'

const DEFAULTS: Territory[] = [
  { id: 'd1', type: 'zip',  value: '75023',     addedAt: '2024-04-01T00:00:00Z' },
  { id: 'd2', type: 'zip',  value: '75024',     addedAt: '2024-04-01T00:00:00Z' },
  { id: 'd3', type: 'city', value: 'Plano, TX', addedAt: '2024-04-01T00:00:00Z' },
  { id: 'd4', type: 'zip',  value: '73012',     addedAt: '2024-04-15T00:00:00Z' },
  { id: 'd5', type: 'zip',  value: '80013',     addedAt: '2024-05-01T00:00:00Z' },
]

// ── helpers ──────────────────────────────────────────────────────────────────

function fromRow(row: { id: string; type: string; value: string; added_at: string }): Territory {
  return { id: row.id, type: row.type as TerritoryType, value: row.value, addedAt: row.added_at }
}

function lsRead(): Territory[] {
  if (typeof window === 'undefined') return DEFAULTS
  const raw = localStorage.getItem(LS_KEY)
  return raw ? JSON.parse(raw) : DEFAULTS
}

function lsWrite(items: Territory[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(items))
}

// ── public helper ─────────────────────────────────────────────────────────────

export function activeStormsForTerritory(territory: Territory): number {
  return MOCK_STORMS.filter(
    (s) =>
      s.affectedZips.includes(territory.value) ||
      s.location.toLowerCase().includes(territory.value.toLowerCase())
  ).length
}

// ── hook ──────────────────────────────────────────────────────────────────────

export function useTerritoriesStore() {
  const [territories, setTerritories] = useState<Territory[]>([])
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    if (!isSupabaseReady()) {
      setTerritories(lsRead())
      setHydrated(true)
      return
    }

    const { data, error } = await supabase
      .from('territories')
      .select('id, type, value, added_at')
      .order('added_at', { ascending: true })

    if (error || !data) {
      console.warn('[territories] Supabase fetch failed, using localStorage:', error?.message)
      setTerritories(lsRead())
    } else {
      setTerritories(data.length > 0 ? data.map(fromRow) : DEFAULTS)
    }
    setHydrated(true)
  }

  async function add(type: TerritoryType, value: string) {
    const trimmed = value.trim()
    if (!trimmed) return
    const duplicate = territories.some(
      (t) => t.type === type && t.value.toLowerCase() === trimmed.toLowerCase()
    )
    if (duplicate) return

    if (!isSupabaseReady()) {
      const next: Territory = {
        id: Date.now().toString(), type, value: trimmed,
        addedAt: new Date().toISOString(),
      }
      const updated = [...territories, next]
      setTerritories(updated)
      lsWrite(updated)
      return
    }

    // Optimistic
    const tempId = `temp-${Date.now()}`
    const optimistic: Territory = { id: tempId, type, value: trimmed, addedAt: new Date().toISOString() }
    setTerritories((prev) => [...prev, optimistic])

    const { data, error } = await supabase
      .from('territories')
      .insert({ type, value: trimmed })
      .select('id, type, value, added_at')
      .single()

    if (error || !data) {
      console.error('[territories] Insert failed:', error?.message)
      setTerritories((prev) => prev.filter((t) => t.id !== tempId))
      return
    }

    setTerritories((prev) =>
      prev.map((t) => (t.id === tempId ? fromRow(data) : t))
    )
  }

  async function remove(id: string) {
    const updated = territories.filter((t) => t.id !== id)
    setTerritories(updated)

    if (!isSupabaseReady()) {
      lsWrite(updated)
      return
    }

    const { error } = await supabase.from('territories').delete().eq('id', id)
    if (error) console.error('[territories] Delete failed:', error.message)
  }

  return { territories, add, remove, hydrated }
}
