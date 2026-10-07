const ADDRESS=/^0x[0-9a-fA-F]{40}$/;
const HASH=/^0x[0-9a-fA-F]{64}$/;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export class AttentionWallet420{
  constructor(provider){if(!provider||typeof provider.request!=='function')throw new Error('EIP-1193 wallet required');this.provider=provider;this.account=null;this.chainId=null;this.listeners=[];}
  async connect(expectedChainId){
    const accounts=await this.provider.request({method:'eth_requestAccounts'});
    const chainId=String(await this.provider.request({method:'eth_chainId'})).toLowerCase();
    const account=String(accounts?.[0]||'').toLowerCase();
    if(!ADDRESS.test(account))throw new Error('wallet returned no valid account');
    if(expectedChainId&&chainId!==expectedChainId.toLowerCase())throw new Error('WRONG_NETWORK');
    this.account=account;this.chainId=chainId;return Object.freeze({account,chainId});
  }
  installInvalidation(onInvalidate){
    const invalidate=reason=>{this.account=null;this.chainId=null;onInvalidate(reason);};
    for(const event of ['accountsChanged','chainChanged','disconnect'])if(typeof this.provider.on==='function'){const fn=()=>invalidate(event);this.provider.on(event,fn);this.listeners.push([event,fn]);}
  }
  dispose(){if(typeof this.provider.removeListener==='function')for(const [e,fn] of this.listeners)this.provider.removeListener(e,fn);this.listeners=[];this.account=null;this.chainId=null;}
}
export function executionGate({config,wallet,review}={}){
  if(!wallet?.account)return {ok:false,reason:'WALLET_NOT_CONNECTED'};
  if(!config?.network?.chainId||wallet.chainId?.toLowerCase()!==config.network.chainId.toLowerCase())return {ok:false,reason:'WRONG_NETWORK'};
  if(!review?.canonical)return {ok:false,reason:'CANONICAL_REVIEW_REQUIRED'};
  if(String(review.source?.chainId).toLowerCase()!==config.network.chainId.toLowerCase())return {ok:false,reason:'REVIEW_CHAIN_MISMATCH'};
  const allowed=new Set(['attentionTreasuryAddress','campaignRegistryAddress','consentRegistryAddress','rewardRegistryAddress'].map(k=>config.registry?.[k]?.toLowerCase()).filter(Boolean));
  if(!allowed.has(review.transaction?.to?.toLowerCase()))return {ok:false,reason:'UNEXPECTED_TRANSACTION_TARGET'};
  return {ok:true,reason:null};
}
export async function submitReviewedAttentionTransaction({wallet,config,review,onState=()=>{}}={}){
  const gate=executionGate({config,wallet,review});if(!gate.ok)throw new Error(gate.reason);
  const tx={from:wallet.account,to:review.transaction.to,data:review.transaction.data,value:review.transaction.value||'0x0'};
  const gas=await wallet.provider.request({method:'eth_estimateGas',params:[tx]});onState({state:'SIMULATED',gas});
  const txHash=await wallet.provider.request({method:'eth_sendTransaction',params:[{...tx,gas}]});if(!HASH.test(txHash))throw new Error('wallet returned invalid transaction hash');onState({state:'SUBMITTED',txHash});
  return txHash;
}
export async function waitForAttentionTransaction(provider,txHash,{minConfirmations=1,pollIntervalMs=1500,timeoutMs=120000,onState=()=>{}}={}){
  if(!HASH.test(txHash))throw new Error('invalid transaction hash');
  const started=Date.now();
  while(Date.now()-started<=timeoutMs){
    const receipt=await provider.request({method:'eth_getTransactionReceipt',params:[txHash]});
    if(receipt){
      if(BigInt(receipt.status)===0n){const s={state:'REVERTED',txHash,receipt};onState(s);return s;}
      const block=await provider.request({method:'eth_getBlockByNumber',params:[receipt.blockNumber,false]});
      if(!block||String(block.hash).toLowerCase()!==String(receipt.blockHash).toLowerCase()){const s={state:'REORGED',txHash,receipt};onState(s);return s;}
      const latest=BigInt(await provider.request({method:'eth_blockNumber'})),included=BigInt(receipt.blockNumber);
      const confirmations=latest>=included?Number(latest-included+1n):0;
      const state=confirmations>=minConfirmations?'CONFIRMED':'INCLUDED';const s={state,txHash,receipt,confirmations};onState(s);if(state==='CONFIRMED')return s;
    }else{onState({state:'PENDING',txHash});}
    await sleep(pollIntervalMs);
  }
  throw Object.assign(new Error('transaction confirmation timed out'),{code:'TX_TIMEOUT'});
}
