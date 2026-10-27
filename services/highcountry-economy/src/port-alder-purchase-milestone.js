// Production-only snapshot aggregator: injected reader must be a server-side,
// finalized authoritative land-title index. Never accept browser purchase counts.
export async function canonicalPortAlderMilestone({reader,session,identity}){
 if(typeof identity?.registeredPrincipal!=='function'||typeof reader?.finalizedPortAlderTitles!=='function')throw Error('canonical reader and authenticated principal required');
 const owner=await identity.registeredPrincipal(session);
 if(typeof owner!=='string'||!owner)throw Error('unauthenticated request');
 const result=await reader.finalizedPortAlderTitles();
 if(result?.settlementId!=='HC-EC-S01'||result.finalized!==true||!Number.isSafeInteger(result.revision)||result.revision<0||
 !Array.isArray(result.eligibleTitleIds)||!Array.isArray(result.settledTitleIds)||typeof result.snapshotId!=='string'||
 !/^[A-Za-z0-9_-]{8,}$/.test(result.snapshotId))throw Error('unfinalized or malformed canonical title inventory');
 const allowed=new Set(result.eligibleTitleIds);
 if(allowed.size!==result.eligibleTitleIds.length||allowed.size===0||![...allowed].every(id=>typeof id==='string'&&/^HC-EC-(U|C)-\d{6}$/.test(id)))throw Error('invalid eligible title inventory');
 const sold=new Set();
 for(const item of result.settledTitleIds){
  if(!item||!allowed.has(item.titleId)||sold.has(item.titleId)||item.finalized!==true||
  typeof item.currentOwner!=='string'||!item.currentOwner||
  item.currentOwner==='420CORP'||item.currentOwner==='RESERVE'||item.currentOwner==='UNISSUED'||
  item.status!=='ISSUED_SETTLED')throw Error('invalid settled title evidence');
  sold.add(item.titleId);
 }
 return Object.freeze({schema:'HC.WORLD.PURCHASE.MILESTONE.V1',settlementId:'HC-EC-S01',
 authority:'SERVER_ATTESTED_CANONICAL_SETTLED_TITLE_CURRENT_OWNER',finalized:true,
 qualifyingPurchased:sold.size,eligibleTitles:allowed.size,revision:result.revision,
 canonicalSnapshotId:'HC-EC-S01:'+result.snapshotId});
}
