#!/usr/bin/env node
// Real Wallet core service discovery and EIP-1559 signing against the exact
// *same* patched node420 chain 420. Test key 0x01 is a PUBLIC, insecure EVM
// fixture and MUST NEVER be used for real funds, founders or launch manifests.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {createTreasuryClient420} from '../../wallet/web/core/treasury-client.js';
import {createGovernance420Client,GOVERNANCE420_SERVICE_ID} from '../../wallet/web/core/governance-management.js';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const requireIndexer=createRequire(path.join(ROOT,'420-indexer/package.json'));
const {Wallet,keccak256}=requireIndexer('ethers');
const args=process.argv.slice(2);
function opt(k){let i=args.indexOf('--'+k);if(i<0||!args[i+1])throw Error(k+' required');return args[i+1];}
function need(v,m){if(!v)throw Error('GOV-PRE-08 shared-chain local Wallet: '+m);}
const mode=opt('mode'),rpcUrl=opt('rpc');
need(['sign','verify'].includes(mode) && /^http:\/\/127\.0\.0\.1:\d{3,5}$/.test(rpcUrl),
     'no real chain or unapproved wallet mode');
const graph=JSON.parse(await fs.readFile(opt('graph'),'utf8'));
need(graph.chainId===31337 && graph.approvedV4===false,'imported original must be local-only');
const fixture=new Wallet('0x'+'00'.repeat(31)+'01');
need(fixture.address.toLowerCase()==='0x7e5f4552091a69125d5dfcb7b8c2659029395bdf',
     'test fixture address diverged from deterministic local wallet');
let calls=0,rawSent=0;
async function rpc(method,params=[]){
  calls++;
  const res=await fetch(rpcUrl,{method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({jsonrpc:'2.0',id:calls,method,params})});
  need(res.ok,'node420 RPC unavailable');
  const data=await res.json();
  if(data.error)throw Error(method+': '+data.error.message);
  return data.result;
}
const provider={
  request:async(method,params=[])=>{
    if(method==='eth_accounts')return [fixture.address]; // authenticated by actual local private-key signature below
    if(method==='eth_sendTransaction'||method==='personal_sign'||method==='eth_signTypedData_v4')
      throw Error('must be signed by local test fixture, never RPC impersonation');
    return rpc(method,params);
  }
};
const chain=await provider.request('eth_chainId');
need(BigInt(chain)===420n,'same-chain Wallet chainId 420 required');
const registry='0x0000000000000000000000000000000000000434';
const code=await provider.request('eth_getCode',[registry,'latest']);
need(code!=='0x','real Registry runtime not on same node420 Genesis');
const treasury=createTreasuryClient420({provider,chainId:chain,registryCodeHash:keccak256(code)});
const resolved=await treasury.discover();
need(resolved.router.toLowerCase()===graph.serviceDiscoveries.TREASURY.address.toLowerCase(),
     'Wallet Treasury Registry service resolution not actual imported 420 chain');
const civic=graph.walletCivicModuleAddresses;
const ids=graph.walletCanonicalComponentIds;
const gov=createGovernance420Client({provider,chainId:chain,account:fixture.address,
 discovery:{source:'protocol-registry',serviceId:GOVERNANCE420_SERVICE_ID,
   registryAddress:registry,revision:1,modules:civic,
   componentIds:Object.fromEntries(Object.keys(civic).map(k=>[k,ids[k]]))}});
const session=await gov.verifySession();
need(session.chainId===420n && session.account.toLowerCase()===fixture.address.toLowerCase(),
     'real Wallet Governance five-component discovery failed on same Geth chain');
// Run fail-closed 420Wallet authorization checks on the *same* native Geth
// node as the actual signed transaction. These probes must not broadcast.
async function deny(action,pattern,label){
  let refused=false;
  try{await action();}catch(error){refused=pattern.test(String(error));}
  need(refused,'missing fail-closed Wallet denial: '+label);
}
function adversarialProvider(transform){
  return {request:async(method,params=[])=>{
    const replacement=transform(method,params);
    if(replacement!==undefined)return replacement;
    return provider.request(method,params);
  }};
}
function civicWith(testProvider,account=fixture.address){
  return createGovernance420Client({provider:testProvider,chainId:chain,account,
    discovery:{source:'protocol-registry',serviceId:GOVERNANCE420_SERVICE_ID,
      registryAddress:registry,revision:1,modules:civic,
      componentIds:Object.fromEntries(Object.keys(civic).map(k=>[k,ids[k]]))}});
}
await deny(()=>civicWith(adversarialProvider((method)=>
    method==='eth_chainId'?'0x1a5':undefined)).verifySession(),
    /wrong network/i,'wrong-chain wallet');
await deny(()=>civicWith(adversarialProvider((method)=>
    method==='eth_accounts'?[]:undefined)).verifySession(),
    /no longer authorized/i,'disconnected identity');
