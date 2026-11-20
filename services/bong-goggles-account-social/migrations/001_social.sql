-- AUTH-8. BongGoggles off-chain, wallet-independent social authority.
-- Deliberately separate from on-chain BG profiles, feeds and rewards.
-- No account420 account identifier, email, wallet, or 420Names association.
CREATE SCHEMA IF NOT EXISTS bg_account_social;
CREATE TABLE IF NOT EXISTS bg_account_social.members (
 subject uuid PRIMARY KEY,
 display_name text NOT NULL DEFAULT 'Member'
  CHECK(char_length(display_name) BETWEEN 1 AND 80),
 bio text NOT NULL DEFAULT '' CHECK(char_length(bio)<=500),
 joined_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE IF NOT EXISTS bg_account_social.posts (
 id uuid PRIMARY KEY,
 author uuid NOT NULL REFERENCES bg_account_social.members(subject),
 body text NOT NULL CHECK(char_length(body) BETWEEN 1 AND 2000),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS bg_social_posts_feed ON bg_account_social.posts(created_at DESC,id DESC)
 WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS bg_social_posts_author ON bg_account_social.posts(author,created_at DESC);
CREATE TABLE IF NOT EXISTS bg_account_social.comments (
 id uuid PRIMARY KEY,
 post_id uuid NOT NULL REFERENCES bg_account_social.posts(id),
 author uuid NOT NULL REFERENCES bg_account_social.members(subject),
 body text NOT NULL CHECK(char_length(body) BETWEEN 1 AND 500),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS bg_social_comments_post ON bg_account_social.comments(post_id,created_at,id)
 WHERE deleted_at IS NULL;
CREATE TABLE IF NOT EXISTS bg_account_social.reactions (
 post_id uuid NOT NULL REFERENCES bg_account_social.posts(id),
 subject uuid NOT NULL REFERENCES bg_account_social.members(subject),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(post_id,subject)
);
CREATE TABLE IF NOT EXISTS bg_account_social.follows (
 follower uuid NOT NULL REFERENCES bg_account_social.members(subject),
 followed uuid NOT NULL REFERENCES bg_account_social.members(subject),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(follower,followed),CHECK(follower<>followed)
);
CREATE TABLE IF NOT EXISTS bg_account_social.blocks (
 blocker uuid NOT NULL REFERENCES bg_account_social.members(subject),
 blocked uuid NOT NULL REFERENCES bg_account_social.members(subject),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(blocker,blocked),CHECK(blocker<>blocked)
);
CREATE TABLE IF NOT EXISTS bg_account_social.reports (
 id uuid PRIMARY KEY,
 reporter uuid NOT NULL REFERENCES bg_account_social.members(subject),
 post_id uuid NOT NULL REFERENCES bg_account_social.posts(id),
 reason text NOT NULL CHECK(reason IN ('spam','harassment','privacy','other')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(reporter,post_id)
);
-- Browser sessions are server-side encrypted AUTH-7 SSO bearer records.
-- Only a random-cookie SHA-256 digest is stored; tokens never reach JS.
CREATE TABLE IF NOT EXISTS bg_account_social.sessions (
 cookie_digest bytea PRIMARY KEY CHECK(octet_length(cookie_digest)=32),
 subject uuid NOT NULL REFERENCES bg_account_social.members(subject),
 token_cipher bytea NOT NULL,
 expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS bg_social_sessions_expiry ON bg_account_social.sessions(expires_at);
CREATE TABLE IF NOT EXISTS bg_account_social.login_flows (
 flow_digest bytea PRIMARY KEY CHECK(octet_length(flow_digest)=32),
 state_digest bytea NOT NULL UNIQUE CHECK(octet_length(state_digest)=32),
 verifier_cipher bytea NOT NULL,
 expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS bg_social_flow_expiry ON bg_account_social.login_flows(expires_at);
