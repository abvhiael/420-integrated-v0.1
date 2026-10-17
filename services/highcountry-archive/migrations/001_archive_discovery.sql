-- Applied before starting archive workers; transaction semantics enforced by app.
CREATE TABLE IF NOT EXISTS hc_archive_events (
 event_id TEXT PRIMARY KEY, player_id TEXT NOT NULL, issuer TEXT NOT NULL,
 objective_id TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS hc_archive_fragments (
 player_id TEXT NOT NULL, founder_id TEXT NOT NULL, fragment_id TEXT NOT NULL,
 event_id TEXT NOT NULL REFERENCES hc_archive_events(event_id),
 unlocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(player_id,fragment_id)
);
CREATE INDEX IF NOT EXISTS hc_archive_fragments_founder ON hc_archive_fragments(player_id,founder_id);
CREATE TABLE IF NOT EXISTS hc_archive_entitlements (
 player_id TEXT NOT NULL, entitlement_id TEXT NOT NULL,
 category TEXT NOT NULL, metadata JSONB NOT NULL,
 awarded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(player_id,entitlement_id)
);
REVOKE ALL ON hc_archive_events,hc_archive_fragments,hc_archive_entitlements FROM PUBLIC;
-- Grant only the designated backend worker limited DML separately, using deployment role grants.
