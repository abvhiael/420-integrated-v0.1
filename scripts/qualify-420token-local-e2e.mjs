// Actual local EVM software integration. No manufactured contract responses,
// receipts, balances or events. Only the isolated Anvil bootstrap may use
// privileged RPC methods; the tested Wallet receives a restricted RPC adapter.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {
  TOKEN_TEMPLATES_420,TOKEN_COMPONENT_ID_420,TOKEN_GENESIS_V3_420,
  TOKEN_SERVICE_ID_420,TOKEN_COMMUNITY_VAULT_ID_420,TOKEN_CREATION_FEE_WEI_420,
  createTokenDiscoverySession420,createTokenCatalogue420,createERC20Wizard420,
  createERC721Wizard420,createERC1155Wizard420,createTokenFeeReview420,
  prepareTokenDeploymentHandoff420,tokenManagementActions420
} from '../wallet/web/core/token-app.js';
import {tokenHashText420 as H,tokenHashHex420 as hash,tokenEncodeAbi420 as abi,tokenReadCall420 as call,tokenWord420 as word} from '../wallet/web/core/token-sdk.js';
import {discoverSmartAccount} from '../wallet/web/core/accounts.js';
import {encodeExecute,ZERO_ADDRESS as ZERO,ZERO_BYTES32 as Z32} from '../wallet/web/core/abi.js';

