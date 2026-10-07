const ADDRESS=/^0x[0-9a-fA-F]{40}$/;
export async function connectWallet(ethereum,expectedChainId){
  if(!ethereum?.request)throw new Error('injected wallet unavailable');
  const accounts=await ethereum.request({method:'eth_requestAccounts'});
  const account=accounts?.[0];
  if(!ADDRESS.test(account||''))throw new Error('wallet account unavailable');
  const chainId=await ethereum.request({method:'eth_chainId'});
  if(!/^0x[0-9a-fA-F]+$/.test(chainId||''))throw new Error('wallet chain unavailable');
  const wallet={account,chainId:chainId.toLowerCase()};
  if(expectedChainId&&Number(BigInt(wallet.chainId))!==Number(expectedChainId))throw new Error('WRONG_NETWORK');
  return wallet;
}
export function walletNetworkValid(wallet,expectedChainId){
  return !!wallet?.account&&!!expectedChainId&&Number(BigInt(wallet.chainId))===Number(expectedChainId);
}
export function installWalletInvalidation(ethereum,onInvalidate){
  if(!ethereum?.on||typeof onInvalidate!=='function')return ()=>{};
  const accounts=accounts=>onInvalidate(!accounts?.length?'accountsDisconnected':'accountsChanged');
  const chain=()=>onInvalidate('chainChanged');
  ethereum.on('accountsChanged',accounts);ethereum.on('chainChanged',chain);
  return ()=>{
    ethereum.removeListener?.('accountsChanged',accounts);
    ethereum.removeListener?.('chainChanged',chain);
  };
}
