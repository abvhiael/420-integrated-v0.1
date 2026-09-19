export async function connectWallet420(ethereum,expectedChainId=null){
 if(!ethereum?.request) throw new Error('No injected EIP-1193 wallet found');
 const accounts=await ethereum.request({method:'eth_requestAccounts'}); const account=accounts?.[0]?.toLowerCase(); if(!account)throw new Error('No wallet account authorized');
 const chainHex=await ethereum.request({method:'eth_chainId'}); const chainId=BigInt(chainHex).toString();
 if(expectedChainId!==null&&chainId!==String(expectedChainId)) throw new Error(`Wrong network: expected ${expectedChainId}, received ${chainId}`);
 return {account,chainId};
}
