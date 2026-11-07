import test from 'node:test';
import assert from 'node:assert/strict';
import {SportsbookOddsBudget,normalizeBookmakerOdds} from '../worker/odds-budget.js';
import {SPORTS,fetchDailyFixtures} from '../server/sportsbook-provider.mjs';
import {validateSportsbookMarquee} from '../src/sportsbook-ui.js';
const t0=Date.parse('2026-11-07T18:00:00Z');
const key='TEST_CREDENTIAL_DUMMY_1234567';
const headers=new Map([['content-type','application/json'],['x-requests-remaining','480']]);
const event=(sport,id,start='2026-11-07T23:00:00Z')=>({
 id,sport_key:sport,home_team:'Home '+id,away_team:'Away '+id,commence_time:start
});
const priceEvent=(sport,id)=>({...event(sport,id),bookmakers:[{
 title:'Verified Book',markets:[{key:'h2h',last_update:'2026-11-07T17:55:00Z',outcomes:[
 {name:'Home '+id,price:-110},{name:'Away '+id,price:+125}
 ]}]
}]});
const fakeStore=()=>{const map=new Map();return{map,async get(k){return map.get(k);},async put(k,v){map.set(k,structuredClone(v));}};};
const req=new Request('https://internal.invalid/internal/read-lines');
function makeDO(now=t0,{upstreamFailure=false,remaining='480'}={}){
 const storage=fakeStore();
 const obj=new SportsbookOddsBudget({storage},{THE_ODDS_API_KEY:key});
 let calls=[];
 obj.clock=()=>now;
 obj.fetcher=async(url,opts)=>{
  const u=new URL(url);calls.push(u);
  assert.equal(u.hostname,'api.the-odds-api.com');
  assert.equal(u.searchParams.get('apiKey'),key);
  assert.equal(u.searchParams.get('regions'),'us');
  assert.equal(u.searchParams.get('markets'),'h2h');
  assert.equal(u.searchParams.get('oddsFormat'),'american');
  if(upstreamFailure)return {ok:false,headers:{get:()=>null}};
  const sport=u.pathname.split('/')[3];
  return {ok:true,headers:{get:k=>k.toLowerCase()==='x-requests-remaining'?remaining:headers.get(k.toLowerCase())||null},
   text:async()=>JSON.stringify([priceEvent(sport,'real-'+sport)])};
 };
 return{obj,storage,calls,advance:next=>{now=next;},getNow:()=>now};
}
test('Provider moneyline normalization accepts verified bookmaker format and rejects ambiguous decimals',()=>{
 const p=normalizeBookmakerOdds(priceEvent(SPORTS[0].key,'match1'),SPORTS[0]);
 assert.equal(p.prices.length,2);
 assert.equal(p.prices[0].american,-110);
 assert.equal(p.prices[1].american,125);
 const bad=priceEvent(SPORTS[0].key,'match1');bad.bookmakers[0].markets[0].outcomes[0].price=1.91;
 assert.equal(normalizeBookmakerOdds(bad,SPORTS[0]).prices.length,1);
});
test('One globally serialized DO spends at most five credits every 12h, not per visitor',async()=>{
 const {obj,calls,storage}=makeDO();
 const responses=await Promise.all(Array.from({length:15},()=>obj.fetch(req)));
 assert(responses.every(x=>x.status===200));
 assert.equal(calls.length,SPORTS.length,'requests must coalesce');
 const result=await responses[0].json();
 assert.equal(result.events.length,SPORTS.length);
 assert(!JSON.stringify(result).includes(key));
 assert.equal(result.authority,'provider-observed-not-wager-authority');
 assert.equal((await storage.get('monthly-budget')).spent,SPORTS.length);
 await obj.fetch(req);
 assert.equal(calls.length,SPORTS.length,'12h cache hit must be free');
});
test('Half-day recheck and monthly cap cannot be evaded by traffic, restarts or repeated failure',async()=>{
 const d=makeDO();
 await d.obj.fetch(req);
 d.advance(t0+12*3600000+1000);
 let res=await d.obj.fetch(req);
 assert.equal(res.status,200);
 assert.equal(d.calls.length,10);
 assert.equal((await d.storage.get('monthly-budget')).spent,10);
 await d.storage.put('monthly-budget',{month:'2026-11',spent:350,blocked:false});
 d.advance(t0+25*3600000);
 const fresh=new SportsbookOddsBudget({storage:d.storage},{THE_ODDS_API_KEY:key});
 fresh.clock=d.getNow;
 fresh.fetcher=d.obj.fetcher;
 res=await fresh.fetch(req);
 assert.equal(res.status,503,'stale prices cannot be served after hard budget cap');
 assert.equal(d.calls.length,10,'no paid calls after limit');
 assert.equal((await d.storage.get('monthly-budget')).spent,350);
});
test('Provider remaining credits near free tier safety margin blocks subsequent fetches',async()=>{
 const d=makeDO(t0,{remaining:'149'});
 const first=await d.obj.fetch(req);
 assert.equal(first.status,200);
 assert.equal(d.calls.length,1,'provider remaining-credits header must stop subsequent sports');
 assert.equal((await d.storage.get('monthly-budget')).blocked,true);
});
test('Provider errors reserve cost and throttle retry instead of allowing visitor-triggered bursts',async()=>{
 const d=makeDO(t0,{upstreamFailure:true});
 const a=await d.obj.fetch(req);
 assert.equal(a.status,200); // stable empty slate is valid, no invented prices
 const calls=d.calls.length;
 await d.obj.fetch(req);
 assert.equal(d.calls.length,calls,'failed source cannot retry on every page hit');
 assert.equal((await d.storage.get('monthly-budget')).spent,calls);
});
test('Marquee includes next-day games and labels unverified start time honestly',async()=>{
 const start='2026-11-08T21:00:00Z';
 const fixtureFetch=async url=>{
  const sport=new URL(url).pathname.split('/')[3];
  return {ok:true,headers:{get:k=>k.toLowerCase()==='content-type'?'application/json':null},
   text:async()=>JSON.stringify([event(sport,'tomorrow-'+sport,start)])};
 };
 const feed=await fetchDailyFixtures(key,{fetcher:fixtureFetch,now:t0});
 assert.equal(feed.events.length,4);
 assert(feed.events.every(e=>e.id.startsWith('tomorrow-')));
 assert(feed.events.every(e=>e.status==='scheduled'));
 assert.equal(validateSportsbookMarquee(feed,t0).events.length,4);
 const past='2026-11-07T17:00:00Z';
 const startFeed=await fetchDailyFixtures(key,{fetcher:async url=>{
  const sport=new URL(url).pathname.split('/')[3];
  return {ok:true,headers:{get:k=>k.toLowerCase()==='content-type'?'application/json':null},
   text:async()=>JSON.stringify([event(sport,'started-'+sport,past)])};
 },now:t0});
 assert(startFeed.events.every(e=>e.status==='start-time-passed'));
 assert.equal(validateSportsbookMarquee(startFeed,t0).events.length,4);
});
