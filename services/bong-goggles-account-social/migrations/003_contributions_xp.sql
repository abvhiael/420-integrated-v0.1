-- AUTH-10: wallet-independent OFF-CHAIN community XP; never ERC-20,
-- on-chain rewards, redeemable points, economic entitlement or 420Wallet.
-- Immutable journal. Only service-issued, verified, app-scoped subjects.
CREATE TABLE IF NOT EXISTS bg_account_social.contribution_xp_events (
 id uuid PRIMARY KEY,
 subject uuid NOT NULL REFERENCES bg_account_social.members(subject),
 source_kind text NOT NULL CHECK(source_kind IN ('post','comment')),
 source_id uuid NOT NULL,
 action text NOT NULL CHECK(action IN ('grant','revoke')),
 points smallint NOT NULL CHECK(
   (action='grant' AND points IN (5,2)) OR
   (action='revoke' AND points IN (-5,-2))),
 policy_version integer NOT NULL DEFAULT 1 CHECK(policy_version=1),
 content_digest bytea NOT NULL CHECK(octet_length(content_digest)=32),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(source_kind,source_id,action)
);
CREATE UNIQUE INDEX IF NOT EXISTS bg_social_xp_no_repost_farming
 ON bg_account_social.contribution_xp_events(subject,source_kind,content_digest)
 WHERE action='grant';
CREATE INDEX IF NOT EXISTS bg_social_xp_subject_history
 ON bg_account_social.contribution_xp_events(subject,created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS bg_social_xp_daily
 ON bg_account_social.contribution_xp_events(subject,source_kind,created_at)
 WHERE action='grant';
-- Schema's owner/operator alone administers policy and migrations.
-- Runtime receives SELECT,INSERT only; no client writes or wallet claims.
