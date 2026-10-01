import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {
  Contract, JsonRpcProvider, Wallet, id, keccak256, randomBytes, toUtf8Bytes, ZeroHash,
} from 'ethers';
import { validateNetworkManifest420 } from '../../developer-hub/src/network-discovery.mjs';
import { createNames420Client, hash420Label } from '../../wallet/web/core/names-client.js';
import {
  NAMES_ADDRESS_420,
  REGISTRY_ADDRESS_420,
  NAMES_RUNTIME_HASH_420,
  NAMES_SERVICE_ID_420,
  NAMES_TESTNET_SCHEMA_420,
  runtimeHash420,
  validateNamesLiveTestnetEvidence420,
} from '../dist/src/names-testnet-qualification.js';

const sleep=(ms)=>new Promise((resolve)=>setTimeout(resolve,ms));
const fail=(message)=>{throw new Error(message);};
const lower=(value)=>String(value).toLowerCase();

function parseArgs(argv){
  const args={manifest:null,searchUrl:null,repositorySha:null,output:null,label:null,timeoutSeconds:'240'};
  for(let i=0;i<argv.length;i+=1){
    const key=argv[i];
    if(!key?.startsWith('--')) fail('unexpected argument: '+key);
    const name=key.slice(2);
    if(!Object.hasOwn(args,name)) fail('unsupported argument: --'+name);
    const value=argv[++i];
    if(!value||value.startsWith('--')) fail('missing value for --'+name);
    args[name]=value;
  }
  for(const key of ['manifest','searchUrl','repositorySha','output']) if(!args[key]) fail('--'+key+' is required');
  if(!/^[0-9a-f]{40}$/i.test(args.repositorySha)) fail('--repositorySha must be a 40-hex commit SHA');
  if(!/^\d+$/.test(args.timeoutSeconds)||Number(args.timeoutSeconds)<60) fail('--timeoutSeconds must be at least 60');
  return args;
}

async function json(file){
  try{return JSON.parse(await fs.readFile(file,'utf8'));}catch(error){fail('cannot read valid JSON from '+file+': '+error.message);}
}
async function rpcFetch(url,method,params=[]){
  const response=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});
  if(!response.ok) fail('RPC '+method+' HTTP '+response.status);
  const payload=await response.json();
  if(payload.error) fail('RPC '+method+' error: '+(payload.error.message||'unknown'));
  if(!Object.hasOwn(payload,'result')) fail('RPC '+method+' missing result');
  return payload.result;
}
function secureUrl(value,label){
  const u=new URL(value);
  if(u.protocol!=='https:') fail(label+' must use HTTPS');
  if(u.username||u.password) fail(label+' must not embed credentials');
  return u;
}
async function getJson(url,label){
  const response=await fetch(url,{headers:{accept:'application/json'}});
  if(!response.ok) fail(label+' HTTP '+response.status);
  return response.json();
}
async function waitReceipt(tx,label){
  const receipt=await tx.wait();
  if(!receipt||receipt.status!==1) fail(label+' transaction failed or receipt missing');
  return receipt;
}
async function waitForTimestamp(provider,target,timeoutSeconds){
  const deadline=Date.now()+timeoutSeconds*1000;
  while(Date.now()<deadline){
    const block=await provider.getBlock('latest');
    if(block&&BigInt(block.timestamp)>=target) return block;
    await sleep(3000);
  }
  fail('commitment reveal window did not open before qualification timeout');
}
async function waitForDerived(fn,timeoutSeconds,label){
  const deadline=Date.now()+timeoutSeconds*1000;
  let last;
  while(Date.now()<deadline){
    try{return await fn();}catch(error){last=error;await sleep(3000);}
  }
  fail(label+' did not converge: '+(last?.message||'timeout'));
}

