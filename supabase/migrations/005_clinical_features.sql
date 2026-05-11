-- ── Insurance & diagnosis fields on clients ─────────────────────────────────
ALTER TABLE clients ADD COLUMN IF NOT EXISTS insurance_company   text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS policy_number       text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS group_number        text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS subscriber_name     text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS subscriber_dob      date;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS auth_number         text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS authorized_visits   integer;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS auth_expiration     date;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS diagnosis_codes     text[] DEFAULT '{}';

-- ── SOAP / Progress Notes ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS session_notes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    uuid REFERENCES clients  ON DELETE CASCADE  NOT NULL,
  session_id   uuid REFERENCES sessions ON DELETE SET NULL,
  therapist_id uuid REFERENCES therapists ON DELETE SET NULL,
  session_date date NOT NULL,
  subjective   text,
  objective    text,
  assessment   text,
  plan         text,
  goals_addressed uuid[] DEFAULT '{}',
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

ALTER TABLE session_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_all_session_notes" ON session_notes;
CREATE POLICY "auth_all_session_notes" ON session_notes FOR ALL
  USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- ── Goals ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS goals (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   uuid REFERENCES clients ON DELETE CASCADE NOT NULL,
  description text NOT NULL,
  category    text NOT NULL DEFAULT 'other',
  target_date date,
  status      text NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'mastered', 'discontinued')),
  progress    integer NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  notes       text,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_all_goals" ON goals;
CREATE POLICY "auth_all_goals" ON goals FOR ALL
  USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- ── Tasks ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    uuid REFERENCES clients  ON DELETE CASCADE,
  session_id   uuid REFERENCES sessions ON DELETE CASCADE,
  title        text NOT NULL,
  task_type    text NOT NULL DEFAULT 'custom'
                 CHECK (task_type IN ('soap_note', 'auth_expiring', 'custom')),
  due_date     date,
  completed_at timestamptz,
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_all_tasks" ON tasks;
CREATE POLICY "auth_all_tasks" ON tasks FOR ALL
  USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Indexes
CREATE INDEX IF NOT EXISTS idx_session_notes_client ON session_notes (client_id, session_date DESC);
CREATE INDEX IF NOT EXISTS idx_goals_client         ON goals (client_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_incomplete     ON tasks (due_date) WHERE completed_at IS NULL;
