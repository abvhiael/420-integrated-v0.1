import test from 'node:test';
import assert from 'node:assert/strict';
import {createBridgeClient420,BRIDGE_COMPONENTS_420} from '../core/bridge-client.js';
import {keccak256Hex} from '../core/keccak.js';
import {encodeInitiateOutbound} from '../../../exchange/web/core/abi.js';
import {createExchangeBridge420,requireBridgeCompositionSettlement420} from '../../../exchange/web/core/canonical-bridge.js';
const H=s=>keccak256Hex(new TextEncoder().encode(s)),sel=s=>H(s).slice(0,10);
const word=n=>BigInt(n).toString(16).padStart(64,'0'),id=n=>'0x'+word(n),address=n=>'0x'+word(n).slice(-40);
const encode=xs=>'0x'+xs.map(x=>typeof x==='string'&&x.startsWith('0x')?x.slice(2).padStart(64,'0'):word(x)).join('');
const codeHash=keccak256Hex(Uint8Array.of(0x60,0));
function fixture(){
 const names=Object.keys(BRIDGE_COMPONENTS_420),components=Object.fromEntries(names.map((n,i)=>[n,address(100+i)]));
 const componentIds=Object.fromEntries(Object.entries(BRIDGE_COMPONENTS_420).map(([n,s])=>[H('420/APP/420BRIDGE/'+s),n]));
 let currentChain='0x420',account=address(1),now=1000,routeActive=true,adapterActive=true,runtimeValid=true,serviceActive=true,exchangeActive=true,remaining=1000000n,reorg=false,simulationFails=false,status=6,confirmations=0;
 const calls=[],sent=[];
 const provider={async request({method,params=[]}){
 calls.push({method,params});
 if(method==='eth_chainId')return currentChain;
 if(method==='eth_accounts'||method==='eth_requestAccounts')return [account];
 if(method==='wallet_switchEthereumChain'){currentChain=params[0].chainId;return null;}
 if(method==='eth_getBlockByNumber')return {number:'0xa',hash:reorg?id(999):id(10),timestamp:'0x64'};
 if(method==='eth_getCode')return runtimeValid?'0x6000':'0x6001';
 if(method==='eth_estimateGas')return '0x12345';
 if(method==='eth_sendTransaction'){sent.push(params[0]);return id(321);}
 if(method==='eth_call'){
  const {to,data}=params[0],selector=data.slice(0,10),arg='0x'+data.slice(10,74);
  if(to===address(9)){
   if(selector===sel('resolve(bytes32)'))return encode([componentIds[arg]?components[componentIds[arg]]:address(80)]);
   if(selector===sel('runtimeCodeHash(bytes32)'))return encode([codeHash]);
   if(selector===sel('getService(bytes32)'))return encode([components.GatewayRouter420,codeHash,id(90),1,1,serviceActive?1:0]);
  }
  if(selector===sel('componentId()')){const name=names.find(n=>components[n]===to);return encode([H('420/APP/420BRIDGE/'+BRIDGE_COMPONENTS_420[name])]);}
  if(selector===sel('routes(bytes32)'))return encode([id(3),0x420,1,id(31),id(32),id(4),id(5),1,routeActive?2:3,1,1]);
  if(selector===sel('chainBindings(bytes32)'))return encode([id(41),id(42),id(43),id(44)]);
  if(selector===sel('chains(bytes32)'))return arg===id(41)?encode([0x420,id(42),id(50),id(51),1,1]):encode([1,id(44),id(50),id(51),1,1]);
  if(selector===sel('assets(bytes32)'))return encode([address(60),id(3),id(61),id(62),id(63),2,1]);
  if(selector===sel('adapters(bytes32)')){if(!adapterActive)throw Error('disabled adapter');return encode([address(70)]);}
  if(selector===sel('adapterId()'))return encode([id(4)]);
  if(selector===sel('requireQualified(bytes32)')){if(!exchangeActive)throw Error('ineligible Exchange asset');return encode([id(3),id(2),id(4),id(71),1,1,1]);}
  if(selector===sel('routeLimits(bytes32)')||selector===sel('assetLimits(bytes32)'))return encode([1000000,1000000,1000000,1000000,1000000,1000000]);
  if(selector===sel('routeUsage(bytes32)')||selector===sel('assetUsage(bytes32)'))return encode([0,0,0,0,0,0,remaining]);
  if(selector===sel('routeUnsettledInbound(bytes32)')||selector===sel('assetUnsettledInbound(bytes32)'))return encode([0]);
  if(selector===sel('limit(bytes32,bytes32)'))return encode([id(2),H('420/BRIDGE/LIMIT/HOURLY_OUT'),3600,remaining,0,remaining]);
  if(selector===sel('transfers(bytes32)'))return encode([id(2),id(3),address(1),address(2),100,id(101),id(102),status,100,100]);
  if(selector===sel('initiateOutbound(bytes32,bytes32,bytes32,bytes,uint256,bytes)')){if(simulationFails)throw Error('adapter fee/recipient rejection');return encode([id(102)]);}
  if(selector===sel('requireOutboundSigningAdmission(bytes32,bytes32,bytes32)'))return encode([id(80)]);
  if([sel('requireRouteChainsCurrent(bytes32)'),sel('requireRouteVerifierCurrent(bytes32)'),sel('requireOutboundSigningAdmission(bytes32,bytes32,bytes32)')].includes(selector))return '0x';
  throw Error('unexpected call '+selector+' to '+to);
 }
 throw Error('unexpected method '+method);
 }};
 const config={provider,chainId:'0x420',registry:address(9),registryCodeHash:codeHash,exchangeQualification:address(8),exchangeQualificationCodeHash:codeHash,clock:()=>now};
 return {client:createBridgeClient420(config),config,calls,sent,input:{routeId:id(2),exchangeAssetId:id(7),amountRaw:'100',recipientBytes:address(2),feeValueWei:'3',extra:'0x1234'},
 change(o){if(o.chain!==undefined)currentChain=o.chain;if(o.account!==undefined)account=o.account;if(o.now!==undefined)now=o.now;if(o.routeActive!==undefined)routeActive=o.routeActive;if(o.adapterActive!==undefined)adapterActive=o.adapterActive;if(o.runtimeValid!==undefined)runtimeValid=o.runtimeValid;if(o.serviceActive!==undefined)serviceActive=o.serviceActive;if(o.exchangeActive!==undefined)exchangeActive=o.exchangeActive;if(o.remaining!==undefined)remaining=o.remaining;if(o.reorg!==undefined)reorg=o.reorg;if(o.simulationFails!==undefined)simulationFails=o.simulationFails;if(o.status!==undefined)status=o.status;}};
}

