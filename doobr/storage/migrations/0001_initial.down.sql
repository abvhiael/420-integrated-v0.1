-- Destructive development rollback only; forbid use on live regulated records.
BEGIN;
SELECT pg_advisory_xact_lock(4202101);
DROP SCHEMA IF EXISTS doobr_private CASCADE;
COMMIT;
