// High Country social economy browser controller.
// Server/chain gateway is the source of truth: this client never signs as a member,
// caches grants as authority or interprets an authorization record as a settlement.
export class SocialEconomyError extends Error {}
const OPERATIONS=Object.freeze({
  createOrganization:'organization.create',
  invite:'organization.invite',
  revokeInvitation:'organization.invitation.revoke',
  join:'organization.join',
  leave:'organization.leave',
  remove:'organization.remove',
  proposeLeader:'organization.leader.propose',
  acceptLeader:'organization.leader.accept',
  delegate:'organization.delegate',
  revokeGrant:'organization.delegate.revoke',
  createCooperative:'cooperative.create',
  enroll:'cooperative.enroll',
  withdraw:'cooperative.withdraw',
  propose:'cooperative.propose',
  vote:'cooperative.vote',
  cancelProposal:'cooperative.proposal.cancel',
  execute:'cooperative.execute'
});
const valueKinds=new Set(['organization','cooperative','proposal','permission','treasury','history']);
function record(x){return !!x && typeof x==='object'&&!Array.isArray(x);}
function exactGateway(g){for(const k of ['authenticate','snapshot','authorize','submit','receipt','history'])if(typeof g?.[k]!=='function')throw new SocialEconomyError('canonical gateway method missing: '+k);return g;}
const nonSettlement=(item)=>Object.freeze({...item,settled:false,settlementProof:null});
export class SocialEconomyController {
  #gateway; #identity; #scope; #revision=0;
  constructor({gateway,scope}) {
    this.#gateway=exactGateway(gateway);
    if(typeof scope!=='string'||!scope.trim())throw new SocialEconomyError('scope required');
    this.#scope=scope;
  }
  get principal(){return this.#identity?.principal??null;}
  get revision(){return this.#revision;}
  async connect(session){
    const a=await this.#gateway.authenticate(session);
    if(!record(a)||typeof a.principal!=='string'||!a.principal||a.registered!==true)throw new SocialEconomyError('registered authenticated player required');
    this.#identity=Object.freeze({principal:a.principal,session});
    this.#revision++;
    return this.snapshot();
  }
  async snapshot(){
    if(!this.#identity)throw new SocialEconomyError('session required');
    const x=await this.#gateway.snapshot({session:this.#identity.session,scope:this.#scope});
    if(!record(x)||!Array.isArray(x.organizations)||!Array.isArray(x.cooperatives)||!Array.isArray(x.permissions))throw new SocialEconomyError('unverified snapshot');
    return Object.freeze({organizations:x.organizations,cooperatives:x.cooperatives,permissions:x.permissions,principal:this.principal,revision:this.#revision});
  }
  async history(kind,id,{cursor=null}={}){
    if(!this.#identity||!valueKinds.has(kind)||typeof id!=='string'||!id)throw new SocialEconomyError('invalid history request');
    const x=await this.#gateway.history({session:this.#identity.session,scope:this.#scope,kind,id,cursor});
    if(!record(x)||!Array.isArray(x.entries))throw new SocialEconomyError('unverified history');
    return Object.freeze({entries:x.entries.map(e=>{
      if(!record(e)||typeof e.id!=='string'||typeof e.state!=='string')throw new SocialEconomyError('invalid history item');
      // Treasury approval is explicitly not a monetary transfer.
      if(kind==='treasury'&&e.state!=='settled')return nonSettlement(e);
      if(kind==='treasury'&&e.state==='settled'&&!(e.settlementProof?.canonical===true&&typeof e.settlementProof?.receiptId==='string'&&e.settlementProof.receiptId))throw new SocialEconomyError('canonical settlement receipt missing');
      return Object.freeze({...e});
    }),nextCursor:x.nextCursor??null});
  }
  async act(action,payload={}){
    if(!this.#identity)throw new SocialEconomyError('session required');
    if(!Object.values(OPERATIONS).includes(action)||!record(payload))throw new SocialEconomyError('unsupported operation');
    if(action===OPERATIONS.execute&&payload.kind==='treasury')throw new SocialEconomyError('governance cannot execute treasury transfers');
    const ctx={session:this.#identity.session,principal:this.principal,scope:this.#scope,action,payload};
    const authority=await this.#gateway.authorize(ctx);
    if(!record(authority)||authority.allowed!==true||!authority.proof||typeof authority.proof!=='string')throw new SocialEconomyError('canonical authorization denied');
    // Gateway must authenticate signer and verify fresh on-chain state again at submission.
    const tx=await this.#gateway.submit({...ctx,authorizationProof:authority.proof});
    if(!record(tx)||typeof tx.operationId!=='string'||!tx.operationId)throw new SocialEconomyError('operation acknowledgement missing');
    const receipt=await this.#gateway.receipt({session:this.#identity.session,scope:this.#scope,operationId:tx.operationId});
    if(!record(receipt)||receipt.operationId!==tx.operationId||receipt.finalized!==true||receipt.authorized!==true||receipt.action!==action)throw new SocialEconomyError('finalized canonical operation receipt missing');
    if(receipt.isFundTransfer===true)throw new SocialEconomyError('fund transfers require separate canonical treasury settlement flow');
    this.#revision++;
    return Object.freeze({operationId:tx.operationId,receipt:Object.freeze({...receipt}),snapshot:await this.snapshot()});
  }
}
export {OPERATIONS};
