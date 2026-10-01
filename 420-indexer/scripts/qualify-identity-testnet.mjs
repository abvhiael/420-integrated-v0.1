import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { Contract, JsonRpcProvider } from 'ethers';
import { validateNetworkManifest420 } from '../../developer-hub/src/network-discovery.mjs';
import { createIdentity420Client } from '../../wallet/web/core/identity-management.js';
import {
  IDENTITY_ADDRESS_420,
  IDENTITY_RUNTIME_HASH_420,
  IDENTITY_TESTNET_SCHEMA_420,
  identityRuntimeHash420,
  validateIdentityLiveTestnetEvidence420,
} from '../dist/src/identity-testnet-qualification.js';

const fail=(message)=>{throw new Error(message);};
const lower=(value)=>String(value).toLowerCase();

function parseArgs(argv){
  const args={manifest:null,evidenceDraft:null,repositorySha:null,output:null,timeoutSeconds:'240'};
  for(let i=0;i<argv.length;i+=1){
    const key=argv[i]; if(!key?.startsWith('--'))fail('unexpected argument: '+key);
    const name=key.slice(2); if(!Object.hasOwn(args,name))fail('unsupported argument: --'+name);
    const value=argv[++i]; if(!value||value.startsWith('--'))fail('missing value for --'+name);
    args[name]=value;
  }
  for(const key of ['manifest','evidenceDraft','repositorySha','output'])if(!args[key])fail('--'+key+' is required');
  if(!/^[0-9a-f]{40}$/i.test(args.repositorySha))fail('--repositorySha must be a 40-hex commit SHA');
  if(!/^\d+$/.test(args.timeoutSeconds)||Number(args.timeoutSeconds)<60)fail('--timeoutSeconds must be at least 60');
  return args;
}
async function json(file){
  try{return JSON.parse(await fs.readFile(file,'utf8'));}catch(error){fail('cannot read valid JSON from '+file+': '+error.message);}
}
function secureUrl(value,label){
  let u;try{u=new URL(value);}catch{fail(label+' must be absolute URL');}
  if(u.protocol!=='https:')fail(label+' must use HTTPS');
  if(u.username||u.password)fail(label+' must not embed credentials');
  return u;
}
async function getJson(url,label){
  const response=await fetch(url,{headers:{accept:'application/json'}});
  if(!response.ok)fail(label+' HTTP '+response.status);
  return response.json();
}
async function waitFor(fn,timeoutSeconds,label){
  const deadline=Date.now()+timeoutSeconds*1000;let last;
  while(Date.now()<deadline){try{return await fn();}catch(error){last=error;await new Promise(r=>setTimeout(r,3000));}}
  fail(label+' did not converge: '+(last?.message||'timeout'));
}
async function successfulReceipt(provider,hash,label){
  const receipt=await provider.getTransactionReceipt(hash);
  if(!receipt)fail(label+' receipt missing');
  if(receipt.status!==1)fail(label+' transaction reverted');
  return receipt;
}
function objectKey(field,value){return field+':'+lower(value);}
function eventPageUrl(base,chainId,key){
  const u=new URL(base.replace(/\/$/,'')+'/v1/protocols/events');
  u.searchParams.set('chainId',chainId);u.searchParams.set('protocol','420Identity');
  u.searchParams.set('objectKey',key);u.searchParams.set('direction','asc');u.searchParams.set('limit','200');
  return u;
}

const args=parseArgs(process.argv.slice(2));
const manifest=validateNetworkManifest420(await json(args.manifest));
if(manifest.network.environment!=='testnet')fail('ID-AUDIT-9 requires official environment=testnet manifest');
const rpcUrl=manifest.rpc?.http?.[0];
secureUrl(rpcUrl,'official RPC');
for(const service of ['indexer','search','explorer'])secureUrl(manifest.services?.[service],service);
if(lower(manifest.contracts?.Identity420?.address)!==IDENTITY_ADDRESS_420)fail('official manifest Identity420 must be canonical 0x0436');

const draft=await json(args.evidenceDraft);
if(draft.status==='PASS')fail('input must be an unqualified evidence draft, not predeclared PASS');
if(draft.phase!=='ID-AUDIT-9')fail('evidence draft phase mismatch');
if(!draft.lifecycle||!draft.recovery)fail('evidence draft requires lifecycle and recovery records');

const provider=new JsonRpcProvider(rpcUrl);
const network=await provider.getNetwork();
if(network.chainId!==BigInt(manifest.network.chainId))fail('RPC chain ID does not match official manifest');
const genesis=await provider.getBlock(0);if(!genesis?.hash)fail('RPC did not return canonical genesis block');
const latest=await provider.getBlock('latest');if(!latest||latest.number<=0)fail('RPC head unavailable');

