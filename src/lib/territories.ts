'use client'

import { useState, useEffect } from 'react'
import { supabase, isSupabaseReady } from './supabase'
import type { Storm } from './types'

export type TerritoryType = 'zip' | 'city' | 'neighborhood'

export type Territory = {
  id: string
  type: TerritoryType
  value: string
  placeName?: string   // resolved from geocoding e.g. "Greenwich, CT"
  radiusMiles: number
  lat?: number
  lng?: number
  addedAt: string
  leadCount?: number
  areaHousingAgeLabel?: string
  historicalHailRiskLabel?: string
  enrichedAt?: string
}

export type ScanState =
  | { status: 'scanning' }
  | { status: 'done'; count: number }
  | { status: 'error'; message: string }

const LS_KEY = 'vantage_territories'

function fromRow(row: {
  id: string
  type: string
  value: string
  place_name?: string | null
  radius_miles: number
  lat: number | null
  lng: number | null
  added_at: string
  area_housing_age_label?: string | null
  historical_hail_risk_label?: string | null
  enriched_at?: string | null
}): Territory {
  return {
    id: row.id,
    type: row.type as TerritoryType,
    value: row.value,
    placeName: row.place_name ?? undefined,
    radiusMiles: row.radius_miles ?? 3,
    lat: row.lat ?? undefined,
    lng: row.lng ?? undefined,
    addedAt: row.added_at,
    areaHousingAgeLabel: row.area_housing_age_label ?? undefined,
    historicalHailRiskLabel: row.historical_hail_risk_label ?? undefined,
    enrichedAt: row.enriched_at ?? undefined,
  }
}

function lsRead(): Territory[] {
  if (typeof window === 'undefined') return []
  const raw = localStorage.getItem(LS_KEY)
  return raw ? JSON.parse(raw) : []
}

function lsWrite(items: Territory[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(items))
}

export function activeStormsForTerritory(territory: Territory, storms: Storm[]): number {
  const v = territory.value.toLowerCase()
  return storms.filter(
    (s) =>
      s.location.toLowerCase().includes(v) ||
      s.name.toLowerCase().includes(v) ||
      s.reports.some((r) => r.city.toLowerCase().includes(v) || r.county.toLowerCase().includes(v))
  ).length
}

