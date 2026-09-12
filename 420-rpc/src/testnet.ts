export interface Rpc12TestnetEnvironment420 {
  chainId: bigint;
  environment: 'testnet';
  expectedGenesisHash: string;
  publicHttpUrl: string;
  publicWebsocketUrl: string;
  canonicalExecutionProviderIds: readonly string[];
  indexerProviderIds: readonly string[];
}

export interface Rpc12DeploymentEvidence420 {
  rpcRevision: string;
  nodeRevision: string;
  indexerRevision: string;
  descriptorManifestDigest: string;
  compiledArtifactsDigest: string;
  observedChainId: bigint;
  observedGenesisHash: string;
  canonicalProviderCount: number;
  derivedProviderCount: number;
  readinessReady: boolean;
  supportedMethods: readonly string[];
  httpSmokePassed: boolean;
  websocketSmokePassed: boolean;
  submissionSmokePassed: boolean;
  derivedReadSmokePassed: boolean;
  authSmokePassed: boolean;
  resourceLimitSmokePassed: boolean;
  failoverDrillPassed: boolean;
  wrongChainDrillPassed: boolean;
  finalityConflictDrillPassed: boolean;
  websocketLossDrillPassed: boolean;
  recoveryDrillPassed: boolean;
  telemetryRedactionPassed: boolean;
}

export interface Rpc12CloseoutReport420 {
  service: '420RPC';
  phase: 'RPC-12';
  decision: 'go' | 'no-go';
  blockers: readonly string[];
  chainId: string;
  environment: 'testnet';
  httpOrigin: string;
  websocketOrigin: string;
  rpcRevision: string;
  nodeRevision: string;
  indexerRevision: string;
  canonicalProviderCount: number;
  derivedProviderCount: number;
  authoritative: false;
  launchAuthority: false;
}

const HASH32 = /^0x[0-9a-fA-F]{64}$/;
const SHA256 = /^(?:sha256:)?[0-9a-fA-F]{64}$/;
const REVISION = /^[0-9a-zA-Z._/+:-]{7,128}$/;

export const REQUIRED_RPC12_METHODS_420 = Object.freeze([
  'web3_clientVersion',
  'eth_chainId',
  'eth_blockNumber',
  'eth_getBlockByNumber',
  'eth_getBalance',
  'eth_getLogs',
  'eth_call',
  'eth_estimateGas',
  'eth_feeHistory',
  'eth_sendRawTransaction',
  'eth_subscribe',
  'eth_unsubscribe',
] as const);

function publicOrigin(raw: string, expectedProtocol: 'https:' | 'wss:'): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`invalid ${expectedProtocol} public URL`);
  }
  if (url.protocol !== expectedProtocol) throw new Error(`public URL must use ${expectedProtocol}`);
  if (url.username || url.password) throw new Error('public URL must not embed credentials');
  if (url.hash) throw new Error('public URL must not contain a fragment');
  return `${url.protocol}//${url.host}`;
}

function validIds(ids: readonly string[]): boolean {
  return ids.length > 0 && new Set(ids).size === ids.length && ids.every((id) => /^[a-zA-Z0-9._:-]{1,128}$/.test(id));
}

export function validateRpc12Environment420(input: Rpc12TestnetEnvironment420): string[] {
  const errors: string[] = [];
  if (input.chainId !== 420n) errors.push('testnet chain ID must equal 420');
  if (input.environment !== 'testnet') errors.push('environment must equal testnet');
  if (!HASH32.test(input.expectedGenesisHash)) errors.push('expected genesis hash must be a 32-byte hex hash');
  try { publicOrigin(input.publicHttpUrl, 'https:'); } catch (error) { errors.push((error as Error).message); }
  try { publicOrigin(input.publicWebsocketUrl, 'wss:'); } catch (error) { errors.push((error as Error).message); }
  if (!validIds(input.canonicalExecutionProviderIds)) errors.push('canonical execution provider IDs must be unique and non-empty');
  if (!validIds(input.indexerProviderIds)) errors.push('indexer provider IDs must be unique and non-empty');
  return errors;
}

