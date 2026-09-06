import { Pool } from 'pg';

export interface ReleaseDiscoveryCursor420 {
  publishedAt: string;
  releaseId: string;
}

export interface ReleaseDiscoveryQuery420 {
  creatorId?: number;
  releaseType?: string;
  recordingId?: number;
  workId?: number;
  cursor?: ReleaseDiscoveryCursor420;
  limit?: number;
}

export interface ReleaseDiscoveryItem420 {
  releaseId: string;
  creatorId: string;
  creatorLabel: string | null;
  releaseType: string;
  metadataHash: string;
  artworkHash: string;
  publishedAt: string;
  presentationRevision: string | null;
  presentationHash: string | null;
  discoverabilityHash: string | null;
}

export interface ReleaseDiscoveryPage420 {
  items: ReleaseDiscoveryItem420[];
  nextCursor: ReleaseDiscoveryCursor420 | null;
}

export interface CreatorSearchItem420 {
  creatorId: string;
  account: string | null;
  label: string | null;
  presentationRevision: string | null;
  profileManifestHash: string | null;
}

export class DiscoveryProjectionStore420 {
  readonly pool: Pool;

  constructor(connectionString = process.env.DATABASE_URL ?? 'postgres://postgres:postgres@127.0.0.1:5432/creative_indexer') {
    this.pool = new Pool({ connectionString });
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  async discoverPublishedReleases(query: ReleaseDiscoveryQuery420 = {}): Promise<ReleaseDiscoveryPage420> {
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 100);
    const fetchLimit = limit + 1;
    const cursorPublishedAt = query.cursor?.publishedAt ?? null;
    const cursorReleaseId = query.cursor?.releaseId ?? null;

    const result = await this.pool.query(
      `SELECT DISTINCT
          r.release_id,
          r.creator_id,
          cp.label AS creator_label,
          r.release_type,
          r.metadata_hash,
          r.artwork_hash,
          r.published_at,
          rp.revision AS presentation_revision,
          rp.presentation_hash,
          rp.discoverability_hash
       FROM catalog_releases r
       LEFT JOIN creator_profiles cp ON cp.creator_id=r.creator_id
       LEFT JOIN release_presentations_current rp ON rp.release_id=r.release_id
       WHERE r.status='PUBLISHED'
         AND ($1::bigint IS NULL OR r.creator_id=$1)
         AND ($2::text IS NULL OR r.release_type=$2)
         AND (
           $3::bigint IS NULL OR EXISTS (
             SELECT 1 FROM catalog_release_tracks t
             WHERE t.release_id=r.release_id AND t.recording_id=$3
           )
         )
         AND (
           $4::bigint IS NULL OR EXISTS (
             SELECT 1
             FROM catalog_release_tracks t
             JOIN recordings rec ON rec.recording_id=t.recording_id
             WHERE t.release_id=r.release_id AND rec.work_id=$4
           )
         )
         AND (
           $5::bigint IS NULL OR $6::bigint IS NULL OR
           (r.published_at, r.release_id) < ($5::bigint, $6::bigint)
         )
       ORDER BY r.published_at DESC, r.release_id DESC
       LIMIT $7`,
      [
        query.creatorId ?? null,
        query.releaseType ?? null,
        query.recordingId ?? null,
        query.workId ?? null,
        cursorPublishedAt,
        cursorReleaseId,
        fetchLimit,
      ],
    );

    const hasMore = result.rows.length > limit;
    const visibleRows = result.rows.slice(0, limit);
    const items = visibleRows.map((row) => ({
      releaseId: String(row.release_id),
      creatorId: String(row.creator_id),
      creatorLabel: row.creator_label ?? null,
      releaseType: String(row.release_type),
      metadataHash: String(row.metadata_hash),
      artworkHash: String(row.artwork_hash),
      publishedAt: String(row.published_at),
      presentationRevision: row.presentation_revision == null ? null : String(row.presentation_revision),
      presentationHash: row.presentation_hash ?? null,
      discoverabilityHash: row.discoverability_hash ?? null,
    }));

    const last = hasMore ? items.at(-1) : null;
    return {
      items,
      nextCursor: last == null ? null : { publishedAt: last.publishedAt, releaseId: last.releaseId },
    };
  }

  async searchCreators(query: string, limit = 20): Promise<CreatorSearchItem420[]> {
    const normalized = query.trim();
    if (normalized.length === 0) return [];
    const boundedLimit = Math.min(Math.max(limit, 1), 50);
    const result = await this.pool.query(
      `SELECT cp.creator_id, cp.account, cp.label,
              pres.revision AS presentation_revision,
              pres.profile_manifest_hash
       FROM creator_profiles cp
       LEFT JOIN creator_presentations_current pres ON pres.creator_id=cp.creator_id
       WHERE cp.label ILIKE '%' || $1 || '%'
          OR cp.account ILIKE '%' || $1 || '%'
       ORDER BY lower(coalesce(cp.label,'')), cp.creator_id
       LIMIT $2`,
      [normalized, boundedLimit],
    );
    return result.rows.map((row) => ({
      creatorId: String(row.creator_id),
      account: row.account ?? null,
      label: row.label ?? null,
      presentationRevision: row.presentation_revision == null ? null : String(row.presentation_revision),
      profileManifestHash: row.profile_manifest_hash ?? null,
    }));
  }
}
