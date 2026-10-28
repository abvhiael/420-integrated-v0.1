// HC-NEXT-7.2/7.3: read-only, fail-closed account-to-address premium authorization.
// Never infer ownership from a client wallet string or treat a signature as an entitlement.
const fail=code=>{throw Object.assign(new Error(code),{code});};
const address=x=>typeof x==='string'&&/^0x[0-9a-fA-F]{40}$/.test(x)&&!/^0x0{40}$/i.test(x);
const scope=x=>typeof x==='string'&&/^0x[0-9a-fA-F]{64}$/.test(x)&&!/^0x0{64}$/i.test(x);
const chainId=x=>typeof x==='string'&&/^[1-9][0-9]{0,19}$/.test(x);
const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.toLowerCase()===b.toLowerCase();
export function createHighCountryPremiumAuthorization420({
  walletService,chain,gameId,networkId,registryAddress,requiredConfirmations=12
}={}){
  if(typeof walletService?.session!=='function'||typeof chain?.readGate!=='function'||
     typeof chain?.getChainId!=='function'||typeof chain?.getFinalizedBlock!=='function'||
     !scope(gameId)||!chainId(networkId)||!address(registryAddress)||
     !Number.isSafeInteger(requiredConfirmations)||requiredConfirmations<1)
    fail('premium-configuration-invalid');
  async function eligible({token,scopeId}={}){
    if(typeof token!=='string'||!token||token.length>4096)fail('authentication-required');
    if(!scope(scopeId))fail('premium-scope-invalid');
    // Existing walletService.session independently verifies live issuer token and
    // resolves active link from account-scoped durable persistence, never input.
    const before=await walletService.session(token);
    if(!before||!before.accountId||!same(before.gameId,gameId)||!before.wallet)
      fail('premium-link-required');
    const link=before.wallet;
    const w=link.wallet??link.address;
    const cid=String(link.chain_id??link.chainId??'');
    if(!address(w)||cid!==networkId)fail('premium-link-required');
    if(String(await chain.getChainId())!==networkId)fail('premium-chain-mismatch');
    const finalized=await chain.getFinalizedBlock();
    if(!finalized||!Number.isSafeInteger(finalized.number)||finalized.number<0||
       !Number.isSafeInteger(finalized.confirmations)||finalized.confirmations<requiredConfirmations||
       typeof finalized.hash!=='string'||!/^0x[0-9a-fA-F]{64}$/.test(finalized.hash))
      fail('premium-finality-unavailable');
    // Adapter must use a pinned blockHash (EIP-1898) and verified registry code.
    const result=await chain.readGate({registryAddress,account:w,scope:scopeId,
      blockHash:finalized.hash,requireCanonical:true});
    if(result!==true)fail('premium-ineligible');
    // Recheck live issuer revocation, unlink, relink and account changes after RPC.
    const after=await walletService.session(token);
    const linked=after?.wallet;
    if(after?.accountId!==before.accountId||!same(after?.gameId,gameId)||
       !same(linked?.wallet??linked?.address,w)||
       String(linked?.chain_id??linked?.chainId??'')!==networkId)
      fail('premium-link-revoked');
    return Object.freeze({eligible:true,accountId:before.accountId,
      wallet:w.toLowerCase(),scope:scopeId.toLowerCase(),networkId,
      registryAddress:registryAddress.toLowerCase(),finalizedBlockHash:finalized.hash});
  }
  return Object.freeze({eligible});
}
