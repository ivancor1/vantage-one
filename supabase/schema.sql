-- ============================================================
-- Vantage — Supabase Schema
-- Run this in the Supabase SQL Editor for your project.
-- ============================================================

-- Territories: zip codes, cities, and neighborhoods to monitor
CREATE TABLE IF NOT EXISTS public.territories (
  id        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  type      text        NOT NULL CHECK (type IN ('zip', 'city', 'neighborhood')),
  value     text        NOT NULL,
  added_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (type, value)
);

-- Lead statuses: tracks rep actions on each property
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
-- RLS is disabled for now — enable and add user_id policies
-- when Supabase Auth is wired up in a later step.
-- ============================================================
ALTER TABLE public.territories  DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_statuses DISABLE ROW LEVEL SECURITY;
