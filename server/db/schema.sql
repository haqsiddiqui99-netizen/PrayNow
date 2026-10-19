-- PrayNow database schema (PostgreSQL)
-- Run: psql $DATABASE_URL -f server/db/schema.sql

CREATE SCHEMA IF NOT EXISTS praynow;

SET search_path TO praynow, public;

CREATE TYPE user_role AS ENUM ('admin', 'mosque_manager', 'app_user');

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name     VARCHAR(255) NOT NULL,
  mobile        VARCHAR(32) UNIQUE,
  role          user_role NOT NULL DEFAULT 'mosque_manager',
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mosques (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id        VARCHAR(32),
  name             VARCHAR(255) NOT NULL,
  address          TEXT NOT NULL,
  area             VARCHAR(255) NOT NULL,
  city             VARCHAR(128) NOT NULL DEFAULT 'Delhi',
  phone            VARCHAR(64),
  lat              DOUBLE PRECISION NOT NULL,
  lng              DOUBLE PRECISION NOT NULL,
  sect             VARCHAR(64),
  imam             VARCHAR(255),
  imam_mobile      VARCHAR(32),
  imam_photo       TEXT,
  moazzin_name     VARCHAR(255),
  moazzin_mobile   VARCHAR(32),
  moazzin_photo    TEXT,
  imams            JSONB NOT NULL DEFAULT '[]',
  moazzins         JSONB NOT NULL DEFAULT '[]',
  juma_khutba      VARCHAR(16),
  juma_namaz       VARCHAR(16),
  juma_sessions    TEXT,
  sermon_language  VARCHAR(128),
  facilities       TEXT[] NOT NULL DEFAULT '{}',
  facility_options TEXT[] NOT NULL DEFAULT '{}',
  events           TEXT[] NOT NULL DEFAULT '{}',
  photos           TEXT[] NOT NULL DEFAULT '{}',
  capacity         INTEGER NOT NULL DEFAULT 500,
  taraweeh_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  taraweeh_start   VARCHAR(16) NOT NULL DEFAULT '8:45 PM',
  taraweeh_nights  INTEGER NOT NULL DEFAULT 27,
  taraweeh_rakahs  INTEGER NOT NULL DEFAULT 20,
  taraweeh_night   INTEGER NOT NULL DEFAULT 1,
  maghrib_offset_minutes INTEGER,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  mic_enabled      BOOLEAN NOT NULL DEFAULT TRUE,
  stream_url       VARCHAR(512),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mosque_timings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mosque_id   UUID NOT NULL REFERENCES mosques(id) ON DELETE CASCADE,
  prayer_name   VARCHAR(16) NOT NULL CHECK (prayer_name IN ('Fajr','Dhuhr','Asr','Maghrib','Isha')),
  prayer_start  VARCHAR(16) NOT NULL DEFAULT '',
  azan          VARCHAR(16) NOT NULL,
  jamat         VARCHAR(16) NOT NULL,
  prayer_end    VARCHAR(16) NOT NULL DEFAULT '',
  UNIQUE (mosque_id, prayer_name)
);

CREATE TABLE IF NOT EXISTS mosque_night_timings (
  mosque_id       UUID PRIMARY KEY REFERENCES mosques(id) ON DELETE CASCADE,
  tahajjud_start  VARCHAR(16) NOT NULL,
  tahajjud_end    VARCHAR(16) NOT NULL,
  sehri_start     VARCHAR(16) NOT NULL,
  sehri_end       VARCHAR(16) NOT NULL,
  iftar_time      VARCHAR(16) NOT NULL DEFAULT ''
);

-- Links mosque_manager users to mosques they can edit
CREATE TABLE IF NOT EXISTS mosque_assignments (
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mosque_id  UUID NOT NULL REFERENCES mosques(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, mosque_id)
);

-- Live azan broadcast sessions. A row with status='live' means the mosque is
-- currently broadcasting its azan (started by a mosque_manager/admin from the app).
CREATE TABLE IF NOT EXISTS mosque_live_azan_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mosque_id     UUID NOT NULL REFERENCES mosques(id) ON DELETE CASCADE,
  prayer_name   VARCHAR(16),
  channel       VARCHAR(128) NOT NULL,
  started_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  status        VARCHAR(16) NOT NULL DEFAULT 'live' CHECK (status IN ('live','ended')),
  listeners     INTEGER NOT NULL DEFAULT 0,
  recording_url VARCHAR(512),
  started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_azan_sessions_mosque ON mosque_live_azan_sessions(mosque_id);
