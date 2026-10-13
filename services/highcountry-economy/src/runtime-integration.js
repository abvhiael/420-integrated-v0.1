// R04 consumers of the canonical R05 authenticated/durable boundary.
// No raw saves or player private keys; trusted issuer keys and contract/code hashes are deployment inputs.
import {verify,randomBytes} from 'node:crypto';
import {SettlementError,BudsLedger} from './buds-ledger.js';
import {ReviewedEconomyCatalog} from './reviewed-catalog.js';
import {address} from './finalized-rpc.js';
import {keccak256} from './keccak.js';
const id=x=>typeof x==='string'&&/^[a-zA-Z0-9:_-]{1,128}$/.test(x);
export function runtimeState(s){
 for(const key of ['runtimeAccounts','runtimeWallets','runtimeWalletOwners','runtimeNonces','runtimeEpochs','runtimeSourceEpochs'])
  if(!s[key])s[key]=new Map();
 return s;
}
const fail=message=>{throw new SettlementError(message);};
export class RuntimeAuthority {
 constructor({store,issuers,audience,gameId,chainId,origin,rpc,clock=()=>Date.now()}){
  if(typeof store?.transact!=='function'||!issuers||!id(audience)||!/^0x[0-9a-f]{64}$/i.test(gameId)
     ||!Number.isSafeInteger(chainId)||!/^https?:\/\//.test(origin)||!rpc)fail('invalid runtime authority');
  Object.assign(this,{store,issuers,audience,gameId,chainId,origin,rpc,clock});
 }
 verifyToken(token){
  if(typeof token!=='string'||token.length>8192)fail('invalid session');
  const parts=token.split('.');if(parts.length!==2)fail('invalid session');
  let c;try{c=JSON.parse(Buffer.from(parts[0],'base64url').toString());}catch{fail('invalid session');}
  const key=this.issuers[c.iss]?.publicKey;
  if(!key||!verify(null,Buffer.from(parts[0]),key,Buffer.from(parts[1],'base64url'))
     ||c.aud!==this.audience||c.game!==this.gameId||!id(c.sub)||!id(c.sid)
     ||!Number.isSafeInteger(c.exp)||!Number.isSafeInteger(c.nbf)||!Number.isSafeInteger(c.epoch)
     ||this.clock()<c.nbf||this.clock()>=c.exp||c.exp-c.nbf>3600000)fail('session denied');
  return c;
 }
 async registeredPrincipal(token){
  const c=this.verifyToken(token);
  return this.store.transact(s=>{
   runtimeState(s);const a=s.runtimeAccounts.get(c.sub);
   if(!a||a.issuer!==c.iss||(s.runtimeEpochs.get(c.sub)||0)!==c.epoch)fail('account revoked or unregistered');
   return c.sub;
  });
 }
 async register(token){
  const c=this.verifyToken(token);
  return this.store.transact(s=>{
   runtimeState(s);
   if((s.runtimeEpochs.get(c.sub)||0)!==c.epoch)fail('account revoked');
   const old=s.runtimeAccounts.get(c.sub);if(old&&old.issuer!==c.iss)fail('account issuer collision');
   s.runtimeAccounts.set(c.sub,{issuer:c.iss,game:this.gameId});return c.sub;
  });
 }
 async requireTrustedIssuer(token,source){
  const c=this.verifyToken(token);await this.registeredPrincipal(token);
  if(!this.issuers[c.iss]?.operators?.[c.sub]?.sources?.includes(source))fail('source issuer denied');
 }
 async requireMarketOperator(token){
  const c=this.verifyToken(token);await this.registeredPrincipal(token);
  if(this.issuers[c.iss]?.operators?.[c.sub]?.marketOperator!==true)fail('market operator denied');
 }
 async revoke(token,principal){
  const c=this.verifyToken(token);await this.registeredPrincipal(token);
  if(!this.issuers[c.iss]?.operators?.[c.sub]?.administrator||!id(principal))fail('revocation denied');
  return this.store.transact(s=>{runtimeState(s);s.runtimeEpochs.set(principal,(s.runtimeEpochs.get(principal)||0)+1);});
 }
 async revokeSource(token,source){
  const c=this.verifyToken(token);await this.registeredPrincipal(token);
  if(!this.issuers[c.iss]?.operators?.[c.sub]?.administrator||!id(source))fail('source revocation denied');
  return this.store.transact(s=>{runtimeState(s);s.runtimeSourceEpochs.set(source,(s.runtimeSourceEpochs.get(source)||0)+1);});
 }
 async linkChallenge(token,wallet){
  const principal=await this.registeredPrincipal(token);wallet=address(wallet);
  const nonce=randomBytes(32).toString('hex'),expires=this.clock()+300000;
  const message=JSON.stringify({domain:'HC.WALLET.LINK.V1',audience:this.audience,origin:this.origin,
   chainId:this.chainId,gameId:this.gameId,principal,wallet,nonce,expires,consent:'link-only'});
  await this.store.transact(s=>{runtimeState(s);s.runtimeNonces.set(nonce,{principal,wallet,expires,message});});
  return {nonce,message,expires};
 }
 async linkWallet(token,nonce,signature){
  const principal=await this.registeredPrincipal(token);
  const challenge=await this.store.transact(s=>{runtimeState(s);return s.runtimeNonces.get(nonce);});
  if(!challenge||challenge.principal!==principal||this.clock()>=challenge.expires)fail('link challenge denied');
  if(!await this.rpc.verifyWallet(challenge.wallet,challenge.message,signature))fail('wallet consent denied');
  const profile=await this.rpc.playerProfile(this.gameId,challenge.wallet);
  const c=this.verifyToken(token);
  return this.store.transact(s=>{
   runtimeState(s);const current=s.runtimeNonces.get(nonce);
   if(!current||this.clock()>=current.expires||(s.runtimeEpochs.get(principal)||0)!==c.epoch)fail('link replay or revoked');
   const other=s.runtimeWalletOwners.get(challenge.wallet);
   if(other&&other!==principal)fail('wallet already bound');
   const old=s.runtimeWallets.get(principal);if(old&&old.wallet!==challenge.wallet)fail('unlink consent required');
   s.runtimeWallets.set(principal,{wallet:challenge.wallet,profile,chainId:this.chainId,game:this.gameId});
   s.runtimeWalletOwners.set(challenge.wallet,principal);s.runtimeNonces.delete(nonce);return profile;
  });
 }
 async walletOf(token){
  const p=await this.registeredPrincipal(token);
  const b=await this.store.transact(s=>{runtimeState(s);return s.runtimeWallets.get(p);});
  if(!b||b.game!==this.gameId||b.chainId!==this.chainId)fail('wallet binding required');
  if(await this.rpc.playerProfile(this.gameId,b.wallet)!==b.profile)fail('canonical profile changed');
  return b.wallet;
 }
 async unlink(token){
  const p=await this.registeredPrincipal(token);
  await this.store.transact(s=>{runtimeState(s);const b=s.runtimeWallets.get(p);
   if(b)s.runtimeWalletOwners.delete(b.wallet);s.runtimeWallets.delete(p);
   for(const [n,c] of s.runtimeNonces)if(c.principal===p)s.runtimeNonces.delete(n);});
 }
}
export class GameplayRewardRuntime {
 constructor({store,authority,rpc,sources,clock=()=>Date.now()}){
  if(!sources||typeof authority?.walletOf!=='function')fail('missing approved sources');
  Object.assign(this,{store,authority,rpc,sources,clock});
 }
 async claim(token,source,envelope){
  const owner=await this.authority.registeredPrincipal(token),wallet=await this.authority.walletOf(token);
  const policy=this.sources[source];if(!policy||!['mission','progression'].includes(policy.kind))fail('unapproved source');
  let p;try{p=JSON.parse(Buffer.from(envelope.payload,'base64url').toString());}catch{fail('invalid gameplay proof');}
  if(!verify(null,Buffer.from(envelope.payload),policy.publicKey,Buffer.from(envelope.signature,'base64url'))
     ||p.domain!=='HC.GAMEPLAY.REWARD.V1'||p.game!==this.authority.gameId||p.chainId!==this.authority.chainId
     ||p.owner!==owner||p.wallet!==wallet||p.source!==source||p.contract!==policy.contract
     ||!/^0x[0-9a-f]{64}$/i.test(p.objective)||!Number.isSafeInteger(p.amount)||p.amount<=0
     ||!Number.isSafeInteger(p.expires)||this.clock()>=p.expires||p.expires>this.clock()+300000
     ||p.epoch!==policy.epoch)fail('gameplay proof denied');
  if(!await this.rpc.unrestricted(policy.emergencyDomain))fail('reward ingress restricted');
  const valid=policy.kind==='mission'?await this.rpc.missionReward(source,wallet,p.objective,p.amount):
   await this.rpc.progressionReward(source,wallet,p.objective,p.amount);
  if(!valid)fail('canonical gameplay completion required');
  // Independent of envelope/signature/op ID: this canonical source objective can pay this owner only once.
  const proof=keccak256(Buffer.from(JSON.stringify([p.chainId,p.game,p.contract,p.objective,wallet])));
  const catalog=new ReviewedEconomyCatalog({sources:[{id:source,maxAward:policy.maxAward,totalCap:policy.totalCap}],
   sinks:[],verifyEvidence:(s,h,o,n)=>s===source&&h===proof&&o===owner&&n===p.amount});
  const guardedStore={transact:callback=>this.store.transact(s=>{
   runtimeState(s);if((s.runtimeSourceEpochs.get(source)??policy.epoch)!==p.epoch)fail('source revoked');
   const c=this.authority.verifyToken(token);if((s.runtimeEpochs.get(owner)||0)!==c.epoch)fail('account revoked');
   const b=s.runtimeWallets.get(owner);if(!b||b.wallet!==wallet)fail('wallet binding revoked');
   return callback(s);
  })};
  return new BudsLedger(guardedStore,catalog).earn('reward:'+proof,owner,source,proof,p.amount);
 }
}
