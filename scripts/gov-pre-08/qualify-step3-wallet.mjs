#!/usr/bin/env node
// GOV-PRE-08 Step3 real Wallet consumer, no fake contract responses.
// No signatures or real keys, read-only chain-31337 discovery and action review.
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createTreasuryClient420 } from '../../wallet/web/core/treasury-client.js';
import { createGovernance420Client,GOVERNANCE420_SERVICE_ID } from '../../wallet/web/core/governance-management.js';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const requireIndexer=createRequire(path.join(ROOT,'420-indexer/package.json'));
const {keccak256}=requireIndexer('ethers');
const args=process.argv.slice(2);
function param(n){const i=args.indexOf('--'+n);if(i<0||!args[i+1])throw Error(n+' required');return args[i+1];}
function need(test,msg){if(!test)throw Error('GOV-PRE-08 local Wallet: '+msg);}
const url=param('rpc');
need(/^http:\/\/127\.0\.0\.1:\d{3,5}$/.test(url),'no external Wallet RPC');
const graph=JSON.parse(await fs.readFile(param('graph'),'utf8'));
need(graph.schema==='GOV_PRE_08_STEP3_LOCAL_ACTUAL_FOURTEEN_CONSTRUCTORS_V1'
  && graph.chainId===31337 && graph.approvedV4===false,'unapproved synthetic source only');
const registry='0x0000000000000000000000000000000000000434';
let requestCount=0,transactionCount=0;
const provider={
  async request(method,params=[]){
    requestCount++;
    if(method==='eth_sendTransaction'||method==='personal_sign'||method==='eth_signTypedData_v4'){
      transactionCount++;
      throw Error('read-only Wallet qualification is not a release signer');
    }
    const res=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({jsonrpc:'2.0',id:requestCount,method,params})});
    need(res.ok,'RPC HTTP unavailable');
    const body=await res.json();
    if(body.error)throw Error('local RPC '+method+': '+body.error.message);
    return body.result;
  }
};
const chain=await provider.request('eth_chainId');
need(BigInt(chain)===31337n,'wrong Anvil wallet chain');
const accounts=await provider.request('eth_accounts');
need(accounts.length>0,'local dev-account RPC is not running');
const account=accounts[0];
const registryCode=await provider.request('eth_getCode',[registry,'latest']);
const client=createTreasuryClient420({provider,chainId:chain,
    registryCodeHash:keccak256(registryCode)});
const treasury=await client.discover();
need(treasury.router.toLowerCase()===graph.serviceDiscoveries.TREASURY.address.toLowerCase(),
     'actual Wallet Treasury client did not discover canonical service');
need(treasury.disbursements.toLowerCase()===
     graph.actualProductionConstructorAddresses.TreasuryDisbursementRegistry420.toLowerCase(),
     'actual Wallet Treasury client dependency pointer drift');
const prepared=await client.prepareGovernedAction({
  kind:'setAssetPolicy',asset:'0x0000000000000000000000000000000000000000',
  allowed:true,maxSingle:'100',maxEpoch:'200',epochSeconds:'86400'});
need(prepared.action.target.toLowerCase()===
     graph.actualProductionConstructorAddresses.TreasuryPolicyRegistry420.toLowerCase()
     && prepared.action.value===0n && transactionCount===0,
     'Treasury Wallet preparation emitted authority or wrong target');
const govComponents=graph.walletCivicModuleAddresses;
const componentIds=graph.walletCanonicalComponentIds;
const gov=createGovernance420Client({provider,chainId:chain,account,
  discovery:{source:'protocol-registry',serviceId:GOVERNANCE420_SERVICE_ID,
    registryAddress:registry,revision:1,
    modules:govComponents,
    componentIds:Object.fromEntries(Object.keys(govComponents).map(k=>[k,componentIds[k]]))}});
const session=await gov.verifySession();
need(session.chainId===31337n && session.account.toLowerCase()===account.toLowerCase(),
     'actual Wallet Governance client could not qualify all five deployed Civic components');
async function denied(task,pattern){
  let bad=false;
  try{await task();}catch(e){bad=pattern.test(String(e));}
  need(bad,'fail-closed Wallet condition did not reject expected error');
}
const wrongNetwork={request:async(method,params)=>{
  if(method==='eth_chainId')return '0x1a4';
  return provider.request(method,params);
}};
const wrongTreasury=createTreasuryClient420({
  provider:wrongNetwork,chainId:chain,registryCodeHash:keccak256(registryCode)});
await denied(()=>wrongTreasury.discover(),/wrong Treasury chain/i);
const wrongGov=createGovernance420Client({provider:wrongNetwork,chainId:chain,account,
  discovery:{source:'protocol-registry',serviceId:GOVERNANCE420_SERVICE_ID,
    registryAddress:registry,modules:govComponents,
    componentIds:Object.fromEntries(Object.keys(govComponents).map(k=>[k,componentIds[k]]))}});
await denied(()=>wrongGov.verifySession(),/Wrong network/);
const stale={request:async(method,params)=>{
  if(method==='eth_getCode' && params[0]?.toLowerCase()===registry)return '0x';
  return provider.request(method,params);
}};
const changedRegistry=createTreasuryClient420({provider:stale,chainId:chain,
    registryCodeHash:keccak256(registryCode)});
await denied(()=>changedRegistry.discover(),/no deployed code|runtime mismatch/i);
const noAccount={request:async(method,params)=>{
  if(method==='eth_accounts')return [];
  return provider.request(method,params);
}};
const disconnected=createGovernance420Client({provider:noAccount,chainId:chain,account,
  discovery:{source:'protocol-registry',serviceId:GOVERNANCE420_SERVICE_ID,
    registryAddress:registry,modules:govComponents,
    componentIds:Object.fromEntries(Object.keys(govComponents).map(k=>[k,componentIds[k]]))}});
await denied(()=>disconnected.verifySession(),/no longer authorized/);
need(transactionCount===0,'local Wallet accidentally submitted governance or transfer');
const report={
  schema:'GOV_PRE_08_STEP3_WALLET_REAL_RPC_CANONICAL_READONLY_V1',
  sourceGitHead:graph.sourceGitHead,graphDigest:graph.deterministicGraphDigestSha256,
  chainId:31337,authoritativeV4Approved:false,
  connectedVia:'wallet/web/core/treasury-client.js and governance-management.js',
  realRpcRequests:requestCount,unapprovedProductionTransactionsSent:0,
  treasuryCanonicalDiscovery:true,treasuryDependencyRootVerified:true,
  governanceFiveModulesVerified:true,realRegistryRuntimeAndServiceHashesVerified:true,
  governedTreasuryActionPreparedWithoutBroadcast:true,
  wrongChainRejected:true,staleRegistryRejected:true,accountDisconnectedRejected:true,
  fullWalletUiBrowserQualified:false,stakeConsensusQualified:false,
  authenticUserAuthorization:false
};
await fs.writeFile(param('output'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log('GOV_PRE_08_STEP3_REAL_WALLET_TREASURY_GOVERNANCE_READS=PASS LOCAL ONLY');
