BEGIN;

CREATE TABLE IF NOT EXISTS catalog_releases (
  release_id BIGINT PRIMARY KEY,
  creator_id BIGINT NOT NULL,
  release_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  metadata_hash TEXT NOT NULL,
  artwork_hash TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  published_at BIGINT
);

CREATE INDEX IF NOT EXISTS catalog_releases_creator_status_idx
  ON catalog_releases (creator_id, status, published_at DESC, release_id DESC);

CREATE TABLE IF NOT EXISTS catalog_release_tracks (
  release_id BIGINT NOT NULL REFERENCES catalog_releases(release_id) ON DELETE CASCADE,
  recording_id BIGINT NOT NULL,
  position INTEGER NOT NULL CHECK (position >= 0),
  PRIMARY KEY (release_id, recording_id),
  UNIQUE (release_id, position)
);

CREATE TABLE IF NOT EXISTS creator_presentation_revisions (
  creator_id BIGINT NOT NULL,
  revision BIGINT NOT NULL CHECK (revision > 0),
  profile_manifest_hash TEXT NOT NULL,
  social_links_hash TEXT NOT NULL,
  PRIMARY KEY (creator_id, revision)
);

CREATE TABLE IF NOT EXISTS creator_presentations_current (
  creator_id BIGINT PRIMARY KEY,
  revision BIGINT NOT NULL CHECK (revision > 0),
  profile_manifest_hash TEXT NOT NULL,
  social_links_hash TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS release_presentation_revisions (
  release_id BIGINT NOT NULL REFERENCES catalog_releases(release_id) ON DELETE CASCADE,
  creator_id BIGINT NOT NULL,
  revision BIGINT NOT NULL CHECK (revision > 0),
  presentation_hash TEXT NOT NULL,
  discoverability_hash TEXT NOT NULL,
  external_ids_hash TEXT NOT NULL,
  PRIMARY KEY (release_id, revision)
);

CREATE TABLE IF NOT EXISTS release_presentations_current (
  release_id BIGINT PRIMARY KEY REFERENCES catalog_releases(release_id) ON DELETE CASCADE,
  creator_id BIGINT NOT NULL,
  revision BIGINT NOT NULL CHECK (revision > 0),
  presentation_hash TEXT NOT NULL,
  discoverability_hash TEXT NOT NULL,
  external_ids_hash TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS release_presentations_creator_idx
  ON release_presentations_current (creator_id, release_id);

COMMIT;