const args=parseArgs(process.argv.slice(2));
const manifest=validateNetworkManifest420(await json(args.manifest));
if(manifest.network.environment!=='testnet') fail('NAMES-AUDIT-9 requires official environment=testnet manifest');
const rpcUrl=manifest.rpc?.http?.[0];
secureUrl(rpcUrl,'official RPC');
secureUrl(manifest.services?.indexer,'official Indexer');
secureUrl(args.searchUrl,'420Search');
if(lower(manifest.contracts?.Names420?.address)!==NAMES_ADDRESS_420) fail('official manifest Names420 must be canonical 0x0435');
if(lower(manifest.contracts?.ProtocolRegistry?.address)!==REGISTRY_ADDRESS_420) fail('official manifest ProtocolRegistry must be canonical 0x0434');

const ownerKey=process.env.NAMES_TESTNET_OWNER_PRIVATE_KEY;
const recipientKey=process.env.NAMES_TESTNET_RECIPIENT_PRIVATE_KEY;
if(!/^0x[0-9a-fA-F]{64}$/.test(ownerKey||'')) fail('NAMES_TESTNET_OWNER_PRIVATE_KEY missing from protected environment');
if(!/^0x[0-9a-fA-F]{64}$/.test(recipientKey||'')) fail('NAMES_TESTNET_RECIPIENT_PRIVATE_KEY missing from protected environment');
if(lower(ownerKey)===lower(recipientKey)) fail('owner and recipient testnet keys must be distinct');

const provider=new JsonRpcProvider(rpcUrl);
const network=await provider.getNetwork();
if(network.chainId!==BigInt(manifest.network.chainId)) fail('RPC chain ID does not match official manifest');
const genesis=await provider.getBlock(0);
if(!genesis?.hash) fail('RPC did not return canonical genesis block');
const latest=await provider.getBlock('latest');
if(!latest?.number) fail('RPC head unavailable');

const namesArtifact=await json(new URL('../../contracts/artifacts/Names420.json',import.meta.url));
const registryArtifact=await json(new URL('../../contracts/artifacts/ProtocolRegistry.json',import.meta.url));
const namesCode=await provider.getCode(NAMES_ADDRESS_420);
const namesCodeHash=runtimeHash420(namesCode);
if(lower(namesCodeHash)!==NAMES_RUNTIME_HASH_420) fail('live Names420 runtime hash mismatch');

const namesRead=new Contract(NAMES_ADDRESS_420,namesArtifact.abi,provider);
if(await namesRead.systemName()!=='Names420') fail('live Names420 systemName mismatch');
if(Number(await namesRead.protocolVersion())!==3) fail('live Names420 protocolVersion mismatch');
const governance=lower(await namesRead.governanceTimelock());
if(governance!=='0x0000000000000000000000000000000000000429') fail('live Names420 governance binding mismatch');
const mappingRootSlots={};
for(const slot of [0,1,2]) mappingRootSlots[String(slot)]=await provider.getStorage(NAMES_ADDRESS_420,slot);

const registry=new Contract(REGISTRY_ADDRESS_420,registryArtifact.abi,provider);
const [registryImpl,registryRevision]=await registry.resolveActive(NAMES_SERVICE_ID_420);
const registryService=await registry.getService(NAMES_SERVICE_ID_420);
if(lower(registryImpl)!==NAMES_ADDRESS_420) fail('ProtocolRegistry does not discover canonical Names420');
if(lower(registryService.implementation)!==NAMES_ADDRESS_420||registryService.active!==true) fail('ProtocolRegistry Names service is inactive or wrong');
if(lower(registryService.codeHash)!==NAMES_RUNTIME_HASH_420) fail('ProtocolRegistry Names runtime hash mismatch');

const owner=new Wallet(ownerKey,provider);
const recipient=new Wallet(recipientKey,provider);
const ownerAddress=lower(await owner.getAddress());
const recipientAddress=lower(await recipient.getAddress());
const namesOwner=new Contract(NAMES_ADDRESS_420,namesArtifact.abi,owner);
const namesRecipient=new Contract(NAMES_ADDRESS_420,namesArtifact.abi,recipient);
const minAge=BigInt(await namesRead.MIN_COMMITMENT_AGE());
const maxAge=BigInt(await namesRead.MAX_COMMITMENT_AGE());
const duration=BigInt(await namesRead.MIN_REGISTRATION_PERIOD());

