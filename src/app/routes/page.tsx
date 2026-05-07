import { Route, Navigation } from 'lucide-react'

export default function RoutesPage() {
  return (
    <div className="p-6 space-y-4 max-w-screen-xl">
      <div className="flex items-center gap-2">
        <Route className="w-4 h-4 text-vantage-yellow" />
        <h2 className="text-sm font-semibold text-vantage-text">Route Builder</h2>
      </div>

      <div className="bg-vantage-card border border-dashed border-vantage-border rounded-lg px-5 py-10 text-center space-y-2">
        <Navigation className="w-8 h-8 text-vantage-yellow mx-auto" />
        <p className="text-vantage-text font-medium">Sales Route Builder</p>
        <p className="text-vantage-muted text-sm max-w-sm mx-auto">
          Select top leads, reorder stops, and export an optimized Google Maps route for your
          field reps. Coming in Step 2.
        </p>
      </div>
    </div>
  )
}
