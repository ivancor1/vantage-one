'use client'

// Hail Evidence Report — the printable "data receipt" a rep hands the homeowner or attaches
// to a claim file. Every number on this page is real public data (NOAA NEXRAD signatures,
// NWS Local Storm Reports, FEMA NRI, Census ACS) interpolated to this address — sources cited.

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Printer, ShieldAlert } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { distKm } from '@/lib/hail'
import type { LsrReport } from '@/lib/types'

type ReportLead = {
  id: string
  address: string
  lat: number
  lng: number
  year_built: number | null
  roof_age: number | null
  footprint_sqm: number | null
  satellite_url: string | null
  spotter_hail_in: number | null
  radar_hail_in: number | null
  nearest_report_km: number | null
  visual_roof_score: number | null
  ai_notes: string | null
  area_housing_age_label: string | null
  historical_hail_risk_label: string | null
  nearest_storm_id: string | null
}

type ReportStorm = {
  id: string
  name: string
  date: string
  wfo: string
  hail_size: number
  report_count: number
  reports: LsrReport[]
}

export default function EvidenceReportPage() {
  const params = useParams<{ id: string }>()
  const [lead, setLead] = useState<ReportLead | null>(null)
  const [storm, setStorm] = useState<ReportStorm | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading')

  useEffect(() => {
    async function load() {
      const { data: l } = await supabase.from('leads').select('*').eq('id', params.id).single()
      if (!l) { setState('missing'); return }
      setLead(l as ReportLead)
      if (l.nearest_storm_id) {
        const { data: s } = await supabase
          .from('storms')
          .select('id, name, date, wfo, hail_size, report_count, reports')
          .eq('id', l.nearest_storm_id)
          .single()
        if (s) setStorm(s as ReportStorm)
      }
      setState('ready')
    }
    load()
  }, [params.id])

  if (state === 'loading') {
    return <div className="p-12 text-center text-vantage-faint text-xs font-mono">BUILDING REPORT…</div>
  }
  if (state === 'missing' || !lead) {
    return <div className="p-12 text-center text-vantage-muted text-sm">Lead not found.</div>
  }

  // Nearest real hail reports to THIS address (for the evidence table)
  const hailReports = ((storm?.reports ?? []) as LsrReport[])
    .filter((r) => r.type === 'HAIL' && r.magnitude > 0)
    .map((r) => ({ ...r, distKm: Math.round(distKm(lead.lat, lead.lng, r.lat, r.lng) * 10) / 10 }))
    .sort((a, b) => a.distKm - b.distKm)
    .slice(0, 5)

  const generated = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <div className="report-page max-w-[720px] mx-auto p-8 print:p-0 space-y-6 bg-vantage-black min-h-full">

      {/* Header */}
      <div className="flex items-start justify-between border-b-2 border-vantage-text pb-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-vantage-text" />
            <span className="font-display text-lg font-semibold tracking-tight text-vantage-text">Vantage</span>
          </div>
          <p className="text-[10px] font-mono text-vantage-faint uppercase tracking-widest mt-1">
            Hail Evidence Report · generated {generated}
          </p>
        </div>
        <button
          onClick={() => window.print()}
          className="no-print flex items-center gap-1.5 px-3 py-1.5 rounded bg-vantage-yellow text-vantage-black text-xs font-bold hover:opacity-90"
        >
          <Printer className="w-3.5 h-3.5" /> Print / Save PDF
        </button>
      </div>

      {/* Property */}
      <div className="flex gap-5 items-start">
        <div className="flex-1 space-y-1">
          <h1 className="text-xl font-semibold text-vantage-text">{lead.address}</h1>
          <p className="text-xs text-vantage-muted font-mono">
            {lead.lat.toFixed(5)}, {lead.lng.toFixed(5)}
            {lead.year_built && ` · built ${lead.year_built}`}
            {lead.footprint_sqm && ` · ≈ ${Math.round((lead.footprint_sqm * 1.15) / 9.29)} roofing squares (est. from building footprint)`}
          </p>
          {lead.area_housing_age_label && (
            <p className="text-xs text-vantage-muted">Area housing stock: {lead.area_housing_age_label} <span className="text-vantage-faint">(Census ACS 5-yr, area-level)</span></p>
          )}
          {lead.historical_hail_risk_label && (
            <p className="text-xs text-vantage-muted">Historical hail risk: {lead.historical_hail_risk_label} <span className="text-vantage-faint">(FEMA National Risk Index, county-level)</span></p>
          )}
        </div>
        {lead.satellite_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={lead.satellite_url} alt="Aerial view" onError={(e) => { e.currentTarget.style.display = 'none' }} className="w-[180px] rounded border border-vantage-border" />
        )}
      </div>

      {/* Hail evidence summary */}
      <div className="border border-vantage-border rounded-lg p-4 space-y-2">
        <p className="text-[10px] font-mono text-vantage-faint uppercase tracking-widest">Hail evidence at this address</p>
        {lead.radar_hail_in == null && lead.spotter_hail_in == null ? (
          <p className="text-sm text-vantage-muted">No hail evidence recorded for this address yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {lead.radar_hail_in != null && (
              <div>
                <p className="text-2xl font-bold font-mono text-vantage-text">{lead.radar_hail_in}″</p>
                <p className="text-xs text-vantage-muted">Radar-estimated hail size</p>
                <p className="text-[10px] text-vantage-faint font-mono">NOAA NEXRAD Level-III hail signatures (SWDI), interpolated to this address</p>
              </div>
            )}
            {lead.spotter_hail_in != null && (
              <div>
                <p className="text-2xl font-bold font-mono text-vantage-text">{lead.spotter_hail_in}″</p>
                <p className="text-xs text-vantage-muted">Spotter-reported hail size</p>
                <p className="text-[10px] text-vantage-faint font-mono">NWS Local Storm Reports, interpolated to this address</p>
              </div>
            )}
          </div>
        )}
        {storm && (
          <p className="text-xs text-vantage-muted pt-1 border-t border-vantage-border">
            Event: {storm.name} · {storm.date} · NWS office {storm.wfo} · {storm.report_count} official reports · max reported hail {storm.hail_size}″
          </p>
        )}
      </div>

      {/* Nearest official reports table */}
      {hailReports.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-mono text-vantage-faint uppercase tracking-widest">Nearest official hail reports (NWS)</p>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-vantage-border text-vantage-faint font-mono text-[10px] uppercase text-left">
                <th className="py-1.5 pr-2 font-medium">Size</th>
                <th className="py-1.5 pr-2 font-medium">Distance</th>
                <th className="py-1.5 pr-2 font-medium">Location</th>
                <th className="py-1.5 pr-2 font-medium">Time (UTC)</th>
                <th className="py-1.5 font-medium">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-vantage-border/60">
              {hailReports.map((r, i) => (
                <tr key={i} className="text-vantage-text">
                  <td className="py-1.5 pr-2 font-mono font-semibold">{r.magnitude}″</td>
                  <td className="py-1.5 pr-2 font-mono">{r.distKm} km</td>
                  <td className="py-1.5 pr-2">{r.city}, {r.state}</td>
                  <td className="py-1.5 pr-2 font-mono">{r.validTime.replace('T', ' ').replace('Z', '')}</td>
                  <td className="py-1.5">{r.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Vulnerability note */}
      {lead.visual_roof_score != null && (
        <div className="border border-vantage-border rounded-lg p-4 space-y-1">
          <p className="text-[10px] font-mono text-vantage-faint uppercase tracking-widest">Aerial roof-vulnerability read</p>
          <p className="text-sm text-vantage-text">Score {lead.visual_roof_score}/100{lead.ai_notes ? ` — ${lead.ai_notes}` : ''}</p>
          <p className="text-[10px] text-vantage-faint font-mono">AI read of aerial imagery that may predate the storm · indicates pre-existing wear only · not an inspection</p>
        </div>
      )}

      {/* Footer */}
      <div className="border-t border-vantage-border pt-3 space-y-1">
        <p className="text-[10px] text-vantage-faint leading-relaxed">
          Sources: NOAA NCEI Severe Weather Data Inventory (NEXRAD Level-III hail signatures) · NWS Local Storm Reports via Iowa
          Environmental Mesonet · FEMA National Risk Index · US Census ACS 5-yr · OpenStreetMap contributors.
          Interpolated estimates at the stated coordinates; original point data available from the cited public archives.
        </p>
        <p className="text-[10px] font-mono text-vantage-faint">
          This report documents public weather evidence. It is not a damage assessment, inspection, or insurance determination.
        </p>
      </div>
    </div>
  )
}
