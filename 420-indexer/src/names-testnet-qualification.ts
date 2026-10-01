import { id, keccak256, getBytes, Interface, ZeroAddress } from 'ethers';

export const NAMES_TESTNET_SCHEMA_420 = '420-names-live-testnet-qualification-v1';
export const NAMES_ADDRESS_420 = '0x0000000000000000000000000000000000000435';
export const REGISTRY_ADDRESS_420 = '0x0000000000000000000000000000000000000434';
export const GOVERNANCE_TIMELOCK_420 = '0x0000000000000000000000000000000000000429';
export const NAMES_RUNTIME_HASH_420 = '0xa974fffd3a40e7f28db41e4ae30656b33789d2483b18b47c809ce2385de709b7';
export const NAMES_SERVICE_ID_420 = id('420/service/names/v1');

const HEX32 = /^0x[0-9a-fA-F]{64}$/;
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const ZERO_WORD = /^0x0{64}$/i;

export interface NamesOfficialManifest420 {
  schemaVersion: '1.0.0';
  network: { name: string; environment: 'testnet'; chainId: string };
  rpc: { http: string[]; websocket?: string[] };
  services: { indexer: string; [key: string]: string };
  contracts: {
    Names420: { address: string; source: string; version?: string };
    ProtocolRegistry: { address: string; source: string; version?: string };
    [key: string]: { address: string; source: string; version?: string };
  };
}

export interface NamesReadEvidence420 {
  chainId: string;
  genesisHash: string;
  blockNumber: string;
  names: {
    address: string;
    codeHash: string;
    systemName: string;
    protocolVersion: number;
    governanceTimelock: string;
    mappingRootSlots: Record<'0'|'1'|'2', string>;
  };
  registry: {
    address: string;
    serviceId: string;
    implementation: string;
    revision: number;
    codeHash: string;
    active: boolean;
  };
}

export interface NamesWorkflowEvidence420 {
  label: string;
  labelHash: string;
  owner: string;
  recipient: string;
  commitTx: string;
  registerTx: string;
  renewTx: string;
  resolutionTx: string;
  reverseTx: string;
  transferTx: string;
  acceptTx: string;
  finalOwner: string;
  finalResolvedAddress: string;
  finalProfileId: string;
  finalServiceId: string;
  reverseAfterTransfer: string;
}

export interface NamesServiceEvidence420 {
  indexer: {
    qualified: boolean;
    chainId: string;
    protocol: '420Names';
    labelHash: string;
    latestEventName: string;
    latestBlockNumber: string;
  };
  search: {
    qualified: boolean;
    labelHash: string;
    resolvedOwner: string;
    resolvedAddress: string;
    source: string;
  };
  wallet: {
    qualified: boolean;
    label: string;
    labelHash: string;
    resolvedAddress: string;
  };
}

export interface NamesLiveTestnetEvidence420 {
  schema: typeof NAMES_TESTNET_SCHEMA_420;
  phase: 'NAMES-AUDIT-9';
  status: 'PASS';
  repositorySha: string;
  manifestPath: string;
  read: NamesReadEvidence420;
  workflow: NamesWorkflowEvidence420;
  services: NamesServiceEvidence420;
}

function fail(message: string): never { throw new Error(message); }
function lowerAddress(value: string, label: string): string {
  if (!ADDRESS.test(value)) fail(label + ' must be an EVM address');
  return value.toLowerCase();
}
function positiveDecimal(value: string, label: string): bigint {
  if (!/^[1-9][0-9]*$/.test(value)) fail(label + ' must be a positive decimal integer');
  return BigInt(value);
}
function requireHttps(value: string, label: string): void {
  let u: URL;
  try { u = new URL(value); } catch { fail(label + ' must be an absolute URL'); }
  if (u.protocol !== 'https:') fail(label + ' must use HTTPS');
  if (u.username || u.password) fail(label + ' must not embed credentials');
}
function txHash(value: string, label: string): void {
  if (!HEX32.test(value)) fail(label + ' must be a 32-byte transaction hash');
}

