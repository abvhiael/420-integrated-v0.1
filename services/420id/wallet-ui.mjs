// AUTH-5 wallet UI: explicit EIP-1193 account request and personal_sign.
// No keys, signatures, bearer tokens or wallet proofs in browser storage.
export function installWalletUI({get,post,run,isAuthenticated,status}){
 let current=null;
 function visible(){
  get('wallet-section').hidden=!isAuthenticated();
  get('wallet-current').textContent=current?current.address+' · chain '+current.chainId+' · '+current.kind:'No wallet linked.';
  get('wallet-unlink').disabled=!isAuthenticated()||!current;
 }
 function clear(){current=null;get('wallet-consent').checked=false;get('wallet-note').textContent='';visible();}
 async function refresh(){const r=await post('/v1/wallet/current',{});current=r.wallet;visible();}
 get('wallet-refresh').addEventListener('click',()=>void run(async()=>{await refresh();status('Wallet link status updated.');}));
 get('wallet-unlink').addEventListener('click',()=>void run(async()=>{
  if(!current)throw new Error('No wallet to unlink.');
  await post('/v1/wallet/unlink',{});clear();status('Wallet association removed; your 420ID account and sessions remain unchanged.');
 }));
 get('wallet-form').addEventListener('submit',event=>{event.preventDefault();void run(async()=>{
  if(!isAuthenticated())throw new Error('Sign in with your 420ID account first.');
  if(!get('wallet-consent').checked)throw new Error('Explicit consent is required.');
  const provider=window.ethereum;
  if(!provider||typeof provider.request!=='function')throw new Error('No EIP-1193 wallet provider is available.');
  const addresses=await provider.request({method:'eth_requestAccounts'});
  if(!Array.isArray(addresses)||!addresses.length||!/^0x[0-9a-fA-F]{40}$/.test(addresses[0]))throw new Error('No valid wallet address was selected.');
  const address=addresses[0],kind=get('wallet-kind').value;
  const challenge=await post('/v1/wallet/start',{address,kind,consentAccepted:true});
  const selectedChain=await provider.request({method:'eth_chainId'});
  if(typeof selectedChain!=='string'||!/^0x[0-9a-fA-F]+$/.test(selectedChain)||BigInt(selectedChain)!==BigInt(challenge.chainId))throw new Error('Switch 420Wallet to the chain specified by 420ID before signing.');
  if(challenge.address.toLowerCase()!==address.toLowerCase()||typeof challenge.message!=='string')throw new Error('Wallet challenge mismatch.');
  const hex='0x'+Array.from(new TextEncoder().encode(challenge.message),x=>x.toString(16).padStart(2,'0')).join('');
  // personal_sign shows a human-readable consent message in the wallet.
  // Its exact byte contents and signature are checked server-side.
  const signature=await provider.request({method:'personal_sign',params:[hex,address]});
  if(typeof signature!=='string')throw new Error('Wallet did not supply a signature.');
  const result=await post('/v1/wallet/finish',{challengeId:challenge.challengeId,signature});
  current=result.wallet;get('wallet-consent').checked=false;visible();
  status('Wallet linked by a verified, single-use signature. No spending or login rights were granted.');
 })});
 clear();return {clear,visible};
}
