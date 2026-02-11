-- Migration 005: Add metadata column to audit_logs for richer context
-- This supports auth events (login method, IP, user agent) and org structure changes

ALTER TABLE IF EXISTS "${SCHEMA}".audit_logs
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT NULL;

-- Also add previous_values and new_values if they don't exist 
-- (original schema used old_values/new_values naming inconsistently)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = '${SCHEMA}' 
    AND table_name = 'audit_logs' 
    AND column_name = 'previous_values'
  ) THEN
    -- Check if old_values exists and rename, or add new
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = '${SCHEMA}' 
      AND table_name = 'audit_logs' 
      AND column_name = 'old_values'
    ) THEN
      ALTER TABLE "${SCHEMA}".audit_logs RENAME COLUMN old_values TO previous_values;
    ELSE
      ALTER TABLE "${SCHEMA}".audit_logs ADD COLUMN previous_values JSONB DEFAULT NULL;
    END IF;
  END IF;
END $$;

-- Add index for global audit queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
  ON "${SCHEMA}".audit_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_performed_by
  ON "${SCHEMA}".audit_logs(performed_by);