export function validateNamesOfficialTestnetManifest420(manifest: NamesOfficialManifest420): NamesOfficialManifest420 {
  if (!manifest || typeof manifest !== 'object') fail('official testnet manifest missing');
  if (manifest.schemaVersion !== '1.0.0') fail('unsupported official testnet manifest schema');
  if (manifest.network?.environment !== 'testnet') fail('NAMES-AUDIT-9 requires environment=testnet');
  positiveDecimal(manifest.network?.chainId, 'manifest chainId');
  if (!Array.isArray(manifest.rpc?.http) || manifest.rpc.http.length === 0) fail('official testnet manifest requires RPC');
  manifest.rpc.http.forEach((url, i) => requireHttps(url, 'RPC[' + i + ']'));
  if (!manifest.services?.indexer) fail('official testnet manifest requires Indexer service');
  requireHttps(manifest.services.indexer, 'Indexer');
  const names = lowerAddress(manifest.contracts?.Names420?.address ?? '', 'manifest Names420 address');
  const registry = lowerAddress(manifest.contracts?.ProtocolRegistry?.address ?? '', 'manifest ProtocolRegistry address');
  if (names !== NAMES_ADDRESS_420) fail('official testnet manifest Names420 address mismatch');
  if (registry !== REGISTRY_ADDRESS_420) fail('official testnet manifest ProtocolRegistry address mismatch');
  return structuredClone(manifest);
}

export function validateNamesReadEvidence420(manifest: NamesOfficialManifest420, evidence: NamesReadEvidence420): void {
  const validated = validateNamesOfficialTestnetManifest420(manifest);
  if (positiveDecimal(evidence.chainId, 'observed chainId') !== positiveDecimal(validated.network.chainId, 'manifest chainId')) {
    fail('live chain ID does not match official manifest');
  }
  if (!HEX32.test(evidence.genesisHash)) fail('live genesis hash is invalid');
  positiveDecimal(evidence.blockNumber, 'observed blockNumber');

  const names = evidence.names;
  if (lowerAddress(names.address, 'observed Names420 address') !== NAMES_ADDRESS_420) fail('Names420 address mismatch');
  if (names.codeHash.toLowerCase() !== NAMES_RUNTIME_HASH_420) fail('Names420 runtime hash mismatch');
  if (names.systemName !== 'Names420') fail('Names420 systemName mismatch');
  if (names.protocolVersion !== 3) fail('Names420 protocolVersion mismatch');
  if (lowerAddress(names.governanceTimelock, 'Names420 governance timelock') !== GOVERNANCE_TIMELOCK_420) fail('Names420 governance binding mismatch');
  for (const slot of ['0','1','2'] as const) {
    if (!ZERO_WORD.test(names.mappingRootSlots[slot] ?? '')) fail('Names420 mapping root slot ' + slot + ' is not zero');
  }

  const registry = evidence.registry;
  if (lowerAddress(registry.address, 'ProtocolRegistry address') !== REGISTRY_ADDRESS_420) fail('ProtocolRegistry address mismatch');
  if (registry.serviceId.toLowerCase() !== NAMES_SERVICE_ID_420.toLowerCase()) fail('Names Registry service ID mismatch');
  if (lowerAddress(registry.implementation, 'Registry Names implementation') !== NAMES_ADDRESS_420) fail('Registry does not discover Names420 at canonical address');
  if (!Number.isSafeInteger(registry.revision) || registry.revision <= 0) fail('Registry Names revision must be positive');
  if (registry.codeHash.toLowerCase() !== NAMES_RUNTIME_HASH_420) fail('Registry Names code hash mismatch');
  if (registry.active !== true) fail('Registry Names service must be active');
}

export function validateNamesWorkflowEvidence420(workflow: NamesWorkflowEvidence420): void {
  if (!/^[a-z0-9-]{1,63}\.420$/.test(workflow.label)) fail('workflow label must be canonical lowercase ASCII .420 name');
  if (!HEX32.test(workflow.labelHash)) fail('workflow labelHash invalid');
  const owner = lowerAddress(workflow.owner, 'workflow owner');
  const recipient = lowerAddress(workflow.recipient, 'workflow recipient');
  if (owner === recipient) fail('workflow transfer requires distinct accounts');
  for (const [key,value] of Object.entries({
    commitTx: workflow.commitTx,
    registerTx: workflow.registerTx,
    renewTx: workflow.renewTx,
    resolutionTx: workflow.resolutionTx,
    reverseTx: workflow.reverseTx,
    transferTx: workflow.transferTx,
    acceptTx: workflow.acceptTx,
  })) txHash(value, key);
  if (lowerAddress(workflow.finalOwner, 'workflow final owner') !== recipient) fail('workflow final owner mismatch');
  if (lowerAddress(workflow.finalResolvedAddress, 'workflow final resolution') !== recipient) fail('accepted transfer must reset resolution to recipient');
  if (!/^0x0{64}$/i.test(workflow.finalProfileId)) fail('accepted transfer must clear profileId');
  if (!/^0x0{64}$/i.test(workflow.finalServiceId)) fail('accepted transfer must clear serviceId');
  if (!/^0x0{64}$/i.test(workflow.reverseAfterTransfer)) fail('stale reverse mapping must not remain authoritative after transfer');
}

