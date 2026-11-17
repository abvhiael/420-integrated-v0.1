import {keccak256Hex} from './keccak.js';

export const BRIDGE_SERVICE_ID_420='420/service/bridge/v1';
export const BRIDGE_COMPONENTS_420=Object.freeze({
 GatewayRouter420:'GATEWAY_ROUTER',BridgeTransferRegistry:'TRANSFER_REGISTRY',BridgeRouteRegistry:'ROUTE_REGISTRY',
 BridgeAssetRegistry:'ASSET_REGISTRY',BridgeChainRegistry420:'CHAIN_REGISTRY',BridgeRiskManager:'RISK_MANAGER',
 BridgeVerifierRegistry420:'VERIFIER_REGISTRY',BridgeValueCustody420:'VALUE_CUSTODY'
});
const bytes=h=>Uint8Array.from(h.slice(2).match(/../g)||[],x=>parseInt(x,16));
const hashText=s=>keccak256Hex(new TextEncoder().encode(s));
const hashCode=s=>keccak256Hex(bytes(s));
const check=(v,m)=>{if(!v)throw new Error(m);};
const hex=(v,label)=>{check(typeof v==='string'&&/^0x(?:[0-9a-fA-F]{2})*$/.test(v),`invalid ${label}`);return v.toLowerCase();};
const id=(v,label)=>{check(typeof v==='string'&&/^0x[0-9a-fA-F]{64}$/.test(v)&&!/^0x0{64}$/i.test(v),`invalid ${label}`);return v.toLowerCase();};
const address=(v)=>{check(typeof v==='string'&&/^0x[0-9a-fA-F]{40}$/.test(v)&&!/^0x0{40}$/i.test(v),'invalid address');return v.toLowerCase();};
const uint=(v)=>{check((typeof v==='string'&&/^(0|[1-9][0-9]*)$/.test(v))||typeof v==='bigint','exact integer required');const n=BigInt(v);check(n>=0n&&n<(1n<<256n),'uint256 range');return n;};
const word=v=>uint(v).toString(16).padStart(64,'0');
const chain=v=>{check(typeof v==='string'&&/^0x[0-9a-fA-F]+$/.test(v)&&BigInt(v)>0n,'invalid chain');return '0x'+BigInt(v).toString(16);};
const callData=(signature,args=[])=>hashText(signature).slice(0,10)+args.map(x=>x.slice(2)).join('');
const w=(v)=>'0x'+word(v);
function words(raw,count){check(typeof raw==='string'&&new RegExp(`^0x[0-9a-fA-F]{${count*64}}$`).test(raw),'malformed contract response');return Array.from({length:count},(_,i)=>'0x'+raw.slice(2+i*64,66+i*64).toLowerCase());}
function addrWord(raw){check(BigInt(raw)<(1n<<160n),'noncanonical address');return address('0x'+raw.slice(-40));}
function dynamic(raw){const h=hex(raw,'bytes').slice(2);return word(BigInt(h.length/2))+h.padEnd(Math.ceil(h.length/64)*64,'0');}
function outboundData(review){
 const recipient=dynamic(review.recipientBytes),extra=dynamic(review.extra);
 return callData('initiateOutbound(bytes32,bytes32,bytes32,bytes,uint256,bytes)',[
 review.adapterId,review.routeId,review.assetId,w(192n),w(review.amountRaw),w(BigInt(192+recipient.length/2))])+recipient+extra;
}

/** EIP-1193 client. Registry pin comes from the release's trusted deployment,
 * never from an Explorer/Search/Status response or an untrusted route manifest.
 */
