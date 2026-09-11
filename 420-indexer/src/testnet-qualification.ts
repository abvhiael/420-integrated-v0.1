export type TestnetFinalityMode420 = 'head' | 'confirmations' | 'finalized';

export interface TestnetQualificationConfig420 {
  chainId: string;
  rpcUrl: string;
  expectedGenesisHash: string;
  finalityMode: TestnetFinalityMode420;
  confirmations: number | null;
  sustainedBlocks: number;
  maxReorgDepth: number;
  restartReplayBlocks: number;
}

export interface TestnetQualificationEnvironment420 {
  IDX420_CHAIN_ID?: string;
  IDX420_RPC_URL?: string;
  IDX420_EXPECTED_GENESIS_HASH?: string;
  IDX420_FINALITY_MODE?: string;
  IDX420_CONFIRMATIONS?: string;
  IDX420_SUSTAINED_BLOCKS?: string;
  IDX420_MAX_REORG_DEPTH?: string;
  IDX420_RESTART_REPLAY_BLOCKS?: string;
}

const DECIMAL = /^(0|[1-9][0-9]*)$/;
const HASH32 = /^0x[0-9a-fA-F]{64}$/;

function required(name: string, value: string | undefined): string {
  const normalized = value?.trim();
  if (!normalized) throw new Error(`missing required testnet qualification setting: ${name}`);
  return normalized;
}

function positiveInt(name: string, value: string | undefined): number {
  const raw = required(name, value);
  if (!DECIMAL.test(raw)) throw new Error(`${name} must be a base-10 integer`);
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error(`${name} must be a positive safe integer`);
  return parsed;
}

function nonNegativeInt(name: string, value: string | undefined): number {
  const raw = required(name, value);
  if (!DECIMAL.test(raw)) throw new Error(`${name} must be a base-10 integer`);
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error(`${name} must be a non-negative safe integer`);
  return parsed;
}

function rpcUrl(value: string | undefined): string {
  const raw = required('IDX420_RPC_URL', value);
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error('IDX420_RPC_URL must be an absolute http(s) URL');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('IDX420_RPC_URL must use http or https');
  }
  if (parsed.username || parsed.password) {
    throw new Error('IDX420_RPC_URL must not embed credentials; inject provider secrets separately');
  }
  return parsed.toString();
}

export function parseTestnetQualificationConfig420(
  env: TestnetQualificationEnvironment420,
): TestnetQualificationConfig420 {
  const chainId = required('IDX420_CHAIN_ID', env.IDX420_CHAIN_ID);
  if (!DECIMAL.test(chainId) || BigInt(chainId) <= 0n) {
    throw new Error('IDX420_CHAIN_ID must be a positive base-10 integer');
  }

  const expectedGenesisHash = required('IDX420_EXPECTED_GENESIS_HASH', env.IDX420_EXPECTED_GENESIS_HASH);
  if (!HASH32.test(expectedGenesisHash)) {
    throw new Error('IDX420_EXPECTED_GENESIS_HASH must be a 32-byte 0x-prefixed hash');
  }

  const finalityMode = required('IDX420_FINALITY_MODE', env.IDX420_FINALITY_MODE) as TestnetFinalityMode420;
  if (!['head', 'confirmations', 'finalized'].includes(finalityMode)) {
    throw new Error('IDX420_FINALITY_MODE must be head, confirmations, or finalized');
  }

  const confirmations = finalityMode === 'confirmations'
    ? positiveInt('IDX420_CONFIRMATIONS', env.IDX420_CONFIRMATIONS)
    : null;

  if (finalityMode !== 'confirmations' && env.IDX420_CONFIRMATIONS?.trim()) {
    throw new Error('IDX420_CONFIRMATIONS is only valid when IDX420_FINALITY_MODE=confirmations');
  }

  const maxReorgDepth = positiveInt('IDX420_MAX_REORG_DEPTH', env.IDX420_MAX_REORG_DEPTH);
  const restartReplayBlocks = nonNegativeInt('IDX420_RESTART_REPLAY_BLOCKS', env.IDX420_RESTART_REPLAY_BLOCKS);
  if (restartReplayBlocks > maxReorgDepth) {
    throw new Error('IDX420_RESTART_REPLAY_BLOCKS must not exceed IDX420_MAX_REORG_DEPTH');
  }

  return {
    chainId,
    rpcUrl: rpcUrl(env.IDX420_RPC_URL),
    expectedGenesisHash: expectedGenesisHash.toLowerCase(),
    finalityMode,
    confirmations,
    sustainedBlocks: positiveInt('IDX420_SUSTAINED_BLOCKS', env.IDX420_SUSTAINED_BLOCKS),
    maxReorgDepth,
    restartReplayBlocks,
  };
}
