-- ── Clinic settings (key/value store) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS settings (
  key        text PRIMARY KEY,
  value      text,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_settings" ON settings FOR ALL
  USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Seed default keys
INSERT INTO settings (key, value) VALUES
  ('clinic_name',     ''),
  ('clinic_address',  ''),
  ('clinic_phone',    ''),
  ('clinic_npi',      ''),
  ('clinic_tax_id',   ''),
  ('provider_name',   ''),
  ('provider_credentials', '')
ON CONFLICT (key) DO NOTHING;

-- ── CPT code on service types ────────────────────────────────────────────────
ALTER TABLE service_types ADD COLUMN IF NOT EXISTS cpt_code text;

-- ── Intake forms ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS intake_forms (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     uuid REFERENCES clients ON DELETE CASCADE NOT NULL,
  template      text NOT NULL
                  CHECK (template IN ('registration', 'consent', 'medical_history')),
  form_data     jsonb NOT NULL DEFAULT '{}',
  completed_at  timestamptz,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

ALTER TABLE intake_forms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_intake" ON intake_forms FOR ALL
  USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

CREATE UNIQUE INDEX IF NOT EXISTS idx_intake_one_per_type
  ON intake_forms (client_id, template);

-- ── Reminder log (prevent duplicate sends) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS reminder_log (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES sessions ON DELETE CASCADE NOT NULL,
  method     text NOT NULL DEFAULT 'email',
  sent_at    timestamptz DEFAULT now()
);

ALTER TABLE reminder_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_reminders" ON reminder_log FOR ALL
  USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

CREATE UNIQUE INDEX IF NOT EXISTS idx_reminder_per_session
  ON reminder_log (session_id, method);
