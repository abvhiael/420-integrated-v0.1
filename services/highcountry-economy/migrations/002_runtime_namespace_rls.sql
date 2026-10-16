-- Provisioning/migration role only. Runtime roles may SELECT/UPDATE their single role-named namespace.
-- No application-configurable session variable controls authorization.
ALTER TABLE highcountry_buds_state ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='highcountry_buds_state' AND policyname='hc_role_namespace') THEN
    CREATE POLICY hc_role_namespace ON highcountry_buds_state
      USING (namespace = current_user) WITH CHECK (namespace = current_user);
  END IF;
END $$;
-- Table owner retains migration/provisioning authority; do not use it for runtime requests.
