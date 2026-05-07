'use client'

import clsx from 'clsx'

type Layers = { storms: boolean; properties: boolean }

type Props = {
  layers: Layers
  onChange: (layers: Layers) => void
}

const ITEMS: { key: keyof Layers; label: string; color: string }[] = [
  { key: 'storms',     label: 'Storm Zones', color: '#EF4444' },
  { key: 'properties', label: 'Properties',  color: '#F0C020' },
]

export default function LayerControls({ layers, onChange }: Props) {
  return (
    <div className="absolute top-4 left-4 z-[1000] bg-vantage-surface/90 backdrop-blur-sm border border-vantage-border rounded-lg p-3 space-y-2.5 min-w-[160px]">
      <p className="text-[10px] font-mono text-vantage-faint uppercase tracking-widest pb-0.5">
        Layers
      </p>
      {ITEMS.map(({ key, label, color }) => (
        <button
          key={key}
          onClick={() => onChange({ ...layers, [key]: !layers[key] })}
          className="flex items-center gap-2.5 w-full group"
        >
          <span
            className={clsx(
              'w-3 h-3 rounded-sm border transition-all flex-shrink-0',
              layers[key] ? 'opacity-100' : 'opacity-30'
            )}
            style={{
              backgroundColor: layers[key] ? color : 'transparent',
              borderColor: color,
            }}
          />
          <span
            className={clsx(
              'text-xs transition-colors',
              layers[key] ? 'text-vantage-text' : 'text-vantage-faint'
            )}
          >
            {label}
          </span>
        </button>
      ))}
    </div>
  )
}
