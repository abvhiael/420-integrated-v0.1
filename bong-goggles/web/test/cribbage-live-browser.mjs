// BC-1.5 real Chromium browser-context test: distinct HTTP-only 420ID cookies,
// authenticated host start, separate private hands, full reload and recovery.
// HTTP responses are deterministic server fixtures; actual PostgreSQL/420ID
// end-to-end authority is separately exercised in TestBC15* Go integration.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';

const basePath=resolve(import.meta.dirname,'..');
const port=Number(process.env.BC15_PORT||41920),base='http://127.0.0.1:'+port;
const server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1','--directory',basePath],{stdio:'ignore'});
let browser;
const host='10000000-1111-4111-8111-111111111111',peer='20000000-2222-4222-8222-222222222222';
const roomID='30000000-3333-4333-8333-333333333333',id='40000000-4444-4444-8444-444444444444';
const hash='6f13bd77568efc5d0836eaa61458ca0cc2c500d1db2d9c38e228b1c668f71e24';
const privateHands=[[0,5,14,25,38,49],[2,11,23,26,41,50]];
const room={
 id:roomID,host,gameId:'cribbage',seatCount:2,status:'ready',revision:3,visibility:'public',
 seats:[{index:0,controller:'human',subject:host,team:0,difficulty:''},
        {index:1,controller:'human',subject:peer,team:1,difficulty:''}],invites:[]
};
const summary={id,roomId:roomID,gameId:'cribbage',seatCount:2,
 status:'active',sequence:1,rulesVersion:'v1.0',rulesHash:hash,turnSeat:0};
function snapshot(i){
 const hand=privateHands[i],result={...summary,viewerSeat:i,deadline:'2026-11-22T21:00:00Z',
  winnerSeat:null,privateView:{
   gameId:'cribbage',variant:'standard-2p',round:1,phase:'discard',dealer:1,turn:0,seat:i,
   scores:[0,0],hand,cardCounts:[6,6],cribCount:0,discarded:[false,false],
   starter:-1,pegCount:0,pegPile:[],pegged:[[],[]],saidGo:[false,false],
   lastShow:[],lastAwards:[],losers:[],winner:null
  }};
 return result;
}
const envelope=(body,status=200)=>({status,contentType:'application/json; charset=utf-8',
 body:JSON.stringify({...body,onChain:false,wager:false,rewards:false})});
