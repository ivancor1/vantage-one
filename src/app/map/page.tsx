import { Map, Layers, ZoomIn } from 'lucide-react'

export default function MapPage() {
  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-vantage-border bg-vantage-surface flex-shrink-0">
        <Map className="w-4 h-4 text-vantage-yellow" />
        <span className="text-sm font-medium text-vantage-text">World View</span>
        <span className="text-vantage-faint text-xs">·</span>
        <span className="text-vantage-muted text-xs">Storm zones · Property markers · Heatmap overlay</span>
      </div>

      {/* Map placeholder */}
      <div className="flex-1 flex items-center justify-center bg-vantage-black relative overflow-hidden">
        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              'linear-gradient(#8B9CB0 1px, transparent 1px), linear-gradient(90deg, #8B9CB0 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
        <div className="relative z-10 text-center space-y-3">
          <div className="mx-auto w-16 h-16 rounded-full bg-vantage-card border border-vantage-border flex items-center justify-center">
            <Map className="w-7 h-7 text-vantage-yellow" />
          </div>
          <h3 className="text-vantage-text font-semibold">Interactive Map</h3>
          <p className="text-vantage-muted text-sm max-w-xs">
            Full-screen Leaflet map with storm zones, affected area overlays, and property
            markers. Coming in Step 2.
          </p>
          <div className="flex items-center justify-center gap-4 pt-2 text-xs text-vantage-faint">
            <div className="flex items-center gap-1.5"><Layers className="w-3 h-3" /> Storm layers</div>
            <div className="flex items-center gap-1.5"><ZoomIn className="w-3 h-3" /> Property drill-down</div>
          </div>
        </div>
      </div>
    </div>
  )
}
