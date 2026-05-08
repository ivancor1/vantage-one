import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, CloudLightning, Wind, Home, Hash, MapPin } from 'lucide-react'
import { MOCK_STORMS, MOCK_PROPERTIES } from '@/lib/mock-data'
import PropertyCard from '@/components/properties/PropertyCard'

type Props = { params: { stormId: string } }

export function generateStaticParams() {
  return MOCK_STORMS.map((s) => ({ stormId: s.id }))
}

export default function StormDetailPage({ params }: Props) {
  const storm = MOCK_STORMS.find((s) => s.id === params.stormId)
  if (!storm) notFound()

  const properties = MOCK_PROPERTIES
    .filter((p) => p.stormId === storm.id)
    .sort((a, b) => b.leadScore - a.leadScore)

  const dateStr = new Date(storm.date).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })

  const severityColor =
    storm.severity >= 9 ? '#EF4444' :
    storm.severity >= 7 ? '#F97316' : '#F0C020'

  return (
    <div className="p-8 space-y-6 max-w-4xl">

      {/* Back link */}
      <Link
        href="/storms"
        className="inline-flex items-center gap-1.5 text-xs text-vantage-faint hover:text-vantage-muted transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Storm Feed
      </Link>

      {/* Storm header */}
      <div className="bg-vantage-card border border-vantage-border rounded-lg overflow-hidden">
        <div className="flex items-stretch">
          {/* Color bar */}
          <div className="w-1 flex-shrink-0" style={{ backgroundColor: severityColor }} />

          <div className="flex-1 px-6 py-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-mono text-vantage-faint uppercase tracking-widest mb-2">
                  Storm Event
                </p>
                <h1 className="text-lg font-bold text-vantage-text">{storm.name}</h1>
                <div className="flex items-center gap-2 mt-1.5">
                  <MapPin className="w-3 h-3 text-vantage-faint" />
                  <p className="text-sm text-vantage-muted">{storm.location}</p>
                  <span className="text-vantage-faint">·</span>
                  <p className="text-sm text-vantage-muted">{dateStr}</p>
                </div>
              </div>
            </div>

            {/* Metrics */}
            <div className="flex items-center gap-10 mt-5">
              {[
                { icon: Hash,          label: 'Severity',   value: storm.severity.toString(),           style: { color: severityColor } },
                { icon: CloudLightning,label: 'Hail Size',  value: `${storm.hailSize}"`,                style: {} },
                { icon: Wind,          label: 'Wind Speed', value: `${storm.windSpeed} mph`,            style: {} },
                { icon: Home,          label: 'Est. Homes', value: storm.estimatedHomes.toLocaleString(), style: {} },
              ].map(({ icon: Icon, label, value, style }) => (
                <div key={label}>
                  <div className="flex items-center gap-1 mb-1">
                    <Icon className="w-3 h-3 text-vantage-faint" />
                    <p className="text-[10px] text-vantage-faint uppercase tracking-widest">{label}</p>
                  </div>
                  <p className="text-2xl font-bold font-mono text-vantage-text" style={style}>{value}</p>
                </div>
              ))}
            </div>

            {/* Zips */}
            <div className="flex items-center gap-1.5 mt-4 flex-wrap">
              <span className="text-[10px] text-vantage-faint uppercase tracking-widest mr-1">ZIPs:</span>
              {storm.affectedZips.map((zip) => (
                <span
                  key={zip}
                  className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-vantage-surface border border-vantage-border text-vantage-muted"
                >
                  {zip}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Property list header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-mono text-vantage-faint uppercase tracking-widest mb-1">
            Ranked by Lead Score
          </p>
          <h2 className="text-sm font-semibold text-vantage-text">
            Affected Properties
            <span className="ml-2 text-vantage-faint font-normal">({properties.length})</span>
          </h2>
        </div>
      </div>

      {/* Property cards */}
      <div className="space-y-3">
        {properties.map((property, i) => (
          <PropertyCard key={property.id} property={property} rank={i + 1} />
        ))}
      </div>

    </div>
  )
}