test('Registry-backed bridge review uses exact raw amounts, networks, risk, ABI simulation and explicit confirmation',async()=>{
 const f=fixture();assert.equal(await f.client.connect(),address(1));const r=await f.client.review(f.input);
 assert.equal(r.destinationNetworkId,id(44));assert.equal(r.risk.remainingRaw,'1000000');assert.equal(r.minimumRaw,'1');
 assert.equal(r.transaction.data,encodeInitiateOutbound({adapterId:id(4),routeId:id(2),assetId:id(3),amountRaw:'100',recipientBytes:address(2),extra:'0x1234'}));
 assert.equal(f.sent.length,0);assert.equal(await f.client.submit(r,async x=>{assert.equal(x,r);return true;}),id(321));assert.equal(f.sent.length,1);
 await assert.rejects(f.client.submit(r,async()=>true),/unrecognized/);
});
test('wrong chains and revoked services/components, stale routes, disabled adapters and ineligible Exchange assets fail closed',async()=>{
 for(const mutation of [{chain:'0x1'},{serviceActive:false},{runtimeValid:false},{routeActive:false},{adapterActive:false},{exchangeActive:false},{remaining:99n}]){
  const f=fixture();f.change(mutation);await assert.rejects(f.client.review(f.input));assert.equal(f.sent.length,0);
 }
});
test('switching requests the exact network then rechecks live wallet state',async()=>{
 const f=fixture();f.change({chain:'0x1'});assert.equal(await f.client.switchChain(),address(1));assert.equal(f.calls.find(c=>c.method==='wallet_switchEthereumChain').params[0].chainId,'0x420');
});
test('floating amounts, malformed recipient networks and failed adapter simulation cannot be reviewed',async()=>{
 for(const mutation of [{amountRaw:100},{amountRaw:'1.5'},{amountRaw:'0'},{recipientBytes:'0x1234'},{recipientBytes:'0x'},{feeValueWei:'-1'}]){
  const f=fixture();await assert.rejects(f.client.review({...f.input,...mutation}));assert.equal(f.sent.length,0);
 }
 const f=fixture();f.change({simulationFails:true});await assert.rejects(f.client.review(f.input),/adapter/);
});
test('confirmation rejection and post-review account/chain/route/risk/fee changes cannot submit',async()=>{
 for(const mutation of [{account:address(2)},{chain:'0x1'},{now:31000},{routeActive:false},{remaining:1n},{simulationFails:true}]){
  const f=fixture(),r=await f.client.review(f.input);await assert.rejects(f.client.submit(r,async()=>{f.change(mutation);return true;}));assert.equal(f.sent.length,0);
 }
 const f=fixture(),r=await f.client.review(f.input);await assert.rejects(f.client.submit(r,async()=>false),/rejected/);await assert.rejects(f.client.submit({...r},async()=>true),/unrecognized/);
});
test('simultaneous submits cannot send duplicate value and read-only projections cannot manufacture a review',async()=>{
 const f=fixture(),r=await f.client.review(f.input);let release;const waiting=new Promise(resolve=>{release=resolve;});
 const first=f.client.submit(r,async()=>{await waiting;return true;});await assert.rejects(f.client.submit(r,async()=>true),/already pending/);release();await first;assert.equal(f.sent.length,1);
});
test('Exchange shares Wallet execution and blocks Pay/Swap composition before canonical finalized settlement',async()=>{
 const f=fixture(),exchange=createExchangeBridge420(f.config);assert.throws(()=>exchange.review({...f.input,exchangeAssetId:null}),/Exchange asset/);
 await assert.rejects(requireBridgeCompositionSettlement420(exchange,id(99)),/settlement required/);
 for(const status of [8,9,10,11,12,13]){f.change({status});await assert.rejects(requireBridgeCompositionSettlement420(exchange,id(99)),/settlement required/);}
 f.change({status:7});const done=await requireBridgeCompositionSettlement420(exchange,id(99));assert.equal(done.finalized,true);
 assert.ok(f.calls.some(c=>c.method==='eth_getBlockByNumber'&&c.params[0]==='finalized'));
});