export function createBridgeClient420({provider,chainId,registry,registryCodeHash,exchangeQualification=null,exchangeQualificationCodeHash=null,clock=()=>Date.now()}){
 const expected=chain(chainId),registryAddress=address(registry),registryHash=id(registryCodeHash,'registry runtime');
 const rpc=(method,params=[])=>provider.request({method,params});
 const call=(to,signature,args,block)=>rpc('eth_call',[{to,data:callData(signature,args)},block]);
 let busy=false;
 const reviews=new WeakSet();
 async function wallet(requestAccounts=false){
  check(chain(await rpc('eth_chainId'))===expected,'wrong-chain client');
  const accounts=await rpc(requestAccounts?'eth_requestAccounts':'eth_accounts');
  check(Array.isArray(accounts)&&accounts.length>0,'wallet authorization required');
  return address(accounts[0]);
 }
 async function context(tag='latest'){
  check(chain(await rpc('eth_chainId'))===expected,'wrong-chain RPC');
  const block=await rpc('eth_getBlockByNumber',[tag,false]);
  check(block&&/^0x[0-9a-fA-F]+$/.test(block.number),'missing canonical block');id(block.hash,'block hash');
  const code=hex(await rpc('eth_getCode',[registryAddress,block.number]),'registry code');
  check(code!=='0x'&&hashCode(code)===registryHash,'ProtocolRegistry runtime mismatch');
  const contracts={};
  for(const [name,suffix] of Object.entries(BRIDGE_COMPONENTS_420)){
   const componentId=hashText('420/APP/420BRIDGE/'+suffix);
   const actual=addrWord(words(await call(registryAddress,'resolve(bytes32)',[componentId],block.number),1)[0]);
   const runtime=words(await call(registryAddress,'runtimeCodeHash(bytes32)',[componentId],block.number),1)[0];
   const deployed=hex(await rpc('eth_getCode',[actual,block.number]),'component code');
   check(deployed!=='0x'&&hashCode(deployed)===runtime,`${name} runtime mismatch`);
   check(words(await call(actual,'componentId()',[],block.number),1)[0]===componentId,`${name} component mismatch`);
   contracts[name]=actual;
  }
  // Service and component identities are separate Registry namespaces.
  const service=words(await call(registryAddress,'getService(bytes32)',[hashText(BRIDGE_SERVICE_ID_420)],block.number),6);
  check(service[5]===w(1n)&&BigInt(service[3])>0n,'inactive bridge service');
  const serviceAddress=addrWord(service[0]);
  check(hashCode(hex(await rpc('eth_getCode',[serviceAddress,block.number]),'service code'))===service[1],'bridge service runtime mismatch');
  return {block,contracts};
 }
 async function snapshot(routeId,exchangeAssetId=null){
  routeId=id(routeId,'route');const ctx=await context(),b=ctx.block.number,c=ctx.contracts;
  const r=words(await call(c.BridgeRouteRegistry,'routes(bytes32)',[routeId],b),11);
  check(r[8]===w(2n)&&r[10]===w(1n),'outbound route disabled');
  const reverse=BigInt(r[2])===BigInt(expected);
  check((BigInt(r[1])===BigInt(expected)||reverse)&&r[1]!==r[2],'route network mismatch');
  await call(c.BridgeRouteRegistry,'requireRouteChainsCurrent(bytes32)',[routeId],b);
  await call(c.BridgeRouteRegistry,'requireRouteVerifierCurrent(bytes32)',[routeId],b);
  const bindings=words(await call(c.BridgeRouteRegistry,'chainBindings(bytes32)',[routeId],b),4);
  const source=words(await call(c.BridgeChainRegistry420,'chains(bytes32)',[bindings[0]],b),6);
  const destination=words(await call(c.BridgeChainRegistry420,'chains(bytes32)',[bindings[2]],b),6);
  check(source[0]===r[1]&&source[1]===bindings[1]&&source[5]===w(1n),'stale source identity');
  check(destination[0]===r[2]&&destination[1]===bindings[3]&&destination[5]===w(1n),'stale destination identity');
  const asset=words(await call(c.BridgeAssetRegistry,'assets(bytes32)',[r[0]],b),7);
  check(asset[1]===r[0]&&asset[5]===w(2n)&&asset[6]===w(1n),'bridge representation ineligible');
  const adapter=addrWord(words(await call(c.GatewayRouter420,'adapters(bytes32)',[r[5]],b),1)[0]);
  check(words(await call(adapter,'adapterId()',[],b),1)[0]===r[5],'adapter identity mismatch');
  const qualificationId=id(words(await call(c.GatewayRouter420,'requireOutboundSigningAdmission(bytes32,bytes32,bytes32)',[r[5],routeId,r[0]],b),1)[0],'outbound qualification');
  if(exchangeAssetId!==null){
   check(exchangeQualification!==null&&exchangeQualificationCodeHash!==null,'canonical Exchange qualification missing');
   check(hashCode(hex(await rpc('eth_getCode',[address(exchangeQualification),b]),'Exchange qualification code'))===id(exchangeQualificationCodeHash,'Exchange runtime'),'Exchange runtime mismatch');
   const q=words(await call(address(exchangeQualification),'requireQualified(bytes32)',[id(exchangeAssetId,'Exchange asset')],b),7);
   check(q[0]===r[0]&&q[1]===routeId&&q[2]===r[5]&&q[5]===w(1n)&&q[6]===w(1n),'Exchange bridge route mismatch');
  }
  const pinned=await rpc('eth_getBlockByNumber',[b,false]);check(pinned?.hash?.toLowerCase()===ctx.block.hash.toLowerCase(),'snapshot reorged');
  check(chain(await rpc('eth_chainId'))===expected,'RPC chain changed');
  const result={chainId:expected,contracts:c,routeId,assetId:r[0],adapterId:r[5],adapter,localToken:addrWord(asset[0]),
   sourceChainId:BigInt(reverse?r[2]:r[1]).toString(),destinationChainId:BigInt(reverse?r[1]:r[2]).toString(),sourceNetworkId:reverse?bindings[3]:bindings[1],destinationNetworkId:reverse?bindings[1]:bindings[3],
   sourceAssetId:reverse?r[4]:r[3],destinationAssetId:reverse?r[3]:r[4],verifierConfigHash:r[6],version:BigInt(r[7]).toString(),destinationFamily:Number(BigInt((reverse?source:destination)[4])),
   routeSourceChainId:BigInt(r[1]).toString(),routeDestinationChainId:BigInt(r[2]).toString(),qualificationId,
   blockNumber:b,blockHash:ctx.block.hash,exchangeAssetId};
  result.binding=hashText(JSON.stringify({...result,blockNumber:undefined,blockHash:undefined}));
  return Object.freeze({...result,contracts:Object.freeze(c)});
 }
 async function estimateRisk(s,amount){
  const b=s.blockNumber,manager=s.contracts.BridgeRiskManager;
  const block=await rpc('eth_getBlockByNumber',[b,false]);
  check(block?.hash?.toLowerCase()===s.blockHash.toLowerCase(),'risk snapshot reorged');
  check(typeof block.timestamp==='string'&&/^0x[0-9a-fA-F]+$/.test(block.timestamp),'missing block timestamp');
  const now=BigInt(block.timestamp),caps=[];
  for(const [prefix,key] of [['route',s.routeId],['asset',s.assetId]]){
   const limits=words(await call(manager,prefix+'Limits(bytes32)',[key],b),6).map(BigInt);
   const usage=words(await call(manager,prefix+'Usage(bytes32)',[key],b),7).map(BigInt);
   const unsettled=BigInt(words(await call(manager,prefix+'UnsettledInbound(bytes32)',[key],b),1)[0]);
   const hourly=usage[0]===now/3600n?usage[3]:0n,daily=usage[1]===now/86400n?usage[5]:0n;
   const available=[limits[0],limits[2]-hourly,limits[4]-daily,usage[6]-unsettled];
   check(available.every(cap=>cap>=amount),'bridge risk capacity exhausted');
   caps.push(...available);
  }
  const component=hashText('420/APP/RISK_LIMITS');
  const shared=addrWord(words(await call(registryAddress,'resolve(bytes32)',[component],b),1)[0]);
  const runtime=words(await call(registryAddress,'runtimeCodeHash(bytes32)',[component],b),1)[0];
  check(hashCode(hex(await rpc('eth_getCode',[shared,b]),'shared risk code'))===runtime,'shared risk runtime mismatch');
  const limit=words(await call(shared,'limit(bytes32,bytes32)',[s.routeId,hashText('420/BRIDGE/LIMIT/HOURLY_OUT')],b),6);
  check(limit[0]===s.routeId&&BigInt(limit[3])>0n&&BigInt(limit[5])>=amount,'shared risk capacity exhausted');
  caps.push(BigInt(limit[5]));
  return Object.freeze({remainingRaw:caps.reduce((a,b)=>a<b?a:b).toString(),blockHash:s.blockHash,estimateOnly:true});
 }
 async function review({routeId,exchangeAssetId=null,amountRaw,recipientBytes,feeValueWei='0',extra='0x',validForMs=30000}){
  const sender=await wallet(),s=await snapshot(routeId,exchangeAssetId),amount=uint(amountRaw);
  check(amount>0n,'amount below protocol minimum');check(Number.isSafeInteger(validForMs)&&validForMs>0&&validForMs<=60000,'invalid quote lifetime');
  const risk=await estimateRisk(s,amount);
  const recipient=hex(recipientBytes,'recipient');check(recipient!=='0x'&&!/^0x0+$/.test(recipient),'empty recipient');
  if(s.destinationFamily===1)check(recipient.length===42,'EVM recipient requires 20 bytes');
  // Other families retain exact adapter-native bytes. Their canonical adapter
  // validates checksums, network prefixes, tags and supported payout formats.
  const result=Object.freeze({...s,sender,amountRaw:amount.toString(),recipientBytes:recipient,
   feeValueWei:uint(feeValueWei).toString(),extra:hex(extra,'adapter extra'),expiresAt:clock()+validForMs,
   risk,minimumRaw:'1',feeAuthority:'ADAPTER_SIMULATION',settlementAuthority:'CANONICAL_BRIDGE_CONTRACTS'});
  const transaction=Object.freeze({chainId:expected,from:sender,to:s.contracts.GatewayRouter420,data:outboundData(result),value:'0x'+uint(result.feeValueWei).toString(16)});
  await rpc('eth_call',[transaction,'latest']);
  const gas=await rpc('eth_estimateGas',[transaction]);check(typeof gas==='string'&&/^0x[0-9a-fA-F]+$/.test(gas)&&BigInt(gas)>0n,'invalid gas estimate');
  check(await wallet()===sender,'wallet account changed during simulation');
  check((await snapshot(routeId,exchangeAssetId)).binding===s.binding,'route changed during simulation');
  const reviewed=Object.freeze({...result,transaction,gasEstimate:gas});reviews.add(reviewed);return reviewed;
 }
 async function submit(reviewed,confirm){
  check(!busy,'bridge submission already pending');check(reviews.has(reviewed),'unrecognized bridge review');
  busy=true;
  try{
   check(typeof confirm==='function','explicit confirmation required');
   check(clock()<reviewed.expiresAt,'stale bridge quote');
   check(await wallet()===reviewed.sender,'wallet account changed');
   let current=await snapshot(reviewed.routeId,reviewed.exchangeAssetId);check(current.binding===reviewed.binding,'bridge route changed after review');
   await estimateRisk(current,uint(reviewed.amountRaw));
   await rpc('eth_call',[reviewed.transaction,'latest']);
   check(await confirm(reviewed)===true,'bridge confirmation rejected');
   check(clock()<reviewed.expiresAt,'stale bridge quote');check(await wallet()===reviewed.sender,'wallet account changed');
   current=await snapshot(reviewed.routeId,reviewed.exchangeAssetId);check(current.binding===reviewed.binding,'bridge route changed during confirmation');
   await rpc('eth_call',[reviewed.transaction,'latest']);
   await estimateRisk(current,uint(reviewed.amountRaw));
   check(clock()<reviewed.expiresAt,'stale bridge quote');
   check(await wallet()===reviewed.sender,'wallet account changed before submission');
   // Consume before handing off: an uncertain provider response must be
   // reconciled by canonical transfer/message history, never blindly retried.
   reviews.delete(reviewed);
   return id(await rpc('eth_sendTransaction',[reviewed.transaction]),'transaction hash');
  }finally{busy=false;}
 }
 async function transfer(transferId){
  const ctx=await context('finalized'),r=words(await call(ctx.contracts.BridgeTransferRegistry,'transfers(bytes32)',[id(transferId,'transfer')],ctx.block.number),10);
  check((await rpc('eth_getBlockByNumber',[ctx.block.number,false]))?.hash?.toLowerCase()===ctx.block.hash.toLowerCase(),'transfer history reorged');
  check(chain(await rpc('eth_chainId'))===expected,'RPC chain changed');
  return Object.freeze({transferId,routeId:r[0],assetId:r[1],sender:'0x'+r[2].slice(-40),recipient:'0x'+r[3].slice(-40),amountRaw:BigInt(r[4]).toString(),sourceTxId:r[5],sourceMessageId:r[6],status:Number(BigInt(r[7])),finalized:true,blockHash:ctx.block.hash,authoritative:true});
 }
 return Object.freeze({connect:()=>wallet(true),async switchChain(){await rpc('wallet_switchEthereumChain',[{chainId:expected}]);return wallet();},snapshot,review,submit,transfer});
}
