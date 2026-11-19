import { AbiCoder, id as hashText, keccak256 } from 'ethers';
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
  const width = ['asset','recipient','executor'].includes(name) ? 40 : 64;
  if (!(width === 40 ? /^0x[0-9a-fA-F]{40}$/ : /^0x[0-9a-fA-F]{64}$/).test(value)) throw new Error('Treasury event field invalid: ' + name);
  return value.toLowerCase();
}

function uintField420(fields: Record<string, unknown>, name: string): string {
  const value = fields[name];
  if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'bigint') {
    throw new Error('Treasury numeric event field missing: ' + name);
  }
  const text = String(value);
  const width = name === 'revision' ? 32 : ['validFrom','validUntil','notBefore','expiresAt','epochSeconds'].includes(name) ? 64 : 128;
  if ((typeof value === 'number' && !Number.isSafeInteger(value)) || !/^(0|[1-9]\d*)$/.test(text) || BigInt(text) >= (1n << BigInt(width))) throw new Error('Treasury numeric event field invalid: ' + name);
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
  if (typeof value === 'string' && /^\d+$/.test(value) && Number.isSafeInteger(Number(value))) return Number(value);
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
  if (!/^(0|[1-9]\d*)$/.test(rowString420(row, 'block_number')) || !/^0x[0-9a-fA-F]{64}$/.test(rowString420(row, 'block_hash')) || !/^0x[0-9a-fA-F]{64}$/.test(rowString420(row, 'tx_hash'))) throw new Error('Treasury projection provenance invalid');
  return {
    blockNumber: rowString420(row, 'block_number'),
    blockHash: rowString420(row, 'block_hash'),
    transactionHash: rowString420(row, 'tx_hash'),
    transactionIndex: rowInt420(row, 'tx_index'),
    logIndex: rowInt420(row, 'log_index')
  };
}

// SQL ordering alone cannot establish that a history is internally consistent.
function validateHistory420(rows: QueryRow420[], chainId: bigint, key: string, id: string): void {
  let previous: ReturnType<typeof provenance420> | undefined;
  let contract: string | undefined;
  const positions = new Set<string>();
  const transactions = new Map<string, string>();
  for (const row of rows) {
    if (String(row.chain_id) !== chainId.toString() || row.protocol !== '420Treasury' || stringField420(fields420(row), key) !== id) throw new Error('Treasury history identity mismatch');
    const address = rowString420(row, 'contract_address').toLowerCase();
    if (!/^0x[0-9a-f]{40}$/.test(address) || /^0x0{40}$/.test(address) || (contract !== undefined && contract !== address)) throw new Error('Treasury history contract mismatch');
    contract = address;
    const current = provenance420(row);
    const position = current.blockNumber + ':' + current.logIndex;
    if (positions.has(position)) throw new Error('Treasury duplicate event position');
    positions.add(position);
    const txKey = current.blockNumber + ':' + current.transactionIndex;
    const txHash = current.transactionHash.toLowerCase();
    if (transactions.has(txKey) && transactions.get(txKey) !== txHash) throw new Error('Treasury history transaction mismatch');
    transactions.set(txKey, txHash);
    if (previous && (BigInt(current.blockNumber) < BigInt(previous.blockNumber) ||
      (current.blockNumber === previous.blockNumber && (current.blockHash.toLowerCase() !== previous.blockHash.toLowerCase() || current.transactionIndex < previous.transactionIndex || current.logIndex <= previous.logIndex)))) throw new Error('Treasury history position mismatch');
    previous = current;
  }
}

export interface TreasuryAssetPolicyState420 {
  chainId: string;
  asset: string;
  allowed: boolean;
  maxSingleDisbursement: string;
  maxEpochDisbursement: string;
  epochSeconds: string;
  revision: string;
  blockNumber: string;
  blockHash: string;
  transactionHash: string;
  transactionIndex: number;
  logIndex: number;
  authoritative: false;
}

