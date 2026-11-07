// 420Bet read-only odds-provider adapter. No credentials, quote signatures,
// wager authorization or market settlement may enter the browser.
export const ODDS_API_HOST='https://api.the-odds-api.com';
export const SPORTS=Object.freeze([
 Object.freeze({key:'icehockey_nhl',label:'NHL',priority:0}),
 Object.freeze({key:'basketball_nba',label:'NBA',priority:1}),
 Object.freeze({key:'americanfootball_nfl',label:'NFL',priority:2}),
 Object.freeze({key:'baseball_mlb',label:'MLB',priority:3}),
 Object.freeze({key:'soccer_usa_mls',label:'MLS',priority:4})
]);
const ZONE='America/Regina',MAX_BYTES=150000;
const secureHeaders=Object.freeze({
 'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store',
 'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',
 'Content-Security-Policy':"default-src 'none'"
});
const safeText=(s,max=65)=>typeof s==='string'&&s.length>0&&s.length<=max&&!/[<>\x00-\x1f]/.test(s);
const validTime=x=>typeof x==='string'&&Number.isFinite(Date.parse(x))&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(x);
const day=(at,zone=ZONE)=>new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'2-digit',day:'2-digit',timeZone:zone}).format(at);
const response=(status,body)=>new Response(JSON.stringify(body),{status,headers:secureHeaders});
const isArray=x=>Array.isArray(x)&&x.length<=1000;
export function providerEvent(raw,kind){
 if(!raw||typeof raw!=='object'||!safeText(raw.id,96)||!safeText(raw.home_team)||
    !safeText(raw.away_team)||raw.home_team===raw.away_team||
    raw.sport_key!==kind.key||!validTime(raw.commence_time))return null;
 return {id:raw.id,league:kind.label,home:raw.home_team,away:raw.away_team,
   startsAt:raw.commence_time};
}
function providerUrl(path,apiKey,params={}){
 if(typeof apiKey!=='string'||apiKey.length<16||apiKey.length>512||!/^[a-zA-Z0-9_-]+$/.test(apiKey))
  throw Error('sports provider credentials unavailable');
 const u=new URL(path,ODDS_API_HOST);
 u.searchParams.set('apiKey',apiKey);
 for(const [key,val] of Object.entries(params))u.searchParams.set(key,val);
 return u.toString();
}
async function upstreamJSON(url,{fetcher=globalThis.fetch,timeout=6500}={}){
 const ctrl=new AbortController();
 const timer=setTimeout(()=>ctrl.abort(),timeout);
 try{
  const res=await fetcher(url,{method:'GET',redirect:'error',cache:'no-store',
   signal:ctrl.signal,headers:{Accept:'application/json'}});
  if(!res?.ok||!/^application\/json(?:\s*;|$)/i.test(res.headers?.get?.('Content-Type')||''))
   throw Error('provider unavailable');
  const length=Number(res.headers?.get?.('Content-Length')||0);
  if(!Number.isFinite(length)||length>MAX_BYTES)throw Error('provider response oversized');
  const text=await res.text();
  if(text.length>MAX_BYTES)throw Error('provider response oversized');
  const data=JSON.parse(text);
  if(!isArray(data))throw Error('provider schema rejected');
  return {data,headers:res.headers};
 }finally{clearTimeout(timer);}
}
export async function fetchDailyFixtures(apiKey,{fetcher=globalThis.fetch,now=Date.now()}={}){
 // No quota cost for /sports/{sport}/events. Explicitly prefer free events
 // over odds endpoints for the marquee. Only future scheduled fixtures:
 // start time does NOT independently prove that a game is currently live.
 const currentDay=day(now),results=await Promise.allSettled(SPORTS.map(async kind=>{
  const url=providerUrl('/v4/sports/'+kind.key+'/events',apiKey);
  const {data}=await upstreamJSON(url,{fetcher});
  return data.flatMap(item=>{const mapped=providerEvent(item,kind);
   return mapped&&day(Date.parse(mapped.startsAt))===currentDay&&Date.parse(mapped.startsAt)>=now-120000
    ?[{...mapped,priority:kind.priority}]:[];});
 }));
 if(!results.some(x=>x.status==='fulfilled'))throw Error('all fixture providers unavailable');
 const seen=new Set();
 const events=results.flatMap(x=>x.status==='fulfilled'?x.value:[])
  .sort((a,b)=>Date.parse(a.startsAt)-Date.parse(b.startsAt)||a.priority-b.priority)
  .filter(e=>{if(seen.has(e.id))return false;seen.add(e.id);return true;})
  .slice(0,4).map(({priority,...e})=>({...e,status:'scheduled'}));
 return {
  source:'verified-sports-fixtures-v1',authority:'verified',
  date:currentDay,timezone:ZONE,
  observedAt:new Date(now).toISOString(),expiresAt:new Date(now+12*60000).toISOString(),
  events
 };
}
const cache=new Map();
function memoized(key,fn,clock,ttl=10*60000){
 const prev=cache.get(key);
 if(prev&&prev.until>clock())return prev.promise;
 const promise=Promise.resolve().then(fn);
 cache.set(key,{until:clock()+ttl,promise});
 promise.catch(()=>{if(cache.get(key)?.promise===promise)cache.delete(key);});
 return promise;
}
export function createMarqueeHandler({fetcher=globalThis.fetch,clock=()=>Date.now()}={}){
 return async function handle(context){
  const req=context.request;
  if(req.method!=='GET')return response(405,{error:'method_not_allowed'});
  const parsed=new URL(req.url);
  if(parsed.pathname!=='/api/420bet/sportsbook/marquee'||parsed.search||parsed.hash)
   return response(400,{error:'invalid_request'});
  const secret=context.env?.THE_ODDS_API_KEY;
  if(typeof secret!=='string'||secret.length<16)
   return response(503,{error:'sports_feed_not_configured'});
  try{
   const result=await memoized('marquee:'+secret,()=>fetchDailyFixtures(secret,{fetcher,now:clock()}),clock);
   // Refresh observedAt from actual upstream fetch; never mislabel old cached data
   // as freshly fetched or extend its original expiry.
   if(Date.parse(result.expiresAt)<=clock())throw Error('cached source expired');
   return response(200,result);
  }catch{return response(503,{error:'sports_feed_unavailable'});}
 };
}
// Odds never trigger provider requests from public web traffic. A separate
// authorized budgeted scheduler must populate SPORTSBOOK_ODDS_CACHE KV.
// This prevents uncontrolled global cold-cache bursts consuming 500 credits.
export async function cachedLines(context,{clock=()=>Date.now()}={}){
 const req=context.request;
 if(req.method!=='GET')return response(405,{error:'method_not_allowed'});
 const u=new URL(req.url);
 if(u.pathname!=='/api/420bet/sportsbook/lines'||u.search||u.hash)
  return response(400,{error:'invalid_request'});
 const kv=context.env?.SPORTSBOOK_ODDS_CACHE;
 if(!kv||typeof kv.get!=='function')return response(503,{error:'odds_cache_not_configured'});
 try{
  const data=await kv.get('sportsbook:lines:v1','json');
  if(!data||data.source!=='the-odds-api-v4-display-only'||!Number.isSafeInteger(data.validUntil)||
   clock()>=data.validUntil||clock()+86400000<data.validUntil||!Array.isArray(data.events)||data.events.length>100)
   throw Error('missing or stale cache');
  const events=data.events.map(x=>{
   if(!x||!safeText(x.id,96)||!safeText(x.league,20)||!safeText(x.home)||!safeText(x.away)||
      !validTime(x.startsAt)||!Array.isArray(x.prices)||x.prices.length>8)throw Error('bad price schema');
   return {id:x.id,league:x.league,home:x.home,away:x.away,startsAt:x.startsAt,
    prices:x.prices.map(p=>{
     if(!p||!safeText(p.bookmaker,50)||!safeText(p.outcome,65)||
        !Number.isFinite(p.american)||p.american===0||Math.abs(p.american)>100000)
      throw Error('bad odds');
     return {bookmaker:p.bookmaker,outcome:p.outcome,american:p.american,
      updatedAt:validTime(p.updatedAt)?p.updatedAt:null};
    })};
  });
  return response(200,{source:'the-odds-api-v4-display-only',authority:'provider-observed-not-wager-authority',
   validUntil:data.validUntil,events});
 }catch{return response(503,{error:'verified_odds_not_available'});}
}
