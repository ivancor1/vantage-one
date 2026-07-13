'use client'

import clsx from 'clsx'

type Layers = { storms: boolean }

type Props = {
  layers: Layers
  onChange: (layers: Layers) => void
}

export default function LayerControls({ layers, onChange }: Props) {
  return (
    <div className="absolute top-4 left-4 z-[1000] bg-vantage-surface/90 backdrop-blur-sm border border-vantage-border rounded-lg p-3 space-y-2.5 min-w-[160px]">
      <p className="text-[10px] font-mono text-vantage-faint uppercase tracking-widest pb-0.5">
        Layers
      </p>
      <button
        onClick={() => onChange({ storms: !layers.storms })}
        className="flex items-center gap-2.5 w-full group"
      >
        <span
          className={clsx(
            'w-3 h-3 rounded-sm border transition-all flex-shrink-0',
            layers.storms ? 'opacity-100' : 'opacity-30'
          )}
          style={{
            backgroundColor: layers.storms ? '#EF4444' : 'transparent',
            borderColor: '#EF4444',
          }}
        />
        <span className={clsx('text-xs transition-colors', layers.storms ? 'text-vantage-text' : 'text-vantage-faint')}>
          Storm Zones
        </span>
      </button>
    </div>
  )
}
