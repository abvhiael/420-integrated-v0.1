import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { createPostgresGamingPlayerProfileService420 } from './postgres-repository.js';
const err = code => {const e=new Error(code);e.code=code;throw e;};
const opaque = x=>typeof x==='string'&&/^[A-Za-z0-9:_-]{1,128}$/.test(x);
const commitment = x=>typeof x==='string'&&/^0x[0-9a-f]{64}$/.test(x)&&!/^0x0+$/.test(x);
const wallet = x=>typeof x==='string'&&/^0x[0-9a-fA-F]{40}$/.test(x)&&!/^0x0+$/i.test(x);
const digest = x=>'0x'+createHash('sha256').update(x).digest('hex');
function shape(x,names) {
  if(!x||typeof x!=='object'||Array.isArray(x)||Object.keys(x).some(k=>!names.includes(k))||
     names.some(k=>!Object.hasOwn(x,k)))err('invalid-request');
}
function chainId(x){if(typeof x!=='string'||!/^[1-9][0-9]{0,19}$/.test(x)||BigInt(x)>=(1n<<64n))err('invalid-chain');return x;}
function message(gameId,accountId,c) {
  return ['420 Integrated / High Country wallet link','version: 1',
    'domain: '+c.domain,'account: '+accountId,'game: '+gameId,
    'wallet: '+c.wallet,'chain: '+c.chain_id,'challenge: '+c.challenge_id,
    'nonce: '+c.nonce,'issued: '+c.issued_at,'expires: '+c.expires_at].join('\n');
}
const context = (gameId,accountId,c)=>digest(message(gameId,accountId,c));
export function createHighCountryWalletService420({authority,poolForPrincipal,clientsByChain,domain,verifyRecoveryProof}={}) {
  if(typeof authority?.verifyToken!=='function'||typeof authority?.registeredPrincipal!=='function'||
    !commitment(authority.gameId)||typeof poolForPrincipal!=='function'||
    !(clientsByChain instanceof Map)||!opaque(domain))err('invalid-configuration');
  const scoped=async token=>{
    if(typeof token!=='string'||!token||token.length>4096)err('authentication-required');
    let claims,principal;
    try {claims=authority.verifyToken(token);principal=await authority.registeredPrincipal(token);}
    catch {err('authentication-denied');}
    if(!claims||!opaque(claims.sub)||claims.sub!==principal||claims.game!==authority.gameId)err('authentication-denied');
    const service=await createPostgresGamingPlayerProfileService420({authority,token,poolForPrincipal});
    return {service,accountId:principal};
  };
  const client=async id=>{
    const c=clientsByChain.get(id);
    if(!c||typeof c.verifyMessage!=='function'||typeof c.getChainId!=='function')err('chain-unavailable');
    if(String(await c.getChainId())!==id)err('chain-mismatch');
    return c;
  };
  async function issue(token,input,{recovery=false}={}) {
    shape(input,recovery?['wallet','chainId','consentId','policyHash','recoveryProof','consentAccepted']:
      ['wallet','chainId','consentId','policyHash','consentAccepted']);
    if(!wallet(input.wallet)||!opaque(input.consentId)||!commitment(input.policyHash)||input.consentAccepted!==true)err('invalid-request');
    const id=chainId(input.chainId);
    const {service,accountId}=await scoped(token);
    await client(id);
    if(recovery) {
      if(typeof verifyRecoveryProof!=='function')err('recovery-disabled');
      let proof;
      try {proof=await verifyRecoveryProof({accountId,gameId:authority.gameId,token,proof:input.recoveryProof});}
      catch {err('recovery-denied');}
      if(proof!==true)err('recovery-denied');
    }
    const challenge={challengeId:randomUUID(),wallet:input.wallet.toLowerCase(),chainId:id,
      domain,nonce:randomBytes(32).toString('hex'),consentId:input.consentId,
      policyHash:input.policyHash,recoveryAuthorized:recovery,issuedAt:String(Math.floor(Date.now()/1000)),expiresAt:String(Math.floor(Date.now()/1000)+300)};
    // Server-computed consent context commits to the actual issued challenge.
    const prepared={challenge_id:challenge.challengeId,wallet:challenge.wallet,chain_id:id,
      domain,nonce:challenge.nonce,issued_at:challenge.issuedAt,expires_at:challenge.expiresAt};
    // Database checks clock skew and stores the exact signed issuance timestamp.
    const row=await service.transaction(async tx=>{
      const preliminary=await tx.issueWalletChallenge({...challenge,contextHash:context(authority.gameId,accountId,prepared)});
      return preliminary;
    });
    // The issued timestamp is DB-sourced and can differ at a second boundary.
    return {challengeId:row.challenge_id,message:message(authority.gameId,accountId,row),
      wallet:row.wallet,chainId:row.chain_id,expiresAt:row.expires_at};
  }
  async function complete(token,input) {
    shape(input,['challengeId','signature']);
    if(!opaque(input.challengeId)||typeof input.signature!=='string'||!/^0x[0-9a-fA-F]{130,4096}$/.test(input.signature))
      err('invalid-signature');
    const {service,accountId}=await scoped(token);
    const c=await service.transaction(tx=>tx.walletChallenge(input.challengeId));
    if(!c||c.used_at!==null||BigInt(c.expires_at)<=BigInt(Math.floor(Date.now()/1000))||c.domain!==domain)
      err('challenge-invalid-or-replayed');
    const rpc=await client(c.chain_id);
    let verified=false;
    try {verified=await rpc.verifyMessage({address:c.wallet,message:message(authority.gameId,accountId,c),
      signature:input.signature});} catch {err('signature-verification-unavailable');}
    if(verified!==true)err('invalid-signature');
    return service.transaction(tx=>tx.completeWalletChallenge(c.challenge_id,
      context(authority.gameId,accountId,c),{wallet:c.wallet,domain:c.domain,chainId:c.chain_id,
      nonce:c.nonce,issuedAt:c.issued_at,expiresAt:c.expires_at}));
  }
  return Object.freeze({
    session:async token=>{const {service,accountId}=await scoped(token);
      return service.transaction(async tx=>{const p=await tx.profile();return {accountId,gameId:authority.gameId,
        profileId:p?.profile_id??null,wallet:await tx.activeWallet()};});},
    issueChallenge:(token,x)=>issue(token,x),
    completeLink:complete,
    unlink:async token=>{const {service}=await scoped(token);return service.transaction(tx=>tx.unlinkWallet());},
    // Recovery requires issuer-side proof AND a separately signed fresh challenge.
    issueRecoveryChallenge:(token,x)=>issue(token,x,{recovery:true}),
  });
}
export function createHighCountryWalletHttp420(service) {
  if(!service||typeof service.session!=='function')err('invalid-configuration');
  return createServer(async(req,res)=>{
    const send=(status,payload)=>{res.writeHead(status,{'content-type':'application/json',
      'cache-control':'no-store','x-content-type-options':'nosniff'});res.end(JSON.stringify(payload));};
    try {
      const authorization=req.headers.authorization;
      if(typeof authorization!=='string'||!/^Bearer [^\s]{1,4096}$/.test(authorization))err('authentication-required');
      const token=authorization.slice(7);
      const routes={'GET /v1/session':()=>service.session(token),
        'POST /v1/wallet/challenge':b=>service.issueChallenge(token,b),
        'POST /v1/wallet/complete':b=>service.completeLink(token,b),
        'POST /v1/wallet/unlink':()=>service.unlink(token),
        'POST /v1/wallet/recovery-challenge':b=>service.issueRecoveryChallenge(token,b)};
      const op=routes[req.method+' '+new URL(req.url,'http://localhost').pathname];
      if(!op){send(404,{error:'not-found'});return;}
      let body={};
      if(req.method==='POST'){
        if(!String(req.headers['content-type']??'').startsWith('application/json'))err('invalid-request');
        let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>8192)err('request-too-large');}
        try{body=JSON.parse(raw);}catch{err('invalid-request');}
      }
      send(200,{result:await op(body)});
    }catch(e){
      const clientError=['authentication-required','authentication-denied','invalid-request','invalid-chain',
        'invalid-signature','challenge-invalid-or-replayed','recovery-denied','recovery-disabled','request-too-large',
        'chain-mismatch','chain-unavailable','wallet-link-conflict','consent-denied','profile-not-found',
        'invalid-input','scope-denied','account-revoked'].includes(e.code??e.message);
      send(clientError?403:503,{error:clientError?(e.code??e.message):'service-unavailable'});
    }
  });
}