CREATE INDEX IF NOT EXISTS idx_azan_sessions_status ON mosque_live_azan_sessions(status);

-- City-wide prayer schedule (home page)
CREATE TABLE IF NOT EXISTS city_settings (
  id              SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  city            VARCHAR(128) NOT NULL DEFAULT 'Delhi',
  country         VARCHAR(128) NOT NULL DEFAULT 'India',
  lat             DOUBLE PRECISION NOT NULL DEFAULT 28.6139,
  lng             DOUBLE PRECISION NOT NULL DEFAULT 77.2090,
  zawal_start     VARCHAR(16) NOT NULL DEFAULT '11:20 AM',
  zawal_end       VARCHAR(16) NOT NULL DEFAULT '11:55 AM',
  sunrise         VARCHAR(16) NOT NULL DEFAULT '5:45 AM',
  fajr_namaz_end  VARCHAR(16) NOT NULL DEFAULT '5:40 AM',
  tahajjud_start  VARCHAR(16) NOT NULL DEFAULT '12:30 AM',
  tahajjud_end    VARCHAR(16) NOT NULL DEFAULT '4:40 AM',
  sehri_start     VARCHAR(16) NOT NULL DEFAULT '3:10 AM',
  sehri_end       VARCHAR(16) NOT NULL DEFAULT '4:50 AM',
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS city_prayer_schedule (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prayer_name VARCHAR(16) NOT NULL UNIQUE CHECK (prayer_name IN ('Fajr','Dhuhr','Asr','Maghrib','Isha')),
  start_time  VARCHAR(16) NOT NULL,
  end_time    VARCHAR(16) NOT NULL
);

-- Per-day city prayer windows (365 rows per city/year). Used for home Now/Next.
CREATE TABLE IF NOT EXISTS city_prayer_days (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city            VARCHAR(128) NOT NULL DEFAULT 'Delhi',
  prayer_date     DATE NOT NULL,
  fajr_start      VARCHAR(16) NOT NULL,
  fajr_end        VARCHAR(16) NOT NULL,
  dhuhr_start     VARCHAR(16) NOT NULL,
  dhuhr_end       VARCHAR(16) NOT NULL,
  asr_start       VARCHAR(16) NOT NULL,
  asr_end         VARCHAR(16) NOT NULL,
  maghrib_start   VARCHAR(16) NOT NULL,
  maghrib_end     VARCHAR(16) NOT NULL,
  isha_start      VARCHAR(16) NOT NULL,
  isha_end        VARCHAR(16) NOT NULL,
  sunrise         VARCHAR(16) NOT NULL,
  fajr_namaz_end  VARCHAR(16) NOT NULL,
  zawal_start     VARCHAR(16) NOT NULL,
  zawal_end       VARCHAR(16) NOT NULL,
  tahajjud_start  VARCHAR(16) NOT NULL,
  tahajjud_end    VARCHAR(16) NOT NULL,
  sehri_start     VARCHAR(16) NOT NULL,
  sehri_end       VARCHAR(16) NOT NULL,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (city, prayer_date)
);

CREATE INDEX IF NOT EXISTS idx_city_prayer_days_city_date ON city_prayer_days(city, prayer_date);

-- Upgrade path for existing Postgres installs (no-op on fresh schema / memory)
ALTER TABLE city_settings ADD COLUMN IF NOT EXISTS tahajjud_start VARCHAR(16) NOT NULL DEFAULT '12:30 AM';
ALTER TABLE city_settings ADD COLUMN IF NOT EXISTS tahajjud_end VARCHAR(16) NOT NULL DEFAULT '4:40 AM';
ALTER TABLE city_settings ADD COLUMN IF NOT EXISTS sehri_start VARCHAR(16) NOT NULL DEFAULT '3:10 AM';
ALTER TABLE city_settings ADD COLUMN IF NOT EXISTS sehri_end VARCHAR(16) NOT NULL DEFAULT '4:50 AM';

CREATE INDEX IF NOT EXISTS idx_mosques_active ON mosques(is_active);
CREATE INDEX IF NOT EXISTS idx_mosque_timings_mosque ON mosque_timings(mosque_id);
CREATE INDEX IF NOT EXISTS idx_mosque_assignments_user ON mosque_assignments(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_mosques_legacy_id ON mosques(legacy_id) WHERE legacy_id IS NOT NULL;

-- User follows a mosque for timings/announcement alerts
CREATE TABLE IF NOT EXISTS mosque_subscriptions (
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mosque_id   UUID NOT NULL REFERENCES mosques(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, mosque_id)
);

CREATE INDEX IF NOT EXISTS idx_mosque_subscriptions_mosque ON mosque_subscriptions(mosque_id);

-- Per-mosque reminder preferences (scheduled locally on the device)
ALTER TABLE mosque_subscriptions ADD COLUMN IF NOT EXISTS remind_jamaat BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE mosque_subscriptions ADD COLUMN IF NOT EXISTS jamaat_lead INTEGER NOT NULL DEFAULT 10;
ALTER TABLE mosque_subscriptions ADD COLUMN IF NOT EXISTS remind_azan BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE mosque_subscriptions ADD COLUMN IF NOT EXISTS remind_prayers TEXT NOT NULL DEFAULT 'Fajr,Dhuhr,Asr,Maghrib,Isha';
ALTER TABLE mosque_subscriptions ADD COLUMN IF NOT EXISTS remind_leave BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE mosque_subscriptions ADD COLUMN IF NOT EXISTS travel_minutes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE mosque_subscriptions ADD COLUMN IF NOT EXISTS remind_taraweeh BOOLEAN NOT NULL DEFAULT FALSE;

-- Classes, talks and iftars a mosque announces; `weekly` repeats from starts_at.
CREATE TABLE IF NOT EXISTS mosque_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mosque_id   UUID NOT NULL REFERENCES mosques(id) ON DELETE CASCADE,
  title       VARCHAR(160) NOT NULL,
  details     TEXT NOT NULL DEFAULT '',
  starts_at   TIMESTAMPTZ NOT NULL,
  weekly      BOOLEAN NOT NULL DEFAULT FALSE,
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mosque_events_mosque ON mosque_events(mosque_id);

-- Expo push tokens per user (a user may have multiple devices)
CREATE TABLE IF NOT EXISTS user_push_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token       VARCHAR(512) NOT NULL,
  platform    VARCHAR(32) NOT NULL DEFAULT 'unknown',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, token)
);

