import {createHash, timingSafeEqual} from 'node:crypto';
const deny = (why)=>{throw Error(why)};
export function normalizeCultivarName(s) {
 if(typeof s!=='string'||s.length>96)deny('invalid-name');
 const normalized=s.normalize('NFKC').toLowerCase().replace(/[\u0300-\u036f\u200b-\u200f]/g,'').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
 if(normalized.length<2||normalized.length>48)deny('invalid-name');
 return normalized;
}
export function screenName(name,{blocked=[],heritage=[]}={}){
 const n=normalizeCultivarName(name), compact=n.replace(/ /g,'');
 const matched=heritage.find(x=>x.verified===true&&normalizeCultivarName(x.name)===n);
 if(matched)return {state:'HERITAGE_REVIEW',normalized:n,heritageId:matched.id};
 for(const term of blocked){
  const token=normalizeCultivarName(term), pattern=token.replace(/ /g,'');
  if(n.split(' ').includes(token)||compact.includes(pattern))return {state:'REJECT',normalized:n,reason:'prohibited-term'};
 }
 return {state:'CONTEXT_REVIEW',normalized:n};
}
export function sevenDayQuote(observations,{now,decimals,usdTargetMicros=4200000n,minSamples=24,staleMs=3600000n}){
 if(!Number.isInteger(decimals)||decimals<0||decimals>18)deny('invalid-decimals');
 const end=BigInt(now);const start=end-604800000n;
 const ticks=observations.map(o=>({time:BigInt(o.time),usdMicros:BigInt(o.usdMicros)})).sort((a,b)=>a.time<b.time?-1:1);
 if(ticks.length<minSamples)deny('insufficient-price-samples');
 if(ticks.some((x,i)=>x.usdMicros<=0n||(i&&x.time<=ticks[i-1].time)))deny('invalid-observations');
 const before=ticks.filter(x=>x.time<=start).at(-1);
 const sample=ticks.filter(x=>x.time>start&&x.time<=end);
 if(!before||!sample.length||end-sample.at(-1).time>staleMs)deny('stale-or-incomplete-price');
 let last=start, price=before.usdMicros,weighted=0n;
 for(const tick of sample){weighted+=(tick.time-last)*price;last=tick.time;price=tick.usdMicros;}
 weighted+=(end-last)*price;
 const average=weighted/(end-start);if(average<=0n)deny('invalid-average');
 const numer=usdTargetMicros*(10n**BigInt(decimals));
 const fee=(numer+average-1n)/average;
 if(fee<=0n)deny('invalid-fee');
 return {feeBaseUnits:fee.toString(),reviewerShare:(fee/2n).toString(),vaultShare:(fee-fee/2n).toString(),averageUsdMicros:average.toString(),windowStart:start.toString(),windowEnd:end.toString()};
}
export class CultivarReviewService {
 constructor({heritage=[],blocked=[],contextReview,store,clock=()=>Date.now()}){
  if(typeof contextReview!=='function'||!store)deny('review-service-unconfigured');
  Object.assign(this,{heritage,blocked,contextReview,store,clock});
 }
 async submit({id,name,owner,genomeId,parentA,parentB,custom,paidReceipt}){
  if(!id||!owner||!genomeId||!parentA||!parentB||parentA===parentB)deny('invalid-provenance');
  if(custom&&!paidReceipt?.confirmed)deny('payment-not-confirmed');
  const local=screenName(name,this);if(local.state==='REJECT')deny('name-prohibited');
  const verdict=await this.contextReview({name,normalized:local.normalized,heritageId:local.heritageId});
  if(verdict!=='allow'&&verdict!=='review')deny('automated-block');
  return this.store.createPending({id,owner,genomeId,parentA,parentB,custom,normalized:local.normalized,requiresHeritageVerification:local.state==='HERITAGE_REVIEW',createdAt:this.clock()});
 }
 async review({id,reviewer,decision,reason}){
  const caseData=await this.store.get(id);
  if(!caseData||caseData.status!=='PENDING'||caseData.owner===reviewer||!reason)deny('review-ineligible');
  if(!await this.store.hasRole(reviewer,'NAME_REVIEWER'))deny('review-unauthorized');
  if(!['approve','reject'].includes(decision))deny('invalid-decision');
  if(caseData.requiresHeritageVerification&&!await this.store.hasHeritageEvidence(id))deny('heritage-not-verified');
  return this.store.finalizeOnce({id,reviewer,decision,reason,caseRevision:caseData.revision});
 }
 async usable(id){return (await this.store.get(id))?.status==='PUBLISHED';}
}
