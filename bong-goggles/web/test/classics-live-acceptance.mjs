// BC-0.12 independent-account LIVE acceptance. No simulation or fixtures.
// Each title needs a real game-specific adapter; none are installed by BC-0.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {CLASSIC_ROADMAP} from '../core/classics.js';
const ORIGIN='https://bonggoggles.420integrated.org';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const cookie=/^([A-Za-z0-9_-]{1,80})=([^;\s]{1,4096})$/;
const game=process.env.BC12_GAME_ID;
const sha=process.env.BC12_EXPECTED_SHA;
const rulesHash=process.env.BC12_EXPECTED_RULES_HASH;
if(!CLASSIC_ROADMAP.some(x=>x.id===game)||!/^[a-f0-9]{40}$/.test(sha||'')||
 !/^[a-f0-9]{64}$/.test(rulesHash||''))
 throw Error('BC-0.12 live denied: unknown game, unpinned source or ruleset hash');
const values=[process.env.BC12_ACCOUNT_A_COOKIE,process.env.BC12_ACCOUNT_B_COOKIE];
const keys=values.map(value=>cookie.exec(value??''));
if(keys.some(x=>!x)||keys[0][1]!==keys[1][1]||keys[0][2]===keys[1][2])
 throw Error('BC-0.12 live denied: two distinct authorized 420ID browser cookie secrets required');
const adapterUrl=new URL('./live-classics/'+game+'.mjs',import.meta.url);
try{await readFile(fileURLToPath(adapterUrl))}
catch{throw Error('BC-0.12 live denied: no separately qualified game-specific end-to-end adapter for '+game)}
const adapter=await import(adapterUrl.href);
if(typeof adapter.playToMidpoint!=='function'||typeof adapter.finishAfterReload!=='function'||
 typeof adapter.runBotDifficulty!=='function')
 throw Error('BC-0.12 live denied: incomplete real-match adapter for '+game);
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
let contexts=[];
const request=async (page,path,method='GET',body=null)=>page.evaluate(async ({path,method,body})=>{
 if(!/^\/social-api\/v1\/[a-z0-9/-]+$/.test(path))throw Error('cross-origin or invalid API route');
 const res=await fetch(path,{credentials:'same-origin',redirect:'error',cache:'no-store',
  method,headers:{Accept:'application/json',...(body?{'Content-Type':'application/json'}:{})},
  body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15_000)});
 const text=await res.text();
 let data;try{data=JSON.parse(text)}catch{throw Error('Non-JSON account service response '+res.status)}
 return {status:res.status,data};
},{path,method,body});
try{
 const pages=[];
 for(let i=0;i<2;i++){
  const context=await browser.newContext({viewport:i?{width:390,height:844}:{width:1280,height:800}});
  contexts.push(context);
  await context.addCookies([{name:keys[i][1],value:keys[i][2],
   url:ORIGIN,secure:true,httpOnly:true,sameSite:'Strict'}]);
  const page=await context.newPage();
  await page.goto(ORIGIN+'/games/'+game+'/play',{waitUntil:'domcontentloaded',timeout:30_000});
  await page.locator('main').waitFor({timeout:20_000});
  pages.push(page);
 }
 const principals=[];
 for(const page of pages){
  const me=await request(page,'/social-api/v1/me');
  const subject=me.data?.profile?.subject;
  if(me.status!==200||!uuid.test(subject)||me.data?.walletRequired!==false)
   throw Error('BC-0.12 live denied: 420ID did not authenticate independent account');
  principals.push(subject);
 }
 if(principals[0]===principals[1])throw Error('BC-0.12 live denied: two browser sessions share a 420ID subject');
 const io={pages,request,game,sourceSha:sha}; // Cookie and subjects are NOT sent to adapters.
 const mid=await adapter.playToMidpoint(io);
 if(!uuid.test(mid?.sessionId)||!Number.isSafeInteger(mid.sequence)||mid.sequence<2)
  throw Error('BC-0.12 live denied: invalid game-specific intermediate match');
 for(let i=0;i<2;i++){
  const result=await request(pages[i],'/social-api/v1/classic-sessions/'+mid.sessionId);
  if(result.status!==200||result.data?.session?.sequence!==mid.sequence||
     result.data.session.viewerSeat!==i||result.data.session.status!=='active'||
     result.data.session.gameId!==game||result.data.session.rulesHash!==rulesHash)
   throw Error('BC-0.12 live denied: unverified per-seat midgame snapshot');
 }
 // Actual page reload and cold per-seat server resumption, not local mocks.
 for(const page of pages){
  await page.reload({waitUntil:'domcontentloaded',timeout:30_000});
  const s=await request(page,'/social-api/v1/classic-sessions/'+mid.sessionId);
  if(s.status!==200||s.data?.session?.sequence!==mid.sequence||s.data.session.status!=='active'||
   s.data.session.gameId!==game||s.data.session.rulesHash!==rulesHash)
   throw Error('BC-0.12 live denied: session did not survive device reload');
 }
 await adapter.finishAfterReload({...io,sessionId:mid.sessionId,expectedSequence:mid.sequence});
 const final=[];
 for(const page of pages){
  const r=await request(page,'/social-api/v1/classic-sessions/'+mid.sessionId);
  if(r.status!==200||r.data?.session?.status!=='finished'||r.data?.session?.sequence<=mid.sequence||
   r.data.session.gameId!==game||r.data.session.rulesHash!==rulesHash)
   throw Error('BC-0.12 live denied: no authoritative terminal match');
  final.push(r.data.session);
 }
 if(final[0].sequence!==final[1].sequence||final[0].viewerSeat===final[1].viewerSeat||
  JSON.stringify(final[0].privateView)===JSON.stringify(final[1].privateView))
  throw Error('BC-0.12 live denied: cross-seat session or private projection mismatch');
 for(const difficulty of ['easy','medium','hard']){
  const result=await adapter.runBotDifficulty({...io,difficulty});
  if(result?.difficulty!==difficulty||result?.status!=='finished'||result?.authoritative!==true)
   throw Error('BC-0.12 live denied: incomplete server-side '+difficulty+' AI match');
 }
 let mixedFormats=null;
 if(game==='labyrinth-cribbage'){
  if(typeof adapter.runMixedFormats!=='function')
   throw Error('BC-2.8 live denied: missing complete 3/4-player mixed-420ID acceptance');
  mixedFormats=await adapter.runMixedFormats(io);
  if(mixedFormats?.status!=='finished'||mixedFormats.authoritative!==true||
   mixedFormats.formats?.join('|')!==
    'labyrinth-3p|labyrinth-4p-partners|labyrinth-4p-individual')
   throw Error('BC-2.8 live denied: incomplete mixed 325-point results');
 }
 console.log('BC-0.12 LIVE VERIFIED two authenticated separate accounts, desktop/mobile, reload, terminal, three AI tiers',JSON.stringify({
  game,sourceSha:sha,rulesHash,terminalSequence:final[0].sequence,botLevels:3,
  mixedFormats:mixedFormats?.formats??[]}));
}finally{for(const c of contexts)await c.close();await browser.close()}
