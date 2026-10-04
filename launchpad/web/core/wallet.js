const ADDRESS=/^0x[0-9a-fA-F]{40}$/;
export async function connectWallet(ethereum){
  if(!ethereum?.request)throw new Error('injected wallet unavailable');
  const accounts=await ethereum.request({method:'eth_requestAccounts'});
  const account=accounts?.[0];if(!ADDRESS.test(account||''))throw new Error('wallet account unavailable');
  const chainId=await ethereum.request({method:'eth_chainId'});
  return {account,chainId};
}
export function executionGate({config,wallet,review}={}){
  if(!wallet?.account)return {ok:false,reason:'WALLET_NOT_CONNECTED'};
  if(!config?.network?.chainId||wallet.chainId?.toLowerCase()!==config.network.chainId.toLowerCase())return {ok:false,reason:'WRONG_NETWORK'};
  if(!config.registry?.launchpadRouterAddress||!config.registry?.allocationRegistryAddress||!config.registry?.crowdfundingIntegrationAddress)return {ok:false,reason:'CANONICAL_ADDRESSES_UNRESOLVED'};
  if(!review?.canonical)return {ok:false,reason:'CANONICAL_REVIEW_REQUIRED'};
  const allowed=new Set([
    config.registry.launchpadRouterAddress.toLowerCase(),
    config.registry.allocationRegistryAddress.toLowerCase(),
    config.registry.crowdfundingIntegrationAddress.toLowerCase()
  ]);
  if(!allowed.has(review.transaction.to.toLowerCase()))return {ok:false,reason:'UNEXPECTED_TRANSACTION_TARGET'};
  return {ok:true,reason:null};
}
export async function submitReviewedTransaction({ethereum,config,wallet,review}={}){
  const gate=executionGate({config,wallet,review});if(!gate.ok)throw new Error(gate.reason);
  const tx={from:wallet.account,to:review.transaction.to,data:review.transaction.data,value:review.transaction.value||'0x0'};
  return ethereum.request({method:'eth_sendTransaction',params:[tx]});
}
