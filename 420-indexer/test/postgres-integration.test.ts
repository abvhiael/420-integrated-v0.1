import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { SqlExecutor420 } from '../src/core-projections.js';
import { IndexerQueryService420 } from '../src/query-service.js';

const execFileAsync = promisify(execFile);
const databaseUrl = process.env.INDEXER_PG_URL;

function sqlLiteral(value: unknown): string {
  if (typeof value === 'number' || typeof value === 'bigint') return String(value);
  if (typeof value === 'string' && /^\d+$/.test(value)) return value;
  if (value === null || value === undefined) return 'null';
  return `'${String(value).replaceAll("'", "''")}'`;
}

function bind(sql: string, params: readonly unknown[] = []): string {
  return sql.replace(/\$(\d+)/g, (_match, index: string) => {
    const value = params[Number(index) - 1];
    if (value === undefined) throw new Error(`missing SQL parameter $${index}`);
    return sqlLiteral(value);
  });
}

class PsqlExecutor420 implements SqlExecutor420 {
  constructor(readonly url: string) {}
  async query(sql: string, params?: readonly unknown[]): Promise<unknown> {
    const rendered = bind(sql, params);
    const wrapped = `select coalesce(json_agg(row_to_json(q)),'[]'::json) from (${rendered.replace(/;\s*$/, '')}) q;`;
    const { stdout } = await execFileAsync('psql', [this.url, '-X', '-A', '-t', '-c', wrapped], { maxBuffer: 4 * 1024 * 1024 });
    return { rows: JSON.parse(stdout.trim() || '[]') as Record<string, unknown>[] };
  }
}

async function psql(sql: string): Promise<void> {
  await execFileAsync('psql', [databaseUrl!, '-X', '-v', 'ON_ERROR_STOP=1', '-c', sql], { maxBuffer: 4 * 1024 * 1024 });
}

test('query service executes keyset pages and routed lookups against PostgreSQL', { skip: !databaseUrl }, async () => {
  const sqlDir = fileURLToPath(new URL('../sql/', import.meta.url));
  for (const file of ['001-core-projections.sql', '002-asset-projections.sql', '003-genesis-projections.sql', '005-genesis-state-views.sql', '006-query-indexes.sql']) {
    await psql(await readFile(`${sqlDir}${file}`, 'utf8'));
  }

  await psql(`
    truncate idx_blocks, idx_transactions, idx_addresses, idx_receipts, idx_logs, idx_asset_transfers, idx_asset_balances, idx_assets, idx_protocol_events restart identity cascade;
    insert into idx_blocks(chain_id,block_number,block_hash,parent_hash,block_timestamp) values
      (420,10,'0x10','0x09',1700000010),(420,9,'0x09','0x08',1700000009),(420,8,'0x08','0x07',1700000008);
    insert into idx_addresses(chain_id,address,is_contract) values (420,'0x1111111111111111111111111111111111111111',false);
    insert into idx_transactions(chain_id,tx_hash,block_number,block_hash,tx_index,from_address,to_address,value_wei,input) values
      (420,'0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',10,'0x10',1,'0x1111111111111111111111111111111111111111',null,42,'0x');
    insert into idx_asset_transfers(chain_id,block_number,tx_hash,log_index,asset_key,asset_kind,contract_address,token_id,from_address,to_address,amount) values
      (420,10,'0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',2,'native:420','native',null,null,'0x1111111111111111111111111111111111111111','0x2222222222222222222222222222222222222222',42),
      (420,9,'0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',null,'native:420','native',null,null,'0x2222222222222222222222222222222222222222','0x1111111111111111111111111111111111111111',7);
    insert into idx_protocol_events(chain_id,block_number,block_hash,tx_hash,tx_index,log_index,contract_address,protocol,event_name,fields)
      values (420,10,'0x10','0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',1,3,'0x0437','420Governance','ProposalCreated','{"proposalId":"0xabc"}');
  `);

  const service = new IndexerQueryService420(new PsqlExecutor420(databaseUrl!));
  const firstBlocks = await service.blocks(420n, { limit: 2 });
  assert.equal(firstBlocks.items.length, 2);
  assert.ok(firstBlocks.nextCursor);
  const secondBlocks = await service.blocks(420n, { limit: 2, cursor: firstBlocks.nextCursor! });
  assert.equal(secondBlocks.items.length, 1);
  assert.equal(secondBlocks.items[0]!.block_number, 8);

  const transfers = await service.assetTransfers(420n, { limit: 1 });
  assert.equal(transfers.items.length, 1);
  assert.ok(transfers.nextCursor);
  const transferTail = await service.assetTransfers(420n, { limit: 1, cursor: transfers.nextCursor! });
  assert.equal(transferTail.items.length, 1);

  const addressResults = await service.search(420n, '0x1111111111111111111111111111111111111111');
  assert.equal(addressResults[0]!.result_type, 'address');
  const txResults = await service.search(420n, '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
  assert.equal(txResults.some((row) => row.result_type === 'transaction'), true);
});
