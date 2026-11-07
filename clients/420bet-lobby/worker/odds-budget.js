// Global, persistent, single-owner free-tier odds quota and display cache.
// One Cloudflare Durable Object instance named "420bet-free-odds-v1" serializes
// budget reservation and avoids a public request burst across Worker isolates.
// This is read-only bookie observation, NEVER a 420Bet wagering quote.
import {SPORTS,ODDS_API_HOST,providerEvent} from '../server/sportsbook-provider.mjs';
const MONTHLY_BUDGET=350; // cap below free subscription's 500 credits; leaves buffer
const MIN_RECHECK_MS=12*60*60*1000; // 5 sports x 2/day < 350/month
const MAX_RESPONSE=650000;
const responses={'Content-Type':'application/json; charset=utf-8',
 'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
const reply=(code,data)=>new Response(JSON.stringify(data),{status:code,headers:responses});
const safeText=(s,n=65)=>typeof s==='string'&&s.length>0&&s.length<=n&&!/[<>\x00-\x1f]/.test(s);
const iso=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(x)&&Number.isFinite(Date.parse(x));
const month=now=>new Date(now).toISOString().slice(0,7);
const decimalToAmerican=n=>n>=2?Math.round((n-1)*100):Math.round(-100/(n-1));
const american=n=>Number.isFinite(n)&&Math.abs(n)>=100&&Math.abs(n)<=100000?Math.round(n):null;
function oddsValue(price){
 if(typeof price!=='number'||!Number.isFinite(price))return null;
 // Request oddsFormat=american, so reject ambiguous decimal-format values.
 return american(price);
}
export function normalizeBookmakerOdds(raw,sport){
 const base=providerEvent(raw,sport);
 if(!base||!Array.isArray(raw.bookmakers))return null;
 const prices=[];
 for(const book of raw.bookmakers.slice(0,8)){
  if(!safeText(book.title,50)||!Array.isArray(book.markets))continue;
  const market=book.markets.find(x=>x.key==='h2h'&&Array.isArray(x.outcomes));
  if(!market)continue;
  for(const item of market.outcomes.slice(0,2)){
   const value=oddsValue(item.price);
   if(!safeText(item.name)||value===null)continue;
   prices.push({bookmaker:book.title,outcome:item.name,american:value,
    updatedAt:iso(market.last_update)?market.last_update:null});
   if(prices.length===8)break;
  }
  if(prices.length===8)break;
 }
 return prices.length?{...base,prices}:null;
}
async function getOdds(kind,secret,fetcher){
 const url=new URL('/v4/sports/'+kind.key+'/odds',ODDS_API_HOST);
 url.searchParams.set('apiKey',secret);
 url.searchParams.set('regions','us');
 url.searchParams.set('markets','h2h');
 url.searchParams.set('oddsFormat','american');
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),7000);
 try{
  const res=await fetcher(url.toString(),{method:'GET',cache:'no-store',redirect:'error',
   headers:{Accept:'application/json'},signal:ctrl.signal});
  if(!res?.ok||!/^application\/json(?:;|$)/i.test(res.headers.get('content-type')||''))
   throw Error('odds provider unavailable');
  const limit=Number(res.headers.get('content-length')||0);
  if(limit>MAX_RESPONSE)throw Error('oversized response');
  const txt=await res.text();
  if(txt.length>MAX_RESPONSE)throw Error('oversized response');
  const parsed=JSON.parse(txt);
  if(!Array.isArray(parsed)||parsed.length>250)throw Error('odds schema invalid');
  const remaining=res.headers.get('x-requests-remaining');
  return {
   events:parsed.map(item=>normalizeBookmakerOdds(item,kind)).filter(Boolean).slice(0,24),
   remaining:remaining!==null&&/^\d+$/.test(remaining)?Number(remaining):null
  };
 }finally{clearTimeout(timer);}
}
export class SportsbookOddsBudget{
 constructor(ctx,env){
  this.ctx=ctx;this.env=env;this.inflight=null;
  this.fetcher=globalThis.fetch;
  this.clock=()=>Date.now();
 }
 async fetch(request){
  if(request.method!=='GET'||new URL(request.url).pathname!=='/internal/read-lines')
   return reply(404,{error:'not_found'});
  if(this.inflight)return this.inflight;
  const job=this.readLines();
  this.inflight=job;
  try{return await job;}finally{if(this.inflight===job)this.inflight=null;}
 }
 async readLines(){
  const now=this.clock(),secret=this.env?.THE_ODDS_API_KEY;
  if(typeof secret!=='string'||secret.length<16)return reply(503,{error:'sports_feed_not_configured'});
  const storage=this.ctx.storage;
  // A single global instance owns quota across Cloudflare regions and requests.
  const period=month(now);
  let budget=await storage.get('monthly-budget');
  if(!budget||budget.month!==period)budget={month:period,spent:0,blocked:false};
  const all=[];
  let freshest=0;
  for(const sport of SPORTS){
   const key='odds:'+sport.key;
   let record=await storage.get(key);
   if(!record||typeof record!=='object')record=null;
   if(!record||record.nextFetchAt<=now){
    if(budget.blocked||budget.spent>=MONTHLY_BUDGET){
     // No more chargeable requests without explicit budget renewal.
     record=null;
    }else{
     // Reserve *before* upstream call, even if provider times out.
     // No retry inside same 12-hour window. Persist the reservation first.
     budget.spent++;
     await storage.put('monthly-budget',budget);
     record={fetchedAt:now,nextFetchAt:now+MIN_RECHECK_MS,events:[]};
     await storage.put(key,record);
     try{
      const result=await getOdds(sport,secret,this.fetcher);
      record={...record,events:result.events};
      if(result.remaining!==null&&result.remaining<150){
       budget.blocked=true;
       await storage.put('monthly-budget',budget);
      }
      await storage.put(key,record);
     }catch{
      // Never fall back to invented odds or retry immediately on page hits.
     }
    }
   }
   if(record&&record.fetchedAt+MIN_RECHECK_MS>now&&Array.isArray(record.events)){
    freshest=Math.max(freshest,record.fetchedAt);
    all.push(...record.events);
   }
  }
  if(!freshest)return reply(503,{error:'odds_budget_or_provider_unavailable'});
  // All published odds stay strictly read-only, with their original update
  // times so users can recognize delayed observations. No betting actions.
  return reply(200,{source:'the-odds-api-v4-display-only',
   authority:'provider-observed-not-wager-authority',
   validUntil:Math.min(now+10*60000,...SPORTS.map(s=>now+10*60000)),
   observedAt:new Date(freshest).toISOString(),events:all.slice(0,60),
   displayNotice:'Delayed bookmaker observations only — betting disabled'});
 }
}
