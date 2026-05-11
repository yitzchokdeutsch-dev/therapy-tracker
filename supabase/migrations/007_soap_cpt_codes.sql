-- Add CPT codes + units to session notes
-- Stored as: [{ "code": "97530", "description": "Therapeutic Activities", "units": 2 }, ...]
ALTER TABLE session_notes ADD COLUMN IF NOT EXISTS cpt_codes jsonb NOT NULL DEFAULT '[]';