let label=args.label;
if(!label){
  label='audit9-'+Date.now().toString(36)+'.420';
}
if(!/^[a-z0-9-]{1,63}\.420$/.test(label)) fail('qualification label must be lowercase ASCII/hyphen .420');
const labelHash=hash420Label(label);
if(!(await namesRead.isAvailable(labelHash))) fail('qualification label is already active');
const salt='0x'+Buffer.from(randomBytes(32)).toString('hex');
const commitment=await namesRead.makeCommitment(labelHash,label.slice(0,-4).length,ownerAddress,duration,salt,ownerAddress);
const commitReceipt=await waitReceipt(await namesOwner.commit(commitment),'commit');
const committedAt=BigInt(await namesRead.commitments(commitment));
if(committedAt===0n) fail('commitment timestamp not recorded');
await waitForTimestamp(provider,committedAt+minAge,Number(args.timeoutSeconds));
const beforeReveal=await provider.getBlock('latest');
if(!beforeReveal||BigInt(beforeReveal.timestamp)>committedAt+maxAge) fail('commitment expired before reveal');

const registerReceipt=await waitReceipt(await namesOwner.register(labelHash,label.slice(0,-4).length,ownerAddress,duration,salt),'register');
const registered=await namesRead.resolve(labelHash);
if(lower(registered.owner)!==ownerAddress||lower(registered.resolvedAddress)!==ownerAddress) fail('registered Names state mismatch');

const renewReceipt=await waitReceipt(await namesOwner.renew(labelHash,duration),'renew');
const profileId=id('NAMES-AUDIT-9/profile/'+labelHash);
const serviceId=id('NAMES-AUDIT-9/service/'+labelHash);
const resolutionReceipt=await waitReceipt(await namesOwner.setResolution(labelHash,ownerAddress,profileId,serviceId),'setResolution');
const reverseReceipt=await waitReceipt(await namesOwner.setReverseName(labelHash),'setReverseName');
if(lower(await namesRead.reverseResolve(ownerAddress))!==lower(labelHash)) fail('reverse resolution did not bind owner');

const transferReceipt=await waitReceipt(await namesOwner.transferName(labelHash,recipientAddress),'transferName');
const acceptReceipt=await waitReceipt(await namesRecipient.acceptName(labelHash),'acceptName');
const finalRecord=await namesRead.resolve(labelHash);
const reverseAfterTransfer=await namesRead.reverseResolve(ownerAddress);
if(lower(finalRecord.owner)!==recipientAddress||lower(finalRecord.resolvedAddress)!==recipientAddress) fail('accepted transfer final owner/resolution mismatch');
if(lower(finalRecord.profileId)!==ZeroHash||lower(finalRecord.serviceId)!==ZeroHash) fail('accepted transfer did not clear profile/service');
if(lower(reverseAfterTransfer)!==ZeroHash) fail('stale reverse record remained authoritative after transfer');

const eip1193={request:async(method,params=[])=>provider.send(method,params)};
const walletClient=createNames420Client({provider:eip1193,namesAddress:NAMES_ADDRESS_420,chainId:'0x'+BigInt(manifest.network.chainId).toString(16)});
const walletLookup=await walletClient.lookup(label);
if(lower(walletLookup.record.resolvedAddress)!==recipientAddress) fail('Wallet Names client disagrees with canonical post-transfer resolution');

const indexerBase=manifest.services.indexer.replace(/\/$/,'');
const objectKey='labelHash:'+lower(labelHash);
const indexerPage=await waitForDerived(async()=>{
  const u=new URL(indexerBase+'/v1/protocols/events');
  u.searchParams.set('chainId',manifest.network.chainId);
  u.searchParams.set('protocol','420Names');
  u.searchParams.set('objectKey',objectKey);
  u.searchParams.set('direction','asc');
  u.searchParams.set('limit','200');
  const env=await getJson(u,'420Indexer protocol events');
  if(env.apiVersion!=='v1'||!env.data?.items) fail('420Indexer protocol-event envelope invalid');
  const items=env.data.items;
  const latestEvent=items.at(-1);
  if(!latestEvent||latestEvent.eventName!=='NameTransferred') fail('420Indexer has not indexed final Names transfer');
  return env.data;
},Number(args.timeoutSeconds),'420Indexer');

