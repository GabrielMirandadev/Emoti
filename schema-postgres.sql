CREATE TABLE IF NOT EXISTS families (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  parent_name VARCHAR(120) NOT NULL,
  parent_email VARCHAR(180),
  pin VARCHAR(20) NOT NULL DEFAULT '1234',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS children (
  id SERIAL PRIMARY KEY,
  family_id INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  birth_year INTEGER,
  avatar VARCHAR(20) DEFAULT '🧒',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS emotion_records (
  id SERIAL PRIMARY KEY,
  child_id INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  emotion VARCHAR(30) NOT NULL,
  intensity INTEGER NOT NULL CHECK (intensity BETWEEN 1 AND 5),
  story TEXT,
  audio_path VARCHAR(255),
  audio_data BYTEA,
  audio_mime VARCHAR(100),
  registered_by VARCHAR(20) NOT NULL DEFAULT 'child',
  registered_by_name VARCHAR(120),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_children_family ON children(family_id);
CREATE INDEX IF NOT EXISTS idx_records_child_date ON emotion_records(child_id, created_at DESC);

-- Migración compatible con bases ya creadas
ALTER TABLE emotion_records ADD COLUMN IF NOT EXISTS audio_data BYTEA;
ALTER TABLE emotion_records ADD COLUMN IF NOT EXISTS audio_mime VARCHAR(100);

ALTER TABLE emotion_records
  ADD COLUMN IF NOT EXISTS registered_by VARCHAR(20) NOT NULL DEFAULT 'child';

ALTER TABLE emotion_records
  ADD COLUMN IF NOT EXISTS registered_by_name VARCHAR(120);
