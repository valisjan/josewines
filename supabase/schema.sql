-- ============================================================
-- JoseWines — Supabase Schema
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- --------------------------------------------------------
-- WINES: confirmed cellar entries
-- --------------------------------------------------------
create table wines (
  id                  uuid primary key default uuid_generate_v4(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  name                text not null,
  winery              text not null,
  region              text,
  grape_variety       text,
  vintage_year        integer,
  purchase_date       date not null,
  price_per_bottle    numeric(8,2) not null default 0,
  units_purchased     integer not null default 1,
  units_remaining     integer not null default 1,
  personal_score      integer check (personal_score between 50 and 100),
  notes               text,
  label_image_url     text,
  optimal_drink_from  integer,
  optimal_drink_until integer,
  source_order_id     text,
  created_at          timestamptz not null default now()
);

alter table wines enable row level security;
create policy "Users see own wines" on wines for all using (auth.uid() = user_id);

-- --------------------------------------------------------
-- PENDING_WINES: wines awaiting user confirmation (from email)
-- --------------------------------------------------------
create table pending_wines (
  id                  uuid primary key default uuid_generate_v4(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  name                text not null,
  winery              text not null,
  region              text,
  grape_variety       text,
  vintage_year        integer,
  purchase_date       date not null,
  price_per_bottle    numeric(8,2) not null default 0,
  units_purchased     integer not null default 1,
  source_email_subject text,
  source_order_id     text,
  raw_email_snippet   text,
  created_at          timestamptz not null default now()
);

alter table pending_wines enable row level security;
create policy "Users see own pending" on pending_wines for all using (auth.uid() = user_id);

-- --------------------------------------------------------
-- CONSUMPTIONS: log of bottles consumed
-- --------------------------------------------------------
create table consumptions (
  id        uuid primary key default uuid_generate_v4(),
  wine_id   uuid not null references wines(id) on delete cascade,
  date      date not null,
  occasion  text,
  notes     text,
  created_at timestamptz not null default now()
);

alter table consumptions enable row level security;
create policy "Users see own consumptions" on consumptions
  for all using (
    exists (select 1 from wines w where w.id = consumptions.wine_id and w.user_id = auth.uid())
  );

-- --------------------------------------------------------
-- USER_EMAIL_ALIASES: links forwarding email → user
-- Populated manually after signup (see README)
-- --------------------------------------------------------
create table user_email_aliases (
  alias    text primary key,  -- e.g. "jose123"  → jose123@yourdomain.mailgun.org
  user_id  uuid not null references auth.users(id) on delete cascade
);

alter table user_email_aliases enable row level security;
create policy "Read own alias" on user_email_aliases for select using (auth.uid() = user_id);
