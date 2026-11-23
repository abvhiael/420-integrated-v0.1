// BC-1.7: real Chromium desktop/mobile isolation, keyboard, axe and
// HTTP-only 420ID transport fixture. PostgreSQL rules/authority and true
// deployed two-account acceptance are tested independently (never conflated).
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';

const root=resolve(import.meta.dirname,'..');
const port=Number(process.env.BC17_PORT||41927),base='http://127.0.0.1:'+port;
const server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1','--directory',root],{stdio:'ignore'});
const host='10000000-1111-4111-8111-111111111111',peer='20000000-2222-4222-8222-222222222222';
const oldRoom='30000000-3333-4333-8333-333333333333',match='40000000-4444-4444-8444-444444444444';
const challengeRoom='50000000-5555-4555-8555-555555555555';
const rematchRoom='60000000-6666-4666-8666-666666666666';
const secret='SENTINEL_PRIVATE_HAND_MUST_NOT_RENDER';
const hash='6f13bd77568efc5d0836eaa61458ca0cc2c500d1db2d9c38e228b1c668f71e24';
const flags={onChain:false,wager:false,rewards:false};
const room=(id)=>({id,host,gameId:'cribbage',visibility:'private',seatCount:2,status:'open',
 revision:1,seats:[{index:0,subject:host,controller:'human',team:0},
 {index:1,subject:peer,controller:'invited',team:1}],
 invites:[{id:'70000000-7777-4777-8777-777777777777',target:peer,seat:1,status:'pending',expiresAt:'2027-01-01T12:00:00Z'}]});
const record=(actor)=>({id:match,roomId:oldRoom,gameId:'cribbage',seatCount:2,
 rulesVersion:'v1.0',rulesHash:hash,status:'finished',sequence:125,turnSeat:null,
 winnerSeat:0,viewerSeat:actor===host?0:1,scores:[121,113],
 updatedAt:'2026-11-22T23:00:00Z',
 privateView:{hand:[secret],deck:secret,seed:secret}});
const response=(data,status=200)=>({status,contentType:'application/json; charset=utf-8',body:JSON.stringify({...data,...flags})});
let browser;
const sessions=[];
const state={challengeCreated:false,rematchCreated:false,offline:false,requestIds:new Set(),posts:[]};

async function mount(page,screen){
 await page.evaluate(async screen=>{
  const {CribbageSocialController,bindCribbageSocial}=await import('/core/classic-cribbage-social.js');
  const {renderCribbageRoute}=await import('/core/cribbage-ui.js');
  const ctl=new CribbageSocialController({enabled:true,onChange:()=>{if(window.__bc17?.ctl===ctl)paint();}});
  function paint(){
   document.body.innerHTML='<main id="bc17" aria-label="Cribbage acceptance">'+renderCribbageRoute({
    screen,state:{status:'idle',social:ctl.state}})+'</main>';
   bindCribbageSocial(document.querySelector('#bc17'),ctl,id=>{window.__bc17.destination=id;});
  }
  window.__bc17={ctl,screen,destination:null};
  paint();await ctl.refresh();
 },screen);
 await page.waitForFunction(()=>window.__bc17.ctl.state.status==='ready');
}

async function reloadAndMount(page,screen){
 await page.reload({waitUntil:'domcontentloaded'});
 await mount(page,screen);
}

