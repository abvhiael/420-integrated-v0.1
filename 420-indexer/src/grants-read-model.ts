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
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Grants event fields missing');
  return value as Record<string, unknown>;
}

function stringField420(fields: Record<string, unknown>, name: string): string {
  const value = fields[name];
  if (typeof value !== 'string' || value.length === 0) throw new Error('Grants event field missing: ' + name);
  return value.toLowerCase();
}

function uintField420(fields: Record<string, unknown>, name: string): string {
  const value = fields[name];
  if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'bigint') {
    throw new Error('Grants numeric event field missing: ' + name);
  }
  const text = String(value);
  if (!/^\d+$/.test(text)) throw new Error('Grants numeric event field invalid: ' + name);
  return text;
}

function boolField420(fields: Record<string, unknown>, name: string): boolean {
  const value = fields[name];
  if (typeof value !== 'boolean') throw new Error('Grants boolean event field missing: ' + name);
  return value;
}

function rowString420(row: QueryRow420, name: string): string {
  const value = row[name];
  if (typeof value !== 'string' || value.length === 0) throw new Error('Grants projection provenance missing: ' + name);
  return value;
}

function rowInt420(row: QueryRow420, name: string): number {
  const value = row[name];
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return value;
  if (typeof value === 'string' && /^\d+$/.test(value)) return Number(value);
  throw new Error('Grants projection position invalid: ' + name);
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

function bytes32Id420(value: string, label: string): string {
  const id = value.trim().toLowerCase();
  if (!/^0x[0-9a-f]{64}$/.test(id)) throw new Error(`Grants ${label} invalid`);
  return id;
}

export interface GrantsProgramState420 {
  chainId: string;
  programId: string;
  treasuryBudgetId: string;
  programType: string;
  totalCap: string;
  maxAward: string;
  opensAt: string;
  closesAt: string;
  civicActionHash: string;
  awarded: string;
  active: boolean;
  blockNumber: string;
  blockHash: string;
  transactionHash: string;
  transactionIndex: number;
  logIndex: number;
  authoritative: false;
}

export interface GrantsApplicationState420 {
  chainId: string;
  applicationId: string;
  programId: string;
  applicant: string;
  requestedAmount: string;
  contentHash: string;
  blockNumber: string;
  blockHash: string;
  transactionHash: string;
  transactionIndex: number;
  logIndex: number;
  authoritative: false;
}

export interface GrantsAwardState420 {
  chainId: string;
  awardId: string;
  programId: string;
  applicationId: string;
  recipient: string;
  amount: string;
  termsHash: string;
  state: 'ACTIVE' | 'CANCELLED' | 'COMPLETED';
  blockNumber: string;
  blockHash: string;
  transactionHash: string;
  transactionIndex: number;
  logIndex: number;
  authoritative: false;
}

export interface GrantsMilestoneState420 {
  chainId: string;
  milestoneId: string;
  awardId: string;
  amount: string;
  purposeHash: string;
  claimHash: string | null;
  claimSubmitter: string | null;
  treasuryDisbursementId: string | null;
  state: 'PENDING' | 'CLAIMED' | 'APPROVED' | 'PAID' | 'CANCELLED';
  blockNumber: string;
  blockHash: string;
  transactionHash: string;
  transactionIndex: number;
  logIndex: number;
  authoritative: false;
}

export async function grantsProgramState420(
  db: SqlExecutor420,
  chainId: bigint,
  programId: string
): Promise<GrantsProgramState420 | null> {
  const id = bytes32Id420(programId, 'program id');
  const result = await db.query(
    `select * from idx_protocol_events
     where chain_id = $1 and protocol = '420Grants'
       and event_name in ('ProgramCreated','ProgramActiveChanged','ProgramAwardedChanged')
       and lower(fields->>'programId') = $2
     order by block_number asc, tx_index asc, log_index asc`,
    [chainId.toString(), id]
  );
  const rows = rows420(result);
  if (rows.length === 0) return null;

  const created = rows.filter((row) => row.event_name === 'ProgramCreated');
  if (created.length !== 1) throw new Error('Grants program creation history invalid');
  const base = fields420(created[0]!);
  let active = true;
  let awarded = '0';
  let latest = created[0]!;
  for (const row of rows) {
    if (row.event_name === 'ProgramCreated') continue;
    const fields = fields420(row);
    if (row.event_name === 'ProgramActiveChanged') active = boolField420(fields, 'active');
    else if (row.event_name === 'ProgramAwardedChanged') {
      awarded = uintField420(fields, 'awarded');
      if (BigInt(awarded) > BigInt(uintField420(base, 'totalCap'))) {
        throw new Error('Grants indexed program cap invariant violated');
      }
    } else throw new Error('unexpected Grants program event');
    latest = row;
  }

  return {
    chainId: chainId.toString(),
    programId: stringField420(base, 'programId'),
    treasuryBudgetId: stringField420(base, 'treasuryBudgetId'),
    programType: stringField420(base, 'programType'),
    totalCap: uintField420(base, 'totalCap'),
    maxAward: uintField420(base, 'maxAward'),
    opensAt: uintField420(base, 'opensAt'),
    closesAt: uintField420(base, 'closesAt'),
    civicActionHash: stringField420(base, 'civicActionHash'),
    awarded,
    active,
    ...provenance420(latest),
    authoritative: false
  };
}

export async function grantsApplicationState420(
  db: SqlExecutor420,
  chainId: bigint,
  applicationId: string
): Promise<GrantsApplicationState420 | null> {
  const id = bytes32Id420(applicationId, 'application id');
  const result = await db.query(
    `select * from idx_protocol_events
     where chain_id = $1 and protocol = '420Grants'
       and event_name = 'ApplicationSubmitted'
       and lower(fields->>'applicationId') = $2
     order by block_number asc, tx_index asc, log_index asc`,
    [chainId.toString(), id]
  );
  const rows = rows420(result);
  if (rows.length === 0) return null;
  if (rows.length !== 1) throw new Error('Grants application replay detected');
  const row = rows[0]!;
  const fields = fields420(row);
  return {
    chainId: chainId.toString(),
    applicationId: stringField420(fields, 'applicationId'),
    programId: stringField420(fields, 'programId'),
    applicant: stringField420(fields, 'applicant'),
    requestedAmount: uintField420(fields, 'requestedAmount'),
    contentHash: stringField420(fields, 'contentHash'),
    ...provenance420(row),
    authoritative: false
  };
}

export async function grantsAwardState420(
  db: SqlExecutor420,
  chainId: bigint,
  awardId: string
): Promise<GrantsAwardState420 | null> {
  const id = bytes32Id420(awardId, 'award id');
  const result = await db.query(
    `select * from idx_protocol_events
     where chain_id = $1 and protocol = '420Grants'
       and event_name in ('AwardCreated','AwardStateChanged')
       and lower(fields->>'awardId') = $2
     order by block_number asc, tx_index asc, log_index asc`,
    [chainId.toString(), id]
  );
  const rows = rows420(result);
  if (rows.length === 0) return null;
  const created = rows.filter((row) => row.event_name === 'AwardCreated');
  if (created.length !== 1) throw new Error('Grants award creation history invalid');
  const base = fields420(created[0]!);
  let state: GrantsAwardState420['state'] = 'ACTIVE';
  let latest = created[0]!;
  for (const row of rows) {
    if (row.event_name === 'AwardCreated') continue;
    if (state !== 'ACTIVE') throw new Error('Grants award terminal replay detected');
    const raw = uintField420(fields420(row), 'state');
    if (raw === '2') state = 'CANCELLED';
    else if (raw === '3') state = 'COMPLETED';
    else throw new Error('Grants award state transition invalid');
    latest = row;
  }
  return {
    chainId: chainId.toString(),
    awardId: stringField420(base, 'awardId'),
    programId: stringField420(base, 'programId'),
    applicationId: stringField420(base, 'applicationId'),
    recipient: stringField420(base, 'recipient'),
    amount: uintField420(base, 'amount'),
    termsHash: stringField420(base, 'termsHash'),
    state,
    ...provenance420(latest),
    authoritative: false
  };
}

export async function grantsMilestoneState420(
  db: SqlExecutor420,
  chainId: bigint,
  milestoneId: string
): Promise<GrantsMilestoneState420 | null> {
  const id = bytes32Id420(milestoneId, 'milestone id');
  const result = await db.query(
    `select * from idx_protocol_events
     where chain_id = $1 and protocol = '420Grants'
       and event_name in ('MilestoneCreated','MilestoneClaimed','MilestoneApproved','MilestonePaid','MilestoneCancelled')
       and lower(fields->>'milestoneId') = $2
     order by block_number asc, tx_index asc, log_index asc`,
    [chainId.toString(), id]
  );
  const rows = rows420(result);
  if (rows.length === 0) return null;
  const created = rows.filter((row) => row.event_name === 'MilestoneCreated');
  if (created.length !== 1) throw new Error('Grants milestone creation history invalid');
  const base = fields420(created[0]!);
  let state: GrantsMilestoneState420['state'] = 'PENDING';
  let claimHash: string | null = null;
  let claimSubmitter: string | null = null;
  let treasuryDisbursementId: string | null = null;
  let latest = created[0]!;

  for (const row of rows) {
    if (row.event_name === 'MilestoneCreated') continue;
    const fields = fields420(row);
    if (row.event_name === 'MilestoneClaimed') {
      if (state !== 'PENDING') throw new Error('Grants milestone claim transition invalid');
      claimHash = stringField420(fields, 'claimHash');
      claimSubmitter = stringField420(fields, 'submitter');
      state = 'CLAIMED';
    } else if (row.event_name === 'MilestoneApproved') {
      if (state !== 'CLAIMED') throw new Error('Grants milestone approval transition invalid');
      treasuryDisbursementId = stringField420(fields, 'treasuryDisbursementId');
      state = 'APPROVED';
    } else if (row.event_name === 'MilestonePaid') {
      if (state !== 'APPROVED') throw new Error('Grants milestone payment transition invalid');
      const paidDisbursement = stringField420(fields, 'treasuryDisbursementId');
      if (paidDisbursement !== treasuryDisbursementId) throw new Error('Grants milestone Treasury binding drift');
      state = 'PAID';
    } else if (row.event_name === 'MilestoneCancelled') {
      if (state === 'PAID' || state === 'CANCELLED') throw new Error('Grants milestone terminal replay detected');
      treasuryDisbursementId = null;
      state = 'CANCELLED';
    } else throw new Error('unexpected Grants milestone event');
    latest = row;
  }

  return {
    chainId: chainId.toString(),
    milestoneId: stringField420(base, 'milestoneId'),
    awardId: stringField420(base, 'awardId'),
    amount: uintField420(base, 'amount'),
    purposeHash: stringField420(base, 'purposeHash'),
    claimHash,
    claimSubmitter,
    treasuryDisbursementId,
    state,
    ...provenance420(latest),
    authoritative: false
  };
}
