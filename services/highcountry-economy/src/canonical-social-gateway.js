import {randomBytes} from 'node:crypto';
import {SettlementError} from './buds-ledger.js';
import {address} from './finalized-rpc.js';

// This gateway cannot manufacture canonical authorization, contract operations,
// finality or settlement. All are mandatory independent deployment dependencies.
const ACTIONS=new Set(['organization.create','organization.invite','organization.invitation.revoke','organization.join','organization.leave','organization.remove','organization.leader.propose','organization.leader.accept','organization.delegate','organization.delegate.revoke','cooperative.create','cooperative.enroll','cooperative.withdraw','cooperative.propose','cooperative.vote','cooperative.proposal.cancel','cooperative.execute']);
const KINDS=new Set(['organization','cooperative','proposal','permission','treasury','history']);
const fail=m=>{throw new SettlementError(m);};
const ident=x=>typeof x==='string'&&/^[a-zA-Z0-9:_-]{1,128}$/.test(x);
const hex=x=>typeof x==='string'&&/^0x[0-9a-fA-F]{64}$/.test(x);
export class CanonicalSocialGateway {
 constructor({identity,pool,chain,scope,clock=()=>Date.now()}){
  if(typeof identity?.registeredPrincipal!=='function'||typeof identity?.walletOf!=='function'||typeof pool?.connect!=='function'||!ident(scope))fail('canonical social dependencies required');
  for(const method of ['snapshot','permission','transactionIntent','submitSigned','finalizedReceipt','history','verifyFinality','verifyTreasurySettlement'])
   if(typeof chain?.[method]!=='function')fail('canonical social chain adapter missing: '+method);
  Object.assign(this,{identity,pool,chain,scope,clock});
  this.grants=new Map(); // ephemeral challenges only; never authority or persistent history
 }
 async principal(session){const principal=await this.identity.registeredPrincipal(session);const wallet=address(await this.identity.walletOf(session));return {principal,wallet};}
 async authenticate(session){const x=await this.principal(session);return {registered:true,principal:x.principal,wallet:x.wallet};}
 async snapshot({session,scope}){this.requireScope(scope);const who=await this.principal(session);const data=await this.chain.snapshot({...who,scope});if(!data||!Array.isArray(data.organizations)||!Array.isArray(data.cooperatives)||!Array.isArray(data.permissions))fail('invalid canonical social snapshot');return data;}
 requireScope(scope){if(scope!==this.scope)fail('social scope mismatch');}
 context(ctx){this.requireScope(ctx?.scope);if(!ACTIONS.has(ctx?.action)||!ctx.payload||typeof ctx.payload!=='object'||Array.isArray(ctx.payload)||ctx.action==='cooperative.execute'&&ctx.payload.kind==='treasury')fail('social operation forbidden');}
 async authorize(ctx){
  this.context(ctx);const who=await this.principal(ctx.session);
  if(ctx.principal!==who.principal)fail('principal mismatch');
  const permit=await this.chain.permission({wallet:who.wallet,principal:who.principal,scope:ctx.scope,action:ctx.action,payload:ctx.payload});
  if(permit?.allowed!==true||!hex(permit?.blockHash)||!hex(permit?.policyHash))fail('canonical permission denied');
  const proof=randomBytes(32).toString('hex');
  const transaction=await this.chain.transactionIntent({wallet:who.wallet,action:ctx.action,payload:ctx.payload});
  if(transaction?.from!==who.wallet||transaction?.chainId!==this.identity.chainId||transaction?.value!=='0x0')fail('invalid contract transaction intent');
  this.grants.set(proof,{wallet:who.wallet,principal:who.principal,action:ctx.action,scope:ctx.scope,payload:JSON.stringify(ctx.payload),policyHash:permit.policyHash,transaction,expires:this.clock()+60000});
  return {allowed:true,proof,transaction};
 }
 async submit(ctx){
  this.context(ctx);const who=await this.principal(ctx.session);const g=this.grants.get(ctx.authorizationProof);
  if(!g||this.clock()>=g.expires||g.wallet!==who.wallet||g.principal!==who.principal||g.action!==ctx.action||g.scope!==ctx.scope||g.payload!==JSON.stringify(ctx.payload))fail('authorization proof expired or replayed');
  this.grants.delete(ctx.authorizationProof);
  const fresh=await this.chain.permission({wallet:who.wallet,principal:who.principal,scope:ctx.scope,action:ctx.action,payload:ctx.payload});
  if(fresh?.allowed!==true||fresh.policyHash!==g.policyHash)fail('canonical permission changed');
  // Canonical adapter must obtain a real wallet-authorized signed transaction.
  // A backend signer impersonating the member is expressly prohibited.
  if(typeof ctx.signedRawTransaction!=='string'||!/^0x[0-9a-fA-F]+$/.test(ctx.signedRawTransaction))fail('wallet-signed transaction required');
  const tx=await this.chain.submitSigned({...ctx,payload:{...ctx.payload,signedRawTransaction:ctx.signedRawTransaction},wallet:who.wallet,principal:who.principal,authorization:ctx.authorizationProof});
  if(!hex(tx?.hash)||tx?.signer?.toLowerCase()!==who.wallet||tx?.chainId!==this.identity.chainId||tx?.isFundTransfer===true)fail('invalid signed social transaction');
  const operationId=tx.hash.toLowerCase();
  const client=await this.pool.connect();let started=false;
  try{await client.query('BEGIN');started=true;
   await client.query('INSERT INTO highcountry_social_operations(scope, operation_id, principal, wallet, action, tx_hash, state) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (scope,operation_id) DO NOTHING',[this.scope,operationId,who.principal,who.wallet,ctx.action,operationId,'submitted']);
   await client.query('COMMIT');started=false;
  }catch(e){if(started)await client.query('ROLLBACK');throw e;}finally{client.release();}
  return {operationId};
 }
 async receipt({session,scope,operationId}){
  this.requireScope(scope);const who=await this.principal(session);if(!hex(operationId))fail('operation id invalid');
  const r=await this.pool.query('SELECT principal,wallet,action,tx_hash FROM highcountry_social_operations WHERE scope=$1 AND operation_id=$2',[scope,operationId.toLowerCase()]);
  const row=r.rows[0];if(!row||row.principal!==who.principal||row.wallet.toLowerCase()!==who.wallet)fail('private operation denied');
  const receipt=await this.chain.finalizedReceipt({hash:row.tx_hash,wallet:who.wallet,action:row.action});
  if(!receipt||receipt.finalized!==true||receipt.success!==true||receipt.signer?.toLowerCase()!==who.wallet||receipt.action!==row.action||receipt.hash?.toLowerCase()!==row.tx_hash||receipt.isFundTransfer===true||!hex(receipt.blockHash))fail('canonical finalized receipt unavailable');
  if(await this.chain.verifyFinality(receipt)!==true)fail('canonical finality proof denied');
  await this.pool.query('UPDATE highcountry_social_operations SET state=$3, block_hash=$4 WHERE scope=$1 AND operation_id=$2',[scope,operationId.toLowerCase(),'finalized',receipt.blockHash]);
  return {operationId:operationId.toLowerCase(),action:row.action,finalized:true,authorized:true,isFundTransfer:false,blockHash:receipt.blockHash};
 }
 async history({session,scope,kind,id,cursor=null}){
  this.requireScope(scope);if(!KINDS.has(kind)||!ident(id)||cursor!==null&&!ident(cursor))fail('history request denied');
  const who=await this.principal(session);
  const entries=await this.chain.history({kind,id,scope,principal:who.principal,wallet:who.wallet,cursor});
  if(!entries||!Array.isArray(entries.entries))fail('canonical event history missing');
  const checked=[];
  for(const event of entries.entries){
   if(event?.visibleTo?.includes(who.wallet)!==true||!hex(event.blockHash)||await this.chain.verifyFinality(event)!==true)fail('event history not canonical or authorized');
   if(kind==='treasury'){
    if(event.state==='settled'){
     if(await this.chain.verifyTreasurySettlement(event)!==true)fail('treasury settlement not verified');
    }else{checked.push({...event,settled:false,settlementProof:null});continue;}
   }
   checked.push(event);
  }
  return {entries:checked,nextCursor:entries.nextCursor??null};
 }
}