async function backfillPlaceNames(
  territories: Territory[],
  onUpdate: (id: string, placeName: string) => void
) {
  const missing = territories.filter((t) => !t.placeName)
  if (!missing.length || !isSupabaseReady()) return

  for (const t of missing) {
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(t.value)}`)
      if (!res.ok) continue
      const geo = await res.json() as { placeName?: string }
      if (!geo.placeName) continue
      onUpdate(t.id, geo.placeName)
      await supabase.from('territories').update({ place_name: geo.placeName }).eq('id', t.id)
    } catch {
      // non-fatal
    }
  }
}

export function useTerritoriesStore() {
  const [territories, setTerritories] = useState<Territory[]>([])
  const [hydrated, setHydrated] = useState(false)
  const [scanStates, setScanStates] = useState<Record<string, ScanState>>({})

  useEffect(() => { load() }, [])

  async function load() {
    if (!isSupabaseReady()) {
      setTerritories(lsRead())
      setHydrated(true)
      return
    }

    const { data, error } = await supabase
      .from('territories')
      .select('id, type, value, place_name, radius_miles, lat, lng, added_at')
      .is('deleted_at', null)
      .order('added_at', { ascending: true })

    if (error || !data) {
      console.warn('[territories] Supabase fetch failed, using localStorage:', error?.message)
      setTerritories(lsRead())
      setHydrated(true)
      return
    }

    const rows = data.map(fromRow)

    // Load lead counts per territory
    const { data: counts } = await supabase
      .from('leads')
      .select('territory_id')
      .is('deleted_at', null)

    const countMap: Record<string, number> = {}
    for (const row of counts ?? []) {
      countMap[row.territory_id] = (countMap[row.territory_id] ?? 0) + 1
    }

    const withCounts = rows.map((t) => ({ ...t, leadCount: countMap[t.id] ?? 0 }))
    setTerritories(withCounts)
    setHydrated(true)

    // Backfill place names for territories that are missing them
    backfillPlaceNames(withCounts, (id, placeName) => {
      setTerritories((prev) => prev.map((t) => t.id === id ? { ...t, placeName } : t))
    })
  }

  async function add(type: TerritoryType, value: string, radiusMiles: number): Promise<string | null> {
    const trimmed = value.trim()
    if (!trimmed) return 'Enter a value.'

    const duplicate = territories.some(
      (t) => t.type === type && t.value.toLowerCase() === trimmed.toLowerCase()
    )
    if (duplicate) return 'Already in your territories.'

    // Geocode the territory value
    let lat: number | undefined
    let lng: number | undefined
    let placeName: string | undefined
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(trimmed)}`)
      if (res.ok) {
        const geo = await res.json() as { lat: number; lng: number; placeName?: string }
        lat = geo.lat
        lng = geo.lng
        placeName = geo.placeName
      }
    } catch {
      // proceed without geocode
    }

    if (!isSupabaseReady()) {
      const next: Territory = {
        id: Date.now().toString(),
        type,
        value: trimmed,
        placeName,
        radiusMiles,
        lat,
        lng,
        addedAt: new Date().toISOString(),
      }
      const updated = [...territories, next]
      setTerritories(updated)
      lsWrite(updated)
      return null
    }

    const tempId = `temp-${Date.now()}`
    const optimistic: Territory = {
      id: tempId,
      type,
      value: trimmed,
      placeName,
      radiusMiles,
      lat,
      lng,
      addedAt: new Date().toISOString(),
    }
    setTerritories((prev) => [...prev, optimistic])

    const { data, error } = await supabase
      .from('territories')
      .insert({ type, value: trimmed, place_name: placeName ?? null, radius_miles: radiusMiles, lat: lat ?? null, lng: lng ?? null })
      .select('id, type, value, place_name, radius_miles, lat, lng, added_at')
      .single()

    if (error || !data) {
      console.error('[territories] Insert failed:', error?.message)
      setTerritories((prev) => prev.filter((t) => t.id !== tempId))
      return error?.message ?? 'Failed to save territory. Check Supabase migrations.'
    }

    const saved = fromRow(data)
    setTerritories((prev) => prev.map((t) => (t.id === tempId ? saved : t)))

    // Trigger Overpass scrape if we have coordinates
    if (lat != null && lng != null) {
      setScanStates((prev) => ({ ...prev, [saved.id]: { status: 'scanning' } }))
      try {
        const res = await fetch('/api/territories/scrape', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ territoryId: saved.id, lat, lng, radiusMiles }),
        })
        if (!res.ok) throw new Error(`Scrape returned ${res.status}`)
        const { count } = await res.json() as { count: number }
        setScanStates((prev) => ({ ...prev, [saved.id]: { status: 'done', count } }))
        setTerritories((prev) => prev.map((t) => t.id === saved.id ? { ...t, leadCount: count } : t))
      } catch (err) {
        setScanStates((prev) => ({
          ...prev,
          [saved.id]: { status: 'error', message: String(err) },
        }))
      }
    }

    return null
  }

  async function remove(id: string) {
    setTerritories((prev) => prev.filter((t) => t.id !== id))

    if (!isSupabaseReady()) {
      lsWrite(territories.filter((t) => t.id !== id))
      return
    }

    const now = new Date().toISOString()

    // Soft-delete leads first → they go to Trash for 24h
    const { error: lErr } = await supabase
      .from('leads')
      .update({ deleted_at: now })
      .eq('territory_id', id)
      .is('deleted_at', null)
    if (lErr) console.error('[territories] Lead soft-delete failed:', lErr.message)

    // Hard-delete the territory so the same ZIP/city can be re-added
    const { error: tErr } = await supabase
      .from('territories')
      .delete()
      .eq('id', id)
    if (tErr) console.error('[territories] Delete failed:', tErr.message)
  }

  return { territories, add, remove, hydrated, scanStates }
}
