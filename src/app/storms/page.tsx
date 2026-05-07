import { CloudLightning, Filter, SortDesc } from 'lucide-react'

export default function StormsPage() {
  return (
    <div className="p-6 space-y-4 max-w-screen-xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CloudLightning className="w-4 h-4 text-vantage-yellow" />
          <h2 className="text-sm font-semibold text-vantage-text">Storm Feed</h2>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-vantage-muted border border-vantage-border rounded hover:bg-white/5 transition-colors">
            <Filter className="w-3 h-3" /> Filter
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-vantage-muted border border-vantage-border rounded hover:bg-white/5 transition-colors">
            <SortDesc className="w-3 h-3" /> Sort
          </button>
        </div>
      </div>

      <div className="bg-vantage-card border border-dashed border-vantage-border rounded-lg px-5 py-10 text-center space-y-2">
        <CloudLightning className="w-8 h-8 text-vantage-yellow mx-auto" />
        <p className="text-vantage-text font-medium">Storm Event Feed</p>
        <p className="text-vantage-muted text-sm max-w-sm mx-auto">
          Hail and wind events in your monitored territories, ranked by severity with property
          impact estimates. Coming in Step 2.
        </p>
      </div>
    </div>
  )
}
