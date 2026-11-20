// Wallet-owned, read-only Token discovery. Never use an ecosystem manifest, dApp
// message, route parameter or cached result as deployment authority.
import { normalizeTokenReleaseBinding420, verifyTokenRuntime420 } from './token-runtime.js';
import { discoverSmartAccount } from './accounts.js';
import { assertWalletChain420 } from './transaction-lifecycle.js';
import { prepareTokenDeploymentHandoff420 } from './token-handoff.js';
import { validateTokenCreationEncoding420, tokenHashHex420, tokenReadCall420 } from './token-sdk.js';
import { TOKEN_CREATION_FEE_WEI_420 } from './token-runtime.js';

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
  // Bound stalled RPCs and ensure the discovery path cannot request authority.
  const underlying=provider;
  const deadline=Date.now()+60000;
  provider={request:async(method,params=[])=>{
    check(['eth_accounts','eth_chainId','eth_getBlockByNumber','eth_getCode','eth_call'].includes(method),'non-discovery RPC method');
    const remaining=Math.min(10000,deadline-Date.now());
    check(remaining>0,'Token discovery timed out');
    let timer;
    try {
      return await Promise.race([Promise.resolve().then(()=>underlying.request(method,params)),
        new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Token discovery RPC timed out')),remaining);})]);
    } finally { clearTimeout(timer); }
  }};
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
    authorizationEpoch:fresh.deployed?fresh.authorizationEpoch.toString():null,
    authorizationPolicyVersion:fresh.deployed?fresh.authorizationPolicyVersion.toString():null,
    runtime, verificationBlock:runtime.verificationBlock,
    // Discovery is not authorization or confirmation. Re-verify at handoff.
    authority:'DISCOVERY_ONLY', accountGrant:false, spendingAuthority:false,
  });
}
const status = (state) => Object.freeze({status:state, authority:'DISCOVERY_ONLY',
  accountGrant:false, spendingAuthority:false});
