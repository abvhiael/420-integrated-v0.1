export const STAKE_VALIDATOR_REGISTRY_420 = '0x0000000000000000000000000000000000000423';
export const STAKE_REWARD_CONTROLLER_420 = '0x0000000000000000000000000000000000000420';

export type StakeFinality420 = 'HEAD' | 'SAFE' | 'FINALIZED';

export interface StakeActivityRecord420 {
  readonly chainId: number;
  readonly blockNumber: number;
  readonly blockHash: string;
  readonly transactionHash: string;
  readonly transactionIndex: number;
  readonly logIndex: number;
  readonly contractAddress: string;
  readonly eventName: string;
  readonly validatorId?: string;
  readonly addresses?: readonly string[];
  readonly finality: StakeFinality420;
  readonly topics: readonly string[];
  readonly data: string;
}

export interface StakeActivityPage420 {
  readonly meta: {
    readonly chainId: number;
    readonly snapshotHeight: number;
    readonly snapshotHash: string;
    readonly safeHeight: number;
    readonly finalizedHeight: number;
    readonly schemaVersion: string;
  };
  readonly validatorId?: string;
  readonly address?: string;
  readonly records: readonly StakeActivityRecord420[];
  readonly canonicalAuthority: false;
}

const STAKE_EVENTS_420 = new Set([
  'CommunityValidatorReserveBound','ProtocolCreditReceived','PendingProtocolCreditReturned',
  'ValidatorRegistered','OwnedBondToppedUp','ProtocolCreditReplaced','ValidatorBondWithdrawn',
  'ConsensusStateApplied','ExitNoticeApplied','SlashApplied','RotationSnapshotApplied',
  'ActiveTargetChanged','RewardApplied'
]);
const FINALITY_420 = new Set<StakeFinality420>(['HEAD','SAFE','FINALIZED']);

function normalizeBase420(value: string): string {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error('Stake Explorer base URL must be valid'); }
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost','127.0.0.1','[::1]'].includes(url.hostname))) {
    throw new Error('Stake Explorer base URL must use HTTPS outside localhost');
  }
  return value.replace(/\/$/, '');
}

function validBytes32420(value: string): boolean { return /^0x[0-9a-fA-F]{64}$/.test(value); }
function validAddress420(value: string): boolean { return /^0x[0-9a-fA-F]{40}$/.test(value); }

export function createStakeExplorerClient420(input: {
  readonly baseUrl: string;
  readonly chainId: bigint;
  readonly fetchImpl?: typeof fetch;
}) {
  const base = normalizeBase420(input.baseUrl);
  const expectedChain = Number(input.chainId);
  if (!Number.isSafeInteger(expectedChain) || expectedChain <= 0) throw new Error('Stake client chain ID invalid');
  const fetchImpl = input.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== 'function') throw new Error('Stake client fetch implementation required');

  return Object.freeze({
    async activity(options: { validatorId?: string; address?: string; limit?: number } = {}): Promise<StakeActivityPage420> {
      if (options.validatorId && !validBytes32420(options.validatorId)) throw new Error('validatorId must be bytes32');
      if (options.address && !validAddress420(options.address)) throw new Error('address must be an EVM address');
      if (options.limit !== undefined && (!Number.isInteger(options.limit) || options.limit < 1 || options.limit > 250)) throw new Error('Stake activity limit must be 1..250');
      const url = new URL(base + '/v1/stake/activity');
      if (options.validatorId) url.searchParams.set('validatorId', options.validatorId.toLowerCase());
      if (options.address) url.searchParams.set('address', options.address.toLowerCase());
      if (options.limit) url.searchParams.set('limit', String(options.limit));
      const response = await fetchImpl(url, { headers:{ accept:'application/json' }, cache:'no-store' });
      if (!response.ok) throw new Error('420Explorer Stake activity read failed: ' + response.status);
      const page = await response.json() as StakeActivityPage420;
      if (page.canonicalAuthority !== false) throw new Error('Stake activity response overpromoted canonical authority');
      if (page.meta?.chainId !== expectedChain) throw new Error('Stake activity response chain mismatch');
      if (page.meta.finalizedHeight > page.meta.safeHeight || page.meta.safeHeight > page.meta.snapshotHeight) throw new Error('Stake activity finality boundaries inconsistent');
      if (!Array.isArray(page.records)) throw new Error('Stake activity records missing');
      for (const record of page.records) {
        if (record.chainId !== expectedChain) throw new Error('Stake activity record chain mismatch');
        if (!STAKE_EVENTS_420.has(record.eventName)) throw new Error('Stake activity unknown event');
        const expectedAddress = record.eventName === 'RewardApplied' ? STAKE_REWARD_CONTROLLER_420 : STAKE_VALIDATOR_REGISTRY_420;
        if (record.contractAddress.toLowerCase() !== expectedAddress) throw new Error('Stake activity canonical contract mismatch');
        if (!FINALITY_420.has(record.finality)) throw new Error('Stake activity finality invalid');
        if (record.blockNumber <= page.meta.finalizedHeight && record.finality !== 'FINALIZED') throw new Error('Stake finalized event mislabeled');
        if (record.blockNumber > page.meta.safeHeight && record.finality !== 'HEAD') throw new Error('Stake head event mislabeled');
      }
      return page;
    }
  });
}
