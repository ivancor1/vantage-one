import OpenAI from 'openai'

export type AIValidationResult =
  | { valid: true }
  | { valid: false; message: string }

const KNOWN_MANUFACTURERS = [
  'gaf', 'certainteed', 'owens corning', 'atlas', 'iko', 'tamko',
  'malarkey', 'elk', 'bp', 'henry', 'polyglass',
]

export async function validateQueryWithAI(query: string): Promise<AIValidationResult> {
  // 3+ word queries are specific enough to pass straight through
  if (query.trim().split(/\s+/).length >= 3) return { valid: true }

  // Known manufacturer present — skip AI and pass through
  const queryLower = query.toLowerCase()
  if (KNOWN_MANUFACTURERS.some((m) => queryLower.includes(m))) return { valid: true }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return { valid: true }

  const client = new OpenAI({ apiKey })

  let content = ''
  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You validate queries for a roofing shingle analysis tool used by professional roofers.

A valid query must include at minimum a manufacturer name AND a product line name.

Valid examples:
- "GAF Royal Sovereign Charcoal" — GAF = manufacturer, Royal Sovereign = product line, Charcoal = color
- "GAF Royal Sovereign" — manufacturer + product line, no color is fine
- "GAF Timberline HDZ Charcoal" — valid
- "CertainTeed XT 30" — valid
- "CertainTeed Patriot Weathered Wood" — valid
- "IKO Marathon Weatherwood" — IKO = manufacturer, Marathon = product line
- "IKO Marathon" — valid
- "Owens Corning Supreme Driftwood" — valid
- "Owens Corning Duration Driftwood" — valid
- "TAMKO Heritage Weathered Wood" — TAMKO = manufacturer, Heritage = product line
- "TAMKO Heritage" — valid
- "Atlas Chalet" — Atlas = manufacturer (Atlas Roofing Corporation), Chalet = product line
- "Atlas Stratford" — valid
- "Malarkey Legacy Driftwood" — Malarkey = manufacturer, Legacy = product line
- "Malarkey Legacy" — valid

Invalid examples:
- "Owens Corning" — manufacturer only, no product line
- "GAF charcoal" — manufacturer + color only, no product line
- "black shingles" — no manufacturer, no product line
- "charcoal shingles" — no manufacturer, no product line
- "architectural shingles" — no manufacturer, no product line
- "roof nails" — not a shingle product
- Gibberish

If valid, respond ONLY with: {"valid":true}
If invalid, respond ONLY with: {"valid":false,"message":"<one short actionable sentence, under 12 words>"}
Respond with JSON only. No extra text.`,
        },
        { role: 'user', content: query },
      ],
      temperature: 0,
      max_tokens: 80,
    })
    content = response.choices[0]?.message?.content?.trim() ?? ''
    const parsed = JSON.parse(content) as AIValidationResult
    return parsed
  } catch {
    return { valid: true }
  }
}
