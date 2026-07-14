import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { supabase } from '@/lib/supabase'
import { computeCompositeScore } from '@/lib/lead-scoring'

const client = new OpenAI()

// Honest framing: this is a coarse AERIAL VULNERABILITY read, not damage detection.
// The imagery is a low-resolution top-down tile that may PREDATE the storm — hail damage
// is physically unresolvable here. What it CAN see: age/wear signals that make a roof more
// likely to be damaged (and more claim-worthy) when real hail is confirmed overhead.
const PROMPT =
  'You are looking at a low-resolution top-down aerial tile of a residential roof. ' +
  'The image may be months or years old and may predate any recent storm. ' +
  'Do NOT claim storm or hail damage — it is not visible at this resolution. ' +
  'Rate only visible VULNERABILITY: apparent aging or discoloration, patching or tarps, ' +
  'missing or uneven material, complex/older roof geometry, heavy tree overhang. ' +
  'Return ONLY valid JSON: {"score": <0-10 integer>, "notes": "<one sentence about what is visible>"}. ' +
  '0 = appears new/clean, 10 = clearly worn/aged roof with high damage probability if hit. ' +
  'Be conservative and factual; never mention damage or storms in the notes.'

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
    .select('id, lat, lng, satellite_url, visual_roof_score, roof_age, area_housing_age_score, historical_hail_risk_score, spotter_hail_in, radar_hail_in')
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

  // Rescore from the lead's stored REAL hail evidence (per-home IDW values) + the new
  // vulnerability read — no storm-wide numbers, no fabricated proximity.
  const newLeadScore = computeCompositeScore({
    spotterHailIn: lead.spotter_hail_in ?? undefined,
    radarHailIn: lead.radar_hail_in ?? undefined,
    vulnerabilityScore: visualRoofScore,
    roofAge: lead.roof_age ?? undefined,
    areaHousingAgeScore: lead.area_housing_age_score ?? undefined,
    hailRiskScore: lead.historical_hail_risk_score ?? undefined,
  })

  const { error: updateErr } = await supabase
    .from('leads')
    .update({
      visual_roof_score: visualRoofScore,
      ai_notes: aiNotes,
      ai_analyzed_at: new Date().toISOString(),
      lead_score: newLeadScore,
      // Aerial-only read of possibly pre-storm imagery — never "high" on its own
      score_confidence: 'low',
    })
    .eq('id', id)

  if (updateErr) {
    console.error('[analyze] Update failed:', updateErr.message)
    return NextResponse.json({ error: 'Failed to save analysis' }, { status: 500 })
  }

  return NextResponse.json({ cached: false, visualRoofScore, aiNotes, leadScore: newLeadScore })
}
