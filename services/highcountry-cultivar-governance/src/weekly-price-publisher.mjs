import {sevenDayQuote} from './cultivar-governance.mjs';
export class WeeklyNamingPricePublisher {
 constructor({feeds,store,publisher,clock=()=>Date.now(),decimals=18}){Object.assign(this,{feeds,store,publisher,clock,decimals});}
 async prepareWeek(endUtcMs){
  if(!Number.isSafeInteger(endUtcMs)||endUtcMs%604800000!==345600000)throw Error('not-fixed-utc-week-boundary');
  const inputs=await this.feeds.observations({from:endUtcMs-604800000,to:endUtcMs});
  if(!inputs?.attested||inputs.sources?.length<2)throw Error('unverified-oracle-sources');
  const quote=sevenDayQuote(inputs.points,{now:endUtcMs,decimals:this.decimals,minSamples:24,staleMs:3600000n});
  return {weekEnd:endUtcMs,quote,sourceProof:inputs.proof,sourceIds:inputs.sources,version:'HC-CULTIVAR-NAME-FEE-V2'};
 }
 async activate(prepared,approval){
  if(!approval?.independentlyAuthorized||!prepared?.sourceProof)throw Error('approval-required');
  const prior=await this.store.week(prepared.weekEnd);
  if(prior)throw Error('duplicate-week');
  await this.publisher.publish(prepared);
  await this.store.commitWeek(prepared);
  return prepared;
 }
}
