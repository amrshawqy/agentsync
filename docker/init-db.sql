CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- GIN trigram index for fuzzy text search on record_indexes
DO $$
BEGIN
  IF to_regclass('public.record_indexes') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_ri_text_trgm ON record_indexes USING gin (text_value gin_trgm_ops);
  END IF;
END
$$;

-- ────────────────────────────────────────────────────────
-- PG NOTIFY trigger: broadcast row-level changes on records
-- ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION notify_record_change()
RETURNS trigger AS $$
DECLARE
  rec   RECORD;
  payload JSON;
BEGIN
  IF (TG_OP = 'DELETE') THEN
    rec := OLD;
  ELSE
    rec := NEW;
  END IF;

  payload := json_build_object(
    'operation', TG_OP,
    'table_id',  rec.table_id,
    'record_id', rec.id,
    'team_id',   rec.team_id
  );

  PERFORM pg_notify('record_changes', payload::text);
  RETURN rec;
END;
$$ LANGUAGE plpgsql;

-- Apply the trigger to the records table (if present)
DO $$
BEGIN
  IF to_regclass('public.records') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_record_changes ON records;
    CREATE TRIGGER trg_record_changes
      AFTER INSERT OR UPDATE OR DELETE ON records
      FOR EACH ROW EXECUTE FUNCTION notify_record_change();
  END IF;
END
$$;

-- ────────────────────────────────────────────────────────
-- Row-Level Security: org_isolation policies (if tables exist)
-- ────────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.records') IS NOT NULL THEN
    ALTER TABLE records ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS org_isolation ON records;
    CREATE POLICY org_isolation ON records
      USING (team_id = nullif(current_setting('app.current_team_id', true), '')::uuid)
      WITH CHECK (team_id = nullif(current_setting('app.current_team_id', true), '')::uuid);
  END IF;

  IF to_regclass('public.record_indexes') IS NOT NULL THEN
    ALTER TABLE record_indexes ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS org_isolation ON record_indexes;
    CREATE POLICY org_isolation ON record_indexes
      USING (team_id = nullif(current_setting('app.current_team_id', true), '')::uuid)
      WITH CHECK (team_id = nullif(current_setting('app.current_team_id', true), '')::uuid);
  END IF;

  IF to_regclass('public.record_relations') IS NOT NULL THEN
    ALTER TABLE record_relations ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS org_isolation ON record_relations;
    CREATE POLICY org_isolation ON record_relations
      USING (team_id = nullif(current_setting('app.current_team_id', true), '')::uuid)
      WITH CHECK (team_id = nullif(current_setting('app.current_team_id', true), '')::uuid);
  END IF;
END
$$;

-- ────────────────────────────────────────────────────────
-- Audit Log Partitioning: RANGE by created_at (quarterly)
-- ────────────────────────────────────────────────────────
DO $$
BEGIN
  -- Only partition if audit_log exists and is NOT already partitioned
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'audit_log' AND table_schema = 'public'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'audit_log' AND n.nspname = 'public' AND c.relkind = 'p'
  ) THEN
    -- Rename original table
    ALTER TABLE audit_log RENAME TO audit_log_old;

    -- Create partitioned table with same structure
    CREATE TABLE audit_log (LIKE audit_log_old INCLUDING ALL)
      PARTITION BY RANGE (created_at);

    -- Create quarterly partitions
    CREATE TABLE audit_log_2025_q1 PARTITION OF audit_log
      FOR VALUES FROM ('2025-01-01') TO ('2025-04-01');
    CREATE TABLE audit_log_2025_q2 PARTITION OF audit_log
      FOR VALUES FROM ('2025-04-01') TO ('2025-07-01');
    CREATE TABLE audit_log_2025_q3 PARTITION OF audit_log
      FOR VALUES FROM ('2025-07-01') TO ('2025-10-01');
    CREATE TABLE audit_log_2025_q4 PARTITION OF audit_log
      FOR VALUES FROM ('2025-10-01') TO ('2026-01-01');
    CREATE TABLE audit_log_2026_q1 PARTITION OF audit_log
      FOR VALUES FROM ('2026-01-01') TO ('2026-04-01');
    CREATE TABLE audit_log_2026_q2 PARTITION OF audit_log
      FOR VALUES FROM ('2026-04-01') TO ('2026-07-01');

    -- Migrate existing data
    INSERT INTO audit_log SELECT * FROM audit_log_old;

    -- Drop old table
    DROP TABLE audit_log_old;

    RAISE NOTICE 'audit_log partitioned successfully';
  END IF;
END
$$;
