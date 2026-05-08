'use client'

import { useState, useEffect, useCallback } from 'react'
import type { LeadStatus } from './mock-data'

const KEY = 'vantage_lead_statuses'

export function useLeadStatuses() {
  const [statuses, setStatuses] = useState<Record<string, LeadStatus>>({})
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(KEY)
    setStatuses(stored ? JSON.parse(stored) : {})
    setHydrated(true)
  }, [])

  const updateStatus = useCallback((id: string, status: LeadStatus) => {
    setStatuses((prev) => {
      const next = { ...prev, [id]: status }
      localStorage.setItem(KEY, JSON.stringify(next))
      return next
    })
  }, [])

  return { statuses, updateStatus, hydrated }
}