export function validateNamesServiceEvidence420(workflow: NamesWorkflowEvidence420, services: NamesServiceEvidence420): void {
  const labelHash = workflow.labelHash.toLowerCase();
  if (!services.indexer?.qualified) fail('Indexer Names qualification missing');
  if (services.indexer.protocol !== '420Names') fail('Indexer protocol mismatch');
  if (services.indexer.labelHash.toLowerCase() !== labelHash) fail('Indexer labelHash mismatch');
  if (services.indexer.latestEventName !== 'NameTransferred') fail('Indexer latest Names lifecycle event mismatch');
  positiveDecimal(services.indexer.latestBlockNumber, 'Indexer latest block');

  if (!services.search?.qualified) fail('Search Names qualification missing');
  if (services.search.labelHash.toLowerCase() !== labelHash) fail('Search labelHash mismatch');
  if (lowerAddress(services.search.resolvedOwner, 'Search owner') !== lowerAddress(workflow.finalOwner, 'workflow final owner')) fail('Search owner disagrees with chain workflow');
  if (lowerAddress(services.search.resolvedAddress, 'Search resolution') !== lowerAddress(workflow.finalResolvedAddress, 'workflow final resolution')) fail('Search resolution disagrees with chain workflow');
  if (!services.search.source.includes('420Names')) fail('Search provenance must identify 420Names');

  if (!services.wallet?.qualified) fail('Wallet Names qualification missing');
  if (services.wallet.label !== workflow.label) fail('Wallet label mismatch');
  if (services.wallet.labelHash.toLowerCase() !== labelHash) fail('Wallet labelHash mismatch');
  if (lowerAddress(services.wallet.resolvedAddress, 'Wallet resolution') !== lowerAddress(workflow.finalResolvedAddress, 'workflow final resolution')) fail('Wallet resolution disagrees with chain workflow');
}

export function validateNamesLiveTestnetEvidence420(
  manifest: NamesOfficialManifest420,
  evidence: NamesLiveTestnetEvidence420,
  expectedRepositorySha?: string,
): NamesLiveTestnetEvidence420 {
  if (evidence.schema !== NAMES_TESTNET_SCHEMA_420 || evidence.phase !== 'NAMES-AUDIT-9' || evidence.status !== 'PASS') {
    fail('unsupported Names live-testnet evidence identity');
  }
  if (!/^[0-9a-f]{40}$/i.test(evidence.repositorySha)) fail('evidence repository SHA invalid');
  if (expectedRepositorySha && evidence.repositorySha.toLowerCase() !== expectedRepositorySha.toLowerCase()) fail('evidence repository SHA mismatch');
  if (!evidence.manifestPath || evidence.manifestPath.includes('local.example')) fail('evidence must reference official testnet manifest');
  validateNamesReadEvidence420(manifest, evidence.read);
  validateNamesWorkflowEvidence420(evidence.workflow);
  validateNamesServiceEvidence420(evidence.workflow, evidence.services);
  return structuredClone(evidence);
}

export const NamesReadInterfaces420 = Object.freeze({
  names: new Interface([
    'function systemName() view returns (string)',
    'function protocolVersion() view returns (uint32)',
    'function governanceTimelock() view returns (address)',
  ]),
  registry: new Interface([
    'function resolveActive(bytes32 serviceId) view returns (address implementation,uint32 version)',
    'function getService(bytes32 serviceId) view returns (tuple(address implementation,bytes32 codeHash,bytes32 metadataHash,uint32 version,uint64 activatedAt,bool active))',
  ]),
});

export function runtimeHash420(code: string): string {
  if (!/^0x(?:[0-9a-fA-F]{2})+$/.test(code) || /^0x0*$/i.test(code)) fail('deployed runtime bytecode missing or malformed');
  return keccak256(getBytes(code));
}

export function zeroStorageWord420(value: string): boolean { return ZERO_WORD.test(value); }
