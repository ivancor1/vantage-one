import AreaShingleRisk from '@/components/shingle-analysis/AreaShingleRisk'
import ShingleSearch from '@/components/shingle-analysis/ShingleSearch'

export default function ShingleAnalysisPage() {
  return (
    <div className="min-h-screen bg-vantage-black p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <AreaShingleRisk />
        <ShingleSearch />
      </div>
    </div>
  )
}