try{
 for(let k=0;k<60;k++){
  try{if((await fetch(base+'/index.html')).ok)break;}catch{}
  if(k===59)throw Error('BC-1.5 web fixture unavailable');
  await delay(100);
 }
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const contexts=[],pages=[];
 for(const [i,actor] of [host,peer].entries()){
  const ctx=await browser.newContext({viewport:i?{width:390,height:844}:{width:1500,height:900}});
  contexts.push(ctx);
  await ctx.addCookies([{name:'bc15_account',value:actor,url:base,httpOnly:true,sameSite:'Lax'}]);
  let starts=0;
  await ctx.route('**/app.js',route=>route.fulfill({status:200,contentType:'text/javascript',body:''}));
  await ctx.route('**/social-api/**',async route=>{
   const request=route.request(),pathname=new URL(request.url()).pathname;
   assert.ok((request.headers().cookie||'').includes('bc15_account='+actor),'cross-account cookie sharing');
   let response;
   if(pathname==='/social-api/v1/me')response=envelope({walletRequired:false,profile:{subject:actor}});
   else if(pathname==='/social-api/v1/classic-sessions'&&request.method()==='POST'){
    starts++;response=i===0?envelope({session:snapshot(i)},201):envelope({error:'not host'},404);
   }else if(pathname==='/social-api/v1/classic-sessions'&&request.method()==='GET')
    response=envelope({sessions:[summary]});
   else if(pathname==='/social-api/v1/classic-sessions/'+id)
    response=envelope({session:snapshot(i)});
   else response=envelope({error:'not found'},404);
   await route.fulfill(response);
  });
  const page=await ctx.newPage();pages.push(page);
  await page.goto(base+'/index.html',{waitUntil:'domcontentloaded'});
  const setup=await page.evaluate(async ({room,actor})=>{
   const {renderClassicRooms}=await import('/core/classic-rooms.js');
   const {bindCribbageRoomStart}=await import('/core/classic-cribbage-multiplayer.js');
   const {createAccountSocialClient}=await import('/core/account-social.js');
   document.body.innerHTML='<main id="bc15">'+renderClassicRooms({
    status:'ready',viewer:actor,rooms:[],friends:[],selected:room
   },{enabled:true,roomId:room.id})+'</main>';
   const c={client:createAccountSocialClient({enabled:true}),
    state:{status:'ready',viewer:actor,selected:room},emit(next){this.state=next}};
   bindCribbageRoomStart(document.querySelector('#bc15'),c,{
    history:window.history,onRouteChange:()=>{window.__bc15Started=true;}
   });
   return {startVisible:!!document.querySelector('[data-cribbage-room-start]'),
    httpOnlyCookieHidden:!document.cookie.includes('bc15_account')};
  },{room,actor});
  assert.equal(setup.startVisible,i===0,'host-only start not enforced visually');
  assert.ok(setup.httpOnlyCookieHidden,'HTTP-only identity cookie exposed to DOM');
  if(i===0){
   await page.locator('[data-cribbage-room-start] button').click();
   await page.waitForFunction(()=>window.__bc15Started===true);
   assert.match(page.url(),new RegExp(id+'$'));
  }else assert.equal(starts,0,'peer unexpectedly started the match');
  // A fresh tab reload must reconstruct the match ONLY by authenticated
  // participation listing + GET /session. Browser storage is not authority.
  await page.goto(base+'/index.html',{waitUntil:'domcontentloaded'});
  const actual=await page.evaluate(async id=>{
   const {CribbageSessionController}=await import('/core/cribbage-session.js');
   const {discoverCribbageMatches}=await import('/core/classic-cribbage-multiplayer.js');
   const {renderCribbageRoute}=await import('/core/cribbage-ui.js');
   const {cribbageNewPegs}=await import('/core/cribbage-board.js');
   const c=new CribbageSessionController({enabled:true});
   const matches=await discoverCribbageMatches(c);
   if(matches.length!==1||matches[0].id!==id)throw Error('cold match listing unavailable');
   const found=await c.open(id);
   if(found.status!=='ready')throw Error('cold private seat view unavailable');
   document.body.innerHTML='<main id="bc15">'+renderCribbageRoute({screen:'play',state:found})+'</main>';
   window.__bc15Controller=c;
   return {seat:found.session.viewerSeat,own:found.session.privateView.hand,
    cards:[...document.querySelectorAll('[data-cribbage-card]')].map(x=>Number(x.dataset.cribbageCard)),
    html:document.querySelector('#bc15').innerHTML,
    overflow:document.documentElement.scrollWidth>innerWidth+2};
  },id);
  assert.equal(actual.seat,i,'cross-account projection');
  assert.deepEqual(actual.own,privateHands[i],'wrong private hand after reload');
  assert.deepEqual(actual.cards,privateHands[i],'opponent cards leaked into controls');
  assert.ok(!actual.html.includes('"deck"')&&!actual.html.includes('"seed"'));
  assert.ok(!actual.overflow,'mobile match overflow');
  const renewed=await page.evaluate(async matchId=>{
   const c=window.__bc15Controller;
   c.invalidate();
   const state=await c.open(matchId);
   return {status:state.status,seat:state.session?.viewerSeat,
    own:state.session?.privateView.hand};
  },id);
  assert.equal(renewed.status,'ready');
  assert.equal(renewed.seat,i);
  assert.deepEqual(renewed.own,privateHands[i]);
  console.log('BC-1.5 Chromium separate account '+(i+1)+': authenticated '+(i===0?'host start':'nonhost')+
   ', private cards and cold reconnect PASS');
 }
 assert.notDeepEqual(privateHands[0],privateHands[1]);
 console.log('BC-1.5 two truly separate browser contexts/HTTP-only cookies PASS');
 for(const ctx of contexts)await ctx.close();
}finally{
 if(browser)await browser.close();
 server.kill('SIGTERM');
}
