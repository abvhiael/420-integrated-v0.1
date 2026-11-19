import {
  ZERO_WORD, TOKEN_COMPONENT_ID_420, TOKEN_GENESIS_V3_420, TOKEN_TEMPLATES_420,
  tokenHashText420, tokenHashHex420, tokenReadCall420, tokenEncodeAbi420, tokenWord420,
  tokenAddressWord420, tokenHashWord420,
} from './token-sdk.js';
import { assertWalletChain420 } from './transaction-lifecycle.js';

export const TOKEN_SERVICE_ID_420 = '420/service/token/v1';
export const TOKEN_CREATION_FEE_WEI_420 = 42n * 10n ** 18n;
export const TOKEN_COMMUNITY_VAULT_ID_420 = '420/treasury/vault/token-creation-community-revenue/v1';

const TIMELOCK = '0x0000000000000000000000000000000000000429';
const REGISTRY = '0x0000000000000000000000000000000000000434';
const VAULT_GRAPH = Object.freeze(['AssetVault420', 'VaultRegistry420', 'VaultAccounting420',
  'VaultAuthorization420', 'VaultPolicyRegistry420', 'CapabilityRegistry420']);
const ORDER = Object.freeze(['GovernanceTimelock', 'ProtocolRegistry', ...VAULT_GRAPH,
  'TokenTemplateRegistry420', 'TokenFactory420']);
const POLICY_TYPES = ['AUTHORIZATION', 'ASSET', 'RELEASE', 'ACCOUNTING'].map(t => tokenHashText420('420/VAULT/POLICY/' + t + '/V1'));
const VAULT_ID = tokenHashText420(TOKEN_COMMUNITY_VAULT_ID_420);
const SERVICE_ID = tokenHashText420(TOKEN_SERVICE_ID_420);
const COMPONENT_ID = tokenHashText420(TOKEN_COMPONENT_ID_420);
const check = (ok, label) => { if (!ok) throw Error(label); };

function address(value) {
  const word = tokenAddressWord420(value);
  check(BigInt('0x' + word) !== 0n, 'zero address');
  return '0x' + word.slice(-40);
}
function hash(value, allowZero = false) {
  const word = '0x' + tokenHashWord420(value);
  check(allowZero || word !== ZERO_WORD, 'zero hash');
  return word;
}
function contract(item, label) {
  try { return Object.freeze({address: address(item?.address), codeHash: hash(item?.codeHash)}); }
  catch { throw Error('unverified 420Token dependency: ' + label); }
}
function unreserved(a) {
  const n = BigInt(a);
  check(n < 0x420n || n > 0x4ffn, 'Token dependency uses reserved or retired Genesis address');
}
function words(raw, count) {
  check(typeof raw === 'string' && /^0x[0-9a-fA-F]*$/.test(raw) && raw.length === 2 + 64 * count,
    'malformed Token ABI response');
  return Array.from({length: count}, (_, i) => '0x' + raw.slice(2 + i * 64, 66 + i * 64).toLowerCase());
}
function addressOf(word) {
  check(/^0x0{24}[0-9a-f]{40}$/.test(word), 'malformed ABI address');
  return address('0x' + word.slice(-40));
}
function quantity(value) {
  check(typeof value === 'string' && /^0x(?:0|[1-9a-fA-F][0-9a-fA-F]*)$/.test(value), 'invalid RPC quantity');
  return BigInt(value);
}

// Legacy shape validation is deliberately NOT a proof of deployment identity.
export function validateTokenRuntime420(binding) {
  check(binding?.serviceId === TOKEN_SERVICE_ID_420, 'canonical 420Token service id required');
  check(Number.isSafeInteger(binding.chainId) && binding.chainId > 0, 'invalid 420Token chain id');
  check(binding.version === 1, 'unsupported 420Token service version');
  check(binding.communityTreasuryVaultId === TOKEN_COMMUNITY_VAULT_ID_420,
    'canonical 420Token community Treasury vault id required');
  const factory = contract(binding.factory, 'factory');
  const templateRegistry = contract(binding.templateRegistry, 'template registry');
  const communityTreasuryVault = contract(binding.communityTreasuryVault, 'community Treasury vault');
  const identities = [factory, templateRegistry, communityTreasuryVault].map(x => x.address);
  check(new Set(identities).size === identities.length, '420Token dependency alias');
  identities.forEach(unreserved);
  return Object.freeze({serviceId: TOKEN_SERVICE_ID_420, chainId: binding.chainId, version: 1,
    factory, templateRegistry, communityTreasuryVault, communityTreasuryVaultId: TOKEN_COMMUNITY_VAULT_ID_420});
}

export function tokenFactoryTarget420(runtime) { return validateTokenRuntime420(runtime).factory.address; }

