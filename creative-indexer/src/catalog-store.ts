import { readFile } from 'node:fs/promises';
import { Pool, type PoolClient } from 'pg';
import type { CanonicalEvent } from './types.js';

export interface CatalogTrackProjection {
  recordingId: string;
  position: number;
  workId: string | null;
  recordingClass: string | null;
}

export interface ReleasePublicPage {
  releaseId: string;
  creatorId: string;
  creatorAccount: string | null;
  creatorLabel: string | null;
  releaseType: string;
  metadataHash: string;
  artworkHash: string;
  createdAt: string;
  publishedAt: string;
  presentationRevision: string | null;
  presentationHash: string | null;
  discoverabilityHash: string | null;
  externalIdsHash: string | null;
  tracks: CatalogTrackProjection[];
}

export interface CreatorPublicPage {
  creatorId: string;
  account: string | null;
  label: string | null;
  presentationRevision: string | null;
  profileManifestHash: string | null;
  socialLinksHash: string | null;
  releases: Array<{
    releaseId: string;
    releaseType: string;
    metadataHash: string;
    artworkHash: string;
    publishedAt: string;
    presentationRevision: string | null;
    presentationHash: string | null;
    discoverabilityHash: string | null;
  }>;
}

export class CatalogProjectionStore420 {
  readonly pool: Pool;