try{
 for(let i=0;i<60;i++){
  try{if((await fetch(base+'/index.html')).ok)break;}catch{}
  if(i===59)throw Error('BC-1.7 local source server unavailable');
  await delay(100);
 }
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 for(const [i,actor] of [host,peer].entries()){
  const context=await browser.newContext({viewport:i?{width:390,height:844}:{width:1440,height:940},
   reducedMotion:i?'reduce':'no-preference'});
  sessions.push({context,actor});
  await context.addCookies([{name:'bc17_account',value:actor,url:base,httpOnly:true,sameSite:'Lax'}]);
  await context.route('**/app.js',route=>route.fulfill({status:200,contentType:'text/javascript',body:''}));
  await context.route('**/social-api/**',async route=>{
   const request=route.request(),pathname=new URL(request.url()).pathname;
   const cookie=request.headers().cookie||'';
   assert.ok(cookie.includes('bc17_account='+actor),'browser context crossed 420ID principal');
   if(state.offline)return route.fulfill(response({error:'unavailable'},503));
   let out;
   if(pathname==='/social-api/v1/me'){
    out=response({walletRequired:false,profile:{subject:actor}});
   }else if(pathname==='/social-api/v1/classic-rooms/friends'){
    out=response({friends:[{subject:actor===host?peer:host,
     displayName:'Opponent <img src=x onerror=alert(1)>'}]});
   }else if(pathname==='/social-api/v1/classic-sessions/history'){
    out=response({history:{matches:[record(actor)],
     invitations:actor===peer&&state.challengeCreated?[{
      roomId:challengeRoom,inviter:host,seat:1,expiresAt:'2027-01-01T12:00:00Z'}]:[],
     stats:{sampleSize:1,completed:1,wins:actor===host?1:0,losses:actor===host?0:1}}});
   }else if(pathname==='/social-api/v1/classic-sessions/challenge'&&request.method()==='POST'){
    const input=JSON.parse(request.postData()||'{}');
    assert.equal(actor,host,'opponent forged challenge');
    assert.equal(input.target,peer);
    assert.equal(Object.keys(input).sort().join(','),'requestId,target');
    assert.match(input.requestId,/^[a-f0-9-]{36}$/);
    assert.ok(!state.requestIds.has(input.requestId),'browser replayed signed write');
    state.requestIds.add(input.requestId);state.posts.push({actor,kind:'challenge'});
    state.challengeCreated=true;out=response({room:room(challengeRoom),playable:false},201);
   }else if(pathname==='/social-api/v1/classic-sessions/'+match+'/rematch'&&request.method()==='POST'){
    const input=JSON.parse(request.postData()||'{}');
    assert.equal(actor,host,'only expected actor may initiate fixture rematch');
    assert.equal(Object.keys(input).join(','),'requestId');
    assert.ok(!state.requestIds.has(input.requestId));
    state.requestIds.add(input.requestId);state.posts.push({actor,kind:'rematch'});
    state.rematchCreated=true;out=response({room:room(rematchRoom),playable:false},201);
   }else out=response({error:'not found'},404);
   await route.fulfill(out);
  });
  const page=await context.newPage();
  sessions[i].page=page;
  await page.goto(base+'/index.html',{waitUntil:'domcontentloaded'});
  await mount(page,i?'rematch':'history');
  assert.equal(await page.evaluate(()=>document.cookie.includes('bc17_account')),false,
   '420ID HTTP-only session visible to page scripts');
  assert.equal(await page.locator('[data-cribbage-rematch]').count(),1,'terminal action not rendered');
  const html=await page.locator('#bc17').innerHTML();
  assert.ok(!html.includes(secret),'hidden cards or journal injected into DOM');
  assert.ok(!html.includes('<img src=x onerror='),'untrusted friend display injected');
  assert.ok(html.includes('&lt;img'),'escaped name not presented');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),
   'horizontal overflow in desktop/mobile history');
  await page.addScriptTag({url:base+'/node_modules/axe-core/axe.min.js'});
  const violations=await page.evaluate(async()=>{
   const result=await window.axe.run(document.querySelector('#bc17'),{
    runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}});
   return result.violations.filter(x=>x.impact==='serious'||x.impact==='critical').map(x=>x.id);
  });
  assert.deepEqual(violations,[],'WCAG AA serious/critical failures for account '+i);
 }
 // Keyboard-only challenge performs a real DOM submit and a single
 // same-origin, cookie-bound write. The other browser never receives
 // the first account's result from shared browser storage.
 const pageA=sessions[0].page,pageB=sessions[1].page;
 await pageA.locator('[data-cribbage-challenge] select').focus();
 await pageA.keyboard.press('Tab');
 assert.equal(await pageA.evaluate(()=>document.activeElement?.textContent?.trim()),'Send challenge');
 await pageA.keyboard.press('Enter');
 await pageA.waitForFunction(id=>window.__bc17.destination===id,challengeRoom);
 assert.equal(state.posts.filter(x=>x.kind==='challenge').length,1);
 assert.equal(await pageB.locator('a[href="/games/rooms/'+challengeRoom+'"]').count(),0,
  'other session unexpectedly inherited newly created invitation without server refresh');
 await reloadAndMount(pageB,'history');
 assert.equal(await pageB.locator('a[href="/games/rooms/'+challengeRoom+'"]').count(),1,
  'recipient did not recover pending invitation from own authenticated server read');
 await pageA.locator('[data-cribbage-rematch]').click();
 await pageA.waitForFunction(id=>window.__bc17.destination===id,rematchRoom);
 assert.equal(state.posts.filter(x=>x.kind==='rematch').length,1);
 await reloadAndMount(pageA,'history');
 assert.equal(await pageA.locator('[data-cribbage-rematch]').count(),1,'history lost on reload');
 state.offline=true;
 await pageA.evaluate(()=>window.__bc17.ctl.refresh());
 await pageA.waitForFunction(()=>window.__bc17.ctl.state.status==='unavailable');
 assert.equal(await pageA.locator('[data-cribbage-rematch]').count(),0,'private controls remain after auth loss');
 assert.ok(!(await pageA.locator('#bc17').innerHTML()).includes(match),'stale match leaked after failed re-authentication');
 state.offline=false;
 console.log('BC-1.7 Chromium: two isolated HTTP-only 420ID contexts, desktop/mobile, WCAG AA, keyboard challenge, rematch, reload, private history, auth-loss scrubbing PASS');
}finally{
 for(const item of sessions)await item.context.close();
 if(browser)await browser.close();
 server.kill('SIGTERM');
}
