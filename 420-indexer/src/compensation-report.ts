import type { SqlExecutor420 } from './core-projections.js';
import { COMPENSATION_PROTOCOL_420 } from './compensation-indexer.js';

const NATIVE = '0x' + '0'.repeat(40);
type Event = { event_name: string; block_timestamp: string; block_hash: string; tx_hash: string;
  log_index: number; contract_address: string; fields: Record<string, string> };
type Binding = { chainId: string; vault: string; splitter: string; founders: [string, string, string] };

function checkedHex(value: unknown, bytes: number): string {
  if (typeof value !== 'string' || !new RegExp(`^0x[0-9a-f]{${bytes * 2}}$`, 'i').test(value)) {
    throw new Error('invalid compensation identity');
  }
  return value.toLowerCase();
}

function uint(value: unknown): bigint {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) throw new Error('invalid compensation integer');
  return BigInt(value);
}

function entitlement(total: bigint, slot: number): bigint {
  const groups = total / 4n;
  const remainder = total % 4n;
  if (slot === 0) return groups * 2n + (remainder > 1n ? remainder - 1n : 0n);
  if (slot === 1) return groups;
  return groups + (remainder === 0n ? 0n : 1n);
}

export async function compensationReport420(db: SqlExecutor420, chainId: bigint, binding: Binding, from: bigint, to: bigint) {
  if (chainId.toString() !== binding.chainId || from < 0n || to <= from) throw new Error('invalid compensation report scope');
  const vault = checkedHex(binding.vault, 20);
  const splitter = checkedHex(binding.splitter, 20);
  if (vault === splitter || vault === NATIVE || splitter === NATIVE || binding.founders.length !== 3) throw new Error('invalid splitter binding');
  const founders = binding.founders.map(value => checkedHex(value, 20));
  if (new Set(founders).size !== 3 || founders.includes(NATIVE)) throw new Error('invalid founder binding');

  // One database statement sees a consistent canonical snapshot, including during rollback.
  const { rows } = await db.query(
    `select e.*, b.block_timestamp::text as block_timestamp from idx_protocol_events e
     join idx_blocks b using (chain_id, block_number, block_hash)
     where e.chain_id = $1 and e.protocol = $2 and b.block_timestamp < $3
     and e.contract_address in ($4, $5)
     order by e.block_number, e.tx_index, e.log_index`,
    [chainId.toString(), COMPENSATION_PROTOCOL_420, to.toString(), vault, splitter]
  ) as { rows: Event[] };

  const receipts = new Map<string, number>();
  const contributions = new Set<string>();
  const pools = new Map<string, { credited: bigint; opening: bigint; claimed: bigint[]; periodClaims: bigint[] }>();
  const groups = new Map<string, { application: string; source: string; asset: string; policy: string;
    eligibleRevenue: bigint; compensation: bigint; credits: bigint[] }>();
  for (const row of rows) {
    const f = row.fields;
    const period = uint(row.block_timestamp) >= from;
    const forwarded = row.event_name === 'DevelopmentCompensationForwarded';
    const claim = row.event_name === 'FounderCompensationClaimed';
    const nativeCredit = row.event_name === 'FounderCompensationDeposited';
    if (!forwarded && !claim && !nativeCredit && row.event_name !== 'FounderTokenCompensationCredited') {
      throw new Error('unknown compensation event');
    }
    const asset = nativeCredit ? NATIVE : checkedHex(f.asset ?? f.token, 20);
    const amount = uint(forwarded ? f.compensationAmount : f.amount);
    const emitter = checkedHex(row.contract_address, 20);
    if (!amount || emitter !== (forwarded ? vault : splitter)) throw new Error('invalid compensation emitter or amount');

    if (!claim) {
      if (forwarded ? checkedHex(f.beneficiary, 20) !== splitter : checkedHex(f.sourceVault, 20) !== vault) {
        throw new Error('compensation binding mismatch');
      }
      const id = asset === NATIVE ? '' : checkedHex(f.contributionId, 32);
      const key = [row.block_hash, row.tx_hash, asset, amount, id].join('/');
      const count = receipts.get(key) ?? 0;
      if (!forwarded) {
        receipts.set(key, count + 1);
        continue;
      }
      if (!count) throw new Error('unmatched compensation forwarding');
      if (count === 1) receipts.delete(key);
      else receipts.set(key, count - 1);
      const contribution = checkedHex(f.contributionId, 32);
      if (contributions.has(contribution)) throw new Error('duplicate compensation contribution');
      contributions.add(contribution);
    }

    let pool = pools.get(asset);
    if (!pool) {
      pool = { credited: 0n, opening: 0n, claimed: [0n, 0n, 0n], periodClaims: [0n, 0n, 0n] };
      pools.set(asset, pool);
    }
    if (claim) {
      const slot = founders.indexOf(checkedHex(f.beneficiary, 20));
      if (slot < 0 || pool.claimed[slot]! + amount > entitlement(pool.credited, slot)) throw new Error('claim exceeds founder entitlement');
      pool.claimed[slot]! += amount;
      if (period) pool.periodClaims[slot]! += amount;
      continue;
    }

    const prior = pool.credited;
    pool.credited += amount;
    if (!period) {
      pool.opening = pool.credited;
      continue;
    }
    const application = checkedHex(f.sourceApplicationId, 32);
    const source = checkedHex(f.source, 20);
    const policy = checkedHex(f.policyRef, 32);
    const key = [application, source, asset, policy].join('/');
    const group = groups.get(key) ?? { application, source, asset, policy,
      eligibleRevenue: 0n, compensation: 0n, credits: [0n, 0n, 0n] };
    group.eligibleRevenue += uint(f.grossProtocolRevenue);
    group.compensation += amount;
    for (let slot = 0; slot < founders.length; slot++) {
      group.credits[slot]! += entitlement(pool.credited, slot) - entitlement(prior, slot);
    }
    groups.set(key, group);
  }
  if (receipts.size) throw new Error('unmatched splitter credits');
  return {
    chainId: chainId.toString(), from: from.toString(), to: to.toString(), vault, splitter,
    contributions: [...groups.values()].map(({ eligibleRevenue, compensation, credits, ...dimensions }) => ({
      ...dimensions, eligibleRevenue: eligibleRevenue.toString(), compensation: compensation.toString(),
      founderCredits: founders.map((founder, slot) => ({ founder, credited: credits[slot]!.toString() }))
    })),
    entitlements: [...pools].flatMap(([asset, pool]) => founders.map((founder, slot) => ({
      asset, founder, credited: (entitlement(pool.credited, slot) - entitlement(pool.opening, slot)).toString(),
      claimed: pool.periodClaims[slot]!.toString(), cumulativeClaimed: pool.claimed[slot]!.toString(),
      outstanding: (entitlement(pool.credited, slot) - pool.claimed[slot]!).toString()
    })))
  };
}
