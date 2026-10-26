-- Migration companion: execute as owner with provisioned, non-superuser service role.
-- Required environment substitutions are performed by deployment provisioning, not by players.
-- Provision role only through restricted deployment process; never grant PUBLIC.
DO $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='highcountry_social_runtime') THEN
  CREATE ROLE highcountry_social_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS;
 END IF;
END $$;
REVOKE ALL ON highcountry_social_operations FROM PUBLIC;
ALTER TABLE highcountry_social_operations FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS social_runtime_namespace ON highcountry_social_operations;
-- Database runtime must set a transaction-local trusted namespace before querying.
-- Only the authenticated service role may be granted table privileges.
CREATE POLICY social_runtime_namespace ON highcountry_social_operations
 FOR ALL TO highcountry_social_runtime
 USING (scope = current_setting('highcountry.social_namespace', true))
 WITH CHECK (scope = current_setting('highcountry.social_namespace', true));
GRANT SELECT,INSERT,UPDATE ON highcountry_social_operations TO highcountry_social_runtime;
-- DELETE, TRUNCATE, REFERENCES, TRIGGER are never granted.