CREATE INDEX IF NOT EXISTS idx_user_push_tokens_user ON user_push_tokens(user_id);

-- In-app notification inbox (WhatsApp-style)
CREATE TABLE IF NOT EXISTS notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mosque_id   UUID REFERENCES mosques(id) ON DELETE SET NULL,
  type        VARCHAR(32) NOT NULL CHECK (type IN ('timings', 'announcement', 'azan_alert', 'facilities', 'correction', 'janaza')),
  title       VARCHAR(255) NOT NULL,
  body        TEXT NOT NULL DEFAULT '',
  voice_note_id UUID,
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);

-- Voice notes a mosque admin attaches to a message for subscribers.
CREATE TABLE IF NOT EXISTS mosque_voice_notes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mosque_id   UUID NOT NULL REFERENCES mosques(id) ON DELETE CASCADE,
  mime        VARCHAR(64) NOT NULL DEFAULT 'audio/mp4',
  audio       TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id) WHERE read_at IS NULL;

-- Multi imam / mo'azzin (idempotent for existing databases)
ALTER TABLE mosques ADD COLUMN IF NOT EXISTS imams JSONB NOT NULL DEFAULT '[]';
ALTER TABLE mosques ADD COLUMN IF NOT EXISTS moazzins JSONB NOT NULL DEFAULT '[]';
ALTER TABLE mosques ADD COLUMN IF NOT EXISTS facility_options TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE mosques ADD COLUMN IF NOT EXISTS taraweeh_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE mosques ADD COLUMN IF NOT EXISTS taraweeh_start VARCHAR(16) NOT NULL DEFAULT '8:45 PM';
ALTER TABLE mosques ADD COLUMN IF NOT EXISTS taraweeh_nights INTEGER NOT NULL DEFAULT 27;
ALTER TABLE mosques ADD COLUMN IF NOT EXISTS taraweeh_rakahs INTEGER NOT NULL DEFAULT 20;
ALTER TABLE mosques ADD COLUMN IF NOT EXISTS taraweeh_night INTEGER NOT NULL DEFAULT 1;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS voice_note_id UUID;