const identityArtifact=await json(new URL('../../contracts/artifacts/Identity420.json',import.meta.url));
const code=await provider.getCode(IDENTITY_ADDRESS_420);
const codeHash=identityRuntimeHash420(code);
if(lower(codeHash)!==IDENTITY_RUNTIME_HASH_420)fail('live Identity420 runtime hash mismatch');
const identity=new Contract(IDENTITY_ADDRESS_420,identityArtifact.abi,provider);
if(await identity.systemName()!=='Identity420')fail('live Identity420 systemName mismatch');
if(Number(await identity.protocolVersion())!==3)fail('live Identity420 protocolVersion mismatch');
const governance=lower(await identity.governanceTimelock());
if(governance!=='0x0000000000000000000000000000000000000429')fail('live Identity420 governance binding mismatch');

const lifecycle=draft.lifecycle;
for(const [key,value] of Object.entries({
  createProfileTx:lifecycle.createProfileTx,updateProfileTx:lifecycle.updateProfileTx,
  transferNominationTx:lifecycle.transferNominationTx,transferAcceptanceTx:lifecycle.transferAcceptanceTx,
  issuerConfigureTx:lifecycle.issuerConfigureTx,credentialIssueTx:lifecycle.credentialIssueTx,
  credentialRejectTx:lifecycle.credentialRejectTx,credentialReissueTx:lifecycle.credentialReissueTx,
  credentialRevokeTx:lifecycle.credentialRevokeTx,expiryIssueTx:lifecycle.expiryIssueTx,
  issuerDeactivateTx:lifecycle.issuerDeactivateTx,issuerReactivateTx:lifecycle.issuerReactivateTx,
})) await successfulReceipt(provider,value,key);

const finalProfile=await identity.profiles(lifecycle.profileId);
if(lower(finalProfile.controller)!==lower(lifecycle.finalProfileController))fail('live final profile controller mismatch');
if(Boolean(finalProfile.active)!==true)fail('live final profile must be active');
const issuer=await identity.issuers(lifecycle.issuerId);
if(lower(issuer.controller)!==lower(lifecycle.issuerController)||!Boolean(issuer.active))fail('live issuer final state mismatch');
const rejectedValid=Boolean(await identity.credentialValid(lifecycle.credentialId));
if(rejectedValid)fail('subject-rejected credential is unexpectedly valid');

const revokeReceipt=await provider.getTransactionReceipt(lifecycle.credentialRevokeTx);
const revokeLogs=await provider.getLogs({address:IDENTITY_ADDRESS_420,fromBlock:revokeReceipt.blockNumber,toBlock:revokeReceipt.blockNumber});
if(!revokeLogs.some(log=>lower(log.transactionHash)===lower(lifecycle.credentialRevokeTx)))fail('revocation log provenance missing');

const reissueId=draft.lifecycle.reissuedCredentialId;
if(!/^0x[0-9a-fA-F]{64}$/.test(reissueId||''))fail('evidence draft requires reissuedCredentialId');
const revokedValid=Boolean(await identity.credentialValid(reissueId));
if(revokedValid)fail('revoked credential is unexpectedly valid');

const expiryReceipt=await provider.getTransactionReceipt(lifecycle.expiryIssueTx);
const expiryCredential=await identity.credentials(lifecycle.expiryCredentialId);
if(BigInt(expiryCredential.expiresAt)===0n)fail('expiry credential must have finite expiry');
const latestNow=await provider.getBlock('latest');
if(BigInt(latestNow.timestamp)<BigInt(expiryCredential.expiresAt))fail('expiry observation attempted before credential expiry');
const expiryValid=Boolean(await identity.credentialValid(lifecycle.expiryCredentialId));
if(expiryValid)fail('expired credential is unexpectedly valid');

const deactivateReceipt=await provider.getTransactionReceipt(lifecycle.issuerDeactivateTx);
const reactivateReceipt=await provider.getTransactionReceipt(lifecycle.issuerReactivateTx);
if(deactivateReceipt.blockNumber>=reactivateReceipt.blockNumber)fail('issuer deactivation must precede reactivation');
const issuerAtDeactivate=await identity.issuers(lifecycle.issuerId,{blockTag:deactivateReceipt.blockNumber});
if(Boolean(issuerAtDeactivate.active))fail('issuer was not inactive at deactivation block');
const credentialAtDeactivate=Boolean(await identity.credentialValid(reissueId,{blockTag:deactivateReceipt.blockNumber}));
if(credentialAtDeactivate)fail('credential remained valid while issuer was inactive');

const storageSlots={};
for(const slot of [0,1,2,3])storageSlots[String(slot)]=await provider.getStorage(IDENTITY_ADDRESS_420,slot);

const eip1193={request:async(method,params=[])=>provider.send(method,params)};
const walletClient=createIdentity420Client({
  provider:eip1193,identityAddress:IDENTITY_ADDRESS_420,
  namesAddress:manifest.contracts?.Names420?.address||'0x0000000000000000000000000000000000000435',
  chainId:'0x'+BigInt(manifest.network.chainId).toString(16),
  account:lifecycle.finalProfileController,
});
const walletProfile=await walletClient.profile(lifecycle.profileId);
const walletRejected=await walletClient.credential(lifecycle.credentialId);
const walletRevoked=await walletClient.credential(reissueId);

