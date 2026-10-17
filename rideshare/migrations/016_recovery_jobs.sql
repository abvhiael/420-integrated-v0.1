-- L03.7 durable background queue; restricted worker capability, never public HTTP.
CREATE TABLE liftd.recovery_jobs (
  job_id text PRIMARY KEY CHECK (job_id ~ '^[A-Za-z0-9_-]{1,128}$'),
  kind text NOT NULL CHECK (kind IN ('dispatch_reconcile','availability_sweep','provider_recheck')),
  subject_id text NOT NULL CHECK (subject_id ~ '^[A-Za-z0-9_-]{1,128}$'),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  state text NOT NULL DEFAULT 'queued' CHECK (state IN ('queued','leased','complete','dead')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 20),
  available_at timestamptz NOT NULL DEFAULT now(),
  lease_until timestamptz,
  lease_owner text,
  lease_token text,
  last_error text,
  CHECK ((state='leased')=(lease_until IS NOT NULL AND lease_owner IS NOT NULL AND lease_token IS NOT NULL))
);
CREATE INDEX recovery_jobs_claim ON liftd.recovery_jobs (available_at,job_id) WHERE state IN ('queued','leased');
REVOKE ALL ON liftd.recovery_jobs FROM PUBLIC;
