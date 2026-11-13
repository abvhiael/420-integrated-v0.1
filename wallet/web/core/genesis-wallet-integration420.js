import {keccak256Hex} from './keccak.js';
import {GENESIS_APP_SERVICES} from './genesis-app-catalog.js';

const ADDRESS=/^0x[0-9a-fA-F]{40}$/;
const HASH=/^0x[0-9a-fA-F]{64}$/;
const ZERO='0x'+'0'.repeat(40);
const ENCODER=new TextEncoder();
const canonical=new Map(GENESIS_APP_SERVICES.map(x=>[x.serviceId,x]));
const error=(message,code=4100)=>Object.assign(new Error(message),{code});
function check(v,message){if(!v)throw error(message)}
function address(value,label){check(typeof value==='string'&&ADDRESS.test(value)&&value.toLowerCase()!==ZERO,label+' must be a nonzero EVM address');return value.toLowerCase()}
function hash(value,label){check(typeof value==='string'&&HASH.test(value)&&!/^0x0{64}$/i.test(value),label+' must be a nonzero bytes32');return value.toLowerCase()}
function chainId(value){check(typeof value==='string'&&/^0x[0-9a-fA-F]+$/.test(value)&&BigInt(value)>0n,'Verified EIP-155 chain ID required');return '0x'+BigInt(value).toString(16)}
function url(value,expectedOrigin){
 let parsed;try{parsed=new URL(value)}catch{throw error('Invalid Genesis service URL')}
 check(parsed.protocol==='https:'&&!parsed.username&&!parsed.password&&!parsed.search&&!parsed.hash&&
    parsed.hostname.includes('.')&&!parsed.hostname.endsWith('.invalid'),'Genesis navigation must use a public HTTPS URL');
 check(parsed.origin===expectedOrigin&&parsed.pathname.length<=300,'Service origin has changed');
 return parsed.href;
}
const getServiceSelector='0x'+keccak256Hex(ENCODER.encode('getService(bytes32)')).slice(2,10);
const bytes=hex=>Uint8Array.from(hex.slice(2).match(/../g)||[],x=>parseInt(x,16));
const codeHash=hex=>keccak256Hex(bytes(hex)).toLowerCase();

