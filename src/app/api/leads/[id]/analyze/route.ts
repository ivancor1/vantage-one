import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { supabase } from '@/lib/supabase'
import { computeCompositeScore } from '@/lib/lead-scoring'

const client = new OpenAI()

const PROMPT =
  'Analyze this satellite image of a residential roof for visible condition issues. ' +
  'Return ONLY valid JSON: {"score": <0-10 integer>, "notes": "<one sentence>"}. ' +
  '0 = excellent condition, 10 = severe damage visible. Be conservative and factual.'

async function analyzeWithUrl(imageUrl: string): Promise<{ score: number; notes: string }> {
  const msg = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 128,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: imageUrl } },
          { type: 'text', text: PROMPT },
        ],
      },
    ],
  })
  const text = msg.choices[0]?.message?.content ?? ''
  return JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? text)
}

async function analyzeWithBase64(imageUrl: string): Promise<{ score: number; notes: string }> {
  const res = await fetch(imageUrl)
  if (!res.ok) throw new Error(`Image fetch failed: ${res.status}`)
  const buffer = await res.arrayBuffer()
  const base64 = Buffer.from(buffer).toString('base64')
  const mediaType = res.headers.get('content-type') ?? 'image/jpeg'
  const dataUrl = `data:${mediaType};base64,${base64}`

  const msg = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 128,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: dataUrl } },
          { type: 'text', text: PROMPT },
        ],
      },
    ],
  })
  const text = msg.choices[0]?.message?.content ?? ''
  return JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? text)
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const { data: lead, error: fetchErr } = await supabase
    .from('leads')
    .select('id, lat, lng, satellite_url, visual_roof_score, storm_score, base_score, roof_age, area_housing_age_score, historical_hail_risk_score, nearest_storm_id, distance_to_storm_km')
    .eq('id', id)
    .single()

  if (fetchErr || !lead) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
  }

  if (lead.visual_roof_score != null) {
    return NextResponse.json({ cached: true, visualRoofScore: lead.visual_roof_score })
  }

  if (!lead.satellite_url) {
    return NextResponse.json({ error: 'No satellite image available for this lead' }, { status: 422 })
  }

  let result: { score: number; notes: string }
  try {
    result = await analyzeWithUrl(lead.satellite_url)
  } catch {
    result = await analyzeWithBase64(lead.satellite_url)
  }

  const visualRoofScore = Math.min(100, Math.max(0, Math.round(result.score * 10)))
  const aiNotes = result.notes

  // Re-fetch storm signals so the composite formula gets hail core proximity
  let stormSeverity: number | undefined
  let distanceToHailCoreKm: number | undefined
  let stormRadiusKm: number | undefined
  if (lead.nearest_storm_id) {
    const { data: storm } = await supabase
      .from('storms')
      .select('severity, radius_meters, lat, lng, hail_core_lat, hail_core_lng')
      .eq('id', lead.nearest_storm_id)
      .single()
    if (storm) {
      stormSeverity = storm.severity
      stormRadiusKm = storm.radius_meters / 1000
      const hailCoreLat = (storm.hail_core_lat as number | null) ?? storm.lat
      const hailCoreLng = (storm.hail_core_lng as number | null) ?? storm.lng

      // Compute distance from lead to hail core using flat-earth approximation
      const dlat = (lead.lat - hailCoreLat) * 111
      const dlng = (lead.lng - hailCoreLng) * 111 * Math.cos((lead.lat * Math.PI) / 180)
      distanceToHailCoreKm = Math.sqrt(dlat * dlat + dlng * dlng)
    }
  }

  const newLeadScore = computeCompositeScore({
    stormSeverity,
    distanceToHailCoreKm,
    stormRadiusKm,
    roofAge: lead.roof_age ?? undefined,
    areaHousingAgeScore: lead.area_housing_age_score ?? undefined,
    hailRiskScore: lead.historical_hail_risk_score ?? undefined,
    visualRoofScore,
  })

  const { error: updateErr } = await supabase
    .from('leads')
    .update({
      visual_roof_score: visualRoofScore,
      ai_notes: aiNotes,
      ai_analyzed_at: new Date().toISOString(),
      lead_score: newLeadScore,
      score_confidence: 'high',
    })
    .eq('id', id)

  if (updateErr) {
    console.error('[analyze] Update failed:', updateErr.message)
    return NextResponse.json({ error: 'Failed to save analysis' }, { status: 500 })
  }

  return NextResponse.json({ cached: false, visualRoofScore, aiNotes, leadScore: newLeadScore })
}