const indexerBase=manifest.services.indexer.replace(/\/$/,'');
const profileKey=objectKey('profileId',lifecycle.profileId);
const issuerKey=objectKey('issuerId',lifecycle.issuerId);
const credentialKey=objectKey('credentialId',lifecycle.credentialId);
const pages={};
for(const [name,key] of Object.entries({profile:profileKey,issuer:issuerKey,credential:credentialKey})){
  pages[name]=await waitFor(async()=>{
    const body=await getJson(eventPageUrl(indexerBase,manifest.network.chainId,key),'420Indexer '+name+' Identity events');
    const data=body.data||body;
    if(!Array.isArray(data.items)||data.items.length===0)fail('Indexer '+name+' Identity history empty');
    return data;
  },Number(args.timeoutSeconds),'420Indexer '+name);
}
const latestProfile=pages.profile.items.at(-1),latestIssuer=pages.issuer.items.at(-1),latestCredential=pages.credential.items.at(-1);

const searchBase=manifest.services.search.replace(/\/$/,'');
const searchResult=await waitFor(async()=>{
  const u=new URL(searchBase+'/v1/resolve');u.searchParams.set('q','identity:'+lifecycle.profileId);
  const body=await getJson(u,'420Search Identity resolve');
  const result=body.result;if(!result)fail('Search Identity result missing');
  const resultKey=lower(result.key);\n  if(resultKey!==lower(lifecycle.profileId)&&resultKey!==profileKey)fail('Search profile key mismatch');
  if(lower(result.presentation?.subtitle)!==lower(lifecycle.finalProfileController))fail('Search controller not converged');
  if(String(result.presentation?.snippet||'').toLowerCase().includes('payload'))fail('Search leaked/claimed private payload');
  return result;
},Number(args.timeoutSeconds),'420Search');

const explorerBase=manifest.services.explorer.replace(/\/$/,'');
const explorerTx=await waitFor(async()=>{
  const url=new URL(explorerBase+'/v1/transactions/'+lifecycle.credentialRevokeTx);
  const response=await fetch(url,{headers:{accept:'application/json'}});
  if(!response.ok)fail('420Explorer transaction HTTP '+response.status);
  if(String(response.headers.get('X-420-Canonical-Authority')||'').toLowerCase()!=='false')fail('420Explorer claimed canonical authority');
  const body=await response.json();
  const tx=body.transaction||body.Transaction||body.data?.transaction;
  if(!tx)fail('Explorer transaction payload missing');
  return {body,tx,canonicalAuthority:false};
},Number(args.timeoutSeconds),'420Explorer');

const evidence={
  schema:IDENTITY_TESTNET_SCHEMA_420,phase:'ID-AUDIT-9',status:'PASS',
  repositorySha:args.repositorySha,manifestPath:args.manifest,
  read:{
    chainId:manifest.network.chainId,genesisHash:genesis.hash,blockNumber:String(latest.number),
    identity:{address:IDENTITY_ADDRESS_420,codeHash,systemName:'Identity420',protocolVersion:3,governanceTimelock:governance,storageSlots},
  },
  lifecycle:{
    ...lifecycle,
    rejectedCredentialValid:rejectedValid,
    revokedCredentialValid:revokedValid,
    expiryObservedInvalid:!expiryValid,
    issuerActiveAfterRecovery:Boolean(issuer.active),
    finalProfileController:lower(finalProfile.controller),
    finalProfileActive:Boolean(finalProfile.active),
  },
  services:{
    wallet:{
      qualified:true,profileId:lifecycle.profileId,controller:lower(walletProfile.controller),
      rejectedCredentialValid:Boolean(walletRejected.valid),revokedCredentialValid:Boolean(walletRevoked.valid),
    },
    indexer:{
      qualified:true,chainId:String(latestProfile.chainId),protocol:'420Identity',
      profileObjectKey:profileKey,issuerObjectKey:issuerKey,credentialObjectKey:credentialKey,
      latestProfileEvent:latestProfile.eventName,latestIssuerEvent:latestIssuer.eventName,
      latestCredentialEvent:latestCredential.eventName,latestBlockNumber:String(latestCredential.blockNumber),
    },
    search:{
      qualified:true,profileId:lifecycle.profileId,active:true,controller:lower(searchResult.presentation.subtitle),
      source:String(searchResult.provenance?.authority||searchResult.provenance?.source||''),
      privatePayloadExposed:String(searchResult.presentation?.snippet||'').toLowerCase().includes('payload'),
    },
    explorer:{
      qualified:true,identityAddress:IDENTITY_ADDRESS_420,transactionHash:lifecycle.credentialRevokeTx,
      blockNumber:String(revokeReceipt.blockNumber),canonicalAuthority:explorerTx.canonicalAuthority,
    },
  },
  recovery:draft.recovery,
};
validateIdentityLiveTestnetEvidence420(manifest,evidence,args.repositorySha);
await fs.mkdir(path.dirname(path.resolve(args.output)),{recursive:true});
await fs.writeFile(path.resolve(args.output),JSON.stringify(evidence,null,2)+'\n');
process.stdout.write(JSON.stringify(evidence,null,2)+'\n');
