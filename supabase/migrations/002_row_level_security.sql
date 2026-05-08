-- Phase 2: Row Level Security
-- Run this entire file in Supabase SQL Editor (supabase.com → your project → SQL Editor → New Query)
-- Every table gets RLS enabled + policies that require an authenticated session.
-- Nobody can read or write data without being logged in — not even with the anon key.

-- ─────────────────────────────────────────────
-- CLIENTS
-- ─────────────────────────────────────────────
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_select" ON clients FOR SELECT  USING (auth.role() = 'authenticated');
CREATE POLICY "auth_insert" ON clients FOR INSERT  WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth_update" ON clients FOR UPDATE  USING (auth.role() = 'authenticated');
CREATE POLICY "auth_delete" ON clients FOR DELETE  USING (auth.role() = 'authenticated');

-- ─────────────────────────────────────────────
-- THERAPISTS
-- ─────────────────────────────────────────────
ALTER TABLE therapists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_select" ON therapists FOR SELECT  USING (auth.role() = 'authenticated');
CREATE POLICY "auth_insert" ON therapists FOR INSERT  WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth_update" ON therapists FOR UPDATE  USING (auth.role() = 'authenticated');
CREATE POLICY "auth_delete" ON therapists FOR DELETE  USING (auth.role() = 'authenticated');

-- ─────────────────────────────────────────────
-- SERVICE TYPES
-- ─────────────────────────────────────────────
ALTER TABLE service_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_select" ON service_types FOR SELECT  USING (auth.role() = 'authenticated');
CREATE POLICY "auth_insert" ON service_types FOR INSERT  WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth_update" ON service_types FOR UPDATE  USING (auth.role() = 'authenticated');
CREATE POLICY "auth_delete" ON service_types FOR DELETE  USING (auth.role() = 'authenticated');

-- ─────────────────────────────────────────────
-- SESSIONS
-- ─────────────────────────────────────────────
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_select" ON sessions FOR SELECT  USING (auth.role() = 'authenticated');
CREATE POLICY "auth_insert" ON sessions FOR INSERT  WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth_update" ON sessions FOR UPDATE  USING (auth.role() = 'authenticated');
CREATE POLICY "auth_delete" ON sessions FOR DELETE  USING (auth.role() = 'authenticated');

-- ─────────────────────────────────────────────
-- CHARGES
-- ─────────────────────────────────────────────
ALTER TABLE charges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_select" ON charges FOR SELECT  USING (auth.role() = 'authenticated');
CREATE POLICY "auth_insert" ON charges FOR INSERT  WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth_update" ON charges FOR UPDATE  USING (auth.role() = 'authenticated');
CREATE POLICY "auth_delete" ON charges FOR DELETE  USING (auth.role() = 'authenticated');

-- ─────────────────────────────────────────────
-- PAYMENTS
-- ─────────────────────────────────────────────
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_select" ON payments FOR SELECT  USING (auth.role() = 'authenticated');
CREATE POLICY "auth_insert" ON payments FOR INSERT  WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth_update" ON payments FOR UPDATE  USING (auth.role() = 'authenticated');
CREATE POLICY "auth_delete" ON payments FOR DELETE  USING (auth.role() = 'authenticated');

-- ─────────────────────────────────────────────
-- FEES
-- ─────────────────────────────────────────────
ALTER TABLE fees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_select" ON fees FOR SELECT  USING (auth.role() = 'authenticated');
CREATE POLICY "auth_insert" ON fees FOR INSERT  WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth_update" ON fees FOR UPDATE  USING (auth.role() = 'authenticated');
CREATE POLICY "auth_delete" ON fees FOR DELETE  USING (auth.role() = 'authenticated');

-- ─────────────────────────────────────────────
-- THERAPIST SCHEDULES
-- ─────────────────────────────────────────────
ALTER TABLE therapist_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_select" ON therapist_schedules FOR SELECT  USING (auth.role() = 'authenticated');
CREATE POLICY "auth_insert" ON therapist_schedules FOR INSERT  WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth_update" ON therapist_schedules FOR UPDATE  USING (auth.role() = 'authenticated');
CREATE POLICY "auth_delete" ON therapist_schedules FOR DELETE  USING (auth.role() = 'authenticated');

-- ─────────────────────────────────────────────
-- CLIENT NOTES
-- ─────────────────────────────────────────────
ALTER TABLE client_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_select" ON client_notes FOR SELECT  USING (auth.role() = 'authenticated');
CREATE POLICY "auth_insert" ON client_notes FOR INSERT  WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth_update" ON client_notes FOR UPDATE  USING (auth.role() = 'authenticated');
CREATE POLICY "auth_delete" ON client_notes FOR DELETE  USING (auth.role() = 'authenticated');

-- ─────────────────────────────────────────────
-- CLIENT FILES
-- ─────────────────────────────────────────────
ALTER TABLE client_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_select" ON client_files FOR SELECT  USING (auth.role() = 'authenticated');
CREATE POLICY "auth_insert" ON client_files FOR INSERT  WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth_update" ON client_files FOR UPDATE  USING (auth.role() = 'authenticated');
CREATE POLICY "auth_delete" ON client_files FOR DELETE  USING (auth.role() = 'authenticated');

-- ─────────────────────────────────────────────
-- CLIENT BALANCES VIEW
-- Re-create the view so it runs in the security context of the calling user
-- (SECURITY INVOKER means RLS on the underlying tables is respected)
-- ─────────────────────────────────────────────
DROP VIEW IF EXISTS client_balances;
CREATE OR REPLACE VIEW client_balances
  WITH (security_invoker = true)
AS
SELECT
  c.id AS client_id,
  COALESCE((SELECT SUM(amount)::numeric FROM charges  WHERE client_id = c.id), 0)
  - COALESCE((SELECT SUM(amount)::numeric FROM payments WHERE client_id = c.id), 0)
  AS balance
FROM clients c;

-- ─────────────────────────────────────────────
-- STORAGE: client-files bucket
-- Run this only if you have a bucket named "client-files".
-- If the bucket doesn't exist yet, create it first as PRIVATE
-- in Supabase → Storage → New Bucket (uncheck "Public bucket").
-- ─────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('client-files', 'client-files', false)
ON CONFLICT (id) DO UPDATE SET public = false;

CREATE POLICY "auth_storage_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'client-files' AND auth.role() = 'authenticated');

CREATE POLICY "auth_storage_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'client-files' AND auth.role() = 'authenticated');

CREATE POLICY "auth_storage_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'client-files' AND auth.role() = 'authenticated');