test('Exchange browser controller owns canonical bridge reviews and invalidates them with its wallet session',async()=>{
 const {BrowserExecutionController}=await import('../../../exchange/web/core/browser-execution-controller.js');
 for(const invalidate of [false,true]){
  const f=fixture(),runtime={deployment:{status:'RESOLVED',environment:'testnet'},network:{chainId:'0x420'},bridge:f.config};
  const control=new BrowserExecutionController({runtime,submissionGate:{enabled:true,mode:'PRE08_MOCK'}});
  await control.connect({ethereum:f.config.provider});const review=await control.prepareBridge(f.input);
  if(invalidate){await assert.rejects(control.submitBridge(review,async()=>{control.invalidateExecution('account-changed');return true;}),/context changed/);assert.equal(f.sent.length,0);}
  else {assert.equal(await control.submitBridge(review,async()=>true),id(321));assert.equal(f.sent.length,1);}
  control.dispose();
 }
 const f=fixture(),control=new BrowserExecutionController({runtime:{deployment:{status:'RESOLVED',environment:'testnet'},network:{chainId:'0x420'},bridge:f.config}});
 await control.connect({ethereum:f.config.provider});const review=await control.prepareBridge(f.input);
 await assert.rejects(control.submitBridge(review,async()=>true),/gate is disabled/);assert.equal(f.sent.length,0);control.dispose();
});

test('security11 outbound presentation follows the reverse leg of canonical foreign-to-local routes',async()=>{
 const f=fixture(),request=f.config.provider.request;
 f.config.provider.request=async input=>{
  if(input.method==='eth_call'&&input.params[0].data.startsWith(sel('routes(bytes32)')))return encode([id(3),1,0x420,id(32),id(31),id(4),id(5),1,2,1,1]);
  if(input.method==='eth_call'&&input.params[0].data.startsWith(sel('chainBindings(bytes32)')))return encode([id(43),id(44),id(41),id(42)]);
  return request(input);
 };
 const review=await f.client.review(f.input);
 assert.equal(review.sourceChainId,'1056');assert.equal(review.destinationChainId,'1');
 assert.equal(review.sourceNetworkId,id(42));assert.equal(review.destinationNetworkId,id(44));
 assert.equal(review.sourceAssetId,id(31));assert.equal(review.destinationAssetId,id(32));
});
test('security11 a silent chain change in the last risk RPC cannot reach wallet submission',async()=>{
 const f=fixture(),review=await f.client.review(f.input),request=f.config.provider.request;let confirmed=false;
 f.config.provider.request=async input=>{
  const response=await request(input);
  if(confirmed&&input.method==='eth_call'&&input.params[0].data.startsWith(sel('limit(bytes32,bytes32)')))f.change({chain:'0x1'});
  return response;
 };
 await assert.rejects(f.client.submit(review,async()=>{confirmed=true;return true;}),/wrong-chain/);
 assert.equal(f.sent.length,0);
});
test('security11 verifier requalification with unchanged route labels invalidates the review',async()=>{
 const f=fixture(),review=await f.client.review(f.input),request=f.config.provider.request;let rotated=false;
 f.config.provider.request=async input=>{
  if(rotated&&input.method==='eth_call'&&input.params[0].data.startsWith(sel('requireOutboundSigningAdmission(bytes32,bytes32,bytes32)')))return encode([id(81)]);
  return request(input);
 };
 await assert.rejects(f.client.submit(review,async()=>{rotated=true;return true;}),/route changed during confirmation/);assert.equal(f.sent.length,0);
});
test('security11 the wallet request itself carries the reviewed EIP-155 chain',async()=>{
 const f=fixture(),review=await f.client.review(f.input);await f.client.submit(review,async()=>true);assert.equal(f.sent[0].chainId,'0x420');
});
