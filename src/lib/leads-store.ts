'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase, isSupabaseReady } from './supabase'
import type { LeadStatus } from './mock-data'

const LS_KEY = 'vantage_lead_statuses'

function lsRead(): Record<string, LeadStatus> {
  if (typeof window === 'undefined') return {}
  const raw = localStorage.getItem(LS_KEY)
  return raw ? JSON.parse(raw) : {}
}

export function useLeadStatuses() {
  const [statuses, setStatuses] = useState<Record<string, LeadStatus>>({})
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    if (!isSupabaseReady()) {
      setStatuses(lsRead())
      setHydrated(true)
      return
    }

    const { data, error } = await supabase
      .from('lead_statuses')
      .select('property_id, status')

    if (error || !data) {
      console.warn('[leads] Supabase fetch failed, using localStorage:', error?.message)
      setStatuses(lsRead())
    } else {
      const map: Record<string, LeadStatus> = {}
      for (const row of data) map[row.property_id] = row.status as LeadStatus
      setStatuses(map)
    }
    setHydrated(true)
  }

  const updateStatus = useCallback((id: string, status: LeadStatus) => {
    setStatuses((prev) => {
      const next = { ...prev, [id]: status }

      if (!isSupabaseReady()) {
        localStorage.setItem(LS_KEY, JSON.stringify(next))
        return next
      }

      supabase
        .from('lead_statuses')
        .upsert(
          { property_id: id, status, updated_at: new Date().toISOString() },
          { onConflict: 'property_id' }
        )
        .then(({ error }) => {
          if (error) console.error('[leads] Upsert failed:', error.message)
        })

      return next
    })
  }, [])

  return { statuses, updateStatus, hydrated }
}