function validateRevision(value: string, label: string, blockers: string[]): void {
  if (!REVISION.test(value)) blockers.push(`${label} revision is missing or malformed`);
}

export function buildRpc12CloseoutReport420(
  environment: Rpc12TestnetEnvironment420,
  evidence: Rpc12DeploymentEvidence420,
): Rpc12CloseoutReport420 {
  const blockers = [...validateRpc12Environment420(environment)];
  validateRevision(evidence.rpcRevision, '420RPC', blockers);
  validateRevision(evidence.nodeRevision, 'node420', blockers);
  validateRevision(evidence.indexerRevision, '420Indexer', blockers);
  if (!SHA256.test(evidence.descriptorManifestDigest)) blockers.push('descriptor manifest digest is missing or malformed');
  if (!SHA256.test(evidence.compiledArtifactsDigest)) blockers.push('compiled artifacts digest is missing or malformed');
  if (evidence.observedChainId !== environment.chainId) blockers.push('observed chain ID does not match configured testnet chain');
  if (evidence.observedGenesisHash.toLowerCase() !== environment.expectedGenesisHash.toLowerCase()) blockers.push('observed genesis hash does not match configured testnet genesis');
  if (!Number.isInteger(evidence.canonicalProviderCount) || evidence.canonicalProviderCount < 1) blockers.push('no qualified canonical execution provider was observed');
  if (!Number.isInteger(evidence.derivedProviderCount) || evidence.derivedProviderCount < 1) blockers.push('no qualified derived/indexer provider was observed');
  if (!evidence.readinessReady) blockers.push('420RPC readiness was not traffic-admitting');

  const methods = new Set(evidence.supportedMethods);
  for (const method of REQUIRED_RPC12_METHODS_420) if (!methods.has(method)) blockers.push(`required public compatibility method not witnessed: ${method}`);

  const checks: Array<[keyof Rpc12DeploymentEvidence420, string]> = [
    ['httpSmokePassed', 'HTTPS JSON-RPC smoke was not proven'],
    ['websocketSmokePassed', 'WSS subscription smoke was not proven'],
    ['submissionSmokePassed', 'signed transaction submission smoke was not proven'],
    ['derivedReadSmokePassed', 'derived/indexer read smoke was not proven'],
    ['authSmokePassed', 'credential and scope smoke was not proven'],
    ['resourceLimitSmokePassed', 'rate/resource limit smoke was not proven'],
    ['failoverDrillPassed', 'safe read failover drill was not proven'],
    ['wrongChainDrillPassed', 'wrong-chain rejection drill was not proven'],
    ['finalityConflictDrillPassed', 'finality-conflict fail-closed drill was not proven'],
    ['websocketLossDrillPassed', 'WebSocket upstream-loss/resubscription drill was not proven'],
    ['recoveryDrillPassed', 'readiness recovery/hysteresis drill was not proven'],
    ['telemetryRedactionPassed', 'telemetry redaction check was not proven'],
  ];
  for (const [key, message] of checks) if (evidence[key] !== true) blockers.push(message);

  let httpOrigin = 'invalid';
  let websocketOrigin = 'invalid';
  try { httpOrigin = publicOrigin(environment.publicHttpUrl, 'https:'); } catch { /* blocker already recorded */ }
  try { websocketOrigin = publicOrigin(environment.publicWebsocketUrl, 'wss:'); } catch { /* blocker already recorded */ }

  return Object.freeze({
    service: '420RPC',
    phase: 'RPC-12',
    decision: blockers.length === 0 ? 'go' : 'no-go',
    blockers: Object.freeze(blockers),
    chainId: environment.chainId.toString(),
    environment: 'testnet',
    httpOrigin,
    websocketOrigin,
    rpcRevision: evidence.rpcRevision,
    nodeRevision: evidence.nodeRevision,
    indexerRevision: evidence.indexerRevision,
    canonicalProviderCount: evidence.canonicalProviderCount,
    derivedProviderCount: evidence.derivedProviderCount,
    authoritative: false,
    launchAuthority: false,
  });
}
