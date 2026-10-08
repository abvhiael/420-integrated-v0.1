const ADDRESS=/^0x[0-9a-fA-F]{40}$/;
export async function connectWallet(ethereum,expectedChainId){
  if(!ethereum?.request)throw Error('injected wallet unavailable');
  const accounts=await ethereum.request({method:'eth_requestAccounts'});
  const account=accounts?.[0];
  if(!ADDRESS.test(account||''))throw Error('wallet account unavailable');
  const chainId=await ethereum.request({method:'eth_chainId'});
  if(!/^0x[0-9a-fA-F]+$/.test(chainId||''))throw Error('wallet chain unavailable');
  if(expectedChainId&&Number(BigInt(chainId))!==Number(expectedChainId))throw Error('WRONG_NETWORK');
  return {account,chainId:chainId.toLowerCase()};
}
export function validNetwork(wallet,expected){return !!wallet?.account&&!!expected&&Number(BigInt(wallet.chainId))===Number(expected);}
export function installInvalidation(ethereum,callback){
  if(!ethereum?.on)return ()=>{};
  const accounts=a=>callback(a?.length?'accountsChanged':'accountsDisconnected');
  const chain=()=>callback('chainChanged');
  ethereum.on('accountsChanged',accounts);ethereum.on('chainChanged',chain);
  return ()=>{ethereum.removeListener?.('accountsChanged',accounts);ethereum.removeListener?.('chainChanged',chain);};
}
