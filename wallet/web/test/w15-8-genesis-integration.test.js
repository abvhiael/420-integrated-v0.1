import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {keccak256Hex} from '../core/keccak.js';
import {GENESIS_APP_SERVICES,NON_CANONICAL_WALLET_ALIASES,MISSING_CANONICAL_SERVICE_IDS_FOR_NAMED_GENESIS_PRODUCTS} from '../core/genesis-app-catalog.js';
import {normalizeGenesisRegistryBinding420,normalizeGenesisServiceEntry420,decodeGenesisServiceRecord420,
 verifyGenesisService420,discoverGenesisServices420,assertGenesisNavigationSnapshot420} from '../core/genesis-wallet-integration420.js';
import {normalize420Name,confirm420NameRecipient} from '../core/names-send.js';
import {validateTokenRuntime420,TOKEN_SERVICE_ID_420} from '../core/token-runtime.js';
import {validateWalletGasQuote420} from '../core/gas-sponsorship.js';

const chain='0x1a4',account='0x'+'ab'.repeat(20),registryAddress='0x'+'11'.repeat(20),implementation='0x'+'22'.repeat(20);
const registryCode='0x6001600055',implementationCode='0x6002600055',metadataHash='0x'+'33'.repeat(32);
const digest=hex=>keccak256Hex(Uint8Array.from(hex.slice(2).match(/../g),x=>parseInt(x,16)));
const registry={chainId:chain,address:registryAddress,codeHash:digest(registryCode)};
const meta=GENESIS_APP_SERVICES.find(x=>x.id==='swap');
const entry={id:meta.id,name:meta.name,serviceId:meta.serviceId,approved:true,chainId:chain,
 url:'https://swap.example.org/',origin:'https://swap.example.org',version:1,implementation,
 codeHash:digest(implementationCode),metadataHash};
const uint=value=>BigInt(value).toString(16).padStart(64,'0');
const asWord=value=>value.slice(2).padStart(64,'0');
const encoded=(x={})=>'0x'+asWord(x.implementation||implementation)+
 (x.codeHash||entry.codeHash).slice(2)+(x.metadataHash||metadataHash).slice(2)+
 uint(x.version??1)+uint(x.activatedAt??123)+uint(x.active??1);
function fakeRpc(overrides={}){
 const calls=[];
 const provider={request:async(method,args=[])=>{
  calls.push({method,args});
  if(overrides[method])return overrides[method](args,calls);
  if(method==='eth_chainId')return chain;
  if(method==='eth_getCode')return args[0]===registryAddress?registryCode:args[0]===implementation?implementationCode:'0x';
  if(method==='eth_call')return encoded();
  throw Error('Unsupported RPC method '+method);
 }};
 return {provider,calls};
}