  constructor(connectionString = process.env.DATABASE_URL ?? 'postgres://postgres:postgres@127.0.0.1:5432/creative_indexer') {
    this.pool = new Pool({ connectionString });
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  async applySchema(schemaPath = new URL('../sql/002_catalog.sql', import.meta.url)): Promise<void> {
    const sql = await readFile(schemaPath, 'utf8');
    await this.pool.query(sql);
  }

  async reset(): Promise<void> {
    await this.pool.query(`
      TRUNCATE TABLE
        release_presentations_current, release_presentation_revisions,
        creator_presentations_current, creator_presentation_revisions,
        catalog_release_tracks, catalog_releases
      RESTART IDENTITY CASCADE
    `);
  }

  async ingest(events: CanonicalEvent[]): Promise<void> {
    for (const event of events) {
      const client = await this.pool.connect();
      try {
        await client.query('BEGIN');
        const inserted = await client.query(
          `INSERT INTO event_journal
            (event_key, block_number, block_hash, tx_hash, log_index, module_key, event_type, payload)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
           ON CONFLICT (event_key) DO NOTHING
           RETURNING event_key`,
          [event.eventKey, event.blockNumber, event.blockHash, event.txHash, event.logIndex, event.moduleKey, event.eventType, JSON.stringify(event.payload)],
        );
        if (inserted.rowCount === 1) {
          await client.query(
            `INSERT INTO indexed_blocks(block_number, block_hash, canonical, finalized)
             VALUES ($1,$2,true,true)
             ON CONFLICT (block_number) DO UPDATE SET block_hash=EXCLUDED.block_hash, canonical=true, finalized=true`,
            [event.blockNumber, event.blockHash],
          );
          await this.project(client, event);
        }
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }
  }

  private async project(c: PoolClient, e: CanonicalEvent): Promise<void> {
    const p = e.payload;
    switch (e.eventType) {
      case 'RELEASE_CREATED':
        await c.query(
          `INSERT INTO catalog_releases
            (release_id, creator_id, release_type, status, metadata_hash, artwork_hash, created_at)
           VALUES($1,$2,$3,'DRAFT',$4,$5,$6)
           ON CONFLICT(release_id) DO NOTHING`,
          [p.releaseId, p.creatorId, p.releaseType, p.metadataHash, p.artworkHash, p.createdAt],
        );
        break;
      case 'RELEASE_METADATA_UPDATED':
        await this.requireUpdated(
          c,
          `UPDATE catalog_releases SET metadata_hash=$2, artwork_hash=$3 WHERE release_id=$1 AND status='DRAFT'`,
          [p.releaseId, p.metadataHash, p.artworkHash],
          'release metadata update',
        );
        break;
      case 'RELEASE_TRACK_ADDED':
        await c.query(
          `INSERT INTO catalog_release_tracks(release_id,recording_id,position)
           VALUES($1,$2,$3) ON CONFLICT(release_id,recording_id) DO NOTHING`,
          [p.releaseId, p.recordingId, p.position],
        );
        break;
      case 'RELEASE_TRACK_REMOVED': {
        const removed = await c.query<{ position: number }>(
          `DELETE FROM catalog_release_tracks WHERE release_id=$1 AND recording_id=$2 RETURNING position`,
          [p.releaseId, p.recordingId],
        );
        if (removed.rowCount !== 1) throw new Error('release track removal references unknown track');
        const position = removed.rows[0].position;
        await c.query(
          `UPDATE catalog_release_tracks SET position=-(position+1)
           WHERE release_id=$1 AND position>$2`,
          [p.releaseId, position],
        );
        await c.query(
          `UPDATE catalog_release_tracks SET position=(-position)-2
           WHERE release_id=$1 AND position<0`,
          [p.releaseId],
        );
        break;
      }
      case 'RELEASE_PUBLISHED':
        await this.requireUpdated(
          c,
          `UPDATE catalog_releases SET status='PUBLISHED', published_at=$2 WHERE release_id=$1 AND status='DRAFT'`,
          [p.releaseId, p.publishedAt],
          'release publication',
        );
        break;
      case 'RELEASE_WITHDRAWN':
        await this.requireUpdated(
          c,
          `UPDATE catalog_releases SET status='WITHDRAWN' WHERE release_id=$1 AND status='PUBLISHED'`,
          [p.releaseId],
          'release withdrawal',
        );
        break;
      case 'CREATOR_PRESENTATION_UPDATED':
        await c.query(
          `INSERT INTO creator_presentation_revisions
            (creator_id,revision,profile_manifest_hash,social_links_hash)
           VALUES($1,$2,$3,$4) ON CONFLICT(creator_id,revision) DO NOTHING`,
          [p.creatorId, p.revision, p.profileManifestHash, p.socialLinksHash],
        );
        await c.query(
          `INSERT INTO creator_presentations_current
            (creator_id,revision,profile_manifest_hash,social_links_hash)
           VALUES($1,$2,$3,$4)
           ON CONFLICT(creator_id) DO UPDATE SET
             revision=EXCLUDED.revision,
             profile_manifest_hash=EXCLUDED.profile_manifest_hash,
             social_links_hash=EXCLUDED.social_links_hash
           WHERE EXCLUDED.revision > creator_presentations_current.revision`,
          [p.creatorId, p.revision, p.profileManifestHash, p.socialLinksHash],
        );
        break;
      case 'RELEASE_PRESENTATION_UPDATED':
        await c.query(
          `INSERT INTO release_presentation_revisions
            (release_id,creator_id,revision,presentation_hash,discoverability_hash,external_ids_hash)
           VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(release_id,revision) DO NOTHING`,
          [p.releaseId, p.creatorId, p.revision, p.presentationHash, p.discoverabilityHash, p.externalIdsHash],
        );
        await c.query(
          `INSERT INTO release_presentations_current
            (release_id,creator_id,revision,presentation_hash,discoverability_hash,external_ids_hash)
           VALUES($1,$2,$3,$4,$5,$6)
           ON CONFLICT(release_id) DO UPDATE SET
             creator_id=EXCLUDED.creator_id,
             revision=EXCLUDED.revision,
             presentation_hash=EXCLUDED.presentation_hash,
             discoverability_hash=EXCLUDED.discoverability_hash,
             external_ids_hash=EXCLUDED.external_ids_hash
           WHERE EXCLUDED.revision > release_presentations_current.revision`,
          [p.releaseId, p.creatorId, p.revision, p.presentationHash, p.discoverabilityHash, p.externalIdsHash],
        );
        break;
      default:
        throw new Error(`unsupported catalog event ${e.eventType}`);
    }
  }

  private async requireUpdated(c: PoolClient, sql: string, values: unknown[], operation: string): Promise<void> {
    const result = await c.query(sql, values);
    if (result.rowCount !== 1) throw new Error(`${operation} violates canonical catalog lifecycle`);
  }

  async getReleasePublicPage(releaseId: number): Promise<ReleasePublicPage | null> {
    const release = await this.pool.query(
      `SELECT r.release_id, r.creator_id, cp.account AS creator_account, cp.label AS creator_label,
              r.release_type, r.metadata_hash, r.artwork_hash, r.created_at, r.published_at,
              rp.revision AS presentation_revision, rp.presentation_hash,
              rp.discoverability_hash, rp.external_ids_hash
       FROM catalog_releases r
       LEFT JOIN creator_profiles cp ON cp.creator_id=r.creator_id
       LEFT JOIN release_presentations_current rp ON rp.release_id=r.release_id
       WHERE r.release_id=$1 AND r.status='PUBLISHED'`,
      [releaseId],
    );
    if (release.rowCount !== 1) return null;
    const row = release.rows[0];
    const tracks = await this.pool.query(
      `SELECT t.recording_id, t.position, rec.work_id, rec.recording_class
       FROM catalog_release_tracks t
       LEFT JOIN recordings rec ON rec.recording_id=t.recording_id
       WHERE t.release_id=$1 ORDER BY t.position`,
      [releaseId],
    );
    return {
      releaseId: String(row.release_id),
      creatorId: String(row.creator_id),
      creatorAccount: row.creator_account ?? null,
      creatorLabel: row.creator_label ?? null,
      releaseType: String(row.release_type),
      metadataHash: String(row.metadata_hash),
      artworkHash: String(row.artwork_hash),
      createdAt: String(row.created_at),
      publishedAt: String(row.published_at),
      presentationRevision: row.presentation_revision == null ? null : String(row.presentation_revision),
      presentationHash: row.presentation_hash ?? null,
      discoverabilityHash: row.discoverability_hash ?? null,
      externalIdsHash: row.external_ids_hash ?? null,
      tracks: tracks.rows.map((track) => ({
        recordingId: String(track.recording_id),
        position: Number(track.position),
        workId: track.work_id == null ? null : String(track.work_id),
        recordingClass: track.recording_class ?? null,
      })),
    };
  }

  async getCreatorPublicPage(creatorId: number): Promise<CreatorPublicPage | null> {
    const creator = await this.pool.query(
      `SELECT cp.creator_id, cp.account, cp.label, pres.revision AS presentation_revision,
              pres.profile_manifest_hash, pres.social_links_hash
       FROM creator_profiles cp
       LEFT JOIN creator_presentations_current pres ON pres.creator_id=cp.creator_id
       WHERE cp.creator_id=$1`,
      [creatorId],
    );
    if (creator.rowCount !== 1) return null;
    const row = creator.rows[0];
    const releases = await this.listPublishedReleases(creatorId, 100);
    return {
      creatorId: String(row.creator_id),
      account: row.account ?? null,
      label: row.label ?? null,
      presentationRevision: row.presentation_revision == null ? null : String(row.presentation_revision),
      profileManifestHash: row.profile_manifest_hash ?? null,
      socialLinksHash: row.social_links_hash ?? null,
      releases,
    };
  }

  async listPublishedReleases(creatorId?: number, limit = 50): Promise<CreatorPublicPage['releases']> {
    const boundedLimit = Math.min(Math.max(limit, 1), 100);
    const result = await this.pool.query(
      `SELECT r.release_id, r.release_type, r.metadata_hash, r.artwork_hash, r.published_at,
              rp.revision AS presentation_revision, rp.presentation_hash, rp.discoverability_hash
       FROM catalog_releases r
       LEFT JOIN release_presentations_current rp ON rp.release_id=r.release_id
       WHERE r.status='PUBLISHED' AND ($1::bigint IS NULL OR r.creator_id=$1)
       ORDER BY r.published_at DESC, r.release_id DESC
       LIMIT $2`,
      [creatorId ?? null, boundedLimit],
    );
    return result.rows.map((release) => ({
      releaseId: String(release.release_id),
      releaseType: String(release.release_type),
      metadataHash: String(release.metadata_hash),
      artworkHash: String(release.artwork_hash),
      publishedAt: String(release.published_at),
      presentationRevision: release.presentation_revision == null ? null : String(release.presentation_revision),
      presentationHash: release.presentation_hash ?? null,
      discoverabilityHash: release.discoverability_hash ?? null,
    }));
  }
}