await deny(()=>civicWith(adversarialProvider((method,params)=>
    method==='eth_getCode'&&params[0]?.toLowerCase()===registry.toLowerCase()
      ?'0x':undefined)).verifySession(),
    /no deployed code/i,'vanished canonical Registry runtime');
await deny(()=>civicWith(adversarialProvider((method,params)=>
    method==='eth_getCode'&&params[0]?.toLowerCase()===civic.governor.toLowerCase()
      ?'0x60006000':undefined)).verifySession(),
    /code hash mismatch|contract identity mismatch/i,'tampered Governor bytecode');
const prepared=await treasury.prepareGovernedAction({
  kind:'setAssetPolicy',asset:'0x0000000000000000000000000000000000000000',
  allowed:true,maxSingle:'100',maxEpoch:'200',epochSeconds:'86400'});
need(prepared.action.target.toLowerCase()===
     graph.actualProductionConstructorAddresses.TreasuryPolicyRegistry420.toLowerCase()
     && prepared.action.value===0n,
     'prepared Treasury action sent to wrong governance target');
const accountBalance=BigInt(await rpc('eth_getBalance',[fixture.address,'latest']));
need(accountBalance>0n,'no genuine authenticated native 420 reward backing for local EOA gas');
if(mode==='sign'){
  // EIP-1559 tx is signed locally and submitted as RAW bytes to the real Geth
  // mempool. No unlocked account, chain masquerade or Anvil impersonation.
  const transaction={
    to:graph.sourceFoundersFixtureOnly[1],
    chainId:420,nonce:0,gasLimit:21000n,type:2,
    maxPriorityFeePerGas:1_000_000_000n,maxFeePerGas:2_000_000_000n,
    value:1_000_000_000_000_000n,data:'0x'
  };
  const hostile=await fixture.signTransaction({...transaction,chainId:421});
  let rejected=false;
  try{await rpc('eth_sendRawTransaction',[hostile]);}
  catch(e){rejected=/chain|invalid sender|transaction type/i.test(String(e));}
  need(rejected,'wrong-chain signed EOA transaction was not rejected');
  const raw=await fixture.signTransaction(transaction);
  const tx=await rpc('eth_sendRawTransaction',[raw]);
  need(tx.toLowerCase()===keccak256(raw).toLowerCase(),
       'real patched Geth returned a different signed transaction hash');
  rawSent++;
  const out={schema:'GOV_PRE_08_SIGNED_LOCAL_420WALLET_TX_V1',chainId:420,
    realWalletCoreTreasuryAndGovernanceDiscovered:true,
    genesisTreasuryPolicyBound:true,
    localSignerAddress:fixture.address,
    signerIsPublicInsecureFixture:true,
    actualNativeRewardBeforeSigningWei:accountBalance.toString(),
    txHash:tx,wrongChainSignedTransactionRejected:true,
    wrongChainIdentityAndStaleRegistryAndTamperedCodeRejected:true,
    rawTransactionAcceptedByPatchedGeth:true,
    authorizedProductionOwner:false,approvedV4:false,
    unreviewedTreasuryBroadcastCount:0};
  await fs.writeFile(opt('output'),JSON.stringify(out,null,2)+'\n',{flag:'wx'});
  console.log('GOV_PRE_08_SIGNED_REAL_LOCAL_WALLET_TRANSACTION_BROADCAST=PASS',tx);
}else{
  const tx=opt('tx-hash');
  need(/^0x[0-9a-fA-F]{64}$/.test(tx),'expected signed transaction hash');
  const receipt=await rpc('eth_getTransactionReceipt',[tx]);
  need(receipt?.status==='0x1' && receipt.transactionHash.toLowerCase()===tx.toLowerCase(),
       'local wallet signed transaction not settled in canonical Geth receipt');
  const block=await rpc('eth_getBlockByNumber',[receipt.blockNumber,false]);
  need(block.hash.toLowerCase()===receipt.blockHash.toLowerCase() &&
       block.extraData!=='0x' && Number(BigInt(receipt.blockNumber))>=2,
       'Wallet settlement not part of certified node420 execution block');
  const out={schema:'GOV_PRE_08_REAL_WALLET_CERTIFIED_RECEIPT_V1',
    realWalletCoreTreasuryAndGovernanceDiscovered:true,chainId:420,
    receiptHash:receipt.transactionHash,blockHash:receipt.blockHash,
    blockNumber:Number(BigInt(receipt.blockNumber)),
    nativeExecutionCertificateCommitted:true,realSignedEOA:true,
    approvedV4:false,liveTestnetVerified:false};
  await fs.writeFile(opt('output'),JSON.stringify(out,null,2)+'\n',{flag:'wx'});
  console.log('GOV_PRE_08_REAL_WALLET_NATIVE_NODE420_SIGNED_RECEIPT=PASS',tx);
}
