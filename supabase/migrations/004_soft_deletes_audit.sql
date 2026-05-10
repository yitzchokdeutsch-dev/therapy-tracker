-- Soft delete columns — records are never physically removed, just hidden
ALTER TABLE sessions  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE charges   ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE payments  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Partial indexes keep queries fast on large tables
CREATE INDEX IF NOT EXISTS idx_sessions_not_deleted ON sessions  (session_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_charges_not_deleted  ON charges   (client_id)    WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_payments_not_deleted ON payments  (client_id)    WHERE deleted_at IS NULL;

-- Audit log — immutable record of all significant actions
CREATE TABLE IF NOT EXISTS audit_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES auth.users ON DELETE SET NULL,
  action      text NOT NULL,
  table_name  text,
  record_id   uuid,
  details     jsonb,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_read_audit"
  ON audit_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role IN ('admin', 'secretary')
    )
  );

-- Recreate client_balances view to exclude soft-deleted charges/payments
CREATE OR REPLACE VIEW client_balances
  WITH (security_invoker = true)
AS
SELECT
  c.id AS client_id,
  COALESCE((
    SELECT SUM(ch.amount)
    FROM charges ch
    WHERE ch.client_id = c.id AND ch.deleted_at IS NULL
  ), 0)
  -
  COALESCE((
    SELECT SUM(p.amount)
    FROM payments p
    WHERE p.client_id = c.id AND p.deleted_at IS NULL
  ), 0) AS balance
FROM clients c;
