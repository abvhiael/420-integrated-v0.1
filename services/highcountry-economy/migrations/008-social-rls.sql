-- Fail-closed social-operation row security. Provisioning must define a trusted
-- per-namespace database role/policy before allowing any application access.
-- PostgreSQL session custom settings are caller-mutable: NEVER trust a namespace
-- custom GUC alone as the tenant-isolation boundary.
REVOKE ALL ON highcountry_social_operations FROM PUBLIC;
ALTER TABLE highcountry_social_operations FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS social_runtime_namespace ON highcountry_social_operations;
-- No permissive RLS policies are installed here. A privileged deployment
-- migration must create a fixed scope-bound policy for a dedicated per-namespace
-- runtime role, after validating its login path and least-privilege grants.
