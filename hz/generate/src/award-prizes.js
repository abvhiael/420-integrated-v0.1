import {createHash} from "node:crypto";
const hash=v=>createHash("sha256").update(JSON.stringify(v)).digest("hex");
const id=v=>{if(typeof v!=="string"||!/^[A-Za-z0-9][A-Za-z0-9:_-]{0,127}$/.test(v))throw Error("INVALID_REFERENCE");return v};
const amount=v=>{if(!Number.isSafeInteger(v)||v<0)throw Error("INVALID_AMOUNT");return v};
const copy=v=>structuredClone(v);
export class AwardPrizes420 {
 constructor({domain,authorize,source,compliance,pay}={}){
  if(!domain||typeof authorize!=="function"||typeof source!=="function"||typeof compliance!=="function"||typeof pay!=="function")throw Error("BOUNDARY_REQUIRED");
  Object.assign(this,{domain,authorize,source,compliance,pay});this.schedules=new Map();this.records=new Map();this.keys=new Map();this.reserve=new Map();
 }
 gate(actor,action){if(this.authorize(actor,action)!==true)throw Error("UNAUTHORIZED");}
 schedule(actor,{id:ref,seasonId,categoryId,sourceRef,currency,amountMinor,recipientPolicy="WINNERS_EQUAL",purpose="AWARD_PRIZE"}){
  this.gate(actor,"schedule");id(ref);id(seasonId);id(categoryId);id(currency);id(purpose);amount(amountMinor);
  if(this.schedules.has(ref))throw Error("REPLAY_CONFLICT");
  const s=this.domain.get(this.domain.seasons,seasonId),c=this.domain.get(this.domain.categories,categoryId);
  if(c.seasonId!==s.id||s.state!=="DRAFT"&&s.state!=="SCHEDULED")throw Error("SCHEDULE_FROZEN");
  if(recipientPolicy!=="WINNERS_EQUAL")throw Error("UNSUPPORTED_DISTRIBUTION");
  if(amountMinor>0){id(sourceRef);const funding=this.source(sourceRef);if(!funding||!["TREASURY","GRANTS","PAY"].includes(funding.kind)||funding.currency!==currency||funding.authorized!==true)throw Error("UNAUTHORIZED_FUNDING_SOURCE");}
  const record={id:ref,seasonId,categoryId,sourceRef:amountMinor>0?sourceRef:null,currency,amountMinor,purpose,recipientPolicy,commitment:hash([ref,seasonId,categoryId,sourceRef,currency,amountMinor,purpose,recipientPolicy])};
  this.schedules.set(ref,copy(record));return copy(record);
 }
 plan(actor,{id:ref,scheduleId,resultId,recipients}){
  this.gate(actor,"plan");id(ref);id(resultId);if(this.records.has(ref))throw Error("REPLAY_CONFLICT");
  const schedule=this.schedules.get(id(scheduleId)),result=this.domain.get(this.domain.results,resultId);
  if(!schedule||result.state!=="FINALIZED"||schedule.seasonId!==result.seasonId||schedule.categoryId!==result.categoryId||!result.resultCommitment)throw Error("UNFINALIZED_RESULT");
  if(!Array.isArray(recipients)||new Set(recipients).size!==recipients.length||recipients.some(x=>typeof x!=="string"))throw Error("INVALID_RECIPIENTS");
  const winners=[...result.winnerTargetIds].sort();if(recipients.length!==winners.length||recipients.some((r,i)=>r!==winners[i]))throw Error("WINNER_MISMATCH");
  if(schedule.amountMinor>0&&!recipients.length)throw Error("NO_RECIPIENT");
  const share=recipients.length?Math.floor(schedule.amountMinor/recipients.length):0,rem=recipients.length?schedule.amountMinor%recipients.length:0;
  const transfers=recipients.map((recipient,i)=>({recipient,amountMinor:share+(i<rem?1:0),purpose:schedule.purpose,transferKey:hash([ref,recipient,schedule.commitment,result.resultCommitment])}));
  const total=transfers.reduce((n,t)=>n+t.amountMinor,0);if(total!==schedule.amountMinor)throw Error("ACCOUNTING_MISMATCH");
  const record={id:ref,scheduleId,resultId,resultCommitment:result.resultCommitment,policyCommitment:result.policyCommitment,currency:schedule.currency,totalMinor:total,sourceRef:schedule.sourceRef,transfers,status:total===0?"ZERO_PRIZE":"PLANNED",settledMinor:0,failedMinor:0};
  this.records.set(ref,copy(record));return copy(record);
 }
 async settle(actor,planId){
  this.gate(actor,"settle");const r=this.records.get(id(planId));if(!r)throw Error("NOT_FOUND");if(r.status==="ZERO_PRIZE"||r.status==="SETTLED")return copy(r);
  const schedule=this.schedules.get(r.scheduleId),result=this.domain.get(this.domain.results,r.resultId);
  if(result.resultCommitment!==r.resultCommitment||schedule.commitment!==this.schedules.get(r.scheduleId).commitment)throw Error("COMMITMENT_DRIFT");
  // In-memory journal is a fixture only; a production adapter needs durable atomic reserve/idempotency.
  const done=new Map((r.outcomes||[]).map(x=>[x.transferKey,x]));
  for(const t of r.transfers){
   if(done.get(t.transferKey)?.status==="SETTLED")continue;
   if(t.amountMinor===0){done.set(t.transferKey,{transferKey:t.transferKey,status:"SETTLED",amountMinor:0});continue;}
   const eligibility=this.compliance({recipient:t.recipient,resultId:r.resultId,sourceRef:r.sourceRef,purpose:t.purpose,amountMinor:t.amountMinor});
   if(eligibility?.eligible!==true){done.set(t.transferKey,{transferKey:t.transferKey,status:"BLOCKED",amountMinor:t.amountMinor});continue;}
   try{const confirmation=await this.pay({key:t.transferKey,recipient:t.recipient,amountMinor:t.amountMinor,currency:r.currency,purpose:t.purpose,sourceRef:r.sourceRef,resultCommitment:r.resultCommitment});
     if(!confirmation||confirmation.status!=="CONFIRMED"||!id(confirmation.reference))throw Error("NOT_CONFIRMED");
     done.set(t.transferKey,{transferKey:t.transferKey,status:"SETTLED",amountMinor:t.amountMinor,confirmationRef:confirmation.reference});
   }catch{done.set(t.transferKey,{transferKey:t.transferKey,status:"FAILED",amountMinor:t.amountMinor});}
  }
  r.outcomes=[...done.values()].sort((a,b)=>a.transferKey.localeCompare(b.transferKey));r.settledMinor=r.outcomes.filter(x=>x.status==="SETTLED").reduce((n,x)=>n+x.amountMinor,0);r.failedMinor=r.totalMinor-r.settledMinor;
  if(r.settledMinor+r.failedMinor!==r.totalMinor)throw Error("ACCOUNTING_MISMATCH");
  r.status=r.failedMinor===0?"SETTLED":"PARTIAL_OR_FAILED";return copy(r);
 }
 publicAccounting(planId){const r=this.records.get(id(planId));if(!r)throw Error("NOT_FOUND");return {planId:r.id,resultId:r.resultId,resultCommitment:r.resultCommitment,currency:r.currency,sourceKind:r.sourceRef?this.source(r.sourceRef)?.kind:null,totalMinor:r.totalMinor,settledMinor:r.settledMinor,unsettledMinor:r.totalMinor-r.settledMinor,status:r.status};}
}
