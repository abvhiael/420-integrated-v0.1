// R06.5 fail-closed EVM transaction lifecycle. Receipt presence is NEVER finality.
const fail=c=>{throw Object.assign(new Error(c),{code:c});};
const H=x=>typeof x==='string'&&/^0x[0-9a-fA-F]{64}$/.test(x)&&!/^0x0+$/i.test(x);
const Q=x=>typeof x==='string'&&/^0x(0|[1-9a-fA-F][0-9a-fA-F]*)$/.test(x);
export function createHighCountryTransactionLifecycle420({rpcUrl,chainId,fetchImpl=fetch,witness}={}){
 if(typeof rpcUrl!=='string'||!/^https:\/\/[^/?#]+$/.test(rpcUrl)||
  !Number.isSafeInteger(chainId)||chainId<1||typeof fetchImpl!=='function')fail('tx-config-invalid');
 const entries=new Map(),busy=new Set();let id=0;
 const call=async(method,params)=>{
  const requestId=++id;let response;
  try{response=await fetchImpl(rpcUrl,{method:'POST',headers:{'content-type':'application/json'},
   body:JSON.stringify({jsonrpc:'2.0',id:requestId,method,params})});}catch{fail('tx-rpc-unavailable');}
  if(!response?.ok)fail('tx-rpc-unavailable');
  let obj;try{obj=await response.json();}catch{fail('tx-rpc-malformed');}
  if(obj?.jsonrpc!=='2.0'||obj.id!==requestId||obj.error||!Object.hasOwn(obj,'result'))fail('tx-rpc-malformed');
  return obj.result;
 };
 const checkChain=async()=>{const c=await call('eth_chainId',[]);
  if(!Q(c)||BigInt(c)!==BigInt(chainId))fail('tx-wrong-network');};
 const freeze=x=>Object.freeze({...x});
 function begin(operation){
  if(typeof operation!=='string'||!/^[A-Za-z0-9:_-]{1,128}$/.test(operation)||entries.has(operation)||busy.has(operation))fail('tx-duplicate-operation');
  const row=freeze({operation,state:'awaiting-signature',txHash:null,blockHash:null,blockNumber:null});
  entries.set(operation,row);return row;
 }
 function status(operation){return entries.get(operation)??freeze({operation,state:'empty',txHash:null,blockHash:null,blockNumber:null});}
 async function submit(operation,{requestSignature}={}){
  const prior=entries.get(operation);
  if(!prior||prior.state!=='awaiting-signature'||busy.has(operation)||typeof requestSignature!=='function')fail('tx-submission-not-authorized');
  busy.add(operation);
  try{
   await checkChain();
   // Caller-injected, specifically reviewed signer callback; never accept arbitrary to/data/value.
   const receipt=await requestSignature();
   if(!H(receipt?.txHash))fail('tx-hash-invalid');
   const next=freeze({...prior,state:'submitted',txHash:receipt.txHash.toLowerCase()});entries.set(operation,next);return next;
  }catch(e){
   // A rejected signature can be retried explicitly; unknown submission MUST NOT be automatically re-sent.
   if(e?.code==='user-rejected'||e?.message==='user-rejected')return freeze({...prior,state:'awaiting-signature'});
   entries.set(operation,freeze({...prior,state:'unavailable',reason:'submission-unknown'}));
   throw e;
  }finally{busy.delete(operation);}
 }
 function observe(operation,txHash){
  if(!H(txHash)||typeof operation!=='string'||!/^[A-Za-z0-9:_-]{1,128}$/.test(operation))fail('tx-invalid-watch');
  const prior=entries.get(operation);
  if(prior?.txHash&&prior.txHash.toLowerCase()!==txHash.toLowerCase())fail('tx-hash-conflict');
  if(prior&&!['submitted','pending','unavailable','reorged','finalized','reverted'].includes(prior.state))fail('tx-watch-invalid');
  const row=freeze({operation,state:prior?.state==='finalized'?'finalized':'submitted',
   txHash:txHash.toLowerCase(),blockHash:prior?.blockHash??null,blockNumber:prior?.blockNumber??null});
  entries.set(operation,row);return row;
 }
 async function refresh(operation){
  const previous=entries.get(operation);if(!previous?.txHash)fail('tx-untracked');
  if(busy.has(operation))fail('tx-check-in-progress');busy.add(operation);
  const update=change=>{const next=freeze({...previous,...change});entries.set(operation,next);return next;};
  try{
   await checkChain();
   const receipt=await call('eth_getTransactionReceipt',[previous.txHash]);
   if(receipt===null){
    if(previous.blockHash||previous.state==='finalized')return update({state:'reorged',reason:'receipt-disappeared'});
    return update({state:'pending',reason:'receipt-not-yet-available'});
   }
   if(receipt.transactionHash?.toLowerCase()!==previous.txHash||!H(receipt.blockHash)||
      !Q(receipt.blockNumber)||!['0x0','0x1'].includes(receipt.status))fail('tx-receipt-invalid');
   if(previous.blockHash&&previous.blockHash.toLowerCase()!==receipt.blockHash.toLowerCase())
    return update({state:'reorged',blockHash:receipt.blockHash,blockNumber:receipt.blockNumber,reason:'receipt-reanchored'});
   const block=await call('eth_getBlockByNumber',[receipt.blockNumber,false]);
   if(!block||block.hash?.toLowerCase()!==receipt.blockHash.toLowerCase())return update({
    state:'reorged',blockHash:receipt.blockHash,blockNumber:receipt.blockNumber,reason:'block-mismatch'});
   if(receipt.status==='0x0')return update({state:'reverted',blockHash:receipt.blockHash,blockNumber:receipt.blockNumber});
   const finalized=await call('eth_getBlockByNumber',['finalized',false]);
   if(!finalized||!Q(finalized.number)||!H(finalized.hash))fail('tx-finality-unavailable');
   if(BigInt(finalized.number)<BigInt(receipt.blockNumber))return update({state:'pending',blockHash:receipt.blockHash,
    blockNumber:receipt.blockNumber,reason:'not-finalized'});
   if(typeof witness!=='function')return update({state:'pending',blockHash:receipt.blockHash,
    blockNumber:receipt.blockNumber,reason:'independent-witness-not-configured'});
   let verified=false;try{verified=await witness({chainId:String(chainId),blockHash:receipt.blockHash.toLowerCase(),
    blockNumber:String(BigInt(receipt.blockNumber))});}catch{fail('tx-independent-witness-unavailable');}
   if(verified!==true)fail('tx-independent-witness-denied');
   // No authority for market payout can be inferred from finalized tx inclusion alone.
   return update({state:'finalized',blockHash:receipt.blockHash,blockNumber:receipt.blockNumber,
    reason:'independently-finalized-inclusion-only'});
  }catch(e){
   if(previous.state==='finalized')return update({state:'unavailable',reason:e?.code??'tx-rpc-unavailable'});
   return update({state:'unavailable',reason:e?.code??'tx-rpc-unavailable'});
  }finally{busy.delete(operation);}
 }
 return Object.freeze({begin,submit,observe,status,refresh});
}