// This input is selected by the Wallet from its independently approved release configuration,
// NEVER accepted from a dApp. No release or network is implicitly trusted by its shape.
export function normalizeTokenReleaseBinding420(binding) {
  const runtime = validateTokenRuntime420(binding);
  check(binding.componentId === TOKEN_COMPONENT_ID_420 && binding.genesisConfigHash === TOKEN_GENESIS_V3_420,
    'canonical Token component and Genesis V3 commitment required');
  const registry = contract(binding.registry, 'ProtocolRegistry');
  const governance = contract(binding.governanceTimelock, 'GovernanceTimelock');
  check(registry.address === REGISTRY && governance.address === TIMELOCK, 'wrong canonical Registry or Timelock address');
  check(binding.vaultGraph && Object.keys(binding.vaultGraph).length === VAULT_GRAPH.length, 'incomplete Token Vault graph');
  const graph = Object.freeze(Object.fromEntries(VAULT_GRAPH.map(n => [n, contract(binding.vaultGraph[n], n)])));
  check(graph.AssetVault420.address === runtime.communityTreasuryVault.address &&
    graph.AssetVault420.codeHash === runtime.communityTreasuryVault.codeHash, 'community Vault binding mismatch');
  const dependencies = Object.freeze({GovernanceTimelock:governance, ProtocolRegistry:registry, ...graph,
    TokenTemplateRegistry420:runtime.templateRegistry, TokenFactory420:runtime.factory});
  check(new Set(Object.values(dependencies).map(x => x.address)).size === ORDER.length, 'Token dependency alias');
  VAULT_GRAPH.forEach(n => unreserved(graph[n].address));
  const release = Object.freeze({metadataHash:hash(binding.release?.metadataHash),
    manifestHash:hash(binding.release?.manifestHash), interfaceHash:hash(binding.release?.interfaceHash),
    dependencyRoot:hash(binding.release?.dependencyRoot)});
  const v = binding.vaultRegistration;
  check(v && Array.isArray(v.policyIds) && v.policyIds.length === 4, 'missing Vault registration policies');
  const registration = Object.freeze({creator: address(v.creator), policyIds:Object.freeze(v.policyIds.map(x => hash(x))),
    beneficiarySetId:hash(v.beneficiarySetId,true), metadataHash:hash(v.metadataHash), manifestHash:hash(v.manifestHash)});
  check(new Set(registration.policyIds).size === 4, 'aliased Vault policies');
  const root = tokenHashHex420(tokenEncodeAbi420(
    ['bytes32','bytes32', ...ORDER.flatMap(() => ['address','bytes32']), 'bytes32','bytes32'],
    [tokenHashText420('420/TOKEN/RELEASE/DEPENDENCIES/V1'), TOKEN_GENESIS_V3_420,
      ...ORDER.flatMap(n => [dependencies[n].address, dependencies[n].codeHash]), VAULT_ID, registration.manifestHash]));
  check(root === release.dependencyRoot, 'Token dependency root mismatch');
  return Object.freeze({...runtime, componentId:TOKEN_COMPONENT_ID_420, genesisConfigHash:TOKEN_GENESIS_V3_420,
    genesisHash:hash(binding.genesisHash), registry, governanceTimelock:governance,
    vaultGraph:graph, vaultRegistration:registration, release, dependencies});
}

