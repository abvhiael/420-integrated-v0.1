import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseHTML} from 'linkedom';
import {
 SPORTS,providerEvent,fetchDailyFixtures,createMarqueeHandler,cachedLines
} from '../server/sportsbook-provider.mjs';
import {loadSportsbookLines,createSportsbookView} from '../src/sportsbook-ui.js';
import {onRequest as marqueeRoute} from '../functions/api/420bet/sportsbook/marquee.js';
import {onRequest as linesRoute} from '../functions/api/420bet/sportsbook/lines.js';
const now=Date.parse('2026-11-07T17:00:00Z');
const apiKey='TEST_ONLY_KEY_NOT_REAL_1234567';
const event=(sport_key,id,startsAt='2026-11-07T22:00:00Z')=>({
 id,sport_key,home_team:'Home '+id,away_team:'Away '+id,commence_time:startsAt
});
const headers={get:x=>x.toLowerCase()==='content-type'?'application/json':null};
function providerStub({failed=[]}={}){
 const seen=[];
 const fetcher=async(url,options)=>{
  const u=new URL(url);seen.push({u,options});
  assert.equal(u.hostname,'api.the-odds-api.com');
  assert.equal(u.searchParams.get('apiKey'),apiKey);
  assert(u.pathname.endsWith('/events'),'marquee MUST NOT call the quota-billed /odds endpoint');
  assert.equal(options.method,'GET');
  if(failed.includes(u.pathname))return{ok:false,headers};
  const kind=u.pathname.split('/')[3],i=SPORTS.findIndex(s=>s.key===kind);
  return{ok:true,headers,text:async()=>JSON.stringify([
   event(kind,'match-'+i),event(kind,'tomorrow-'+i,'2026-11-09T02:00:00Z')
  ])};
 };
 return{fetcher,seen};
}
test('Free provider event endpoints and Regina day filtering return at most four real matches',async()=>{
 const {fetcher,seen}=providerStub();
 const result=await fetchDailyFixtures(apiKey,{fetcher,now});
 assert.equal(seen.length,SPORTS.length);
 assert.equal(result.date,'2026-11-07');
 assert.equal(result.timezone,'America/Regina');
 assert.equal(result.source,'verified-sports-fixtures-v1');
 assert.equal(result.events.length,4);
 assert(result.events.every(x=>x.status==='scheduled'&&x.id.startsWith('match-')));
 assert(!JSON.stringify(result).includes(apiKey));
 assert(!JSON.stringify(result).includes('tomorrow'));
});
test('One unavailable sport does not invent results; all unavailable fails closed',async()=>{
 const failed=['/v4/sports/icehockey_nhl/events'];
 const {fetcher}=providerStub({failed});
 const result=await fetchDailyFixtures(apiKey,{fetcher,now});
 assert(!result.events.some(x=>x.league==='NHL'));
 const all=providerStub({failed:SPORTS.map(x=>'/v4/sports/'+x.key+'/events')});
 await assert.rejects(()=>fetchDailyFixtures(apiKey,{fetcher:all.fetcher,now}),/all fixture providers unavailable/);
 assert.equal(providerEvent(event('icehockey_nhl','x'),SPORTS[0]).league,'NHL');
 assert.equal(providerEvent(event('icehockey_nhl','x'),SPORTS[1]),null);
});
test('Cloudflare marquee keeps API key private, coalesces repeat reads and rejects bad requests',async()=>{
 const {fetcher,seen}=providerStub(),handler=createMarqueeHandler({fetcher,clock:()=>now});
 const req=new Request('https://420bet.420integrated.org/api/420bet/sportsbook/marquee');
 const ctx={request:req,env:{THE_ODDS_API_KEY:apiKey}};
 const results=await Promise.all([handler(ctx),handler(ctx)]);
 assert(results.every(x=>x.status===200));
 assert.equal(seen.length,SPORTS.length,'single shared provider batch');
 const body=await results[0].text();
 assert(!body.includes(apiKey));
 const p=JSON.parse(body);assert.equal(p.events.length,4);
 assert.equal(results[0].headers.get('Cache-Control'),'private, no-store');
 assert.equal((await handler({request:req,env:{}})).status,503);
 assert.equal((await handler({request:new Request(req.url,{method:'POST'}),env:ctx.env})).status,405);
 assert.equal((await handler({request:new Request(req.url+'?apiKey=leak'),env:ctx.env})).status,400);
});
test('Cache-only Game Lines never fetches expensive bookmaker odds on public request',async()=>{
 const req=new Request('https://420bet.420integrated.org/api/420bet/sportsbook/lines');
 assert.equal((await cachedLines({request:req,env:{}})).status,503);
 const price={source:'the-odds-api-v4-display-only',validUntil:now+8640000,events:[
  {id:'game-1',league:'NHL',home:'Home',away:'Away',startsAt:'2026-11-07T22:00:00Z',
   prices:[{bookmaker:'Sample bookmaker',outcome:'Home',american:-110,updatedAt:'2026-11-07T16:55:00Z'}]}
 ]};
 let calls=0;
 const kv={async get(key,type){calls++;assert.equal(key,'sportsbook:lines:v1');assert.equal(type,'json');return price;}};
 const res=await cachedLines({request:req,env:{SPORTSBOOK_ODDS_CACHE:kv}},{clock:()=>now});
 assert.equal(res.status,200);assert.equal(calls,1);
 const json=await res.json();
 assert.equal(json.events[0].prices[0].american,-110);
 assert.equal(json.authority,'provider-observed-not-wager-authority');
 const stale=await cachedLines({request:req,env:{SPORTSBOOK_ODDS_CACHE:{get:async()=>({...price,validUntil:now-1})}}},{clock:()=>now});
 assert.equal(stale.status,503);
});
test('Game Lines can display only validated cached bookmaker prices without transactional controls',async()=>{
 const {document}=parseHTML('<html><body></body></html>');
 const data={source:'the-odds-api-v4-display-only',authority:'provider-observed-not-wager-authority',
  validUntil:now+3600000,events:[{id:'event1',league:'NHL',home:'Home',away:'Away',
   startsAt:'2026-11-07T22:00:00Z',prices:[{bookmaker:'Example Book',outcome:'Away',american:125,updatedAt:null}]}]};
 const fetcher=async()=>({ok:true,headers:{get:()=> 'application/json'},json:async()=>data});
 const view=createSportsbookView(document,{tab:'game-lines',fetcher,clock:()=>now,autoRefresh:false});
 await view.ready;
 assert.equal(view.querySelectorAll('.sb-line-row').length,1);
 assert.match(view.querySelector('.sb-price').textContent,/\+125/);
 assert.equal(view.querySelectorAll('.sb-price button').length,0);
 assert.equal(view.dataset.transactions,'disabled');
 view.stopAnimation();
});
test('No odds or fixtures are copied into Vite static assets or browser-bundled keys',()=>{
 const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 const service=readFileSync(new URL('../server/sportsbook-provider.mjs',import.meta.url),'utf8');
 assert(main.includes('sportsbookLinesEndpoint'));
 assert(!main.includes('THE_ODDS_API_KEY'));
 assert(!service.includes('eth_sendTransaction'));
 assert(!service.includes('/odds?'));
 assert.equal(typeof marqueeRoute,'function');
 assert.equal(typeof linesRoute,'function');
});