test('W15.8 catalogue identities come from canonical Solidity service IDs, not aliases or named products',async()=>{
 const source=await readFile(new URL('../../../contracts/src/libraries/ServiceIds420.sol',import.meta.url),'utf8');
 const ids=new Set([...source.matchAll(/keccak256\("([^"]+)"\)/g)].map(x=>x[1]));
 assert.ok(ids.size>=40);
 for(const service of GENESIS_APP_SERVICES)assert.ok(ids.has(service.serviceId));
 for(const alias of NON_CANONICAL_WALLET_ALIASES)assert.equal(ids.has(alias.serviceId),false);
 for(const named of MISSING_CANONICAL_SERVICE_IDS_FOR_NAMED_GENESIS_PRODUCTS)
   assert.ok(!GENESIS_APP_SERVICES.some(x=>x.name===named.name));
});
test('live ProtocolRegistry service identity, implementation code, metadata and navigation are independently verified',async()=>{
 const {provider,calls}=fakeRpc();
 const service=await verifyGenesisService420(provider,{registry,entry,chainId:chain});
 assert.equal(service.verified,true);
 assert.equal(service.permission,'NAVIGATION_ONLY');
 assert.equal(service.accountGrant,false);
 assert.equal(service.spendingAuthority,false);
 const call=calls.find(x=>x.method==='eth_call');
 assert.equal(call.args[0].to,registryAddress);
 assert.equal(call.args[0].data.slice(0,10),'0x'+keccak256Hex(new TextEncoder().encode('getService(bytes32)')).slice(2,10));
 assert.equal(call.args[0].data.slice(10),keccak256Hex(new TextEncoder().encode(meta.serviceId)).slice(2));
 const permission=assertGenesisNavigationSnapshot420(service,service,{account,chainId:chain});
 assert.equal(permission.accountGrant,false);
 assert.equal(permission.spendingAuthority,false);
 assert.equal(permission.url,entry.url);
});
test('malformed, revoked, stale and counterfeit Registry records fail closed',async()=>{
 for(const overrides of [
  {eth_call:()=>encoded({active:0})},
  {eth_call:()=>encoded({version:2})},
  {eth_call:()=>encoded({implementation:'0x'+'44'.repeat(20)})},
  {eth_call:()=>encoded({metadataHash:'0x'+'55'.repeat(32)})},
  {eth_call:()=>encoded({codeHash:'0x'+'55'.repeat(32)})},
  {eth_call:()=> '0x1234'},
  {eth_getCode:()=> '0xdeadbeef'},
  {eth_chainId:(()=>{let n=0;return ()=>++n>1?'0x1':chain})()}
 ])await assert.rejects(()=>verifyGenesisService420(fakeRpc(overrides).provider,{registry,entry,chainId:chain}));
});
test('service manifest spoofing and malformed destinations cannot enter verified directory',()=>{
 const bad=[
  {...entry,approved:false}, {...entry,serviceId:'420/service/exchange/v1'},
  {...entry,id:'finance'}, {...entry,name:'420 Fake Swap'}, {...entry,chainId:'0x1'},
  {...entry,url:'https://evil.example.org/'}, {...entry,url:'http://swap.example.org/'},
  {...entry,url:'https://user@swap.example.org/'}, {...entry,url:'https://swap.example.org/?sig=1'},
  {...entry,url:'https://swap.example.org/#auto'},
  {...entry,version:0}, {...entry,codeHash:'0x'+'0'.repeat(64)}
 ];
 for(const candidate of bad)assert.throws(()=>normalizeGenesisServiceEntry420(candidate,chain));
 assert.throws(()=>normalizeGenesisRegistryBinding420({...registry,chainId:'0x1'},chain));
 assert.throws(()=>normalizeGenesisRegistryBinding420({...registry,codeHash:'0x'+'0'.repeat(64)},chain));
});
test('verified directory omits unavailable services, rejects duplicate identities and ignores stale registry data',async()=>{
 const {provider}=fakeRpc();
 const ok=await discoverGenesisServices420(provider,{registry,chainId:chain,services:[
  entry,{...entry}, {...entry,serviceId:'420/service/noncanonical/v1'}]});
 assert.equal(ok.length,1);assert.equal(ok[0].serviceId,entry.serviceId);
 const missing=await discoverGenesisServices420(fakeRpc({eth_call:()=>encoded({active:0})}).provider,{registry,chainId:chain,services:[entry]});
 assert.deepEqual(missing,[]);
});
test('launch rechecks immutable URL, version, implementation and account/network; no implicit grant',async()=>{
 const {provider}=fakeRpc(),verified=await verifyGenesisService420(provider,{registry,entry,chainId:chain});
 for(const changed of [{url:'https://swap.example.org/other'},{version:2},{metadataHash:'0x'+'55'.repeat(32)},
   {implementation:'0x'+'66'.repeat(20)}]){
  assert.throws(()=>assertGenesisNavigationSnapshot420(verified,{...verified,...changed},{account,chainId:chain}),/changed/);
 }
 assert.throws(()=>assertGenesisNavigationSnapshot420(verified,verified,{account,chainId:'0x1'}),/chain/);
 assert.throws(()=>assertGenesisNavigationSnapshot420(verified,verified,{account:'bad',chainId:chain}),/account/);
});
test('existing Names name normalizer blocks unicode and case lookalikes and catches retargeting between checks',async()=>{
 assert.equal(normalize420Name('safe.420'),'safe.420');
 for(const input of ['Sаfe.420','Safe.420','saƒe.420','safe.eth'])assert.throws(()=>normalize420Name(input));
 const first={labelHash:'0x'+'11'.repeat(32),record:{owner:account,resolvedAddress:implementation,expiresAt:9999999999,labelLength:4}};
 let n=0;
 await assert.rejects(()=>confirm420NameRecipient({name:'safe.420',
  lookup:async()=>{n++;return n===1?first:{...first,record:{...first.record,resolvedAddress:registryAddress}}},
  chainTime:async()=>1000,confirm:async()=>true}),/changed during confirmation/);
});
test('420Gas funding offers and 420Token deployment remain outside app navigation authority',()=>{
 const runtime={serviceId:TOKEN_SERVICE_ID_420,chainId:420,version:1,
  communityTreasuryVaultId:'420/treasury/vault/token-creation-community-revenue/v1',
  factory:{address:implementation,codeHash:'0x'+'11'.repeat(32)},
  templateRegistry:{address:registryAddress,codeHash:'0x'+'22'.repeat(32)},
  communityTreasuryVault:{address:account,codeHash:'0x'+'33'.repeat(32)}};
 assert.equal(validateTokenRuntime420(runtime).serviceId,TOKEN_SERVICE_ID_420);
 assert.throws(()=>validateTokenRuntime420({...runtime,serviceId:meta.serviceId}),/canonical/);
 assert.throws(()=>validateWalletGasQuote420({
  quoteId:'0x'+'11'.repeat(32),chainId:'420',entryPoint:registryAddress,
  paymaster:implementation,account,sponsorshipDigest:'0x'+'22'.repeat(32),
  policyId:'0x'+'33'.repeat(32),authorizationId:'0x'+'44'.repeat(32),
  maxSponsoredCostWei:'1',validAfter:'2020-01-01T00:00:00Z',validUntil:'2099-01-01T00:00:00Z',
  paymasterAndData:'0xab',authority:'funding-offer-only',
  executionAuthorization:true
 },{entryPoint:registryAddress,account}),/authority/);
});