// Single canonical block snapshot for every read. Recheck chain and canonical block before returning.
export async function verifyTokenRuntime420(provider, binding) {
  const r = normalizeTokenReleaseBinding420(binding);
  check(provider && typeof provider.request === 'function', 'Wallet RPC required');
  await assertWalletChain420(provider, r.chainId);
  const genesis = await provider.request('eth_getBlockByNumber', ['0x0', false]);
  check(genesis && genesis.number === '0x0' && hash(genesis.hash) === r.genesisHash, 'Token genesis identity mismatch');
  const tip = await provider.request('eth_getBlockByNumber', ['latest', false]);
  check(tip && quantity(tip.number) >= 0n, 'missing Token verification block');
  const tag = tip.number, blockHash = hash(tip.hash);
  const read = async (a, sig, count, types = [], values = []) => words(
    await provider.request('eth_call', [{to:a, data:tokenReadCall420(sig, types, values)}, tag]), count);
  const eqAddr = async (a, sig, b) => check(addressOf((await read(a,sig,1))[0]) === b, 'Token immutable mismatch: ' + sig);
  const eqWord = async (a, sig, expected, types = [], values = []) =>
    check((await read(a,sig,1,types,values))[0] === expected, 'Token dependency mismatch: ' + sig);
  for (const name of ORDER) {
    const dep = r.dependencies[name];
    const code = await provider.request('eth_getCode', [dep.address, tag]);
    check(typeof code === 'string' && /^0x(?:[0-9a-fA-F]{2})+$/.test(code) && !/^0x0+$/i.test(code)
      && tokenHashHex420(code) === dep.codeHash, 'Token runtime code mismatch: ' + name);
  }
  const f = r.factory.address, t = r.templateRegistry.address, v = r.communityTreasuryVault.address;
  const vr = r.vaultGraph.VaultRegistry420.address, accounting = r.vaultGraph.VaultAccounting420.address;
  const auth = r.vaultGraph.VaultAuthorization420.address, policy = r.vaultGraph.VaultPolicyRegistry420.address;
  const cap = r.vaultGraph.CapabilityRegistry420.address, reg = r.registry.address;
  await eqAddr(reg,'governanceTimelock()',TIMELOCK);
  await eqAddr(t,'governanceTimelock()',TIMELOCK);
  await eqAddr(f,'templates()',t);
  await eqAddr(f,'communityTreasuryVault()',v);
  await eqWord(f,'CREATION_FEE()','0x'+tokenWord420(TOKEN_CREATION_FEE_WEI_420));
  for (const [a,sig,b] of [[v,'registry()',vr],[v,'accounting()',accounting],[v,'authorization()',auth],
    [vr,'authorization()',auth],[vr,'policies()',policy],[accounting,'registry()',vr],
    [auth,'capabilityRegistry()',cap],[policy,'governanceTimelock()',TIMELOCK],
    [v,'registrationCreator()',r.vaultRegistration.creator]]) await eqAddr(a,sig,b);
  await eqWord(v,'vaultId()',VAULT_ID);
  await eqWord(vr,'vaultIdForAddress(address)',VAULT_ID,['address'],[v]);
  const record = await read(vr,'getVault(bytes32)',14,['bytes32'],[VAULT_ID]);
  check(addressOf(record[0])===v && addressOf(record[1])===r.vaultRegistration.creator &&
    record[2]===tokenHashText420('420/VAULT/TYPE/COMMUNITY/V1') &&
    record.slice(3,7).every((w,i)=>w===r.vaultRegistration.policyIds[i]) &&
    record[7]===r.vaultRegistration.beneficiarySetId && record[8]===r.vaultRegistration.metadataHash &&
    record[9]===r.vaultRegistration.manifestHash && BigInt(record[10]) < (1n<<64n) &&
    BigInt(record[11]) > 0n && BigInt(record[11]) <= 0xffffffffn &&
    BigInt(record[12])===1n && BigInt(record[13])===1n, 'inactive or incorrect registered community Vault');
  for (let i=0;i<4;i++) await eqWord(policy,'isActiveOfType(bytes32,bytes32)','0x'+tokenWord420(1n),
    ['bytes32','bytes32'],[r.vaultRegistration.policyIds[i],POLICY_TYPES[i]]);
  const service = await read(reg,'getService(bytes32)',6,['bytes32'],[SERVICE_ID]);
  check(addressOf(service[0])===f && service[1]===r.factory.codeHash && service[2]===r.release.metadataHash &&
    BigInt(service[3])===1n && BigInt(service[4]) < (1n<<64n) && BigInt(service[5])===1n,
    'inactive or mismatched Token Registry service');
  const component=await read(reg,'component(bytes32)',7,['bytes32'],[COMPONENT_ID]);
  check(component[0]===COMPONENT_ID && addressOf(component[1])===f && component[2]===r.factory.codeHash &&
    component.slice(3).map(BigInt).every((n,i)=>n===[1n,0n,0n,2n][i]), 'inactive or mismatched Token Registry component');
  const profile=await read(reg,'getRegistrationProfile(bytes32,uint32)',4,['bytes32','uint256'],[SERVICE_ID,1]);
  check(BigInt(profile[0])===3n && profile[1]===r.release.manifestHash && profile[2]===r.release.dependencyRoot &&
    profile[3]===r.release.interfaceHash, 'Token Registry release commitments mismatch');
  const resolved = await read(reg,'resolveActive(bytes32)',2,['bytes32'],[SERVICE_ID]);
  check(addressOf(resolved[0])===f && BigInt(resolved[1])===1n, 'Token service resolution mismatch');
  const resolvedComponent = await read(reg,'resolve(bytes32)',1,['bytes32'],[COMPONENT_ID]);
  check(addressOf(resolvedComponent[0])===f, 'Token component resolution mismatch');
  const templates = [];
  for (const template of TOKEN_TEMPLATES_420) {
    const entry = await read(t,'template(bytes32)',5,['bytes32'],[template.id]);
    check(BigInt(entry[0])===1n && entry[1]===template.standardWord && entry[2]===template.profileHash &&
      BigInt(entry[3])<=1n && BigInt(entry[4])===1n, 'Token template profile mismatch: '+template.key);
    const enabled=BigInt(entry[3])===1n;
    await eqWord(t,'enabled(bytes32)','0x'+tokenWord420(enabled?1n:0n),['bytes32'],[template.id]);
    templates.push(Object.freeze({...template, enabled}));
  }
  const canonical = await provider.request('eth_getBlockByNumber',[tag,false]);
  check(canonical && quantity(canonical.number)===quantity(tag) && hash(canonical.hash)===blockHash,
    'Token verification block reorganized');
  await assertWalletChain420(provider,r.chainId);
  return Object.freeze({...r, templates:Object.freeze(templates), verificationBlock:Object.freeze({number:tag,hash:blockHash})});
}