const searchBase=args.searchUrl.replace(/\/$/,'');
const searchResponse=await waitForDerived(async()=>{
  const u=new URL(searchBase+'/v1/resolve');
  u.searchParams.set('q','name:'+objectKey);
  const body=await getJson(u,'420Search resolve');
  const result=body.result;
  if(!result||lower(result.key)!==objectKey) fail('420Search labelHash mismatch');
  if(lower(result.presentation?.subtitle)!==recipientAddress) fail('420Search resolution has not converged');
  const snippet=String(result.presentation?.snippet||'');
  const ownerMatch=snippet.match(/owner\s+(0x[0-9a-fA-F]{40})/);
  if(!ownerMatch||lower(ownerMatch[1])!==recipientAddress) fail('420Search owner has not converged');
  return result;
},Number(args.timeoutSeconds),'420Search');

const latestIndexed=indexerPage.items.at(-1);
const ownerMatch=String(searchResponse.presentation.snippet).match(/owner\s+(0x[0-9a-fA-F]{40})/);
const evidence={
  schema:NAMES_TESTNET_SCHEMA_420,
  phase:'NAMES-AUDIT-9',
  status:'PASS',
  repositorySha:args.repositorySha,
  manifestPath:args.manifest,
  read:{
    chainId:manifest.network.chainId,
    genesisHash:genesis.hash,
    blockNumber:String(latest.number),
    names:{
      address:NAMES_ADDRESS_420,
      codeHash:namesCodeHash,
      systemName:'Names420',
      protocolVersion:3,
      governanceTimelock:governance,
      mappingRootSlots,
    },
    registry:{
      address:REGISTRY_ADDRESS_420,
      serviceId:NAMES_SERVICE_ID_420,
      implementation:lower(registryImpl),
      revision:Number(registryRevision),
      codeHash:lower(registryService.codeHash),
      active:Boolean(registryService.active),
    },
  },
  workflow:{
    label,labelHash:lower(labelHash),owner:ownerAddress,recipient:recipientAddress,
    commitTx:commitReceipt.hash,registerTx:registerReceipt.hash,renewTx:renewReceipt.hash,
    resolutionTx:resolutionReceipt.hash,reverseTx:reverseReceipt.hash,
    transferTx:transferReceipt.hash,acceptTx:acceptReceipt.hash,
    finalOwner:lower(finalRecord.owner),finalResolvedAddress:lower(finalRecord.resolvedAddress),
    finalProfileId:lower(finalRecord.profileId),finalServiceId:lower(finalRecord.serviceId),
    reverseAfterTransfer:lower(reverseAfterTransfer),
  },
  services:{
    indexer:{
      qualified:true,chainId:String(latestIndexed.chainId),protocol:'420Names',labelHash:lower(labelHash),
      latestEventName:latestIndexed.eventName,latestBlockNumber:String(latestIndexed.blockNumber),
    },
    search:{
      qualified:true,labelHash:lower(labelHash),resolvedOwner:lower(ownerMatch[1]),
      resolvedAddress:lower(searchResponse.presentation.subtitle),source:String(searchResponse.provenance?.source||''),
    },
    wallet:{
      qualified:true,label,labelHash:lower(walletLookup.labelHash),resolvedAddress:lower(walletLookup.record.resolvedAddress),
    },
  },
};
validateNamesLiveTestnetEvidence420(manifest,evidence,args.repositorySha);
await fs.mkdir(path.dirname(path.resolve(args.output)),{recursive:true});
await fs.writeFile(path.resolve(args.output),JSON.stringify(evidence,null,2)+'\n');
process.stdout.write(JSON.stringify(evidence,null,2)+'\n');
