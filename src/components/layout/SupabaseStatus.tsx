'use client'

import { useEffect, useState } from 'react'
import { supabase, isSupabaseReady } from '@/lib/supabase'

type State = 'checking' | 'connected' | 'local' | 'error'

export default function SupabaseStatus() {
  const [state, setState] = useState<State>('checking')

  useEffect(() => {
    if (!isSupabaseReady()) {
      setState('local')
      return
    }

    supabase
      .from('territories')
      .select('id')
      .limit(1)
      .then(({ error }) => setState(error ? 'error' : 'connected'))
  }, [])

  if (state === 'checking') return null

  const config = {
    connected: { dot: 'bg-status-success',  text: 'text-status-success',  label: 'Supabase' },
    local:     { dot: 'bg-vantage-faint',   text: 'text-vantage-faint',   label: 'Local'    },
    error:     { dot: 'bg-status-critical', text: 'text-status-critical', label: 'DB Error' },
  }[state]

  return (
    <div className="flex items-center gap-1.5">
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${config.dot} ${state === 'connected' ? 'animate-pulse' : ''}`} />
      <span className={`text-[11px] font-mono ${config.text}`}>{config.label}</span>
    </div>
  )
}
