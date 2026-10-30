// HC-NEXT-7.2 account-authoritative ordinary exhibitions.
// All writes run in a caller-supplied durable SERIALIZABLE transaction. No wallet dependency.
import {createHash} from 'node:crypto';
const fail=code=>{throw Object.assign(new Error(code),{code});};
const id=x=>typeof x==='string'&&/^[a-zA-Z0-9:_-]{1,128}$/.test(x);
const digest=x=>typeof x==='string'&&/^0x[0-9a-f]{64}$/.test(x);
const integer=x=>Number.isSafeInteger(x)&&x>=0;
export function createOrdinaryExhibitions420({repository,identity,harvest,clock=()=>Date.now()}={}){
 if(typeof repository?.transaction!=='function'||typeof identity?.verify!=='function'||
    typeof harvest?.verifyFinalizedFlower!=='function'||typeof clock!=='function')fail('exhibition-config-invalid');
 const now=()=>{const t=clock();if(!integer(t))fail('clock-invalid');return t;};
 const actor=async token=>{
  if(typeof token!=='string'||!token||token.length>4096)fail('authentication-required');
  const principal=await identity.verify(token);
  if(!id(principal?.accountId)||principal.registered!==true||principal.revoked===true)fail('authentication-denied');
  return principal.accountId;
 };
 const transaction=fn=>repository.transaction(fn,{isolation:'serializable'});
 const snapshot=x=>structuredClone(x);
 return Object.freeze({
  async status({token,eventId}){
   await actor(token);
   if(!id(eventId))fail('invalid-event');
   return transaction(async tx=>{
    const event=await tx.event(eventId);
    if(!event)fail('event-not-found');
    return snapshot({eventId:event.eventId,seasonId:event.seasonId,category:event.category,
      version:event.version,rulesHash:event.rulesHash,opensAt:event.opensAt,closesAt:event.closesAt,
      challengeUntil:event.challengeUntil,finalized:event.finalized,cancelled:event.cancelled,
      winner:event.finalized?event.winner:null,winnerScore:event.finalized?event.winnerScore:null});
   });
  },
  async create({token,eventId,seasonId,category,version,rulesHash,opensAt,closesAt,challengeUntil}){
   const accountId=await actor(token),t=now();
   if(!id(eventId)||!id(seasonId)||!id(category)||!integer(version)||version<1||
      !digest(rulesHash)||!integer(opensAt)||!integer(closesAt)||!integer(challengeUntil)||
      opensAt<=t||closesAt<=opensAt||challengeUntil<=closesAt||challengeUntil>closesAt+604800000)fail('invalid-event');
   return transaction(async tx=>{
    const season=await tx.season(seasonId);
    const policy=await tx.category(category,version);
    if(!season||season.organizer!==accountId||season.cancelled||opensAt<season.opensAt||
       closesAt>season.closesAt||!policy||policy.rulesHash!==rulesHash||
       policy.walletRequired!==false||policy.scope)fail('event-not-eligible');
    if(await tx.event(eventId))fail('event-exists');
    const event={eventId,seasonId,category,version,rulesHash,organizer:accountId,
      opensAt,closesAt,challengeUntil,finalized:false,cancelled:false,winner:null,winnerScore:0};
    await tx.insertEvent(event);
    return snapshot(event);
   });
  },
  async enter({token,eventId}){
   const accountId=await actor(token),t=now();
   if(!id(eventId))fail('invalid-event');
   return transaction(async tx=>{
    const event=await tx.lockEvent(eventId);
    if(!event||event.cancelled||event.finalized||t<event.opensAt||t>=event.closesAt||
       (await tx.season(event.seasonId))?.cancelled)fail('entry-closed');
    if(await tx.entry(eventId,accountId))fail('duplicate-entry');
    if(await tx.entryCount(eventId)>=128)fail('entry-cap');
    await tx.insertEntry(eventId,accountId);
    return {eventId,accountId,status:'registered'};
   });
  },
  async submit({token,eventId,harvestId}){
   const accountId=await actor(token),t=now();
   if(!id(eventId)||!id(harvestId))fail('invalid-submission');
   return transaction(async tx=>{
    const event=await tx.lockEvent(eventId);
    if(!event||event.cancelled||event.finalized||t<event.opensAt||t>=event.closesAt||
       (await tx.season(event.seasonId))?.cancelled||!await tx.entry(eventId,accountId)||
       await tx.result(eventId,accountId)||await tx.harvestClaim(eventId,harvestId))fail('submission-denied');
    const proof=await harvest.verifyFinalizedFlower({accountId,harvestId});
    if(!proof||proof.accountId!==accountId||proof.harvestId!==harvestId||
       !integer(proof.qualityBps)||proof.qualityBps>10000||
       !integer(proof.finalizedAt)||proof.finalizedAt<event.opensAt||proof.finalizedAt>t||
       !digest(proof.provenanceHash))fail('evidence-denied');
    const result={eventId,accountId,harvestId,qualityBps:proof.qualityBps,
       finalizedAt:proof.finalizedAt,provenanceHash:proof.provenanceHash,rejected:false};
    await tx.insertResult(result);
    return snapshot(result);
   });
  },
  async reject({token,eventId,accountId,reasonHash}){
   const adjudicator=await actor(token),t=now();
   if(!id(eventId)||!id(accountId)||!digest(reasonHash))fail('invalid-dispute');
   return transaction(async tx=>{
    if(!await tx.isAdjudicator(adjudicator))fail('adjudicator-denied');
    const event=await tx.lockEvent(eventId),r=await tx.result(eventId,accountId);
    if(!event||event.finalized||event.cancelled||t>=event.challengeUntil||!r||r.rejected)fail('dispute-closed');
    await tx.rejectResult(eventId,accountId,reasonHash);
    await tx.recordAdjudication({eventId,accountId,adjudicator,harvestId:r.harvestId,reasonHash,
      disposition:'PRE_FINAL_REJECTION',originalWinner:null,originalScore:null,decidedAt:t});
    return {eventId,accountId,rejected:true,reasonHash};
   });
  },
  // A finalized result is immutable. Review records evidence status only, never a replacement winner.
  async review({token,eventId,accountId,reasonHash}){
   const adjudicator=await actor(token),t=now();
   if(!id(eventId)||!id(accountId)||!digest(reasonHash))fail('invalid-dispute');
   return transaction(async tx=>{
    if(!await tx.isAdjudicator(adjudicator))fail('adjudicator-denied');
    const event=await tx.lockEvent(eventId),r=await tx.result(eventId,accountId);
    if(!event?.finalized||event.cancelled||!r)fail('review-unavailable');
    // Recheck all original fields; a provider failure aborts the transaction, never
    // creates a terminal false conviction or substitutes an unverified winner.
    const proof=await harvest.verifyFinalizedFlower({accountId,harvestId:r.harvestId});
    const valid=!r.rejected&&!!proof&&proof.accountId===accountId&&proof.harvestId===r.harvestId&&
      proof.qualityBps===r.qualityBps&&proof.finalizedAt===r.finalizedAt&&
      proof.provenanceHash===r.provenanceHash;
    const disposition=valid?'POST_FINAL_VALID':'POST_FINAL_INVALID';
    await tx.recordAdjudication({eventId,accountId,adjudicator,harvestId:r.harvestId,reasonHash,
      disposition,originalWinner:event.winner,originalScore:event.winnerScore,decidedAt:t});
    return {eventId,accountId,disposition,originalWinner:event.winner,originalScore:event.winnerScore};
   });
  },
  async adjudicationHistory({token,eventId}){
   const principal=await actor(token);
   if(!id(eventId))fail('invalid-event');
   return transaction(async tx=>{
    if(!await tx.isAdjudicator(principal))fail('adjudicator-denied');
    if(!await tx.event(eventId))fail('event-not-found');
    return snapshot(await tx.adjudicationHistory(eventId));
   });
  },
  async finalize({eventId}){
   const t=now();
   if(!id(eventId))fail('invalid-event');
   return transaction(async tx=>{
    const event=await tx.lockEvent(eventId);
    if(!event||event.finalized||event.cancelled||t<event.challengeUntil||
       (await tx.season(event.seasonId))?.cancelled)fail('finalization-denied');
    const results=await tx.results(eventId);
    let best=null;
    for(const r of results){
     if(r.rejected)continue;
     const proof=await harvest.verifyFinalizedFlower({accountId:r.accountId,harvestId:r.harvestId});
     if(!proof||proof.accountId!==r.accountId||proof.harvestId!==r.harvestId||
       proof.qualityBps!==r.qualityBps||proof.finalizedAt!==r.finalizedAt||
       proof.provenanceHash!==r.provenanceHash)continue;
     if(!best||r.qualityBps>best.qualityBps||
       (r.qualityBps===best.qualityBps&&
        (r.finalizedAt<best.finalizedAt||
        (r.finalizedAt===best.finalizedAt&&r.harvestId<best.harvestId))))best=r;
    }
    const outcome={eventId,winner:best?.accountId??null,winnerScore:best?.qualityBps??0,
      finalizedAt:t,evidenceDigest:'0x'+createHash('sha256').update(JSON.stringify(
       results.map(r=>[r.accountId,r.harvestId,r.provenanceHash,r.rejected]).sort((a,b)=>a[0].localeCompare(b[0])))).digest('hex')};
    await tx.finalizeEvent(outcome);
    return outcome;
   });
  }
 });
}