export async function treasuryAssetPolicyState420(db: SqlExecutor420, chainId: bigint, asset: string): Promise<TreasuryAssetPolicyState420 | null> {
  const id = asset.trim().toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(id)) throw new Error('Treasury asset address invalid');
  const rows = rows420(await db.query(
    `select * from idx_protocol_events where chain_id = $1 and protocol = '420Treasury'
       and event_name = 'AssetPolicySet' and lower(fields->>'asset') = $2
     order by block_number asc, tx_index asc, log_index asc`, [chainId.toString(), id]));
  if (!rows.length) return null;
  validateHistory420(rows, chainId, 'asset', id);
  let state: TreasuryAssetPolicyState420 | null = null;
  for (const row of rows) {
    const fields = fields420(row);
    const allowed = fields.allowed;
    const maxSingleDisbursement = uintField420(fields, 'maxSingleDisbursement');
    const maxEpochDisbursement = uintField420(fields, 'maxEpochDisbursement');
    const epochSeconds = uintField420(fields, 'epochSeconds');
    const revision = uintField420(fields, 'revision');
    if (row.event_name !== 'AssetPolicySet' || typeof allowed !== 'boolean' || BigInt(maxSingleDisbursement) === 0n ||
        BigInt(maxEpochDisbursement) < BigInt(maxSingleDisbursement) || BigInt(epochSeconds) === 0n ||
        BigInt(revision) !== (state ? BigInt(state.revision) + 1n : 1n) || (state && state.epochSeconds !== epochSeconds)) throw new Error('Treasury asset policy history invalid');
    state = { chainId: chainId.toString(), asset: id, allowed, maxSingleDisbursement, maxEpochDisbursement, epochSeconds, revision, ...provenance420(row), authoritative: false };
  }
  return state;
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

  validateHistory420(rows, chainId, 'budgetId', id);
  const created = rows.filter((row) => row.event_name === 'BudgetCreated');
  if (created.length !== 1 || rows[0] !== created[0]) throw new Error('Treasury budget creation history invalid');
  const baseFields = fields420(created[0]!);
  const ceiling = uintField420(baseFields, 'ceiling');
  if (BigInt(ceiling) === 0n || BigInt(uintField420(baseFields, 'validUntil')) <= BigInt(uintField420(baseFields, 'validFrom')) || ['budgetId','vaultId','category','civicActionHash'].some(name => /^0x0{64}$/.test(stringField420(baseFields, name)))) throw new Error('Treasury budget creation invalid');
  let committed = '0';
  let executed = '0';
  let latest = created[0]!;

  for (const row of rows) {
    if (row.event_name === 'BudgetCommitmentChanged') {
      const fields = fields420(row);
      const nextCommitted = uintField420(fields, 'committed');
      const nextExecuted = uintField420(fields, 'executed');
      if (BigInt(nextExecuted) < BigInt(executed) || (nextExecuted !== executed && nextCommitted !== committed)) throw new Error('Treasury indexed budget transition invalid');
      committed = nextCommitted;
      executed = nextExecuted;
      if (BigInt(committed) > BigInt(ceiling)) throw new Error('Treasury indexed budget ceiling violated');
      if (BigInt(executed) > BigInt(committed)) throw new Error('Treasury indexed budget invariant violated');
      latest = row;
    } else if (row.event_name !== 'BudgetCreated') {
      throw new Error('unexpected Treasury budget event');
    }
  }


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

export function treasuryCanonicalDisbursementId420(fields: Record<string,unknown>): string {
  return keccak256(AbiCoder.defaultAbiCoder().encode(
    ['bytes32','bytes32','address','uint128','uint64','uint64','bytes32','bytes32'],
    [hashText('420/TREASURY/DISBURSEMENT/V1'),stringField420(fields,'budgetId'),stringField420(fields,'recipient'),uintField420(fields,'amount'),uintField420(fields,'notBefore'),uintField420(fields,'expiresAt'),stringField420(fields,'civicActionHash'),stringField420(fields,'purposeHash')]));
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

  validateHistory420(rows, chainId, 'disbursementId', id);
  const scheduled = rows.filter((row) => row.event_name === 'DisbursementScheduled');
  if (scheduled.length !== 1 || rows[0] !== scheduled[0]) throw new Error('Treasury disbursement schedule history invalid');
  const baseFields = fields420(scheduled[0]!);
  if (BigInt(uintField420(baseFields, 'amount')) === 0n || BigInt(uintField420(baseFields, 'expiresAt')) <= BigInt(uintField420(baseFields, 'notBefore')) || ['disbursementId','budgetId','civicActionHash','purposeHash'].some(name => /^0x0{64}$/.test(stringField420(baseFields, name))) || /^0x0{40}$/.test(stringField420(baseFields, 'recipient'))) throw new Error('Treasury disbursement schedule invalid');
  if (treasuryCanonicalDisbursementId420(baseFields) !== id) throw new Error('Treasury canonical disbursement id mismatch');
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
      if (/^0x0{40}$/.test(executor)) throw new Error('Treasury executor invalid');
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
