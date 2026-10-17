// High Country Original Sixteen — authoritative discovery rules.
// Does not depend on network, $420 payments, browser-local claims or biological loci.
export function validateArchive(journeys,canonical){
 if(journeys?.journeys?.length!==16||canonical?.founders?.length!==16)throw Error('founder-count');
 const names=new Set(),fragmentIds=new Set(),objectives=new Set();
 for(let i=0;i<16;i++){
  const q=journeys.journeys[i],f=canonical.founders[i];
  if(q.founderId!==f.id||q.founderName!==f.name||q.fragments?.length!==4)throw Error('founder-mismatch');
  if(names.has(q.founderId))throw Error('duplicate-founder');names.add(q.founderId);
  for(let z=0;z<4;z++){
   let a=q.fragments[z];if(a.fragmentId!==f.discoverableFragments[z].id||a.title!==f.discoverableFragments[z].title)throw Error('fragment-mismatch');
   if(fragmentIds.has(a.fragmentId)||objectives.has(a.trigger.objectiveId)||objectives.has(a.alternate.objectiveId))throw Error('duplicate-discovery');
   fragmentIds.add(a.fragmentId);objectives.add(a.trigger.objectiveId);objectives.add(a.alternate.objectiveId);
  }
  if(q.final.id!==f.id+'-REVELATION'||q.final.requiresAllFragmentIds.join('|')!==f.discoverableFragments.map(a=>a.id).join('|'))throw Error('revelation-mismatch');
 }
 return true;
}
export class ArchiveDiscoveryService {
 constructor({catalog,journeys,store,authorizeEvent,clock=()=>new Date().toISOString()}){
  validateArchive(journeys,catalog);
  if(!store||typeof store.transact!=='function'||typeof authorizeEvent!=='function')throw Error('authoritative-store-and-verifier-required');
  Object.assign(this,{catalog,journeys,store,authorizeEvent,clock});
  this.objectives=new Map();
  for(const q of journeys.journeys)for(const frag of q.fragments)for(const t of [frag.trigger,frag.alternate])this.objectives.set(t.objectiveId,{founder:q,fragment:frag,trigger:t});
 }
 async ingest({playerId,eventId,issuer,signature,eventType,objectiveId,proof}){
  if(typeof playerId!=='string'||!playerId||typeof eventId!=='string'||!eventId||!issuer||!signature||!proof)throw Error('invalid-event');
  const target=this.objectives.get(objectiveId);
  if(!target||target.trigger.type!==eventType)throw Error('objective-not-eligible');
  if(!await this.authorizeEvent({playerId,eventId,issuer,signature,eventType,objectiveId,proof,issuerRequired:target.trigger.verifiedBy}))throw Error('untrusted-event');
  // Store MUST provide atomic transaction serialization on player progress and global event key.
  // Event identity uniqueness, immutable progress and exactly-once rewards belong to the same DB transaction.
  return this.store.transact(async tx=>{
   if(await tx.eventExists(eventId))return {status:'duplicate',playerId,eventId};
   await tx.claimEvent(eventId,playerId,issuer,objectiveId);
   const fragmentId=target.fragment.fragmentId,founderId=target.founder.founderId;
   const first=await tx.addFragmentOnce(playerId,founderId,fragmentId,{eventId,at:this.clock()});
   let finalUnlocked=false,masterUnlocked=false;
   if(first){
    const all=await Promise.all(target.founder.fragments.map(x=>tx.hasFragment(playerId,x.fragmentId)));
    if(all.every(Boolean)){
     finalUnlocked=await tx.grantEntitlementOnce(playerId,founderId+'-REVELATION',{
      kind:'founder_revelation',founderId,nonTransferable:true,
      rewards:target.founder.final.rewards,at:this.clock()
     });
     if(finalUnlocked){
      const done=await Promise.all(this.journeys.journeys.map(q=>tx.hasEntitlement(playerId,q.final.id)));
      if(done.every(Boolean))masterUnlocked=await tx.grantEntitlementOnce(playerId,'ORIGINAL_SIXTEEN_MASTER',{
       kind:'master_collection',nonTransferable:true,rewards:this.journeys.masterRewards,at:this.clock()
      });
     }
    }
   }
   return {status:first?'unlocked':'already-unlocked',playerId,eventId,fragmentId,founderId,finalUnlocked,masterUnlocked};
  });
 }
 async publicProgress(playerId){
  if(!playerId)throw Error('missing-player');
  return this.store.readPlayer(playerId,this.journeys.journeys.map(q=>({founderId:q.founderId,fragmentIds:q.fragments.map(x=>x.fragmentId),finalId:q.final.id})));
 }
}
