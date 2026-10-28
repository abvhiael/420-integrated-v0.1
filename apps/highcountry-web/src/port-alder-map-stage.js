// Read-only presentation gate. The UI never counts browser purchases or guest saves.
// Production authority MUST provide a server-verified snapshot; any uncertainty is Genesis.
export function selectPortAlderArtwork(catalogue, snapshot){
 const images=catalogue?.maps?.town;
 if(catalogue?.schema!=='HC.WORLD.MAP.CATALOGUE.V1'||!images)throw Error('invalid map catalogue');
 const base={stage:'GENESIS',src:images.genesisSrc,verified:false};
 if(!snapshot||snapshot.schema!=='HC.WORLD.PURCHASE.MILESTONE.V1'||snapshot.settlementId!=='HC-EC-S01'||
 snapshot.authority!=='SERVER_ATTESTED_CANONICAL_SETTLED_TITLE_CURRENT_OWNER'||snapshot.finalized!==true||
 !Number.isSafeInteger(snapshot.qualifyingPurchased)||!Number.isSafeInteger(snapshot.eligibleTitles)||
 snapshot.eligibleTitles<=0||snapshot.qualifyingPurchased<0||snapshot.qualifyingPurchased>snapshot.eligibleTitles||
 !Number.isSafeInteger(snapshot.revision)||snapshot.revision<0||
 typeof snapshot.canonicalSnapshotId!=='string'||!/^HC-EC-S01:[A-Za-z0-9_-]{8,}$/.test(snapshot.canonicalSnapshotId))
 return base;
 const is75=snapshot.qualifyingPurchased*4>=snapshot.eligibleTitles*3;
 const is50=snapshot.qualifyingPurchased*2>=snapshot.eligibleTitles;
 // Keep the already uploaded 50% artwork until the full-capacity PNG is committed.
 const fullAssetReady=images.developed75AssetReady===true&&typeof images.developed75Src==='string';
 const stage=is75&&fullAssetReady?'DEVELOPED_75':is50?'DEVELOPED_50':'GENESIS';
 return {stage,src:stage==='DEVELOPED_75'?images.developed75Src:stage==='DEVELOPED_50'?images.developed50Src:images.genesisSrc,verified:true};
}
export async function requestPortAlderStage({runtime,fetchImpl=fetch,authenticate}={}){
 if(runtime?.mode!=='connected'||typeof authenticate!=='function')return null;
 const token=await authenticate();
 if(typeof token!=='string'||!token)return null;
 try{
  // Fail closed until an authenticated, canonical-count service is deployed.
  const response=await fetchImpl('/api/highcountry/world/port-alder/purchase-milestone',{headers:{authorization:'Bearer '+token},cache:'no-store'});
  if(!response.ok)return null;
  const data=await response.json();
  // Server must attest purchase counts from settled title inventory, not UI submissions.
  return data;
 }catch{return null}
}