-- A signed-in user asks for a mosque to be added; an app admin approves or rejects.
-- Approving copies the request into mosques and records the new id here.
CREATE TABLE IF NOT EXISTS mosque_requests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submitted_by      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name              VARCHAR(255) NOT NULL,
  address           TEXT NOT NULL,
  area              VARCHAR(255) NOT NULL DEFAULT '',
  city              VARCHAR(128) NOT NULL DEFAULT '',
  lat               DOUBLE PRECISION,
  lng               DOUBLE PRECISION,
  owner_name        VARCHAR(255) NOT NULL,
  owner_mobile      VARCHAR(32) NOT NULL,
  owner_email       VARCHAR(255) NOT NULL DEFAULT '',
  notes             TEXT NOT NULL DEFAULT '',
  facilities        TEXT[] NOT NULL DEFAULT '{}',
  timings           TEXT NOT NULL DEFAULT '',
  night_timings     TEXT NOT NULL DEFAULT '',
  maghrib_offset_minutes INTEGER,
  status            VARCHAR(16) NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','approved','rejected')),
  review_note       TEXT NOT NULL DEFAULT '',
  reviewed_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at       TIMESTAMPTZ,
  created_mosque_id UUID REFERENCES mosques(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Photos sit in their own table so listing requests never drags image bytes along.
CREATE TABLE IF NOT EXISTS mosque_request_photos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id   UUID NOT NULL REFERENCES mosque_requests(id) ON DELETE CASCADE,
  content_type VARCHAR(64) NOT NULL DEFAULT 'image/jpeg',
  byte_size    INTEGER NOT NULL DEFAULT 0,
  sort_order   SMALLINT NOT NULL DEFAULT 0,
  data         BYTEA NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Followers report a wrong time or detail; the mosque admin (or app owner) marks it fixed or dismissed.
CREATE TABLE IF NOT EXISTS mosque_corrections (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mosque_id    UUID NOT NULL REFERENCES mosques(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic        VARCHAR(24) NOT NULL
                 CHECK (topic IN ('jamaat','juma','address','phone','facilities','other')),
  prayer       VARCHAR(16),
  suggestion   VARCHAR(500) NOT NULL DEFAULT '',
  note         TEXT NOT NULL DEFAULT '',
  status       VARCHAR(16) NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','fixed','dismissed')),
  resolved_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  resolved_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mosque_corrections_mosque ON mosque_corrections(mosque_id, status, created_at DESC);

-- Funeral prayers a mosque announces at short notice; they drop off a few hours after the prayer.
CREATE TABLE IF NOT EXISTS mosque_janaza (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mosque_id      UUID NOT NULL REFERENCES mosques(id) ON DELETE CASCADE,
  deceased_name  VARCHAR(160) NOT NULL DEFAULT '',
  after_prayer   VARCHAR(16),
  prayer_at      TIMESTAMPTZ NOT NULL,
  burial         VARCHAR(255) NOT NULL DEFAULT '',
  note           TEXT NOT NULL DEFAULT '',
  created_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mosque_janaza_time ON mosque_janaza(prayer_at);

-- What a mosque is asking the community for: volunteers, funds (external link only) or items.
CREATE TABLE IF NOT EXISTS mosque_needs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mosque_id   UUID NOT NULL REFERENCES mosques(id) ON DELETE CASCADE,
  kind        VARCHAR(16) NOT NULL CHECK (kind IN ('volunteers','fundraising','items','other')),
  title       VARCHAR(160) NOT NULL,
  details     TEXT NOT NULL DEFAULT '',
  link        VARCHAR(500) NOT NULL DEFAULT '',
  status      VARCHAR(16) NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mosque_needs_mosque ON mosque_needs(mosque_id, status);

-- Existing installs: widen the notification types for correction and janaza alerts.
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('timings', 'announcement', 'azan_alert', 'facilities', 'correction', 'janaza'));

ALTER TABLE mosque_requests ADD COLUMN IF NOT EXISTS facilities TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE mosque_requests ADD COLUMN IF NOT EXISTS timings TEXT NOT NULL DEFAULT '';
ALTER TABLE mosque_requests ADD COLUMN IF NOT EXISTS night_timings TEXT NOT NULL DEFAULT '';
ALTER TABLE mosque_requests ADD COLUMN IF NOT EXISTS maghrib_offset_minutes INTEGER;
ALTER TABLE mosques ADD COLUMN IF NOT EXISTS maghrib_offset_minutes INTEGER;
ALTER TABLE mosque_night_timings ADD COLUMN IF NOT EXISTS iftar_time VARCHAR(16) NOT NULL DEFAULT '';

-- One saved azan per mosque. A new broadcast replaces the previous file.
CREATE TABLE IF NOT EXISTS mosque_azan_recordings (
  mosque_id   UUID PRIMARY KEY REFERENCES mosques(id) ON DELETE CASCADE,
  prayer_name VARCHAR(16),
  mime        VARCHAR(64) NOT NULL DEFAULT 'audio/aac',
  audio       TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mosque_requests_status ON mosque_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mosque_requests_user ON mosque_requests(submitted_by, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mosque_request_photos_request
  ON mosque_request_photos(request_id, sort_order);