// A disconnect, account/chain change or newer refresh invalidates the old result.
export function createTokenDiscoverySession420() {
  let generation=0, snapshot=status('unconfigured'), context=null;
  const listeners=new Set();
  function publish(value) {
    snapshot=value;
    for (const listener of [...listeners]) listener(value);
    return value;
  }
  function subscribe(listener) {
    check(typeof listener==='function','Token discovery listener required');
    listeners.add(listener); listener(snapshot);
    return ()=>listeners.delete(listener);
  }
  function invalidate(reason='disconnected') { generation++; context=null; return publish(status(reason)); }
  async function refresh({provider,config,controller,smartAccount}={}) {
    const attempt=++generation;
    context=null;
    if (config?.token==null) return publish(status('unconfigured'));
    if (!provider || !controller || !smartAccount) return publish(status('disconnected'));
    try {
      // Only the host's last connected inputs may be reused by a read-only refresh.
      context={provider,config:structuredClone(config),controller,smartAccount:structuredClone(smartAccount)};
      publish(status('checking'));
      const result=await discoverWalletTokenRuntime420(provider,context.config,controller,context.smartAccount);
      if (attempt!==generation) return snapshot;
      return publish(result);
    } catch {
      if (attempt!==generation) return snapshot;
      return publish(status('blocked'));
    }
  }
  async function refreshCurrent(){
    if(!context)return null;
    const expected=generation+1;
    const result=await refresh(context);
    return generation===expected&&snapshot===result?result:null;
  }
  // Only the host-retained provider/release/account can be used. No provider,
  // signer or context is returned. Every RPC is read-only and generation-bound.
  async function simulateCurrent(draft,expected=snapshot,priorReview=null){
    check(context&&snapshot===expected&&expected.status==='verified'&&expected.controllerIsOwner&&expected.deployed,
      'Wallet review context unavailable');
    const attempt=generation,host=context;
    const active=()=>check(attempt===generation&&context===host&&snapshot===expected,'Wallet review context changed');
    const deadline=Date.now()+60000;
    const allowed=['eth_accounts','eth_chainId','eth_getBlockByNumber','eth_getCode','eth_call','eth_estimateGas','eth_gasPrice','eth_getBalance'];
    const provider={request:async(method,params=[])=>{
      active();check(allowed.includes(method),'non-review RPC method');
      const remaining=Math.min(10000,deadline-Date.now());
      check(remaining>0,'Token review timed out');
      let timer;
      try{
        const result=await Promise.race([Promise.resolve().then(()=>host.provider.request(method,params)),
          new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Token review RPC timed out')),remaining);})]);
        active();return result;
      }finally{clearTimeout(timer);}
    }};
    const d=structuredClone(draft), r=d?.request;
    check(d?.authority==='DRAFT_ONLY'&&d.confirmationRequired===true&&d.owner===expected.smartAccount&&
      d.controller===expected.controller&&d.chainId===expected.runtime.chainId&&d.environment===expected.environment&&
      d.verificationBlock?.number===expected.verificationBlock.number&&d.verificationBlock?.hash===expected.verificationBlock.hash&&
      ['manifestHash','dependencyRoot','metadataHash','interfaceHash'].every(k=>d.release?.[k]===expected.runtime.release[k]),
      'Token draft does not match Wallet review context');
    const creation=validateTokenCreationEncoding420(r?.draft,{data:r?.data,templateId:r?.templateId,configHash:r?.configHash,calldataHash:r?.calldataHash});
    check(d.profile?.id===creation.template.id&&expected.runtime.templates.find(p=>p.id===creation.template.id)?.enabled,
      'Token draft template is not verified');
    const canonical=async block=>{
      const b=await provider.request('eth_getBlockByNumber',[block.number,false]);
      check(b?.number===block.number&&b.hash?.toLowerCase()===block.hash,'Token review block reorganized');
    };
    await canonical(expected.verificationBlock);
    if(priorReview){await canonical(priorReview.simulationBlock);await canonical(priorReview.verificationBlock);}
    const before=await discoverWalletTokenRuntime420(provider,host.config,host.controller,host.smartAccount);
    const sameAccount=x=>x.controllerIsOwner&&x.deployed&&x.smartAccount===expected.smartAccount&&
      x.controller===expected.controller&&x.authorizationEpoch===expected.authorizationEpoch&&
      x.authorizationPolicyVersion===expected.authorizationPolicyVersion;
    check(sameAccount(before),'SmartAccount ownership or authorization epoch changed');
    const simulationBlock=before.verificationBlock;
    // Pin the simulation and estimate to the same canonical block as the
    // release and account reads. No silent fallback to an unpinned estimate.
    const pinned={request:(method,params=[])=>{
      if(['eth_getBlockByNumber','eth_getCode','eth_call'].includes(method)){
        const index=method==='eth_getBlockByNumber'?0:1;
        if(params[index]==='latest'){params=[...params];params[index]=simulationBlock.number;}
      }
      if(method==='eth_estimateGas')params=[params[0],simulationBlock.number];
      return provider.request(method,params);
    }};
    const fresh=await discoverSmartAccount(pinned,host.controller,walletAccountConfig(host.config));
    check(fresh.smartAccount===expected.smartAccount&&fresh.controllerIsOwner&&fresh.authorizationEpoch.toString()===before.authorizationEpoch&&
      fresh.authorizationPolicyVersion.toString()===before.authorizationPolicyVersion,'SmartAccount authority changed');
    const prepared=await prepareTokenDeploymentHandoff420(pinned,host.controller,{...fresh,expectedChainId:d.chainId},
      normalizeTokenWalletConfig420(host.config).binding,r);
    // execute() returns ABI bytes containing the factory's returned address.
    // Empty return data is not successful Token deployment simulation.
    const result=prepared.simulation.result;
    check(typeof result==='string'&&/^0x[0-9a-fA-F]{192}$(?![\s\S])/.test(result)&&
      BigInt('0x'+result.slice(2,66))===32n&&BigInt('0x'+result.slice(66,130))===32n&&
      /^0{24}[0-9a-fA-F]{40}$/.test(result.slice(130)),'Malformed Token simulation return');
    const predicted=address('0x'+result.slice(-40));
    check(![expected.controller,expected.smartAccount,...Object.values(expected.runtime.dependencies).map(x=>x.address)].includes(predicted),
      'Token simulation returned an authority address');
    const quantity=(x,label)=>{
      check(typeof x==='string'&&x.length<=66&&/^0x(?:0|[1-9a-fA-F][0-9a-fA-F]*)$(?![\s\S])/.test(x),'Invalid '+label);
      return BigInt(x);
    };
    const gas=quantity(prepared.simulation.gas,'gas estimate');check(gas>0n,'Invalid zero gas estimate');
    const price=quantity(await provider.request('eth_gasPrice',[]),'gas price');
    check(prepared.verificationBlock.number===simulationBlock.number&&prepared.verificationBlock.hash===simulationBlock.hash,'Token simulation block mismatch');
    const after=await discoverWalletTokenRuntime420(provider,host.config,host.controller,host.smartAccount);
    check(sameAccount(after)&&after.runtime.templates.find(p=>p.id===creation.template.id)?.enabled,
      'SmartAccount authority or template availability changed during review');
    const block=after.verificationBlock;
    // A new block is normal. Verify the creator nonce did not advance between
    // the simulation block and the latest verified release/account snapshot.
    const nonceCall={to:prepared.target,data:tokenReadCall420('creatorNonce(address)',['address'],[expected.smartAccount])};
    const nonceAt=async tag=>{const n=await provider.request('eth_call',[nonceCall,tag]);
      check(typeof n==='string'&&/^0x[0-9a-fA-F]{64}$(?![\\s\\S])/.test(n),'Invalid creator nonce');return BigInt(n).toString();};
    const creatorNonce=await nonceAt(simulationBlock.number);
    check(creatorNonce===await nonceAt(block.number),'Creator nonce changed during simulation; retry review');
    const [walletBalance,controllerBalance]=await Promise.all([
      provider.request('eth_getBalance',[expected.smartAccount,block.number]).then(x=>quantity(x,'SmartAccount balance')),
      provider.request('eth_getBalance',[expected.controller,block.number]).then(x=>quantity(x,'controller balance')),
    ]);
    const gasCost=gas*price,total=TOKEN_CREATION_FEE_WEI_420+gasCost;
    check(total<2n**256n,'Fee estimate overflow');
    check(walletBalance>=TOKEN_CREATION_FEE_WEI_420,'Insufficient SmartAccount balance for 42 native 420 fee');
    check(controllerBalance>=gasCost,'Insufficient controller balance for estimated network gas');
    await canonical(expected.verificationBlock);if(priorReview){await canonical(priorReview.simulationBlock);await canonical(priorReview.verificationBlock);}
    await canonical(simulationBlock);await canonical(block);
    await selectedAccount(provider,expected.controller);await assertWalletChain420(provider,d.chainId);active();
    return Object.freeze({authority:'SIMULATED_REVIEW_ONLY',controller:expected.controller,smartAccount:expected.smartAccount,
      chainId:d.chainId,environment:d.environment,authorizationEpoch:after.authorizationEpoch,
      authorizationPolicyVersion:after.authorizationPolicyVersion,templateId:creation.template.id,configHash:creation.configHash,
      calldataHash:creation.calldataHash,executionHash:tokenHashHex420(prepared.transaction.data),
      request:Object.freeze({serviceId:prepared.serviceId,target:prepared.target,value:prepared.value,data:prepared.data,
        draft:creation.draft,templateId:creation.template.id,configHash:creation.configHash,calldataHash:creation.calldataHash}),
      transaction:prepared.transaction,release:prepared.release,
      simulationBlock,verificationBlock:block,creatorNonce,predictedAddress:predicted,communityTreasuryVault:prepared.communityTreasuryVault,
      creationFeeWei:TOKEN_CREATION_FEE_WEI_420.toString(),gasUnits:gas.toString(),gasPriceWei:price.toString(),
      estimatedGasWei:gasCost.toString(),estimatedTotalWei:total.toString(),smartAccountBalanceWei:walletBalance.toString(),
      controllerBalanceWei:controllerBalance.toString(),simulationPassed:true});
  }
  return Object.freeze({refresh,refreshCurrent,simulateCurrent,canRefresh:()=>context!==null,invalidate,subscribe,getSnapshot:()=>snapshot});
}

// Shared by the privileged Wallet web host and its own catalogue, not a DOM event or external dApp API.
export const walletTokenDiscovery420=createTokenDiscoverySession420();
