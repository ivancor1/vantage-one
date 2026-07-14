import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { supabase, isSupabaseReady } from '@/lib/supabase'
import { checkProductStatus, isUnmatchable, type ProductCheck } from '@/lib/shingle-analysis/checkProduct'

const client = new OpenAI()

// Area shingle-risk: the honest, area-level version of "which neighborhoods are more likely
// to need a full re-cover." READS the territory's real Census housing-age + region →
// ESTIMATES likely shingle product lines for that era/region (AI, labeled) → VERIFIES each
// one's discontinuation status via the real (cited) shingle search → OUTPUTS a plain verdict.
// We never claim to know the shingle on a specific roof.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isSupabaseReady()) {
    return NextResponse.json({ ok: false, error: 'Supabase not configured' }, { status: 503 })
  }
  const { id } = await params

  const { data: t, error } = await supabase
    .from('territories')
    .select('value, place_name, census_pct_pre2000, census_pct_pre1980, area_housing_age_label, historical_hail_risk_label')
    .eq('id', id)
    .single()

  if (error || !t) {
    return NextResponse.json({ ok: false, error: 'Territory not found' }, { status: 404 })
  }

  // READ — needs the real Census housing-age signal
  if (t.census_pct_pre2000 == null) {
    return NextResponse.json({
      ok: false,
      needsScan: true,
      error: 'No housing-age data for this area yet — re-scan it from Territories or Storms first.',
    }, { status: 422 })
  }

  const label = (t.place_name || t.value || '') as string
  const region = label.includes(',') ? label.split(',').slice(-1)[0].trim() : label
  const pctPre2000 = Math.round(t.census_pct_pre2000 * 100)
  const pctPre1980 = Math.round((t.census_pct_pre1980 ?? 0) * 100)
  const era = pctPre1980 > 40 ? '1970s–1990s' : pctPre2000 > 50 ? '1980s–2000s' : '2000s–2010s'

  // ESTIMATE — likely product lines for this region + era (clearly labeled "likely")
  let products: string[] = []
  try {
    const ai = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 120,
      messages: [{
        role: 'user',
        content:
          `A roofing contractor works ${region}. Here, ${pctPre2000}% of homes were built before 2000 ` +
          `and ${pctPre1980}% before 1980 — roofs are mostly from the ${era} era. ` +
          `List the 3 asphalt shingle PRODUCT LINES most plausibly installed on these homes ` +
          `(major brands only: GAF, Owens Corning, CertainTeed, IKO, TAMKO, Atlas). ` +
          `Return ONLY a JSON array of 3 specific product-line strings, most-likely first. No commentary.`,
      }],
    })
    const text = ai.choices[0]?.message?.content ?? ''
    const arr = JSON.parse(text.match(/\[[\s\S]*\]/)?.[0] ?? '[]') as string[]
    products = arr.filter((p) => typeof p === 'string').slice(0, 3)
  } catch { /* fall through to defaults */ }
  if (!products.length) products = ['GAF Timberline', 'Owens Corning Oakridge', 'CertainTeed Landmark']

  // VERIFY — real, cited discontinuation search for each (runs concurrently)
  const checks = await Promise.all(products.map(async (p): Promise<ProductCheck | null> => {
    try { return await checkProductStatus(p) } catch { return null }
  }))
  const verified = checks.filter((c): c is ProductCheck => c != null)
  const unmatchable = verified.filter((c) => isUnmatchable(c.status))

  // OUTPUT — verdict driven by the REAL Census age mix + verified discontinuations
  const olderSkew = pctPre2000 >= 55 || pctPre1980 >= 40
  const risk: 'elevated' | 'moderate' | 'low' =
    unmatchable.length >= 2 && olderSkew ? 'elevated' :
    unmatchable.length >= 1 ? 'moderate' : 'low'

  const verdict =
    risk === 'elevated'
      ? `Older-skewing area — ${pctPre2000}% of roofs predate 2000, and ${unmatchable.length} of the shingle lines likely used here are no longer made. On a hail claim, an unmatchable shingle argues for a full re-cover, not a patch.`
      : risk === 'moderate'
        ? `Some roofs here are from eras with discontinued lines${unmatchable[0] ? ` (${unmatchable[0].product} is no longer made)` : ''}. Worth checking the shingle match on the older homes.`
        : `Housing here skews newer, or the likely products are still in production — lower full-re-cover leverage from matching.`

  return NextResponse.json({
    ok: true,
    territory: label,
    region,
    era,
    pctPre2000,
    pctPre1980,
    housingLabel: t.area_housing_age_label,
    hailRisk: t.historical_hail_risk_label,
    risk,
    verdict,
    products: verified,
    searchProvider: verified[0]?.searchProvider ?? 'mock',
  })
}
