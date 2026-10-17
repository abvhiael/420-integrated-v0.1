// Gate all outward use of moderated cultivars, without changing immutable genomes.
export class CultivarUseGate {
 constructor({registry,ledger,verifyOwner,clock=()=>Date.now()}){Object.assign(this,{registry,ledger,verifyOwner,clock});}
 async requireUsable({cultivarId,actor,action}){
  if(!cultivarId||!actor||!['breed','plant','list','trade','transfer','clone','search-public','competition'].includes(action))throw Error('invalid-use');
  const record=await this.registry.get(cultivarId);
  if(!record||record.status!=='PUBLISHED'||record.suspended||record.retired)throw Error('cultivar-unavailable');
  if(!await this.verifyOwner(actor,cultivarId,action))throw Error('not-authorized');
  if(await this.ledger.isBlocked(cultivarId,record.genomeId,record.nameHash))throw Error('moderation-block');
  return {id:cultivarId,genomeId:record.genomeId};
 }
}