const [stage,dest]=process.argv.slice(2);
assert.ok(stage&&dest,'Usage: node scripts/qualify-420token-local-e2e.mjs STAGE OUTPUT');
const root=resolve(stage),out=resolve(dest);mkdirSync(out,{recursive:true});
const local='http://127.0.0.1:18545',chainId=31337,chain='0x7a69',fee=TOKEN_CREATION_FEE_WEI_420,unit=10n**18n;
const timelock='0x0000000000000000000000000000000000000429',registry='0x0000000000000000000000000000000000000434';
const A='address',U='uint256',B='bytes32',q=n=>'0x'+BigInt(n).toString(16);
const json=x=>JSON.stringify(x,(_,v)=>typeof v==='bigint'?v.toString():v,2);
const same=(a,b)=>assert.equal(a.toLowerCase(),b.toLowerCase());
const results={schema:'420token-local-e2e-v1',head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),chainId,mode:'isolated Ethereum Cancun Anvil chain 31337, no public deployment; chain 420 is auto-classified as Optimism by Foundry',bootstrap:[],creations:[],management:[],negative:[],portfolio:null,reorg:null,status:'FAIL'};
let id=0;
async function rpc(method,params=[]){
  const response=await fetch(local,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:++id,method,params}),signal:AbortSignal.timeout(10000)});
  assert.ok(response.ok,'Local RPC HTTP '+response.status);
  const body=await response.json();
  if(body.error){const e=Error(method+': '+body.error.message);e.code=body.error.code;throw e;}
  assert.ok(Object.hasOwn(body,'result'),'Missing RPC result');return body.result;
}
const addr=word=>'0x'+word.slice(-40).toLowerCase();
const get=(to,sig,types=[],values=[],tag='latest')=>rpc('eth_call',[{to,data:call(sig,types,values)},tag]);
const number=async(...args)=>BigInt(await get(...args));
const balance=async a=>BigInt(await rpc('eth_getBalance',[a,'latest']));
async function receipt(h){
  for(let i=0;i<30;i++){const r=await rpc('eth_getTransactionReceipt',[h]);if(r)return r;await new Promise(done=>setTimeout(done,100));}
  throw Error('Missing local mined receipt '+h);
}
let controller,holder,recipient;
async function send(tx,status='0x1'){
  const h=await rpc('eth_sendTransaction',[{from:controller,gasPrice:q(1_000_000_000),gas:q(12_000_000),type:'0x0',...tx}]);
  const r=await receipt(h);assert.equal(r.status,status,'Local transaction '+h+' '+JSON.stringify(tx).slice(0,180));return r;
}
async function deploy(name,types=[],values=[]){
  const art=JSON.parse(readFileSync(resolve(root,'out',name+'.sol',name+'.json'),'utf8'));
  assert.match(art.bytecode.object,/^0x[0-9a-fA-F]+$/);
  const r=await send({data:art.bytecode.object+abi(types,values).slice(2)});
  const address=r.contractAddress.toLowerCase(),code=await rpc('eth_getCode',[address,'latest']);
  assert.notEqual(code,'0x');results.bootstrap.push({contract:name,address,txHash:r.transactionHash,codeHash:hash(code)});return address;
}
async function installCanonical(name,at,types,values){
  // Only test bootstrap: install the actual constructor-materialized runtime
  // at the reserved local Genesis address. Registry constructor has no mutable
  // initialization; timelock scheduling is NOT qualified by this harness.
  const deployed=await deploy(name,types,values),code=await rpc('eth_getCode',[deployed,'latest']);
  assert.equal(await rpc('eth_getCode',[at,'latest']),'0x');
  await rpc('anvil_setCode',[at,code]);await rpc('evm_mine',[]);
  assert.equal(await rpc('eth_getCode',[at,'latest']),code);
  results.bootstrap.push({contract:name,canonicalAddress:at,source:deployed,codeHash:hash(code),localRuntimeInstallation:true});
}
const configure=(to,sig,types,values,from=controller)=>send({from,to,data:call(sig,types,values)});
const write=()=>writeFileSync(resolve(out,'token-local-e2e.json'),json(results)+'\n');
let session,catalogue,wizards,reviews,account,binding,config,selected;
const walletCalls=[];
const allowed=new Set(['eth_chainId','eth_accounts','eth_getBlockByNumber','eth_getCode','eth_call','eth_estimateGas','eth_gasPrice','eth_getBalance','eth_sendTransaction','eth_getTransactionByHash','eth_getTransactionReceipt','eth_getLogs','eth_blockNumber']);
const wallet={request:async(method,params=[])=>{
  assert.ok(allowed.has(method),'Unexpected Wallet RPC: '+method);
  // Forward real RPC unchanged except selecting the connected controller from
  // Anvil's unlocked local accounts. Never emulate receipts or call data.
  if(method==='eth_accounts'){const accounts=await rpc(method,params);assert.ok(accounts.some(a=>a.toLowerCase()===controller));return [controller];}
  walletCalls.push([method,structuredClone(params)]);
  if(method==='eth_sendTransaction'){
    const tx=params[0];assert.equal(tx.from,controller);assert.equal(tx.to,account);assert.equal(tx.value,'0x0');assert.equal(tx.type,'0x0');assert.equal(tx.chainId,chain);
  }
  return rpc(method,params);
}};
const sends=()=>walletCalls.filter(([m])=>m==='eth_sendTransaction').length;
async function open(){
  session=createTokenDiscoverySession420();catalogue=createTokenCatalogue420(session);
  wizards={ERC20:createERC20Wizard420(catalogue,session),ERC721:createERC721Wizard420(catalogue,session),ERC1155:createERC1155Wizard420(catalogue,session)};
  reviews=Object.fromEntries(Object.entries(wizards).map(([k,w])=>[k,createTokenFeeReview420(w,session)]));
  const fresh=await session.refresh({provider:wallet,config,controller,smartAccount:selected});
  assert.equal(fresh.status,'verified','Wallet discovery failed (see direct verification below if needed)');
  assert.equal(fresh.controllerIsOwner,true);assert.equal(catalogue.getSnapshot().enabledCount,8);
}
function close(){for(const x of Object.values(reviews))x.dispose();for(const x of Object.values(wizards))x.dispose();catalogue.dispose();session.invalidate();}
function fields(p,i){
  const userSalt=H('420/local-e2e/token/'+i);
  if(p.standard==='ERC20')return {name:'Local '+p.key,symbol:'L'+i,supply:'10',...(p.capped?{cap:'20'}:{}),userSalt};
  if(p.standard==='ERC721')return {name:'Local Collection',symbol:'LNFT',baseURI:'ipfs://local-qualification/nft.json',userSalt};
  return {uri:'ipfs://local-qualification/{id}.json',userSalt};
}
async function draft(p,i){
  assert.equal(await catalogue.select(p.key),true);
  const w=wizards[p.standard],r=reviews[p.standard];
  for(const [k,v] of Object.entries(fields(p,i)))assert.equal(w.setField(k,v),true);
  const d=await w.review();assert.ok(d,w.getSnapshot().error);
  assert.equal(d.authority,'DRAFT_ONLY');assert.equal(d.owner,account);assert.equal(d.request.value,fee);return {w,r,d};
}
async function prepare(p,i){
  const {w,r,d}=await draft(p,i),n=sends();const quote=await r.simulate();assert.ok(quote,r.getSnapshot().error);assert.equal(sends(),n);
  assert.equal(quote.smartAccount,account);assert.equal(quote.creationFeeWei,fee.toString());assert.equal(quote.transaction.data,encodeExecute(binding.factory.address,fee,d.request.data));
  const auth=await r.authorize(quote);assert.ok(auth,r.getSnapshot().error);assert.equal(sends(),n);return {w,r,d,quote,auth};
}
async function create(p,i){
  const start=sends(),accountBefore=await balance(account),vaultBefore=await balance(binding.communityTreasuryVault.address);
  const prepared=await prepare(p,i),{r,d}=prepared;let {quote,auth}=prepared;
  // Selection deliberately refreshes Wallet context, downgrading retained
  // included receipts until explicitly rechecked. Do not bypass that guard
  // by opening a fresh session or resending an already-consumed approval.
  if(results.creations.length){
    let tracked;const unsubscribe=session.subscribeTransactions(v=>{tracked=v;});unsubscribe();
    for(const previous of results.creations)assert.equal(tracked.find(x=>x.txHash===previous.txHash)?.status,'unverified');
    if(results.creations.length===1){
      await blocked('retained receipt must be rechecked after context refresh',async()=>{
        assert.equal(await r.submit(auth),null);assert.match(r.getSnapshot().error,/Resolve existing Token submission/);
      });
      quote=await r.simulate();assert.ok(quote,r.getSnapshot().error);
      auth=await r.authorize(quote);assert.ok(auth,r.getSnapshot().error);
    }
    for(const previous of results.creations){
      const prior=await session.checkTransaction(previous.txHash);assert.ok(prior,'Prior receipt recheck unavailable');
      assert.equal(prior.status,'confirmed');same(prior.tokenAddress,previous.token);
    }
  }
  const txHash=await r.submit(auth);assert.ok(txHash,r.getSnapshot().error);
  assert.equal(sends(),start+1);assert.equal(await r.submit(auth),null);assert.equal(sends(),start+1);
  const confirmation=await session.checkTransaction(txHash);assert.ok(confirmation,'Creation receipt not verified');
  assert.equal(confirmation.status,'confirmed');same(confirmation.tokenAddress,quote.predictedAddress);assert.equal(confirmation.creationFeeWei,fee.toString());
  assert.equal(confirmation.configHash,d.request.configHash);
  const token=confirmation.tokenAddress;
  assert.equal(await rpc('eth_getCode',[token,'latest'])==='0x',false);
  same(addr(await get(token,'owner()')),account);same(await get(token,'templateId()'),p.id);
  assert.equal(await number(binding.factory.address,'isFactoryDeployment(address)',[A],[token]),1n);
  assert.equal(await balance(account),accountBefore-fee);assert.equal(await balance(binding.communityTreasuryVault.address),vaultBefore+fee);
  assert.equal(await balance(binding.factory.address),0n);
  const rawReceipt=await receipt(txHash),tx=await rpc('eth_getTransactionByHash',[txHash]);
  assert.equal(tx.input,quote.transaction.data);assert.equal(BigInt(tx.value),0n);
  results.creations.push({template:p.key,token,txHash,configHash:d.request.configHash,feeWei:fee.toString(),gasPaidWei:confirmation.gasPaidWei,receipt:rawReceipt,transaction:tx});
  console.log(json({scenario:'create',template:p.key,txHash,token,feeWei:fee,status:'PASS'}));write();return token;
}
async function portfolio(){
  const page=await session.refreshPortfolio();assert.ok(page,session.getPortfolio().error);assert.equal(page.page.complete,true);return page;
}
async function manage(profile,action,params){
  const list=await portfolio(),row=list.items.find(x=>x.templateKey===profile);assert.ok(row,profile);
  const n=sends(),v=await balance(binding.communityTreasuryVault.address),a=await balance(account);
  const review=await session.reviewManagement(row,action,params);assert.equal(review.creationFeeWei,'0');assert.equal(sends(),n);
  const approval=await session.authorizeManagement(review,()=>true,review.security.acknowledgement);assert.equal(sends(),n);
  const h=await session.submitManagement(approval);assert.ok(h);assert.equal(sends(),n+1);
  await assert.rejects(session.submitManagement(approval));assert.equal(sends(),n+1);
  const confirmed=await session.checkTransaction(h);assert.ok(confirmed,'Management receipt not verified: '+profile+'/'+action);assert.equal(confirmed.status,'confirmed');
  assert.equal(await balance(binding.communityTreasuryVault.address),v);assert.equal(await balance(account),a);
  results.management.push({profile,action,params,txHash:h,gasPaidWei:confirmed.gasPaidWei,receipt:await receipt(h)});
  console.log(json({scenario:'management',profile,action,txHash:h,status:'PASS'}));write();return h;
}
async function blocked(name,fn){
  const n=sends();await fn();assert.equal(sends(),n,name+' must not reach Wallet submission');results.negative.push(name);console.log(json({scenario:name,status:'PASS'}));write();
}
try {
  assert.equal(await rpc('eth_chainId'),chain);
  const version=await rpc('web3_clientVersion');assert.match(version,/anvil/i);results.clientVersion=version;
  const accounts=(await rpc('eth_accounts')).map(a=>a.toLowerCase());assert.ok(accounts.length>=3);[controller,holder,recipient]=accounts;
  const closure=JSON.parse(readFileSync(resolve(root,'source-closure.json'),'utf8'));assert.equal(closure.head,results.head);
  results.sourceClosure=closure;results.genesisHash=(await rpc('eth_getBlockByNumber',['0x0',false])).hash;
  await installCanonical('GovernanceTimelock',timelock,[A],[controller]);
  await installCanonical('ProtocolRegistry',registry,[A],[timelock]);
  await rpc('anvil_setBalance',[timelock,q(100n*unit)]);
  await rpc('anvil_impersonateAccount',[timelock]);
  const caps=await deploy('CapabilityRegistry420'),entry=await deploy('EntryPoint420'),sf=await deploy('SmartAccountFactory420',[A,A],[entry,caps]);
  const auth=await deploy('VaultAuthorization420',[A],[caps]),policies=await deploy('VaultPolicyRegistry420',[A],[timelock]),
    vr=await deploy('VaultRegistry420',[A,A],[auth,policies]),accounting=await deploy('VaultAccounting420',[A],[vr]);
  const policyTypes=['AUTHORIZATION','ASSET','RELEASE','ACCOUNTING'].map(k=>H('420/VAULT/POLICY/'+k+'/V1')),
    policyIds=policyTypes.map((_,i)=>H('420/local-e2e/policy/'+i));
  for(let i=0;i<4;i++)await configure(policies,'setPolicy(bytes32,bytes32,bytes32,bytes32,bool)',[B,B,B,B,U],[policyIds[i],policyTypes[i],H('local semantics '+i),Z32,1],timelock);
  const vaultId=H(TOKEN_COMMUNITY_VAULT_ID_420),vault=await deploy('AssetVault420',[B,A,A,A,A],[vaultId,vr,auth,accounting,controller]),
    vaultRegistration={creator:controller,policyIds,beneficiarySetId:Z32,metadataHash:H('local vault metadata'),manifestHash:H('local vault manifest')};
  await configure(vr,'registerVault(bytes32,address,bytes32,bytes32,bytes32,bytes32,bytes32,bytes32,bytes32,bytes32)',[B,A,B,B,B,B,B,B,B,B],
    [vaultId,vault,H('420/VAULT/TYPE/COMMUNITY/V1'),...policyIds,Z32,vaultRegistration.metadataHash,vaultRegistration.manifestHash]);
  const templates=await deploy('TokenTemplateRegistry420',[A],[timelock]),factory=await deploy('TokenFactory420',[A,A],[templates,vault]);
  const depAddresses={GovernanceTimelock:timelock,ProtocolRegistry:registry,AssetVault420:vault,VaultRegistry420:vr,VaultAccounting420:accounting,VaultAuthorization420:auth,VaultPolicyRegistry420:policies,CapabilityRegistry420:caps,TokenTemplateRegistry420:templates,TokenFactory420:factory};
  const deps={};for(const [k,address] of Object.entries(depAddresses))deps[k]={address,codeHash:hash(await rpc('eth_getCode',[address,'latest']))};
  const release={metadataHash:H('local token metadata'),manifestHash:H('local token manifest'),interfaceHash:H('local token interface'),
    dependencyRoot:hash(abi([B,B,...Object.keys(deps).flatMap(()=>[A,B]),B,B],[H('420/TOKEN/RELEASE/DEPENDENCIES/V1'),TOKEN_GENESIS_V3_420,...Object.values(deps).flatMap(d=>[d.address,d.codeHash]),vaultId,vaultRegistration.manifestHash]))};
  await configure(registry,'registerComponent(bytes32,address,(uint16,uint16,uint16),uint8)',[B,A,U,U,U,U],[H(TOKEN_COMPONENT_ID_420),factory,1,0,0,2],timelock);
  await configure(registry,'publishRegisteredService(bytes32,address,bytes32,uint32,bool,uint8,bytes32,bytes32,bytes32)',[B,A,B,U,U,U,B,B,B],[H(TOKEN_SERVICE_ID_420),factory,release.metadataHash,1,1,3,release.manifestHash,release.dependencyRoot,release.interfaceHash],timelock);
  await rpc('anvil_stopImpersonatingAccount',[timelock]);
  binding={serviceId:TOKEN_SERVICE_ID_420,componentId:TOKEN_COMPONENT_ID_420,genesisConfigHash:TOKEN_GENESIS_V3_420,chainId,version:1,genesisHash:results.genesisHash,
    registry:deps.ProtocolRegistry,governanceTimelock:deps.GovernanceTimelock,factory:deps.TokenFactory420,templateRegistry:deps.TokenTemplateRegistry420,communityTreasuryVault:deps.AssetVault420,
    communityTreasuryVaultId:TOKEN_COMMUNITY_VAULT_ID_420,vaultGraph:Object.fromEntries(Object.entries(deps).slice(2,8)),vaultRegistration,release};
  const accountConfig={factoryAddress:sf,recoveryAuthority:ZERO,salt:Z32,verifiedEntryPoint:entry,verifiedCapabilityRegistry:caps};
  const predicted=addr(await get(sf,'getAddress(address,address,bytes32)',[A,A,B],[controller,ZERO,Z32]));
  await configure(sf,'createAccount(address,address,bytes32)',[A,A,B],[controller,ZERO,Z32]);
  account=predicted;await send({to:account,value:q(800n*unit)});
  selected={...await discoverSmartAccount({request:rpc},controller,accountConfig),expectedChainId:chain};assert.equal(selected.smartAccount,account);assert.equal(selected.controllerIsOwner,true);
  config={schema:'420-wallet-runtime-config-v1',network:{chainId:chain,rpcUrl:null},smartAccount:{factoryAddress:sf,recoveryAuthority:ZERO,salt:Z32},
    services:[],trackedAssets:[],deployment:{environment:'local',protocolRegistryAddress:registry,entryPointAddress:entry,capabilityRegistryAddress:caps},token:{environment:'local',binding}};
  results.binding=binding;results.smartAccount=account;results.controller=controller;
  // Direct read-only diagnostic ensures any mismatch reports the actual failing invariant.
  const {discoverWalletTokenRuntime420}=await import('../wallet/web/core/token-discovery.js');
  assert.equal((await discoverWalletTokenRuntime420(wallet,config,controller,selected)).status,'verified');
  await open();assert.equal((await portfolio()).items.length,0);
  const all=TOKEN_TEMPLATES_420;
  // Real wrong-value/revert checks, and untrusted request rejection, before creation.
  const first=await draft(all[0],1),request=first.d.request;
  for(const [name,patch] of [['wrong service',{serviceId:'not-token'}],['wrong factory',{target:holder}],['wrong fee',{value:fee-1n}],['empty calldata',{data:'0x'}]])
    await blocked(name,()=>assert.rejects(prepareTokenDeploymentHandoff420(wallet,controller,selected,binding,{...request,...patch})));
  for(const [name,patch] of [['wrong chain',{chainId:421}],['wrong genesis',{genesisHash:H('wrong genesis')}],['aliased dependency',{templateRegistry:binding.factory}],['zero code hash',{factory:{...binding.factory,codeHash:Z32}}]])
    await blocked(name,async()=>{const s=createTokenDiscoverySession420();const bad=structuredClone(config);bad.token.binding={...bad.token.binding,...patch};assert.equal((await s.refresh({provider:wallet,config:bad,controller,smartAccount:selected})).status,'blocked');s.invalidate();});
  await blocked('direct wrong fee reverts with no accounting change',async()=>{
    const before=await balance(vault);await send({to:factory,value:q(fee-1n),data:request.data},'0x0');assert.equal(await balance(vault),before);assert.equal(await number(factory,'deploymentCount()'),0n);
  });
  // Select/prepare, then disable on the real template registry.
  const old=await prepare(all[0],2);
  await rpc('anvil_impersonateAccount',[timelock]);await configure(templates,'setEnabled(bytes32,bool)',[B,U],[all[0].id,0],timelock);await rpc('anvil_stopImpersonatingAccount',[timelock]);
  await blocked('governance disabled after authorization',async()=>assert.equal(await old.r.submit(old.auth),null));
  await rpc('anvil_impersonateAccount',[timelock]);await configure(templates,'setEnabled(bytes32,bool)',[B,U],[all[0].id,1],timelock);await rpc('anvil_stopImpersonatingAccount',[timelock]);
  await catalogue.refresh();
  // Eight actual factory deployments through the complete Wallet model path.
  for(let i=0;i<all.length;i++)await create(all[i],i+10);
  assert.equal(await number(factory,'deploymentCount()'),8n);assert.equal(await number(factory,'creatorNonce(address)',[A],[account]),8n);
  assert.equal(await balance(vault),8n*fee);assert.equal(await balance(factory),0n);
  const a=await get(accounting,'getAccounting(bytes32,address)',[B,A],[vaultId,ZERO]);
  const accountingWords=Array.from({length:4},(_,i)=>BigInt('0x'+a.slice(2+i*64,66+i*64)));
  assert.deepEqual(accountingWords,[8n*fee,0n,0n,0n]);
  // Rebuild independently from chain after a new session, not synthetic local history.
  close();await open();const reconstructed=await portfolio();assert.equal(reconstructed.items.length,8);
  for(const row of reconstructed.items){const created=results.creations.find(x=>x.token===row.token);assert.ok(created);assert.equal(row.creator,account);assert.equal(row.owner,account);assert.equal(row.configHash,created.configHash);assert.equal(row.receipt.status,'verified');assert.equal(row.receipt.txHash,created.txHash);assert.equal(row.receipt.creationFeeWei,fee.toString());}
  results.portfolio={count:8,createdCount:reconstructed.page.createdCount,complete:reconstructed.page.complete,items:reconstructed.items,vaultBalanceWei:(8n*fee).toString(),accounting:accountingWords};write();
  const tokens=Object.fromEntries(results.creations.map(x=>[x.template,x.token]));
  await manage('ERC20_FIXED','transfer',{to:holder,amount:'1'});assert.equal(await number(tokens.ERC20_FIXED,'balanceOf(address)',[A],[holder]),unit);
  await manage('ERC20_MINTABLE','mint',{to:holder,amount:'2'});assert.equal(await number(tokens.ERC20_MINTABLE,'totalSupply()'),12n*unit);
  await manage('ERC20_CAPPED','mint',{to:holder,amount:'3'});assert.equal(await number(tokens.ERC20_CAPPED,'totalSupply()'),13n*unit);
  await blocked('immutable cap rejected',async()=>{const p=await portfolio();await assert.rejects(session.reviewManagement(p.items.find(x=>x.templateKey==='ERC20_CAPPED'),'mint',{to:holder,amount:'8'}),/cap/i);});
  await manage('ERC20_BURNABLE','burn',{amount:'1'});assert.equal(await number(tokens.ERC20_BURNABLE,'totalSupply()'),9n*unit);
  await manage('ERC20_PERMIT','approve',{spender:holder,amount:'3'});assert.equal(await number(tokens.ERC20_PERMIT,'allowance(address,address)',[A,A],[account,holder]),3n*unit);
  let p=await portfolio();let permission=await session.inspectManagementPermissions(p.items.find(x=>x.templateKey==='ERC20_PERMIT'),{spender:holder});
  assert.equal(permission.allowance,(3n*unit).toString());assert.equal(permission.revocations[0].params.amount,'0');
  await manage('ERC20_PERMIT','approve',permission.revocations[0].params);assert.equal(await number(tokens.ERC20_PERMIT,'allowance(address,address)',[A,A],[account,holder]),0n);
  await manage('ERC20_VOTES','delegate',{to:holder});same(addr(await get(tokens.ERC20_VOTES,'delegates(address)',[A],[account])),holder);
  await manage('ERC721_COLLECTION','mint',{to:account,id:'7'});same(addr(await get(tokens.ERC721_COLLECTION,'ownerOf(uint256)',[U],[7])),account);
  await manage('ERC721_COLLECTION','approve',{spender:holder,id:'7'});same(addr(await get(tokens.ERC721_COLLECTION,'getApproved(uint256)',[U],[7])),holder);
  p=await portfolio();permission=await session.inspectManagementPermissions(p.items.find(x=>x.templateKey==='ERC721_COLLECTION'),{id:'7'});
  await manage('ERC721_COLLECTION','approve',permission.revocations.find(x=>x.action==='approve').params);same(addr(await get(tokens.ERC721_COLLECTION,'getApproved(uint256)',[U],[7])),ZERO);
  await manage('ERC721_COLLECTION','transfer',{from:account,to:holder,id:'7'});same(addr(await get(tokens.ERC721_COLLECTION,'ownerOf(uint256)',[U],[7])),holder);
  // SmartAccount420 lacks ERC1155 receiver callbacks. Use explicit EOA recipient,
  // then the real holder grants operator rights to the account.
  await manage('ERC1155_MULTI','mint',{to:holder,id:'1',amount:'10'});await manage('ERC1155_MULTI','mint',{to:holder,id:'2',amount:'20'});
  await configure(tokens.ERC1155_MULTI,'setApprovalForAll(address,bool)',[A,U],[account,1],holder);
  await manage('ERC1155_MULTI','batchTransfer',{from:holder,to:recipient,ids:'1,2',values:'3,4'});
  assert.equal(await number(tokens.ERC1155_MULTI,'balanceOf(address,uint256)',[A,U],[recipient,1]),3n);
  assert.equal(await number(tokens.ERC1155_MULTI,'balanceOf(address,uint256)',[A,U],[recipient,2]),4n);
  await configure(tokens.ERC1155_MULTI,'setApprovalForAll(address,bool)',[A,U],[account,0],holder);
  await blocked('revoked holder operator rejected',async()=>{const v=await portfolio();await assert.rejects(session.reviewManagement(v.items.find(x=>x.templateKey==='ERC1155_MULTI'),'transfer',{from:holder,to:recipient,id:'1',amount:'1'}),/operator/i);});
  await manage('ERC20_MINTABLE','transferOwnership',{to:holder});same(addr(await get(tokens.ERC20_MINTABLE,'owner()')),holder);
  await blocked('creator no longer owner cannot mint',async()=>{const v=await portfolio(),row=v.items.find(x=>x.templateKey==='ERC20_MINTABLE');assert.equal(row.ownership,'transferred');assert.ok(!tokenManagementActions420(row,account).some(x=>x.key==='mint'));await assert.rejects(session.reviewManagement(row,'mint',{to:holder,amount:'1'}));});
  // Reorg via actual local state snapshot/revert, not a forged confirmation.
  const snapshot=await rpc('evm_snapshot'),before=await number(tokens.ERC20_FIXED,'balanceOf(address)',[A],[holder]);
  const reorgHash=await manage('ERC20_FIXED','transfer',{to:holder,amount:'1'});assert.equal(await number(tokens.ERC20_FIXED,'balanceOf(address)',[A],[holder]),before+unit);
  assert.equal(await rpc('evm_revert',[snapshot]),true);
  const status=await session.checkTransaction(reorgHash);assert.ok(status);assert.equal(status.status,'reorganized');
  assert.equal(await number(tokens.ERC20_FIXED,'balanceOf(address)',[A],[holder]),before);
  results.reorg={txHash:reorgHash,status:status.status,restoredBalance:before.toString()};
  close();await open();assert.equal((await portfolio()).items.length,8);
  assert.equal(await balance(vault),8n*fee);
  assert.equal(await number(factory,'deploymentCount()'),8n);
  assert.equal(await number(factory,'creatorNonce(address)',[A],[account]),8n);
  session.invalidate();assert.equal(session.getSnapshot().status,'disconnected');assert.equal(session.getPortfolio().items.length,0);
  results.walletSubmissions=sends();results.status='PASS';
  console.log(json({tokenLocalE2E:'PASS',creations:results.creations.length,management:results.management.length,negative:results.negative.length,portfolio:8,feeWei:(8n*fee).toString(),reorg:true,walletSubmissions:sends()}));
} catch(e){results.error=e.stack||String(e);console.error(results.error);process.exitCode=1;}
finally{write();}
