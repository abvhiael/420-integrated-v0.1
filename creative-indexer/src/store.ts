import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import type { CanonicalEvent } from './types.js';

export class CreativeIndexerStore {
  readonly pool: Pool;

  constructor(connectionString = process.env.DATABASE_URL ?? 'postgres://postgres:postgres@127.0.0.1:5432/creative_indexer') {
    this.pool = new Pool({ connectionString });
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  async applySchema(schemaPath = new URL('../sql/001_initial.sql', import.meta.url)): Promise<void> {
    const sql = await readFile(schemaPath, 'utf8');
    await this.pool.query(sql);
  }

  async reset(): Promise<void> {
    await this.pool.query(`
      TRUNCATE TABLE
        projection_meta, settlements, royalty_balances, royalty_pools,
        rights_transfers, licenses, contributor_credits, rights_shares,
        rights_versions, recordings, works, creator_profiles,
        protocol_modules, event_journal, indexed_blocks
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
      case 'MODULE_REGISTERED':
        await c.query(
          `INSERT INTO protocol_modules(module_key,module_address,version,lifecycle)
           VALUES($1,$2,$3,'ACTIVE')
           ON CONFLICT(module_key) DO UPDATE SET module_address=EXCLUDED.module_address, version=EXCLUDED.version`,
          [p.moduleKey, p.address, p.version],
        );
        break;
      case 'CREATOR_CREATED':
        await c.query(
          `INSERT INTO creator_profiles(creator_id,account,label) VALUES($1,$2,$3)
           ON CONFLICT(creator_id) DO UPDATE SET account=EXCLUDED.account,label=EXCLUDED.label`,
          [p.creatorId, p.account, p.label],
        );
        break;
      case 'WORK_REGISTERED':
        await c.query(`INSERT INTO works(work_id,rights_version) VALUES($1,$2) ON CONFLICT(work_id) DO NOTHING`, [p.workId, p.rightsVersion]);
        break;
      case 'RECORDING_REGISTERED':
        await c.query(
          `INSERT INTO recordings(recording_id,work_id,recording_class,parent_recording_id,rights_version)
           VALUES($1,$2,$3,$4,$5) ON CONFLICT(recording_id) DO NOTHING`,
          [p.recordingId, p.workId, p.recordingClass, p.parentRecordingId, p.rightsVersion],
        );
        break;
      case 'RIGHTS_VERSION_SET': {
        const assetType = String(p.assetType);
        const assetId = Number(p.assetId);
        const rightsVersion = Number(p.rightsVersion);
        await c.query(
          `INSERT INTO rights_versions(asset_type,asset_id,rights_version) VALUES($1,$2,$3) ON CONFLICT DO NOTHING`,
          [assetType, assetId, rightsVersion],
        );
        const shares = JSON.parse(String(p.shares)) as Array<[number, number]>;
        for (const [creatorId, bps] of shares) {
          await c.query(
            `INSERT INTO rights_shares(asset_type,asset_id,rights_version,creator_id,bps)
             VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,
            [assetType, assetId, rightsVersion, creatorId, bps],
          );
        }
        if (assetType === 'WORK') {
          await c.query(`UPDATE works SET rights_version=$2 WHERE work_id=$1`, [assetId, rightsVersion]);
        } else if (assetType === 'RECORDING') {
          await c.query(`UPDATE recordings SET rights_version=$2 WHERE recording_id=$1`, [assetId, rightsVersion]);
        }
        break;
      }
      case 'CREDIT_ACCEPTED':
        await c.query(
          `INSERT INTO contributor_credits(credit_id,asset_type,asset_id,creator_id,status)
           VALUES($1,$2,$3,$4,'ACCEPTED') ON CONFLICT(credit_id) DO NOTHING`,
          [p.creditId, p.assetType, p.assetId, p.creatorId],
        );
        break;
      case 'LICENSE_ISSUED':
        await c.query(
          `INSERT INTO licenses(license_id,offer_id,recording_id,licensee_creator_id,status)
           VALUES($1,$2,$3,$4,$5) ON CONFLICT(license_id) DO NOTHING`,
          [p.licenseId, p.offerId, p.recordingId, p.licenseeCreatorId, p.status],
        );
        break;
      case 'RIGHTS_TRANSFER_ACCEPTED':
        await c.query(
          `INSERT INTO rights_transfers(transfer_id,asset_type,asset_id,from_creator_id,to_creator_id,bps,resulting_rights_version)
           VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(transfer_id) DO NOTHING`,
          [p.transferId, p.assetType, p.assetId, p.fromCreatorId, p.toCreatorId, p.bps, p.resultingRightsVersion],
        );
        break;
      case 'ROYALTY_SETTLED':
        await c.query(
          `INSERT INTO settlements(settlement_id,revenue_type,recording_id,gross_wei)
           VALUES($1,$2,$3,$4) ON CONFLICT(settlement_id) DO NOTHING`,
          [p.settlementId, p.revenueType, p.recordingId, p.grossWei],
        );
        break;
      case 'FIXTURE_ECONOMICS_FINALIZED':
        await this.projectFixtureEconomics(c, p);
        break;
      default:
        throw new Error(`unsupported canonical event ${e.eventType}`);
    }
  }

  private async projectFixtureEconomics(c: PoolClient, p: CanonicalEvent['payload']): Promise<void> {
    const workId = 1;
    const originalId = 1;
    const remixId = 2;
    await c.query(`INSERT INTO royalty_pools(asset_type,asset_id,total_received_wei) VALUES('WORK',$1,$2) ON CONFLICT(asset_type,asset_id) DO UPDATE SET total_received_wei=EXCLUDED.total_received_wei`, [workId, p.workPoolWei]);
    await c.query(`INSERT INTO royalty_pools(asset_type,asset_id,total_received_wei) VALUES('RECORDING',$1,$2) ON CONFLICT(asset_type,asset_id) DO UPDATE SET total_received_wei=EXCLUDED.total_received_wei`, [originalId, p.originalPoolWei]);
    await c.query(`INSERT INTO royalty_pools(asset_type,asset_id,total_received_wei) VALUES('RECORDING',$1,$2) ON CONFLICT(asset_type,asset_id) DO UPDATE SET total_received_wei=EXCLUDED.total_received_wei`, [remixId, p.remixPoolWei]);
    const balances: Array<[string, number, number, string | number | null | undefined]> = [
      ['WORK', workId, 1, p.aliceWorkWei], ['WORK', workId, 2, p.bobWorkWei],
      ['RECORDING', originalId, 1, p.aliceOriginalWei], ['RECORDING', originalId, 4, p.producerOriginalWei],
      ['RECORDING', originalId, 3, p.carolOriginalWei], ['RECORDING', remixId, 5, p.remixerRemixWei],
      ['RECORDING', remixId, 3, p.carolRemixWei],
    ];
    for (const [assetType, assetId, creatorId, amount] of balances) {
      await c.query(
        `INSERT INTO royalty_balances(asset_type,asset_id,creator_id,claimable_wei) VALUES($1,$2,$3,$4)
         ON CONFLICT(asset_type,asset_id,creator_id) DO UPDATE SET claimable_wei=EXCLUDED.claimable_wei`,
        [assetType, assetId, creatorId, amount],
      );
    }
    await c.query(`INSERT INTO projection_meta(key,value) VALUES('treasuryWei',$1) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value`, [p.treasuryWei]);
    await c.query(`INSERT INTO projection_meta(key,value) VALUES('vaultBalanceWei',$1) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value`, [p.vaultBalanceWei]);
  }

  async digest(): Promise<string> {
    const tables: Array<[string, string]> = [
      ['protocol_modules', 'module_key'],
      ['creator_profiles', 'creator_id'],
      ['works', 'work_id'],
      ['recordings', 'recording_id'],
      ['rights_versions', 'asset_type, asset_id, rights_version'],
      ['rights_shares', 'asset_type, asset_id, rights_version, creator_id'],
      ['contributor_credits', 'credit_id'],
      ['licenses', 'license_id'],
      ['rights_transfers', 'transfer_id'],
      ['royalty_pools', 'asset_type, asset_id'],
      ['royalty_balances', 'asset_type, asset_id, creator_id'],
      ['settlements', 'settlement_id'],
      ['projection_meta', 'key'],
    ];
    const canonical: Record<string, unknown[]> = {};
    for (const [table, orderBy] of tables) {
      const result = await this.pool.query(`SELECT * FROM ${table} ORDER BY ${orderBy}`);
      canonical[table] = result.rows;
    }
    const json = JSON.stringify(canonical, (_key, value) => typeof value === 'bigint' ? value.toString() : value);
    return createHash('sha256').update(json).digest('hex');
  }
}
