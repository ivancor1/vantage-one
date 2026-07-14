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

// A storm scan is real work — pull addressed homes, enrich, interpolate hail, score. But when
// the territory is already built the server answers in ~0.5s, which reads as fake. So we replay
// the REAL pipeline stages on a controlled timer with a live progress bar + homes counter. The
// stages are honest (exactly what the pipeline does); only the pacing is scripted. One number
// tunes it — sized so you click Find Leads, narrate over the finished Broken Arrow example, and
// this lands as you come back to it.
const SIMULATED_SCAN_MS = 30_000

const SCAN_STAGES: { at: number; label: string }[] = [
  { at: 0.00, label: 'Querying OpenStreetMap for addressed homes…' },
  { at: 0.24, label: 'Pulling county context — US Census housing age, FEMA hail history…' },
  { at: 0.46, label: 'Interpolating hail per home — NOAA NEXRAD radar + NWS spotter reports…' },
  { at: 0.72, label: 'Scoring & ranking every home…' },
  { at: 0.93, label: 'Finalizing lead list…' },
]

/** Kick off lead generation for a storm and play a believable, staged scan. The real fetch
 *  runs alongside (returns fast for a pre-built territory); we only flip to 'done' once the
 *  scripted timer AND the fetch have both completed. */
export async function startFindLeads(stormId: string) {
  if (states.get(stormId)?.status === 'running') return
  const startedAt = Date.now()
  states.set(stormId, { status: 'running', progress: 0, stage: SCAN_STAGES[0].label, found: 0, territoryId: null })
  emit()

  // Real fetch in parallel: its count drives the counter target; its territoryId lets the Leads
  // page hide the territory until the reveal so its lead count never leaks mid-"scan".
  const box: { current: GenResult | null } = { current: null }
  const fetchDone = fetch(`/api/storms/${stormId}/generate-leads`, { method: 'POST' })
    .then((r) => r.json() as Promise<GenResult>)
    .catch((err): GenResult => ({ ok: false, error: err instanceof Error ? err.message : 'Failed' }))
    .then((d) => { box.current = d })

  await new Promise<void>((resolve) => {
    const tick = setInterval(() => {
      if (states.get(stormId)?.status !== 'running') { clearInterval(tick); resolve(); return }
      const p = Math.min((Date.now() - startedAt) / SIMULATED_SCAN_MS, 1)
      const stage = [...SCAN_STAGES].reverse().find((s) => p >= s.at) ?? SCAN_STAGES[0]
      const target = box.current?.count ?? 800
      const found = Math.round(target * Math.pow(p, 0.7)) // front-loaded: homes appear, then scoring
      states.set(stormId, {
        status: 'running', progress: p, stage: stage.label, found,
        territoryId: box.current?.ok ? box.current.territoryId ?? null : null,
      })
      emit()
      if (p >= 1) { clearInterval(tick); resolve() }
    }, 120)
  })

  await fetchDone
  const data = box.current
  if (!data || !data.ok || !data.territoryId) {
    states.set(stormId, { status: 'error', message: data?.error ?? 'Failed' })
  } else {
    states.set(stormId, { status: 'done', count: data.count ?? 0, territoryId: data.territoryId })
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
