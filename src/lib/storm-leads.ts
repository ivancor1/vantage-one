'use client'

// Storm-first lead generation state, kept at MODULE scope so it survives tab navigation:
// the fetch keeps running while you browse elsewhere, and the Storms page shows
// "Finding homes…" → "N leads found" whenever you come back. hydrate() also restores
// finished states from the DB after a full page refresh.

import { useSyncExternalStore } from 'react'
import { supabase, isSupabaseReady } from './supabase'

export type StormLeadState =
  | { status: 'running' }
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

/** Kick off (or resume showing) lead generation for a storm. Never navigates — the
 *  button flips to "N leads found — view" when the server finishes. */
export async function startFindLeads(stormId: string) {
  if (states.get(stormId)?.status === 'running') return
  states.set(stormId, { status: 'running' })
  emit()
  try {
    const res = await fetch(`/api/storms/${stormId}/generate-leads`, { method: 'POST' })
    const data = await res.json() as { ok: boolean; territoryId?: string; count?: number; error?: string }
    if (!data.ok || !data.territoryId) throw new Error(data.error ?? `HTTP ${res.status}`)
    states.set(stormId, { status: 'done', count: data.count ?? 0, territoryId: data.territoryId })
  } catch (err) {
    states.set(stormId, { status: 'error', message: err instanceof Error ? err.message : 'Failed' })
  }
  emit()
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
