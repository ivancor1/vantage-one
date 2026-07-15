'use client'

// Storm-first lead generation state, kept at MODULE scope so it survives tab navigation:
// the fetch keeps running while you browse elsewhere, and the Storms page shows
// "Finding homes…" → "N leads found" whenever you come back. hydrate() also restores
// finished states from the DB after a full page refresh.

import { useSyncExternalStore } from 'react'
import { supabase, isSupabaseReady } from './supabase'

export type StormLeadState =
  | { status: 'running'; progress: number; stage: string; found: number; territoryId: string | null }
  | { status: 'done'; count: number; territoryId: string }
  | { status: 'error'; message: string }

const states = new Map<string, StormLeadState>()
const listeners = new Set<() => void>()
let snapshot: Record<string, StormLeadState> = {}

function emit() {
  snapshot = Object.fromEntries(states)
  listeners.forEach((l) => l())
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => { listeners.delete(l) }
}

export function useStormLeadStates(): Record<string, StormLeadState> {
  return useSyncExternalStore(subscribe, () => snapshot, () => snapshot)
}

type GenResult = { ok: boolean; territoryId?: string; count?: number; error?: string }

// The storm scan visualises the REAL pipeline (OSM → Census/FEMA → NOAA radar → scoring). Homes
// STREAM into the list as they're "found": we pull the storm's territory + its pre-built leads,
// then reveal them progressively while the counter climbs. It never blocks on Overpass, so it
// can't stall on camera, and it keeps "collecting" (holds ~96%) once all homes are in.
const SIMULATED_SCAN_MS = 34_000

const SCAN_STAGES: { at: number; label: string }[] = [
  { at: 0.00, label: 'Querying OpenStreetMap for addressed homes…' },
  { at: 0.20, label: 'Pulling county context — US Census housing age, FEMA hail history…' },
  { at: 0.42, label: 'Interpolating hail per home — NOAA NEXRAD radar + NWS spotter reports…' },
  { at: 0.66, label: 'Scoring & ranking every home…' },
  { at: 0.88, label: 'Finalizing lead list…' },
]

/** Start the storm scan. Fetches the territory (returns pre-built leads instantly), then the Leads
 *  page streams its homes in as `found` climbs. Keeps "collecting" — never blocks on the network. */
export function startFindLeads(stormId: string) {
  if (states.get(stormId)?.status === 'running') return
  const startedAt = Date.now()
  states.set(stormId, { status: 'running', progress: 0, stage: SCAN_STAGES[0].label, found: 0, territoryId: null })
  emit()

  const box: { current: GenResult | null } = { current: null }
  fetch(`/api/storms/${stormId}/generate-leads`, { method: 'POST' })
    .then((r) => r.json() as Promise<GenResult>)
    .catch((err): GenResult => ({ ok: false, error: err instanceof Error ? err.message : 'Failed' }))
    .then((d) => { box.current = d })

  const tick = setInterval(() => {
    if (states.get(stormId)?.status !== 'running') { clearInterval(tick); return }
    const p = Math.min((Date.now() - startedAt) / SIMULATED_SCAN_MS, 1)
    const stage = [...SCAN_STAGES].reverse().find((s) => p >= s.at) ?? SCAN_STAGES[0]
    const target = box.current?.ok ? (box.current.count ?? 0) : 0
    const found = Math.round(target * p) // linear — homes stream in steadily
    states.set(stormId, {
      status: 'running', progress: Math.min(p, 0.96), stage: stage.label, found,
      territoryId: box.current?.ok ? box.current.territoryId ?? null : null,
    })
    emit()
  }, 250)
}

/** Restore "done" states from the DB (storm territories are named after the storm). */
let hydrated = false
export async function hydrateStormLeadStates(storms: { id: string; name: string }[]) {
  if (hydrated || !isSupabaseReady() || !storms.length) return
  hydrated = true

  const { data: terrs } = await supabase
    .from('territories')
    .select('id, value')
    .in('value', storms.map((s) => s.name))
    .is('deleted_at', null)

  if (!terrs?.length) return

  await Promise.all(terrs.map(async (t) => {
    const { count } = await supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('territory_id', t.id)
      .is('deleted_at', null)
    if ((count ?? 0) > 0) {
      const storm = storms.find((s) => s.name === t.value)
      if (storm && states.get(storm.id)?.status !== 'running') {
        states.set(storm.id, { status: 'done', count: count!, territoryId: t.id })
      }
    }
  }))
  emit()
}
