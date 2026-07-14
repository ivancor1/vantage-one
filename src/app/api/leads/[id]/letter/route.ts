import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { supabase } from '@/lib/supabase'

const client = new OpenAI()

// Drafts a short homeowner door-hanger/letter from THIS home's real hail evidence.
// Every number in the draft comes from stored NOAA/NWS-derived values — the model is
// explicitly forbidden from inventing facts, urgency, or insurance promises.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const { data: lead, error } = await supabase
    .from('leads')
    .select('id, address, spotter_hail_in, radar_hail_in, nearest_report_km, nearest_storm_id')
    .eq('id', id)
    .single()

  if (error || !lead) {
    return NextResponse.json({ ok: false, error: 'Lead not found' }, { status: 404 })
  }

  let stormDate: string | null = null
  if (lead.nearest_storm_id) {
    const { data: storm } = await supabase
      .from('storms')
      .select('date')
      .eq('id', lead.nearest_storm_id)
      .single()
    stormDate = storm?.date ?? null
  }

  const street = (lead.address as string).split(',')[0]
  const facts = [
    stormDate && `storm date: ${stormDate}`,
    lead.radar_hail_in != null && `NOAA NEXRAD radar-estimated hail near this address: ${lead.radar_hail_in}"`,
    lead.spotter_hail_in != null && `NWS storm-report (spotter) estimated hail: ${lead.spotter_hail_in}"`,
    lead.nearest_report_km != null && `nearest real data point: ${lead.nearest_report_km} km away`,
  ].filter(Boolean).join('\n')

  if (!facts) {
    return NextResponse.json(
      { ok: false, error: 'No hail evidence on this lead yet — run a storm-matched scrape first' },
      { status: 422 }
    )
  }

  try {
    const msg = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content:
          `Write a brief, neighborly door-hanger note (under 120 words) from a local roofing company to the homeowner at ${street}. ` +
          `Cite ONLY these verified facts, plainly:\n${facts}\n` +
          `Offer a free, no-obligation roof inspection. No pressure tactics, no invented details, no insurance promises. ` +
          `End with the exact line: "Hail figures from public NOAA/NWS data — not an insurance determination." ` +
          `Plain text only, no placeholders like [Name] beyond a "— Your local roofing team" sign-off.`,
      }],
    })
    const letter = msg.choices[0]?.message?.content?.trim()
    if (!letter) throw new Error('empty draft')
    return NextResponse.json({ ok: true, letter })
  } catch (err) {
    console.error('[letter]', err)
    return NextResponse.json({ ok: false, error: 'Draft failed — try again' }, { status: 500 })
  }
}
