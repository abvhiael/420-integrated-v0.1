import type { SqlExecutor420 } from './core-projections.js';
import type { QueryRow420 } from './query-service.js';

interface QueryResultLike420 { rows?: QueryRow420[]; }

function rows420(result: unknown): QueryRow420[] {
  if (!result || typeof result !== 'object') throw new Error('query executor returned invalid result');
  const rows = (result as QueryResultLike420).rows;
  if (!Array.isArray(rows)) throw new Error('query executor result missing rows');
  return rows;
}

function fields420(row: QueryRow420): Record<string, unknown> {
  const value = row.fields;
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Treasury event fields missing');
  return value as Record<string, unknown>;
}

function stringField420(fields: Record<string, unknown>, name: string): string {
  const value = fields[name];
  if (typeof value !== 'string' || value.length === 0) throw new Error('Treasury event field missing: ' + name);
  return value.toLowerCase();
}

function uintField420(fields: Record<string, unknown>, name: string): string {
  const value = fields[name];
  if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'bigint') {
    throw new Error('Treasury numeric event field missing: ' + name);
  }
  const text = String(value);
  if (!/^\d+$/.test(text)) throw new Error('Treasury numeric event field invalid: ' + name);
  return text;
}

function rowString420(row: QueryRow420, name: string): string {
  const value = row[name];
  if (typeof value !== 'string' || value.length === 0) throw new Error('Treasury projection provenance missing: ' + name);
  return value;
}

function rowInt420(row: QueryRow420, name: string): number {
  const value = row[name];
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return value;
  if (typeof value === 'string' && /^\d+$/.test(value)) return Number(value);
  throw new Error('Treasury projection position invalid: ' + name);
}

export interface TreasuryBudgetState420 {
  chainId: string;
  budgetId: string;
  vaultId: string;
  category: string;
  asset: string;
  ceiling: string;
  committed: string;
  executed: string;
  validFrom: string;
  validUntil: string;
  civicActionHash: string;
  metadataHash: string;
  blockNumber: string;
  blockHash: string;
  transactionHash: string;
  transactionIndex: number;
  logIndex: number;
  authoritative: false;
}

export interface TreasuryDisbursementState420 {
  chainId: string;
  disbursementId: string;
  budgetId: string;
  recipient: string;
  asset: string;
  amount: string;
  notBefore: string;
  expiresAt: string;
  civicActionHash: string;
  purposeHash: string;
  vaultReleaseHash: string | null;
  executor: string | null;
  state: 'SCHEDULED' | 'EXECUTED' | 'CANCELLED';
  blockNumber: string;
  blockHash: string;
  transactionHash: string;
  transactionIndex: number;
  logIndex: number;
  authoritative: false;
}

function provenance420(row: QueryRow420) {
  return {
    blockNumber: rowString420(row, 'block_number'),
    blockHash: rowString420(row, 'block_hash'),
    transactionHash: rowString420(row, 'tx_hash'),
    transactionIndex: rowInt420(row, 'tx_index'),
    logIndex: rowInt420(row, 'log_index')
  };
}

