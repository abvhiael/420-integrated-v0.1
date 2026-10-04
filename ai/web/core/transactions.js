const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
function hexBig(v,label){if(typeof v!=='string'||!/^0x[0-9a-fA-F]+$/.test(v))throw Error('invalid '+label);return BigInt(v);}
export async function inspectAiTransaction420(provider,txHash,{minConfirmations=1}={}){
  if(!/^0x[0-9a-fA-F]{64}$/.test(txHash))throw Error('invalid transaction hash');
  const receipt=await provider.request({method:'eth_getTransactionReceipt',params:[txHash]});
  if(!receipt){const tx=await provider.request({method:'eth_getTransactionByHash',params:[txHash]});return {state:tx?'PENDING':'DROPPED',txHash,confirmations:0};}
  if(hexBig(receipt.status,'receipt status')===0n)return {state:'REVERTED',txHash,receipt,confirmations:0};
  const block=await provider.request({method:'eth_getBlockByNumber',params:[receipt.blockNumber,false]});
  if(!block||String(block.hash).toLowerCase()!==String(receipt.blockHash).toLowerCase())return {state:'REORGED',txHash,receipt,confirmations:0};
  const latest=hexBig(await provider.request({method:'eth_blockNumber'}),'latest block');
  const included=hexBig(receipt.blockNumber,'receipt block');
  const confirmations=latest>=included?Number(latest-included+1n):0;
  return {state:confirmations>=minConfirmations?'CONFIRMED':'INCLUDED',txHash,receipt,confirmations};
}
export async function waitForAiTransaction420(provider,txHash,{minConfirmations=1,pollIntervalMs=1500,timeoutMs=120000,onState=()=>{}}={}){
  const started=Date.now();let last=null;
  while(Date.now()-started<=timeoutMs){last=await inspectAiTransaction420(provider,txHash,{minConfirmations});onState(last);if(['CONFIRMED','REVERTED','REORGED','DROPPED'].includes(last.state))return last;await sleep(pollIntervalMs);}
  throw Object.assign(new Error('transaction confirmation timed out'),{code:'TX_TIMEOUT',last});
}
export async function submitReviewedAiTransaction420({wallet,to,data,policy,onState}){
  if(!wallet?.account)throw Error('wallet not connected');if(!/^0x[0-9a-fA-F]{40}$/.test(to))throw Error('transaction target invalid');if(!/^0x[0-9a-fA-F]+$/.test(data))throw Error('transaction data invalid');
  const gas=await wallet.estimateGas({to,data,value:'0x0'});onState({state:'SIMULATED',gas});
  const txHash=await wallet.sendTransaction({to,data,value:'0x0',gas});onState({state:'SUBMITTED',txHash});
  const final=await waitForAiTransaction420(wallet.provider,txHash,{...policy,onState});if(final.state!=='CONFIRMED')throw Object.assign(new Error('transaction '+final.state.toLowerCase()),{state:final});return final;
}
