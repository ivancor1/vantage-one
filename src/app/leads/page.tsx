import { Users, Star } from 'lucide-react'

export default function LeadsPage() {
  return (
    <div className="p-6 space-y-4 max-w-screen-xl">
      <div className="flex items-center gap-2">
        <Users className="w-4 h-4 text-vantage-yellow" />
        <h2 className="text-sm font-semibold text-vantage-text">Lead Intelligence</h2>
      </div>

      <div className="bg-vantage-card border border-dashed border-vantage-border rounded-lg px-5 py-10 text-center space-y-2">
        <Star className="w-8 h-8 text-vantage-yellow mx-auto" />
        <p className="text-vantage-text font-medium">Property Intelligence</p>
        <p className="text-vantage-muted text-sm max-w-sm mx-auto">
          AI-scored property cards with satellite imagery, damage estimates, insurance data,
          and lead status tracking. Coming in Step 2.
        </p>
      </div>
    </div>
  )
}
