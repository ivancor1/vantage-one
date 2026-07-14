-- ============================================================
-- Vantage — Supabase Schema (matches the live database)
-- Run this in the Supabase SQL Editor on a fresh project and
-- the app works. Generated from the production schema 2026-07.
-- ============================================================

-- Territories: ZIPs / cities / storm areas being monitored
CREATE TABLE IF NOT EXISTS public.territories (
  id                          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  type                        text        NOT NULL CHECK (type IN ('zip', 'city', 'neighborhood')),
  value                       text        NOT NULL,
  added_at                    timestamptz NOT NULL DEFAULT now(),
  radius_miles                integer     NOT NULL DEFAULT 3,
  lat                         double precision,
  lng                         double precision,
  deleted_at                  timestamptz,
  place_name                  text,
  -- Area enrichment (Census ACS tract + FEMA NRI county)
  census_pct_pre2000          real,
  census_pct_pre1980          real,
  area_housing_age_label      text,
  area_housing_age_score      real,
  historical_hail_risk_score  real,
  historical_hail_risk_label  text,
  enriched_at                 timestamptz,
  UNIQUE (type, value)
);

-- Storms: NWS LSR groups (one row per WFO+date), synced from IEM
CREATE TABLE IF NOT EXISTS public.storms (
  id             text             PRIMARY KEY,           -- "{wfo}-{YYYY-MM-DD}"
  wfo            text             NOT NULL,
  date           text             NOT NULL,
  name           text             NOT NULL,
  location       text             NOT NULL,
  lat            double precision NOT NULL,              -- centroid of report points (modeled)
  lng            double precision NOT NULL,
  hail_size      double precision NOT NULL DEFAULT 0,    -- max reported hail, inches (NWS)
  wind_speed     double precision NOT NULL DEFAULT 0,    -- max gust, mph (NWS)
  report_count   integer          NOT NULL DEFAULT 0,
  severity       double precision NOT NULL DEFAULT 0,    -- Vantage 0-10 (modeled)
  radius_meters  integer          NOT NULL DEFAULT 0,    -- modeled impact radius
  reports        jsonb            NOT NULL DEFAULT '[]'::jsonb,  -- raw LSR points
  active         boolean          NOT NULL DEFAULT true,
  first_seen_at  timestamptz      NOT NULL DEFAULT now(),
  last_seen_at   timestamptz      NOT NULL DEFAULT now(),
  hail_core_lat  real,                                   -- max-magnitude hail report point
  hail_core_lng  real
);

-- Leads: one row per addressed OSM building per territory
CREATE TABLE IF NOT EXISTS public.leads (
  id                          uuid             PRIMARY KEY DEFAULT gen_random_uuid(),
  territory_id                uuid             NOT NULL REFERENCES public.territories(id) ON DELETE CASCADE,
  osm_id                      text             NOT NULL,
  address                     text             NOT NULL,
  lat                         double precision NOT NULL,
  lng                         double precision NOT NULL,
  status                      text             NOT NULL DEFAULT 'new',
  base_score                  integer          NOT NULL DEFAULT 50,
  storm_score                 integer,
  lead_score                  integer          NOT NULL DEFAULT 50,
  nearest_storm_id            text,
  distance_to_storm_km        double precision,
  distance_to_territory_km    double precision,
  roof_age                    integer,
  year_built                  integer,
  data_source                 text             NOT NULL DEFAULT 'OpenStreetMap',
  deleted_at                  timestamptz,
  created_at                  timestamptz      NOT NULL DEFAULT now(),
  updated_at                  timestamptz      NOT NULL DEFAULT now(),
  satellite_url               text,
  -- Aerial roof-vulnerability read (a prior, never damage detection)
  visual_roof_score           smallint,
  ai_notes                    text,
  ai_analyzed_at              timestamptz,
  -- Area-level enrichment denormalized onto the lead
  area_housing_age_label      text,
  area_housing_age_score      real,
  historical_hail_risk_score  real,
  historical_hail_risk_label  text,
  score_confidence            text,
  -- Per-home hail evidence (IDW over NWS reports + NOAA SWDI radar signatures)
  spotter_hail_in             numeric,
  radar_hail_in               numeric,
  nearest_report_km           numeric,
  inside_hail_swath           boolean,
  -- Roof size from the OSM building footprint
  footprint_sqm               numeric,
  UNIQUE (territory_id, osm_id)   -- scrape upserts key on this; re-scans dedupe
);

-- Lead statuses for the storm-detail property view (separate, keyed by OSM property id)
CREATE TABLE IF NOT EXISTS public.lead_statuses (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id text        NOT NULL UNIQUE,
  status      text        NOT NULL DEFAULT 'new',
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT valid_status CHECK (
    status IN ('new','knocked','interested','inspection','claim','closed','not_qualified')
  )
);

-- ============================================================
-- Single-operator MVP: RLS is intentionally disabled. Multi-tenancy
-- (user_id on territories/leads + RLS policies) is the first change
-- required to onboard a second customer — see README "Known limitations".
-- ============================================================
ALTER TABLE public.territories   DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.storms        DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads         DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_statuses DISABLE ROW LEVEL SECURITY;
