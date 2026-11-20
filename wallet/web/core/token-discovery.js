// Wallet-owned, read-only Token discovery. Never use an ecosystem manifest, dApp
// message, route parameter or cached result as deployment authority.
import { normalizeTokenReleaseBinding420, verifyTokenRuntime420 } from './token-runtime.js';
import { discoverSmartAccount } from './accounts.js';
import {prepareTokenManagement420,sameTokenManagementReview420,readTokenManagementReceipt420,tokenManagementActions420,inspectTokenPermissions420} from './token-management.js';
import {readCreatedTokenPage420} from './token-portfolio.js';
import { readTokenDeployment420 } from './token-deployment.js';
import { assertWalletChain420, normalizeTransactionHash420 } from './transaction-lifecycle.js';
import { prepareTokenDeploymentHandoff420 } from './token-handoff.js';
import { validateTokenCreationEncoding420, tokenHashHex420, tokenReadCall420, readTokenRecord420 } from './token-sdk.js';
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
    recoveryAuthority:fresh.deployed?fresh.recoveryAuthority:null,pendingRecoveryOwner:fresh.deployed?fresh.pendingRecoveryOwner:null,recoveryExecutableAt:fresh.deployed?fresh.recoveryExecutableAt.toString():null,
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
  const listeners=new Set(), transactionListeners=new Set(), issued=new WeakMap(), authorizations=new WeakMap();
  const records=[];let sending=false,checking=false;
  const managementQuotes=new WeakMap(),managementApprovals=new WeakMap(),managementBindings=new WeakMap();let managementRevision=0,permissionRevision=0;
  function cancelManagement(){++managementRevision;++permissionRevision;}
  const sameRelease=(a,b)=>['metadataHash','manifestHash','interfaceHash','dependencyRoot'].every(k=>a.release[k]===b.release[k]);
  const portfolioListeners=new Set();let portfolioAttempt=0,portfolioPage=null;
  const emptyPortfolio=(status='idle',error='')=>Object.freeze({status,error,items:Object.freeze([]),page:null});
  let portfolio=emptyPortfolio();
  const publishPortfolio=v=>{portfolio=v;for(const fn of [...portfolioListeners])fn(v);return v;};
  function subscribePortfolio(fn){portfolioListeners.add(fn);fn(portfolio);return()=>portfolioListeners.delete(fn);}
  function clearPortfolio(){cancelManagement();++portfolioAttempt;portfolioPage=null;publishPortfolio(emptyPortfolio());}
  const visible=()=>Object.freeze(records.filter(x=>snapshot.status==='verified'&&x.review.chainId===snapshot.runtime.chainId&&x.review.controller===snapshot.controller&&x.review.smartAccount===snapshot.smartAccount&&x.review.release.manifestHash===snapshot.runtime.release.manifestHash).map(x=>Object.freeze({txHash:x.txHash,status:x.status,error:x.error||'',confirmation:x.confirmation||null,kind:x.kind||'creation',label:x.review.label||null}))); 
  function emitTransactions(){for(const fn of [...transactionListeners])fn(visible());}
  function subscribeTransactions(fn){transactionListeners.add(fn);fn(visible());return()=>transactionListeners.delete(fn);}
  function publish(value) {
    if(snapshot!==value){for(const x of records){if(x.status==='confirmed'||x.status==='reverted'){x.status='unverified';x.confirmation=null;x.error='Wallet context refreshed. Recheck canonical receipt.';}}}
    snapshot=value;clearPortfolio();
    for (const listener of [...listeners]) listener(value);
    emitTransactions();return value;
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
      check(typeof n==='string'&&/^0x[0-9a-fA-F]{64}$(?![\s\S])/.test(n),'Invalid creator nonce');return BigInt(n).toString();};
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
    const quote=Object.freeze({authority:'SIMULATED_REVIEW_ONLY',controller:expected.controller,smartAccount:expected.smartAccount,
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
    issued.set(quote,{draft,expected,generation:attempt});return quote;
  }
  async function refreshPortfolio(more=false){
    if(!context||snapshot.status!=='verified'||portfolio.status==='checking'||(more&&(!portfolioPage||portfolioPage.complete)))return null;
    const prior=more?portfolioPage:null,previousItems=more?portfolio.items:[],host=context,expected=snapshot,attempt=++portfolioAttempt,epoch=generation;
    const active=()=>check(attempt===portfolioAttempt&&epoch===generation&&context===host&&snapshot===expected,'Portfolio context changed');
    const deadline=Date.now()+60000,allowed=['eth_accounts','eth_chainId','eth_getBlockByNumber','eth_getCode','eth_call','eth_getLogs','eth_getTransactionReceipt'];
    const provider={request:async(method,params=[])=>{
      active();check(allowed.includes(method),'Non-portfolio RPC method');
      const remaining=Math.min(10000,deadline-Date.now());check(remaining>0,'Portfolio request timed out');
      let timer;try{const v=await Promise.race([Promise.resolve().then(()=>host.provider.request(method,params)),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Portfolio RPC timed out')),remaining);})]);active();return v;}finally{clearTimeout(timer);}
    }};
    portfolioPage=null;publishPortfolio(emptyPortfolio('checking'));
    try{
      // Fresh runtime discovery on first page; following pages stay on the
      // same canonical block and are never mixed with another snapshot.
      const fresh=prior?expected:await discoverWalletTokenRuntime420(provider,host.config,host.controller,host.smartAccount);
      check(fresh.status==='verified'&&fresh.smartAccount===expected.smartAccount&&fresh.controller===expected.controller&&fresh.runtime.release.dependencyRoot===expected.runtime.release.dependencyRoot,'Portfolio Wallet context mismatch');
      await selectedAccount(provider,expected.controller);
      const page=await readCreatedTokenPage420(provider,normalizeTokenWalletConfig420(host.config).binding,expected.smartAccount,prior?.block??fresh.verificationBlock,prior);
      await selectedAccount(provider,expected.controller);await assertWalletChain420(provider,expected.runtime.chainId);active();
      portfolioPage=page;return publishPortfolio(Object.freeze({status:'verified',error:'',page,items:Object.freeze([...previousItems,...page.items])}));
    }catch(e){if(attempt===portfolioAttempt){portfolioPage=null;publishPortfolio(emptyPortfolio('blocked','Portfolio unavailable: '+String(e?.message||'Verification failed').slice(0,240)));}return null;}
  }
  async function reviewManagement(row,action,input){return reviewManagementAt(row,action,input,null,++managementRevision);}
  async function reviewManagementAt(row,action,input,prior,revision){
    check(context&&snapshot.status==='verified'&&snapshot.controllerIsOwner&&snapshot.deployed&&portfolio.status==='verified'&&portfolio.items.includes(row),'Verified created-token record and Wallet owner required');
    const expected=snapshot,host=context,attempt=generation,portfolioVersion=portfolioAttempt,deadline=Date.now()+60000;
    const active=()=>check(snapshot===expected&&context===host&&generation===attempt&&portfolioAttempt===portfolioVersion&&managementRevision===revision,'Management context changed');
    const allowed=['eth_accounts','eth_chainId','eth_getBlockByNumber','eth_getCode','eth_call','eth_estimateGas','eth_gasPrice','eth_getBalance'];
    const provider={request:async(method,params=[])=>{active();check(allowed.includes(method),'Non-management RPC method');const remaining=Math.min(10000,deadline-Date.now());check(remaining>0,'Management review timed out');let timer;try{
      const value=await Promise.race([Promise.resolve().then(()=>host.provider.request(method,params)),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Management RPC timed out')),remaining);})]);active();return value;
    }finally{clearTimeout(timer);}}};
    const actionSpec=tokenManagementActions420(row,expected.smartAccount).find(x=>x.key===action);check(actionSpec,'Management action is unavailable');
    const source=Object.freeze(readTokenRecord420(input,actionSpec.fields.map(x=>x.name),'Token management fields'));
    const canonical=async b=>{const at=await provider.request('eth_getBlockByNumber',[b.number,false]);check(at?.number===b.number&&at.hash?.toLowerCase()===b.hash,'Management block reorganized');};
    await canonical(portfolio.page.block);if(prior)await canonical(prior.block);
    const fresh=await discoverWalletTokenRuntime420(provider,host.config,host.controller,host.smartAccount);
    const sameAccount=x=>x.deployed&&x.controllerIsOwner&&x.smartAccount===expected.smartAccount&&x.controller===expected.controller&&x.authorizationEpoch===expected.authorizationEpoch&&x.authorizationPolicyVersion===expected.authorizationPolicyVersion&&x.recoveryAuthority===expected.recoveryAuthority&&x.pendingRecoveryOwner===expected.pendingRecoveryOwner&&x.recoveryExecutableAt===expected.recoveryExecutableAt;
    check(sameAccount(fresh)&&sameRelease(fresh.runtime,expected.runtime),'SmartAccount authority or Token release changed');
    const pinned={request:(method,params=[])=>{if(['eth_getCode','eth_call'].includes(method)&&params[1]==='latest')params=[params[0],fresh.verificationBlock.number];return provider.request(method,params);}};
    const pinnedAccount=await discoverSmartAccount(pinned,host.controller,walletAccountConfig(host.config));
    check(pinnedAccount.smartAccount===expected.smartAccount&&pinnedAccount.controllerIsOwner&&pinnedAccount.deployed&&pinnedAccount.authorizationEpoch.toString()===expected.authorizationEpoch&&pinnedAccount.authorizationPolicyVersion.toString()===expected.authorizationPolicyVersion&&pinnedAccount.recoveryAuthority===expected.recoveryAuthority&&pinnedAccount.pendingRecoveryOwner===expected.pendingRecoveryOwner&&pinnedAccount.recoveryExecutableAt.toString()===expected.recoveryExecutableAt,'Pinned SmartAccount authority changed');
    const accountCode=await provider.request('eth_getCode',[expected.smartAccount,fresh.verificationBlock.number]);check(/^0x(?:[0-9a-fA-F]{2})+$/.test(accountCode)&&!/^0x0+$/i.test(accountCode),'Invalid SmartAccount runtime');
    const accountAuthority=Object.freeze({owner:pinnedAccount.owner,epoch:expected.authorizationEpoch,policyVersion:expected.authorizationPolicyVersion,recoveryAuthority:expected.recoveryAuthority,pendingRecoveryOwner:expected.pendingRecoveryOwner,recoveryExecutableAt:expected.recoveryExecutableAt,codeHash:tokenHashHex420(accountCode)});
    if(prior)check(JSON.stringify(prior.accountAuthority)===JSON.stringify(accountAuthority),'SmartAccount runtime or recovery state changed');
    const prepared=await prepareTokenManagement420(provider,fresh.runtime,row,fresh.smartAccount,fresh.controller,action,source);
    const after=await discoverWalletTokenRuntime420(provider,host.config,host.controller,host.smartAccount);
    check(sameAccount(after)&&sameRelease(after.runtime,fresh.runtime)&&after.verificationBlock.hash===fresh.verificationBlock.hash&&after.verificationBlock.number===fresh.verificationBlock.number,'Management simulation block or authority changed; refresh review');
    check(tokenHashHex420(await provider.request('eth_getCode',[expected.smartAccount,fresh.verificationBlock.number]))===accountAuthority.codeHash,'SmartAccount runtime changed');
    await canonical(fresh.verificationBlock);await canonical(portfolio.page.block);if(prior)await canonical(prior.block);
    await selectedAccount(provider,expected.controller);await assertWalletChain420(provider,expected.runtime.chainId);active();
    const pending=accountAuthority.pendingRecoveryOwner!=='0x'+'0'.repeat(40);
    const security=pending?Object.freeze({...prepared.security,warnings:Object.freeze([...prepared.security.warnings,'A SmartAccount recovery is pending. Review the recovery owner and executable time; management authority may change.'])}):prepared.security;
    const quote=Object.freeze({...prepared,security,accountAuthority,authorizationEpoch:fresh.authorizationEpoch,authorizationPolicyVersion:fresh.authorizationPolicyVersion});
    managementQuotes.set(quote,{row,action,input:source,expected,portfolioVersion,attempt,revision});managementBindings.set(quote,revision);return quote;
  }
  async function inspectManagementPermissions(row,input={}){
    check(context&&snapshot.status==='verified'&&portfolio.status==='verified'&&portfolio.items.includes(row),'Verified created-token record required');
    const expected=snapshot,host=context,attempt=generation,portfolioVersion=portfolioAttempt,revision=++permissionRevision,deadline=Date.now()+60000;
    const active=()=>check(context===host&&snapshot===expected&&generation===attempt&&portfolioVersion===portfolioAttempt&&permissionRevision===revision,'Permission lookup context changed');
    const query=Object.freeze(readTokenRecord420(input,['spender','id'],'Permission lookup'));
    const provider={request:async(method,params=[])=>{active();check(['eth_accounts','eth_chainId','eth_getBlockByNumber','eth_getCode','eth_call'].includes(method),'Non-permission RPC method');let timer;try{const remaining=Math.min(10000,deadline-Date.now());check(remaining>0,'Permission lookup timed out');const value=await Promise.race([Promise.resolve().then(()=>host.provider.request(method,params)),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Permission RPC timed out')),remaining);})]);active();return value;}finally{clearTimeout(timer);}}};
    const canonical=async b=>{const at=await provider.request('eth_getBlockByNumber',[b.number,false]);check(at?.number===b.number&&at.hash?.toLowerCase()===b.hash,'Permission lookup block reorganized');};
    await canonical(portfolio.page.block);
    const fresh=await discoverWalletTokenRuntime420(provider,host.config,host.controller,host.smartAccount);
    check(fresh.smartAccount===expected.smartAccount&&fresh.controller===expected.controller&&sameRelease(fresh.runtime,expected.runtime),'Permission lookup release or account changed');
    const view=await inspectTokenPermissions420(provider,fresh.runtime,row,fresh.smartAccount,query);
    await canonical(fresh.verificationBlock);await canonical(portfolio.page.block);await selectedAccount(provider,expected.controller);await assertWalletChain420(provider,expected.runtime.chainId);active();
    return view;
  }
  function managementSource(quote){
    const source=managementQuotes.get(quote);
    check(source&&source.expected===snapshot&&source.attempt===generation&&source.portfolioVersion===portfolioAttempt&&source.revision===managementRevision&&portfolio.items.includes(source.row),'Management review unavailable or stale');
    return source;
  }
  async function authorizeManagement(quote,active=()=>true,acknowledgement=null){
    const source=managementSource(quote);managementQuotes.delete(quote);
    check(active(),'Management authorization cancelled');
    check(quote.security.acknowledgement===null||acknowledgement===quote.security.acknowledgement,'Exact management risk acknowledgement required');
    const fresh=await reviewManagementAt(source.row,source.action,source.input,quote,source.revision);
    managementQuotes.delete(fresh);check(active()&&source.revision===managementRevision&&sameTokenManagementReview420(quote,fresh),'Management review changed or cancelled; review again');
    const approval=Object.freeze({authority:'EXPLICIT_TOKEN_MANAGEMENT_AUTHORIZATION',review:fresh});
    managementApprovals.set(approval,{...source,quote:fresh});managementBindings.set(approval,source.revision);return approval;
  }
  function revokeManagement(value){if(!value)return;managementApprovals.delete(value);managementQuotes.delete(value);if(managementBindings.get(value)===managementRevision)cancelManagement();}
  async function submitManagement(approval,active=()=>true){
    const source=managementApprovals.get(approval);managementApprovals.delete(approval);
    check(source&&source.expected===snapshot&&source.attempt===generation&&source.portfolioVersion===portfolioAttempt&&source.revision===managementRevision&&!sending&&active(),'Management authorization unavailable, stale or consumed');
    const host=context,q=source.quote;let record=null;sending=true;
    try{
      check(!records.some(x=>x.review.chainId===q.chainId&&x.review.smartAccount===q.smartAccount&&['submitting','pending','confirming','reorganized','unknown','unverified'].includes(x.status)),'Resolve existing Token submission first');
      const fresh=await reviewManagementAt(source.row,source.action,source.input,q,source.revision);managementQuotes.delete(fresh);
      check(active()&&context===host&&generation===source.attempt&&portfolioAttempt===source.portfolioVersion&&source.revision===managementRevision&&sameTokenManagementReview420(q,fresh),'Management review changed or cancelled; review again');
      record={kind:'management',review:q,txHash:null,status:'submitting'};records.push(record);emitTransactions();
      const tx={...q.transaction,gas:'0x'+BigInt(q.gasUnits).toString(16),gasPrice:'0x'+BigInt(q.gasPriceWei).toString(16),type:'0x0',chainId:'0x'+q.chainId.toString(16)};
      check(active()&&context===host&&generation===source.attempt&&portfolioAttempt===source.portfolioVersion&&source.revision===managementRevision,'Management authorization cancelled');
      try{record.txHash=normalizeTransactionHash420(await host.provider.request('eth_sendTransaction',[tx]));record.status='pending';}
      catch(e){record.status=e?.code===4001?'rejected':'unknown';record.error=record.status==='rejected'?'Wallet rejected the request.':'Submission outcome unknown. Check Wallet activity; do not resubmit automatically.';}
      emitTransactions();if(record.status!=='rejected')clearPortfolio();return record.txHash;
    }catch(e){if(record&&record.status==='submitting'){record.status='rejected';emitTransactions();}throw e;}
    finally{sending=false;}
  }
  function recordAuthorization(auth,draft,expected){
    const issuedQuote=issued.get(auth.review);
    check(snapshot===expected&&issuedQuote?.draft===draft&&issuedQuote?.expected===expected&&issuedQuote?.generation===generation&&auth.authority==='EXPLICIT_TOKEN_CREATION_AUTHORIZATION'&&auth.maxGasWei===auth.review.estimatedGasWei&&auth.maxTotalWei===auth.review.estimatedTotalWei,'Invalid Wallet authorization');
    authorizations.set(auth,{draft,expected,generation});
  }
  function revokeAuthorization(auth){if(auth)authorizations.delete(auth);}
  async function submitCurrent(auth,stillAuthorized){
    const retained=authorizations.get(auth);check(retained&&retained.generation===generation&&retained.expected===snapshot&&!sending,'Authorization unavailable or already consumed');
    authorizations.delete(auth);sending=true;const host=context,expected=snapshot,attempt=generation,q=auth.review;
    let record=null;
    try{
      check(stillAuthorized()&&context===host,'Authorization cancelled');
      check(!records.some(x=>x.review.chainId===q.chainId&&x.review.smartAccount===q.smartAccount&&['submitting','pending','confirming','reorganized','unknown','unverified'].includes(x.status)),'Resolve existing Token submission before creating another');
      const fresh=await simulateCurrent(retained.draft,expected,q);
      check(stillAuthorized()&&generation===attempt&&context===host&&snapshot===expected,'Authorization cancelled or context changed');
      check(['executionHash','configHash','calldataHash','creatorNonce','authorizationEpoch','authorizationPolicyVersion','predictedAddress','gasUnits','gasPriceWei','estimatedGasWei','estimatedTotalWei'].every(k=>fresh[k]===q[k]),'Reviewed transaction or costs changed; authorize again');
      record={review:q,maxGasWei:auth.maxGasWei,maxTotalWei:auth.maxTotalWei,txHash:null,status:'submitting'};records.push(record);emitTransactions();
      const tx={...q.transaction,gas:'0x'+BigInt(q.gasUnits).toString(16),gasPrice:'0x'+BigInt(q.gasPriceWei).toString(16),type:'0x0',chainId:'0x'+q.chainId.toString(16)};
      // Only the host-owned connected Wallet may prompt and broadcast. Never retry an ambiguous send.
      check(stillAuthorized()&&generation===attempt&&context===host,'Authorization cancelled');
      try{record.txHash=normalizeTransactionHash420(await host.provider.request('eth_sendTransaction',[tx]));record.status='pending';}
      catch(e){record.status=e?.code===4001?'rejected':'unknown';record.error=record.status==='rejected'?'Wallet rejected the request.':'Submission outcome unknown. Check Wallet activity; do not resubmit automatically.';}
      emitTransactions();return record.txHash;
    }catch(e){if(record&&record.status==='submitting'){record.status='rejected';emitTransactions();}throw e;}
    finally{sending=false;}
  }
  async function checkTransaction(hash){
    const record=records.find(x=>x.txHash===hash&&visible().some(v=>v.txHash===hash));
    if(!record||!context||checking)return null;
    checking=true;const host=context,attempt=generation,expected=snapshot,deadline=Date.now()+60000;
    const active=()=>check(context===host&&generation===attempt&&snapshot===expected,'Token tracking context changed');
    const allowed=['eth_chainId','eth_getTransactionReceipt','eth_getTransactionByHash','eth_getBlockByNumber','eth_blockNumber','eth_getCode','eth_call'];
    const provider={request:async(method,params=[])=>{active();check(allowed.includes(method),'Non-tracking RPC method');let timer;try{
      const remaining=Math.min(10000,deadline-Date.now());check(remaining>0,'Token tracking timed out');
      const value=await Promise.race([Promise.resolve().then(()=>host.provider.request(method,params)),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Token tracking timed out')),remaining);})]);active();return value;
    }finally{clearTimeout(timer);}}};
    const wasIncluded=record.status==='confirmed'||record.status==='reverted'||record.confirmation?.blockNumber!=null;
    record.confirmation=null;record.status='confirming';record.error='';emitTransactions();
    try{const binding=normalizeTokenWalletConfig420(host.config).binding;
      const confirmation=await (record.kind==='management'?readTokenManagementReceipt420(provider,record,binding):readTokenDeployment420(provider,record,binding));active();record.status=wasIncluded&&confirmation.status==='pending'?'reorganized':confirmation.status;record.confirmation=record.status===confirmation.status?confirmation:Object.freeze({...confirmation,status:record.status});return record.confirmation;}
    catch(e){record.status='unverified';record.error=(record.kind==='management'?'Management transaction not verified: ':'Deployment not verified: ')+String(e?.message||'Unavailable').slice(0,240);return null;}
    finally{checking=false;emitTransactions();}
  }
  return Object.freeze({refresh,refreshCurrent,simulateCurrent,recordAuthorization,revokeAuthorization,submitCurrent,checkTransaction,subscribeTransactions,subscribePortfolio,refreshPortfolio,reviewManagement,authorizeManagement,revokeManagement,submitManagement,cancelManagement,inspectManagementPermissions,getPortfolio:()=>portfolio,canRefresh:()=>context!==null,invalidate,subscribe,getSnapshot:()=>snapshot});
}

// Shared by the privileged Wallet web host and its own catalogue, not a DOM event or external dApp API.
export const walletTokenDiscovery420=createTokenDiscoverySession420();
