# Vantage

Storm-damage lead intelligence for roofing companies. Vantage watches severe weather across
the US in real time; one click on a storm finds the actual addressed homes near its hail
reports, gives **each home a real, per-address hail estimate from two independent government
sources**, ranks them as a door-knock list, and produces the deliverables a rep actually
ships — a printable evidence report, a homeowner letter, an optimized knock route, a CRM CSV.

Built as a working MVP in **Next.js + TypeScript + Supabase**, wired to live public data —
no mock data, no paid leads vendor.

## The problem

After a hailstorm, roofing companies race to find damaged homes and knock doors. Today that's
guesswork — buy a generic lead list, or drive the neighborhood. The signal that matters
(*which specific homes sat under the worst of the hail*) is scattered across weather feeds,
radar archives, and mapping data that nobody stitches together.

## What's wired today (everything below is live code, not roadmap)

1. **Live storm layer.** NWS Local Storm Reports (via Iowa Environmental Mesonet) for the
   last 72 h, grouped and scored. Every number shown is labeled **NWS official** vs
   **modeled by Vantage**.
2. **Storm → leads, one click.** "Find leads in this area" on any storm scrapes real
   addressed buildings (OpenStreetMap Overpass) around the storm's strongest hail reports —
   with fallback across report points, since rural reports often have no addressed homes.
3. **Two-source per-home hail evidence — the core.** Each home gets an inverse-distance-
   weighted hail estimate from (a) real NWS spotter reports and (b) **NOAA SWDI `nx3hail`
   NEXRAD radar hail signatures** — two independent sources, interpolated to the address
   (`src/lib/hail.ts`). When both agree, the score says so ("radar + spotter confirmed").
   No single fabricated "hail core" point.
4. **Roof vulnerability (honest AI).** A gpt-4o-mini read of the aerial tile that is
   *forbidden from claiming damage* — imagery may predate the storm — and is capped at
   `low` confidence. It scores wear/age as a damage-probability prior, weighted under the
   hail evidence.
5. **Area context.** Census ACS housing age (tract-level; needs a free `CENSUS_API_KEY`)
   and FEMA National Risk Index hail history (county-level), both labeled with source and
   granularity in the UI.
6. **Deliverables per lead.** Printable hail-evidence report (radar + spotter table with
   distances/timestamps/sources), an AI-drafted homeowner letter grounded only in that
   home's stored numbers (with a mandatory "not an insurance determination" line), Street
   View, checkbox-pick → optimized knock route (nearest-neighbor, Google Maps), CSV export.
7. **Area shingle risk.** Per territory: reads the real Census age mix, AI-estimates the
   shingle lines *likely* used in that era/region (explicitly labeled "likely — verify on
   site"), then runs a **real, cited web search** for each line's discontinuation status.
   Discontinued + old housing stock → elevated full-re-cover potential.
8. **Pipeline.** Lead inbox with statuses (new → knocked → interested → inspection → claim
   → closed), soft-delete Trash, "search wider" re-scans (+2 mi, additive, dedup by
   `territory_id, osm_id`).

## Data sources (as wired)

| Source | Used for |
|---|---|
| NWS Local Storm Reports (via IEM) | Live hail/wind events + per-home spotter interpolation |
| NOAA NCEI SWDI `nx3hail` | NEXRAD radar hail signatures, per-home interpolation |
| OpenStreetMap (Overpass) | Addressed buildings + roof footprint area (≈ squares) |
| Census ACS B25034 | Area housing age (tract-level; free API key required) |
| FEMA National Risk Index | County hail-risk history |
| Mapbox Static | Aerial tiles (display + vulnerability read) |
| OpenAI gpt-4o-mini | Roof-vulnerability prior · homeowner letter · shingle-era estimate |
| Tavily | Shingle discontinuation evidence (falls back to a **loudly-labeled** mock) |

## Honesty rules baked into the product

- Every signal in the UI carries its source and granularity ("Census ACS · area-level").
- The vision model cannot claim storm damage; its confidence is forced to `low`.
- The letter generator may only cite stored NOAA/NWS-derived values and must append a
  disclosure line.
- "Likely shingle lines" are AI estimates and say so; discontinuation verdicts come from
  live, cited search.
- If the Tavily key is missing, shingle results show a red **DEMO DATA** banner instead of
  silently fabricating.

## Known limitations (deliberate scope, not oversights)

- **Single-operator tool** — no auth/multi-tenancy; RLS off. First thing to add for a
  second customer (`user_id` + RLS policies).
- **Synchronous scrape** (~30–60 s, Overpass-bound). Fine locally; a hosted version should
  enqueue a background job and poll — the client's `ScanState` machine already supports it.
- **OSM address coverage varies by metro** (each scan caps at ~120 addressed buildings;
  Florida suburbs are sparse, hail-belt metros are rich). Roadmap: Microsoft Building
  Footprints as the national base layer.
- **Roof age is sparse per-home** (OSM tags only) — so the score leans on the per-home hail
  evidence and area-level Census age, and per-lead `confidence` reflects what was present.
  A county-parcel (ArcGIS) enrichment was prototyped — see
  `scripts/test-fulton-enrichment.mjs` — and deliberately **not** shipped: 4-county coverage
  presented as a feature would be dishonest at national scale.
- No per-lead evidence ledger table yet — the printable report *is* the provenance view;
  an immutable `lead_evidence` log is the roadmap version.

## Tests

`npm test` — unit tests on the money math: `computeCompositeScore` (hail dominance,
two-source corroboration bonus, no-hail neutrality) and `interpolateHail` (IDW weighting,
distance floor, empty input).

## Stack

Next.js 14 (App Router) · TypeScript · Tailwind · Supabase (Postgres) · Leaflet · OpenAI ·
Vitest.

Core logic in `src/lib/`: `iem.ts` (storm ingestion) · `hail.ts` (IDW + SWDI radar) ·
`overpass.ts` (buildings + footprints) · `lead-scoring.ts` (composite score) ·
`area-enrichment.ts` (Census/FEMA) · `storm-leads.ts` (storm-first flow state) ·
`shingle-analysis/` (evidence classifier + area risk).

## Running locally

```bash
npm install
cp .env.local.example .env.local   # fill in keys
npm run dev
```

`supabase/schema.sql` creates the real schema (territories, leads, storms, lead_statuses).

Environment: `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`NEXT_PUBLIC_MAPBOX_TOKEN`, `OPENAI_API_KEY`, `CENSUS_API_KEY` (free),
`TAVILY_API_KEY` (optional — mock is loudly labeled).

## Status

Working MVP, single-operator. The storm → evidence → deliverables loop is live end-to-end on
real data. Roadmap, in order: async scrape jobs · national building footprints · multi-tenant
auth + RLS · per-lead evidence ledger · storm-triggered re-score alerts ("14 of your saved
leads just got hit").
