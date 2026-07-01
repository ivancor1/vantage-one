# Vantage

Storm-damage lead intelligence for roofing companies. Vantage watches severe weather across the entire US in real time, and when a roofer drops in a territory, it finds the actual homes inside the storm's damage footprint, ranks them as sales leads, and enriches each one with the data a roofer actually needs — roof age, area risk, and an AI read on roof condition.

Built as a working MVP in **Next.js + TypeScript + Supabase**, wired to live public weather and parcel data instead of mock data or a paid leads vendor.

## The problem

After a hailstorm, roofing companies race to find damaged homes and knock doors. Today that's guesswork — buy a generic lead list, or drive the neighborhood. The signal that actually matters (*which specific homes sat under the worst of the hail, and which of those are old enough to have vulnerable roofs*) is scattered across weather feeds, mapping data, and county records that nobody has stitched together.

Vantage stitches them together.

## How it works

1. **Live storm layer (national).** Pulls NWS/IEM Local Storm Reports and NOAA MRMS radar-derived hail (MESH) for the last 72 hours, scores each storm by severity, and refreshes on a schedule. This layer is free and always on — no lead scraping happens here.
2. **Territory → leads.** A roofer adds a ZIP or city with a radius (1–10 mi). Vantage pulls every real building inside the storm footprint from OpenStreetMap (Overpass) and ranks them with a lead-scoring model (storm severity × proximity × property signals).
3. **Enrichment.** For covered counties, each lead is enriched from public **county ArcGIS parcel** records (year built → roof age), with **Census ACS** housing-age as a fallback and **FEMA National Risk Index** for area hail risk. An **OpenAI vision** pass reads aerial imagery for a rough roof-condition score.
4. **Work the list.** Leads land in an inbox with a map view, status tracking, and soft-delete/Trash so nothing vanishes silently.

## Shingle Analysis (bonus tool)

A separate tool that answers a question roofers actually ask: *is this shingle still made?* Type a shingle (manufacturer / line / color), and Vantage searches manufacturer, distributor, and retailer sources (via Tavily), classifies the evidence, and returns a definitive **active / discontinued / regional / limited** verdict with sources — a result, not homework.

## Data sources

| Source | Used for |
|---|---|
| NWS / IEM Local Storm Reports | Live storm events (hail / wind) |
| NOAA MRMS MESH | Radar-derived max hail size |
| OpenStreetMap (Overpass) | Real buildings inside a territory |
| County ArcGIS parcel layers | Year built / roof age |
| Census ACS (B25034) | Housing-age fallback where no parcel data exists |
| FEMA National Risk Index | Area hail risk |
| Mapbox | Map tiles + aerial imagery |
| OpenAI (vision) | Roof-condition score |
| Tavily | Shingle evidence search |

Built on free/public data first: Vantage skips the ~$375/mo paid parcel API in favor of a county-ArcGIS registry it expands one county at a time.

## Stack

Next.js (App Router) · TypeScript · Tailwind · Supabase (Postgres + auth) · Leaflet / react-leaflet · OpenAI.

Core logic lives in `src/lib/`:

- `iem.ts`, `mrms-mesh.ts`, `storm-api.ts` — storm ingestion + severity scoring
- `overpass.ts`, `territories.ts`, `lead-scoring.ts` — territory → ranked leads
- `county-arcgis-registry.ts`, `*-enrichment.ts`, `regrid.ts` — parcel / area enrichment
- `shingle-analysis/` — the shingle evidence classifier
- `supabase.ts`, `leads-store.ts`, `types.ts` — persistence + shared types

## Running locally

```bash
npm install
cp .env.local.example .env.local   # fill in the keys below
npm run dev
```

Environment (`.env.local`):

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase
- `NEXT_PUBLIC_MAPBOX_TOKEN` — map tiles / aerial imagery
- `OPENAI_API_KEY` — roof-condition scoring + shingle analysis
- `TAVILY_API_KEY` — shingle evidence search (optional; falls back to mock)
- `REGRID_API_KEY` — optional paid parcel enrichment

## Status

Working MVP / prototype. The storm layer is live nationwide; county parcel enrichment currently covers a handful of hail-belt counties (Fulton GA, Maricopa AZ, Tarrant TX, Douglas NE) and is built to expand. Roof scoring and shingle analysis are API-driven, not custom models.
