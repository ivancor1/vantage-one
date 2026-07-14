'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase, isSupabaseReady } from './supabase'
import type { Lead, LeadStatus } from './types'

type LeadRow = {
  id: string
  territory_id: string
  osm_id: string
  address: string
  lat: number
  lng: number
  status: string
  base_score: number
  storm_score: number | null
  lead_score: number
  nearest_storm_id: string | null
  distance_to_storm_km: number | null
  distance_to_territory_km: number | null
  year_built: number | null
  roof_age: number | null
  data_source: string
  deleted_at: string | null
  created_at: string
  satellite_url: string | null
  visual_roof_score: number | null
  ai_notes: string | null
  ai_analyzed_at: string | null
  area_housing_age_label: string | null
  area_housing_age_score: number | null
  historical_hail_risk_score: number | null
  historical_hail_risk_label: string | null
  score_confidence: string | null
  spotter_hail_in: number | null
  radar_hail_in: number | null
  nearest_report_km: number | null
  inside_hail_swath: boolean | null
  footprint_sqm: number | null
  territories?: { value: string } | null
}

function fromRow(row: LeadRow): Lead {
  return {
    id: row.id,
    territoryId: row.territory_id,
    osmId: row.osm_id,
    address: row.address,
    lat: row.lat,
    lng: row.lng,
    status: row.status as LeadStatus,
    baseScore: row.base_score,
    stormScore: row.storm_score ?? undefined,
    leadScore: row.lead_score,
    nearestStormId: row.nearest_storm_id ?? undefined,
    distanceToStormKm: row.distance_to_storm_km ?? undefined,
    distanceToTerritoryKm: row.distance_to_territory_km ?? undefined,
    yearBuilt: row.year_built ?? undefined,
    roofAge: row.roof_age ?? undefined,
    dataSource: row.data_source,
    deletedAt: row.deleted_at ?? undefined,
    createdAt: row.created_at,
    satelliteUrl: row.satellite_url ?? undefined,
    visualRoofScore: row.visual_roof_score ?? undefined,
    aiNotes: row.ai_notes ?? undefined,
    aiAnalyzedAt: row.ai_analyzed_at ?? undefined,
    areaHousingAgeLabel: row.area_housing_age_label ?? undefined,
    areaHousingAgeScore: row.area_housing_age_score ?? undefined,
    historicalHailRiskScore: row.historical_hail_risk_score ?? undefined,
    historicalHailRiskLabel: row.historical_hail_risk_label ?? undefined,
    scoreConfidence: (row.score_confidence ?? undefined) as 'high' | 'medium' | 'low' | undefined,
    spotterHailIn: row.spotter_hail_in ?? undefined,
    radarHailIn: row.radar_hail_in ?? undefined,
    nearestReportKm: row.nearest_report_km ?? undefined,
    insideHailSwath: row.inside_hail_swath ?? undefined,
    footprintSqm: row.footprint_sqm ?? undefined,
    territoryValue: row.territories?.value,
    nearestStormName: undefined,
    nearestStormSeverity: undefined,
  }
}

export function useLeads() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    if (!isSupabaseReady()) {
      setLeads([])
      setLoading(false)
      setHydrated(true)
      return
    }

    const { data, error } = await supabase
      .from('leads')
      .select(`*, territories ( value )`)
      .is('deleted_at', null)
      .order('lead_score', { ascending: false })

    if (error) {
      console.error('[leads] Fetch failed:', error.message)
      setLeads([])
    } else {
      // Enrich with storm names if any leads have a nearest_storm_id
      const rows = (data ?? []) as LeadRow[]
      const stormIds = [...new Set(rows.map((r) => r.nearest_storm_id).filter(Boolean))] as string[]

      let stormMap: Record<string, { name: string; severity: number }> = {}
      if (stormIds.length > 0) {
        const { data: storms } = await supabase
          .from('storms')
          .select('id, name, severity')
          .in('id', stormIds)
        for (const s of storms ?? []) stormMap[s.id] = { name: s.name, severity: s.severity }
      }

      setLeads(rows.map((r) => ({
        ...fromRow(r),
        nearestStormName: r.nearest_storm_id ? stormMap[r.nearest_storm_id]?.name : undefined,
        nearestStormSeverity: r.nearest_storm_id ? stormMap[r.nearest_storm_id]?.severity : undefined,
      })))
    }

    setLoading(false)
    setHydrated(true)
  }

  const updateStatus = useCallback(async (id: string, status: LeadStatus) => {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)))

    if (!isSupabaseReady()) return

    const { error } = await supabase
      .from('leads')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) console.error('[leads] Status update failed:', error.message)
  }, [])

  return { leads, loading, hydrated, updateStatus, reload: load }
}

export function useTrashLeads() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isSupabaseReady()) {
      setLeads([])
      setLoading(false)
      return
    }

    // Purge leads deleted more than 24 hours ago
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    supabase
      .from('leads')
      .delete()
      .not('deleted_at', 'is', null)
      .lt('deleted_at', cutoff)
      .then(({ error }) => {
        if (error) console.warn('[trash] Purge failed:', error.message)
      })

    supabase
      .from('leads')
      .select(`*, territories ( value )`)
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          console.error('[trash] Fetch failed:', error.message)
          setLeads([])
        } else {
          setLeads((data ?? []).map((r) => fromRow(r as LeadRow)))
        }
        setLoading(false)
      })
  }, [])

  return { leads, loading }
}