export async function treasuryBudgetState420(
  db: SqlExecutor420,
  chainId: bigint,
  budgetId: string
): Promise<TreasuryBudgetState420 | null> {
  const id = budgetId.trim().toLowerCase();
  if (!/^0x[0-9a-f]{64}$/.test(id)) throw new Error('Treasury budget id invalid');

  const result = await db.query(
    `select * from idx_protocol_events
     where chain_id = $1 and protocol = '420Treasury'
       and event_name in ('BudgetCreated','BudgetCommitmentChanged')
       and lower(fields->>'budgetId') = $2
     order by block_number asc, tx_index asc, log_index asc`,
    [chainId.toString(), id]
  );
  const rows = rows420(result);
  if (rows.length === 0) return null;

  const created = rows.filter((row) => row.event_name === 'BudgetCreated');
  if (created.length !== 1) throw new Error('Treasury budget creation history invalid');
  const baseFields = fields420(created[0]!);
  let committed = '0';
  let executed = '0';
  let latest = created[0]!;

  for (const row of rows) {
    if (row.event_name === 'BudgetCommitmentChanged') {
      const fields = fields420(row);
      committed = uintField420(fields, 'committed');
      executed = uintField420(fields, 'executed');
      if (BigInt(executed) > BigInt(committed)) throw new Error('Treasury indexed budget invariant violated');
      latest = row;
    } else if (row.event_name !== 'BudgetCreated') {
      throw new Error('unexpected Treasury budget event');
    }
  }

  const ceiling = uintField420(baseFields, 'ceiling');
  if (BigInt(committed) > BigInt(ceiling)) throw new Error('Treasury indexed budget ceiling violated');

  return {
    chainId: chainId.toString(),
    budgetId: stringField420(baseFields, 'budgetId'),
    vaultId: stringField420(baseFields, 'vaultId'),
    category: stringField420(baseFields, 'category'),
    asset: stringField420(baseFields, 'asset'),
    ceiling,
    committed,
    executed,
    validFrom: uintField420(baseFields, 'validFrom'),
    validUntil: uintField420(baseFields, 'validUntil'),
    civicActionHash: stringField420(baseFields, 'civicActionHash'),
    metadataHash: stringField420(baseFields, 'metadataHash'),
    ...provenance420(latest),
    authoritative: false
  };
}

export async function treasuryDisbursementState420(
  db: SqlExecutor420,
  chainId: bigint,
  disbursementId: string
): Promise<TreasuryDisbursementState420 | null> {
  const id = disbursementId.trim().toLowerCase();
  if (!/^0x[0-9a-f]{64}$/.test(id)) throw new Error('Treasury disbursement id invalid');

  const result = await db.query(
    `select * from idx_protocol_events
     where chain_id = $1 and protocol = '420Treasury'
       and event_name in ('DisbursementScheduled','DisbursementExecuted','DisbursementCancelled')
       and lower(fields->>'disbursementId') = $2
     order by block_number asc, tx_index asc, log_index asc`,
    [chainId.toString(), id]
  );
  const rows = rows420(result);
  if (rows.length === 0) return null;

  const scheduled = rows.filter((row) => row.event_name === 'DisbursementScheduled');
  if (scheduled.length !== 1) throw new Error('Treasury disbursement schedule history invalid');
  const baseFields = fields420(scheduled[0]!);
  let state: TreasuryDisbursementState420['state'] = 'SCHEDULED';
  let vaultReleaseHash: string | null = null;
  let executor: string | null = null;
  let latest = scheduled[0]!;

  for (const row of rows) {
    if (row.event_name === 'DisbursementScheduled') continue;
    if (state !== 'SCHEDULED') throw new Error('Treasury disbursement terminal replay detected');
    if (row.event_name === 'DisbursementExecuted') {
      const fields = fields420(row);
      vaultReleaseHash = stringField420(fields, 'vaultReleaseHash');
      if (/^0x0{64}$/.test(vaultReleaseHash)) throw new Error('Treasury executed disbursement missing Vault release commitment');
      executor = stringField420(fields, 'executor');
      state = 'EXECUTED';
      latest = row;
    } else if (row.event_name === 'DisbursementCancelled') {
      state = 'CANCELLED';
      latest = row;
    } else {
      throw new Error('unexpected Treasury disbursement event');
    }
  }

  return {
    chainId: chainId.toString(),
    disbursementId: stringField420(baseFields, 'disbursementId'),
    budgetId: stringField420(baseFields, 'budgetId'),
    recipient: stringField420(baseFields, 'recipient'),
    asset: stringField420(baseFields, 'asset'),
    amount: uintField420(baseFields, 'amount'),
    notBefore: uintField420(baseFields, 'notBefore'),
    expiresAt: uintField420(baseFields, 'expiresAt'),
    civicActionHash: stringField420(baseFields, 'civicActionHash'),
    purposeHash: stringField420(baseFields, 'purposeHash'),
    vaultReleaseHash,
    executor,
    state,
    ...provenance420(latest),
    authoritative: false
  };
}
