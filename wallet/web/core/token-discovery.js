// Wallet-owned, read-only Token discovery. Never use an ecosystem manifest, dApp
// message, route parameter or cached result as deployment authority.
import { normalizeTokenReleaseBinding420, verifyTokenRuntime420 } from './token-runtime.js';
import { discoverSmartAccount } from './accounts.js';
import { assertWalletChain420 } from './transaction-lifecycle.js';

const environments = new Set(['local','devnet','testnet','mainnet']);
const check = (ok, message) => { if (!ok) throw Error(message); };
function address(value) {
  check(typeof value==='string' && /^0x[0-9a-fA-F]{40}$/.test(value) && BigInt(value)!==0n,
    'missing or malformed Wallet account/deployment address');
  return value.toLowerCase();
}
function chain(value) {
  check(typeof value==='string' && /^0x[0-9a-fA-F]+$/.test(value) && BigInt(value)>0n &&
    BigInt(value)<=BigInt(Number.MAX_SAFE_INTEGER), 'invalid Wallet Token chain');
  return Number(BigInt(value));
}

// Only the same-origin Wallet runtime config, generated from verified deployment
// inventory, selects the independent release pin. On-chain state must still match.
export function normalizeTokenWalletConfig420(config) {
  if (config?.token == null) return null;
  const token=config.token, deployment=config.deployment;
  check(token && typeof token==='object' && !Array.isArray(token) &&
    Object.keys(token).length===2 && Object.hasOwn(token,'environment') && Object.hasOwn(token,'binding'),
    'malformed Wallet Token configuration');
  check(environments.has(token.environment) && token.environment===deployment?.environment,
    'Token release environment differs from Wallet deployment');
  const binding=normalizeTokenReleaseBinding420(token.binding);
  check(chain(config.network?.chainId)===binding.chainId,'Token release chain differs from Wallet network');
  check(address(deployment.protocolRegistryAddress)===binding.registry.address,
    'Token ProtocolRegistry differs from Wallet authority');
  check(address(deployment.capabilityRegistryAddress)===binding.vaultGraph.CapabilityRegistry420.address,
    'Token CapabilityRegistry differs from Wallet authority');
  address(deployment.entryPointAddress);
  address(config.smartAccount?.factoryAddress);
  return Object.freeze({environment:token.environment,binding});
}
function walletAccountConfig(config) {
  return Object.freeze({
    factoryAddress:address(config.smartAccount.factoryAddress),
    recoveryAuthority:config.smartAccount.recoveryAuthority ?? null,
    salt:config.smartAccount.salt ?? null,
    verifiedEntryPoint:address(config.deployment.entryPointAddress),
    verifiedCapabilityRegistry:address(config.deployment.capabilityRegistryAddress),
  });
}
async function selectedAccount(provider, expected) {
  const accounts=await provider.request('eth_accounts',[]);
  check(Array.isArray(accounts) && accounts.length>0 && address(accounts[0])===expected,
    'selected Wallet account changed or disconnected');
}
export async function discoverWalletTokenRuntime420(provider, config, controller, selectedSmartAccount) {
  const approved=normalizeTokenWalletConfig420(config);
  check(approved,'Token release is not configured');
  check(provider && typeof provider.request==='function','connected Wallet provider required');
  const owner=address(controller), selected=address(selectedSmartAccount?.smartAccount);
  check(address(selectedSmartAccount?.controller)===owner,'Token Wallet controller mismatch');
  check(typeof selectedSmartAccount?.deployed==='boolean','Token Wallet account deployment state missing');
  check(selectedSmartAccount.expectedChainId!=null && BigInt(selectedSmartAccount.expectedChainId)===BigInt(approved.binding.chainId),
    'Token Wallet account chain mismatch');
  const accountConfig=walletAccountConfig(config);
  const selectedDeployed=selectedSmartAccount.deployed;
  await assertWalletChain420(provider,approved.binding.chainId);
  await selectedAccount(provider,owner);
  const runtime=await verifyTokenRuntime420(provider,approved.binding);
  const fresh=await discoverSmartAccount(provider,owner,accountConfig);
  check(fresh.smartAccount===selected && fresh.deployed===selectedDeployed,
    'selected Wallet SmartAccount changed during Token discovery');
  const canonical=await provider.request('eth_getBlockByNumber',[runtime.verificationBlock.number,false]);
  check(canonical?.number===runtime.verificationBlock.number &&
    canonical.hash?.toLowerCase()===runtime.verificationBlock.hash,'Token discovery block reorganized');
  await selectedAccount(provider,owner);
  await assertWalletChain420(provider,approved.binding.chainId);
  return Object.freeze({
    status:'verified', serviceId:runtime.serviceId, environment:approved.environment,
    controller:owner, smartAccount:selected, deployed:fresh.deployed,
    controllerIsOwner:fresh.deployed && fresh.controllerIsOwner===true,
    runtime, verificationBlock:runtime.verificationBlock,
    // Discovery is not authorization or confirmation. Re-verify at handoff.
    authority:'DISCOVERY_ONLY', accountGrant:false, spendingAuthority:false,
  });
}
const status = (state) => Object.freeze({status:state, authority:'DISCOVERY_ONLY',
  accountGrant:false, spendingAuthority:false});
// A disconnect, account/chain change or newer refresh invalidates the old result.
export function createTokenDiscoverySession420({onChange=()=>{}}={}) {
  let generation=0, snapshot=status('unconfigured');
  function publish(value) { snapshot=value; onChange(value); return value; }
  function invalidate(reason='disconnected') { generation++; return publish(status(reason)); }
  async function refresh({provider,config,controller,smartAccount}={}) {
    const attempt=++generation;
    if (config?.token==null) return publish(status('unconfigured'));
    if (!provider || !controller || !smartAccount) return publish(status('disconnected'));
    publish(status('checking'));
    try {
      const result=await discoverWalletTokenRuntime420(provider,config,controller,smartAccount);
      if (attempt!==generation) return snapshot;
      return publish(result);
    } catch {
      if (attempt!==generation) return snapshot;
      return publish(status('blocked'));
    }
  }
  return Object.freeze({refresh,invalidate,getSnapshot:()=>snapshot});
}
