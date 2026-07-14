'use client'

import { useState, useEffect } from 'react'
import { supabase, isSupabaseReady } from './supabase'
import type { Storm, LsrReport } from './types'

const SYNC_INTERVAL_MS = 30 * 60 * 1000 // 30 min

// Module-level guard — one IEM sync at a time, across all hook instances
let syncInProgress = false
let lastSyncMs = 0

function fromRow(row: Record<string, unknown>): Storm {
  return {
    id: row.id as string,
    wfo: row.wfo as string,
    date: row.date as string,
    name: row.name as string,
    location: row.location as string,
    lat: row.lat as number,
    lng: row.lng as number,
    hailSize: row.hail_size as number,
    windSpeed: row.wind_speed as number,
    reportCount: row.report_count as number,
    severity: row.severity as number,
    radiusMeters: row.radius_meters as number,
    affectedZips: [],
    reports: (row.reports as LsrReport[]) ?? [],
    hailCoreLat: (row.hail_core_lat as number | null) ?? (row.lat as number),
    hailCoreLng: (row.hail_core_lng as number | null) ?? (row.lng as number),
  }
}

async function triggerSync(): Promise<void> {
  if (syncInProgress || Date.now() - lastSyncMs < SYNC_INTERVAL_MS) return
  syncInProgress = true
  lastSyncMs = Date.now()
  try {
    await fetch('/api/storms')
  } catch {
    // sync failure is non-fatal — stale data is better than no data
  } finally {
    syncInProgress = false
  }
}

export function useStorms() {
  const [storms, setStorms] = useState<Storm[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    // No Supabase configured — fall back to direct API call (dev/demo mode)
    if (!isSupabaseReady()) {
      try {
        const res = await fetch('/api/storms')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        setStorms(await res.json())
      } catch (e) {
        setError(String(e))
      }
      setLoading(false)
      return
    }

    // Read persisted storms from Supabase
    const { data, error: dbErr } = await supabase
      .from('storms')
      .select('*')
      .eq('active', true)
      .order('severity', { ascending: false })

    if (dbErr) {
      setError(dbErr.message)
      setLoading(false)
      return
    }

    if (data && data.length > 0) {
      setStorms(data.map(fromRow))
      setLoading(false)

      // Trigger IEM sync in the background only if data is stale
      const oldestUpdate = Math.min(...data.map((s) => new Date(s.last_seen_at as string).getTime()))
      if (Date.now() - oldestUpdate > SYNC_INTERVAL_MS) {
        triggerSync().then(load)
      }
    } else {
      // Supabase has no storms yet — trigger first sync, then read
      await triggerSync()
      const { data: fresh } = await supabase
        .from('storms')
        .select('*')
        .eq('active', true)
        .order('severity', { ascending: false })
      setStorms((fresh ?? []).map(fromRow))
      setLoading(false)
    }
  }

  return { storms, loading, error }
}
