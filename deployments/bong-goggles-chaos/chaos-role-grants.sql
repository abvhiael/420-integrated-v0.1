-- Apply using the *operator* database identity only, AFTER social migration 007.
-- The dedicated game role is provisioned with its own credential outside Git.
-- No memberships, 420ID sessions, wallet identities or moderation privileges.
BEGIN;
DO $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='bonggoggles_chaos_runtime') THEN
  RAISE EXCEPTION 'Provision the separate game DB role before applying these grants';
 END IF;
END $$;
GRANT USAGE ON SCHEMA bg_account_social TO bonggoggles_chaos_runtime;
GRANT SELECT, INSERT ON bg_account_social.chaos_rooms TO bonggoggles_chaos_runtime;
GRANT UPDATE(data,status,revision,updated_at)
 ON bg_account_social.chaos_rooms TO bonggoggles_chaos_runtime;
GRANT SELECT, INSERT ON bg_account_social.chaos_room_members TO bonggoggles_chaos_runtime;
GRANT SELECT ON bg_account_social.blocks TO bonggoggles_chaos_runtime;
COMMIT;
-- Acceptance from the *game* role: SELECT from chaos_rooms and blocks works,
-- DELETE on chaos_rooms, SELECT on sessions, and SELECT on login_flows are DENIED.