export function normalizeGenesisRegistryBinding420(config,selectedChain){
 check(config&&typeof config==='object','Registry deployment not configured');
 const expected=chainId(selectedChain),chain=chainId(config.chainId);
 check(expected===chain,'Genesis Registry chain mismatch');
 return Object.freeze({chainId:chain,address:address(config.address,'Registry'),codeHash:hash(config.codeHash,'Registry code hash')});
}
export function normalizeGenesisServiceEntry420(entry,selectedChain){
 check(entry&&entry.approved===true,'Genesis service has not been release-approved');
 check(typeof entry.serviceId==='string'&&canonical.has(entry.serviceId),'Unknown or noncanonical Genesis service ID');
 const meta=canonical.get(entry.serviceId);
 check(entry.id===meta.id&&entry.name===meta.name,'Genesis catalogue identity mismatch');
 check(chainId(entry.chainId)===chainId(selectedChain),'Service published on a different chain');
 check(Number.isSafeInteger(entry.version)&&entry.version>0&&entry.version<=0xffffffff,'Invalid service version');
 check(typeof entry.origin==='string'&&entry.origin.startsWith('https://'),'Missing approved service origin');
 const parsedOrigin=new URL(entry.origin);
 check(parsedOrigin.origin===entry.origin&&!parsedOrigin.username&&!parsedOrigin.password&&!parsedOrigin.search&&!parsedOrigin.hash,'Origin must be exact HTTPS authority');
 const result=Object.freeze({id:meta.id,name:meta.name,category:meta.category,serviceId:meta.serviceId,
   chainId:chainId(selectedChain),version:entry.version,origin:parsedOrigin.origin,url:url(entry.url,entry.origin),
   implementation:address(entry.implementation,'Service implementation'),
   codeHash:hash(entry.codeHash,'Service code hash'),metadataHash:hash(entry.metadataHash,'Service metadata hash'),
   permission:'NAVIGATION_ONLY',accountGrant:false,spendingAuthority:false,
   description:meta.description});
 return result;
}
export function decodeGenesisServiceRecord420(raw){
 check(typeof raw==='string'&&/^0x[0-9a-fA-F]{384}$/.test(raw),'Malformed ProtocolRegistry getService response');
 const words=Array.from({length:6},(_,i)=>raw.slice(2+i*64,2+(i+1)*64).toLowerCase());
 const implementation='0x'+words[0].slice(-40);
 const version=BigInt('0x'+words[3]),active=BigInt('0x'+words[5]);
 check(BigInt('0x'+words[0].slice(0,24))===0n,'Malformed Registry address word');
 check(version>0n&&version<=0xffffffffn&&active<=1n,'Malformed ProtocolRegistry version or status');
 check(BigInt('0x'+words[4])<=((1n<<64n)-1n),'Malformed ProtocolRegistry activation time');
 return Object.freeze({implementation,codeHash:'0x'+words[1],metadataHash:'0x'+words[2],
   version:Number(version),activatedAt:BigInt('0x'+words[4]),active:active===1n});
}
export async function verifyGenesisService420(provider,{registry,entry,chainId:expectedChain}){
 check(provider&&typeof provider.request==='function','Verified chain RPC required');
 const expected=chainId(expectedChain),deployment=normalizeGenesisRegistryBinding420(registry,expected);
 const approved=normalizeGenesisServiceEntry420(entry,expected);
 const start=chainId(await provider.request('eth_chainId',[]));
 check(start===expected,'RPC chain identity changed before service check');
 const registryCode=await provider.request('eth_getCode',[deployment.address,'latest']);
 check(typeof registryCode==='string'&&/^0x(?:[0-9a-fA-F]{2})+$/.test(registryCode)&&codeHash(registryCode)===deployment.codeHash,
   'ProtocolRegistry runtime code hash mismatch');
 const serviceHash=keccak256Hex(ENCODER.encode(approved.serviceId));
 const raw=await provider.request('eth_call',[{to:deployment.address,data:getServiceSelector+serviceHash.slice(2)},'latest']);
 const actual=decodeGenesisServiceRecord420(raw);
 check(actual.active,'Service has been revoked or deactivated');
 check(actual.implementation===approved.implementation&&actual.codeHash===approved.codeHash&&
   actual.metadataHash===approved.metadataHash&&actual.version===approved.version,
   'Service manifest differs from authoritative Registry record');
 const serviceCode=await provider.request('eth_getCode',[actual.implementation,'latest']);
 check(typeof serviceCode==='string'&&/^0x(?:[0-9a-fA-F]{2})+$/.test(serviceCode)&&codeHash(serviceCode)===actual.codeHash,
   'Service implementation runtime code hash mismatch');
 check(chainId(await provider.request('eth_chainId',[]))===expected,'RPC chain changed during service check');
 return Object.freeze({...approved,registry:deployment.address,registryCodeHash:deployment.codeHash,verified:true,
   status:'registry-verified',permission:'NAVIGATION_ONLY',accountGrant:false,spendingAuthority:false});
}
export async function discoverGenesisServices420(provider,{registry,services,chainId:expectedChain,limit=40}){
 if(!registry||!Array.isArray(services)||services.length>60||!Number.isInteger(limit)||limit<1||limit>60)return [];
 const seen=new Set(),selected=[];
 for(const entry of services){
   if(!entry?.serviceId||seen.has(entry.serviceId))continue;
   seen.add(entry.serviceId);
   if(selected.length>=limit)break;
   selected.push(entry);
 }
 const output=[];
 // Bound RPC concurrency; do not hammer unresponsive Registry endpoints on popup open.
 for(let offset=0;offset<selected.length;offset+=3){
   const results=await Promise.allSettled(selected.slice(offset,offset+3).map(
     entry=>verifyGenesisService420(provider,{registry,entry,chainId:expectedChain})));
   for(const item of results)if(item.status==='fulfilled')output.push(item.value);
 }
 return output;
}
export function assertGenesisNavigationSnapshot420(previous,current,{account,chainId:expectedChain}){
 check(previous?.verified===true&&current?.verified===true,'Unverified Genesis destination');
 check(previous.serviceId===current.serviceId&&previous.url===current.url&&previous.origin===current.origin&&
  previous.version===current.version&&previous.implementation===current.implementation&&
  previous.codeHash===current.codeHash&&previous.metadataHash===current.metadataHash,
   'Destination changed since review');
 check(current.chainId===chainId(expectedChain),'Genesis navigation chain changed');
 check(typeof account==='string'&&ADDRESS.test(account),'Select an account before opening a Genesis app');
 // Navigation does not initiate eth_requestAccounts or authorize any dApp.
 return Object.freeze({url:current.url,origin:current.origin,serviceId:current.serviceId,
   account:account.toLowerCase(),chainId:current.chainId,
   accountGrant:false,spendingAuthority:false,authority:'NAVIGATION_ONLY'});
}

export async function verifyGenesisIdentityBinding420(client,{account,chainId:expectedChain,profileId,requirePrimaryName=false}={}){
 check(client&&typeof client.verifySession==='function'&&typeof client.profile==='function'&&
   typeof client.bilateralPrimaryName==='function','Verified Identity420 client required');
 const controller=address(account,'Wallet controller'),expected=chainId(expectedChain);
 check(typeof profileId==='string'&&HASH.test(profileId),'Identity420 profileId must be bytes32');
 const prior=await client.verifySession();
 check(chainId(prior?.chainId)===expected,'Identity420 network changed');
 check(typeof client.account==='string'&&client.account.toLowerCase()===controller,'Identity420 signer account mismatch');
 const profile=await client.profile(profileId);
 check(profile?.exists===true&&profile.active===true&&
   typeof profile.controller==='string'&&profile.controller.toLowerCase()===controller,
   'Identity420 profile is inactive or belongs to another controller');
 const zero='0x'+'0'.repeat(64);
 let primaryNameVerified=false;
 if(typeof profile.primaryName==='string'&&HASH.test(profile.primaryName)&&profile.primaryName.toLowerCase()!==zero){
   const names=await client.bilateralPrimaryName(profileId,profile.primaryName);
   primaryNameVerified=names?.bilateral===true&&names?.profile?.controller?.toLowerCase()===controller;
 }
 if(requirePrimaryName)check(primaryNameVerified,'Names420 and Identity420 primary name are not mutually verified');
 const after=await client.verifySession();
 check(chainId(after?.chainId)===expected&&client.account.toLowerCase()===controller,
   'Identity420 account or chain changed while reading profile');
 return Object.freeze({profileId:profileId.toLowerCase(),account:controller,chainId:expected,
   active:true,primaryNameVerified,profileBinding:'on-chain-verified',
   grantsWalletAuthority:false,grantsSpendingAuthority:false});
}
