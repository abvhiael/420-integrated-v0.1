// BC-0.12: a REAL Chromium, two isolated browser contexts and local
// account-transport fixtures. This is NOT deployed two-account acceptance.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {resolve,dirname,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const a='11111111-1111-4111-8111-111111111111';
const b='22222222-2222-4222-8222-222222222222';
const roomId='33333333-3333-4333-8333-333333333333';
const sessionId='44444444-4444-4444-8444-444444444444';
const clock='2026-11-22T04:00:00Z';
const subjects=[a,b];
const seats=subjects.map((subject,index)=>({index,controller:'human',subject,team:index}));
const room={id:roomId,host:a,gameId:'chess',seatCount:2,
 visibility:'private',status:'in_game',revision:3,seats,invites:[]};
const lifecycle={id:sessionId,roomId,gameId:'chess',status:'active',
 seatCount:2,sequence:1,turnSeat:0,deadline:clock};
const publicEvent={sequence:1,kind:'started',actorSeat:null,
 publicState:{status:'active',turnSeat:0,deadline:clock,winnerSeat:null,finishedReason:''},
 occurredAt:clock};
const envelope=x=>({onChain:false,wager:false,rewards:false,playable:false,...x});
const typemap={'.js':'text/javascript','.mjs':'text/javascript','.css':'text/css',
 '.html':'text/html','.json':'application/json','.svg':'image/svg+xml',
 '.png':'image/png','.webp':'image/webp'};
const handler=async(req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/runtime-config.json'){
  const config=JSON.parse(await readFile(resolve(root,'runtime-config.example.json'),'utf8'));
  config.appOrigin='http://127.0.0.1:'+res.socket.localPort;
  config.environment='staging';config.features={...config.features,accountSocial:false,
   accountGames:false,classicRooms:false,classicCommunications:false};
  res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});
  res.end(JSON.stringify(config));return;
 }
 let path=decodeURIComponent(url.pathname);
 if(path==='/'||path==='/games'||path==='/classics'||path.startsWith('/games/')||
  path.startsWith('/classics/'))path='/index.html';
 if(path.includes('\0')||path.includes('..')){res.writeHead(403);res.end();return}
 const destination=resolve(root,'.'+path);
 if(!destination.startsWith(root+sep)){res.writeHead(403);res.end();return}
 try{const bytes=await readFile(destination);
  res.writeHead(200,{'Content-Type':typemap[extname(destination)]||'application/octet-stream',
   'Cache-Control':'no-store'});res.end(bytes);
 }catch{res.writeHead(404);res.end('Not found')}
};
const server=createServer((req,res)=>void handler(req,res).catch(()=>{
 if(!res.headersSent)res.writeHead(500);res.end('Internal fixture error')}));
const listen=()=>new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const close=()=>new Promise(resolve=>server.close(resolve));
const start=Date.now();const errors=[];
let browser;
try{
 await listen();
 const origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const desktop=await browser.newContext({viewport:{width:1366,height:800}});
 await desktop.route(/^https:\/\//,route=>route.abort('blockedbyclient'));
 const page=await desktop.newPage();
 page.on('pageerror',err=>errors.push(err.message));
 await page.goto(origin+'/games',{waitUntil:'domcontentloaded'});
 await page.locator('main .games-catalogue').waitFor({timeout:10_000});
 assert.equal(await page.locator('.games-catalogue__tile').count()>=25,true);
 for(const title of ['cribbage','chess','kaiser'])
  assert.equal(await page.locator('a[href="/games/'+title+'"]').count()>0,true);
 await page.locator('a[href="/games/cribbage"]').first().click();
 await page.locator('main .games-game-page').waitFor({timeout:5000});
 assert.match(await page.locator('main').innerText(),/Registry only|not yet playable/i);
 assert.equal(await page.locator('[data-game-action="play"]').count(),0);
 assert.equal(await page.locator('button:has-text("Start game")').count(),0);
 await page.keyboard.press('Tab');
 assert.equal(await page.evaluate(()=>document.activeElement?.tagName!=='BODY'),true);
 const axeCode=await readFile(resolve(root,'node_modules/axe-core/axe.min.js'),'utf8');
 await page.addScriptTag({content:axeCode});
 const violations=await page.evaluate(async()=>window.axe.run(document,{
  runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}
 }));
 const blocking=violations.violations.filter(v=>['critical','serious'].includes(v.impact));
 assert.deepEqual(blocking.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.length})),[]);
 const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 await mobile.route(/^https:\/\//,route=>route.abort('blockedbyclient'));
 const mp=await mobile.newPage();
 mp.on('pageerror',err=>errors.push(err.message));
 await mp.goto(origin+'/games/kaiser',{waitUntil:'domcontentloaded'});
 await mp.locator('main .games-game-page').waitFor({timeout:10_000});
 assert.match(await mp.locator('main').innerText(),/Kaiser/);
 assert.equal(await mp.locator('[data-game-action="play"]').count(),0);
 const width=await mp.evaluate(()=>({
  view:window.innerWidth,content:document.querySelector('.games-game-page').getBoundingClientRect().width
 }));
 assert.ok(width.content<=width.view+2,'mobile game view overflow '+JSON.stringify(width));
 await mobile.close();
 // Independent contexts, independent cookies and *fixture* 420ID principals.
 // HTTP route fixtures cannot assert real production sign-on; the separate
 // live acceptance workflow checks that boundary before any release.
 let outage=false;
 const mkContext=async(principal)=>{
  const context=await browser.newContext({viewport:{width:1000,height:760}});
  await context.addCookies([{name:'bc12_test_identity',value:principal,
    url:origin,httpOnly:true,sameSite:'Strict'}]);
  await context.route('**/social-api/**',async route=>{
   if(outage&&principal===b){await route.abort('failed');return}
   const cookie=route.request().headers()['cookie']??'';
   const subject=/bc12_test_identity=([^;]+)/.exec(cookie)?.[1];
   if(subject!==principal){await route.fulfill({status:401,json:{error:'unauthorized'}});return}
   const u=new URL(route.request().url()).pathname.replace(/^\/social-api/,'');
   let data={},status=200;
   if(u==='/v1/me')data={walletRequired:false,profile:{subject}};
   else if(u==='/v1/classic-rooms/'+roomId)data=envelope({room});
   else if(u==='/v1/classic-rooms/'+roomId+'/presence')
    data=envelope({presence:{roomId,revision:3,leaseSeconds:20,
     seats:[{seat:0,online:true},{seat:1,online:!outage}]}});
   else if(u==='/v1/classic-sessions')data={onChain:false,wager:false,rewards:false,
    sessions:[lifecycle]};
   else if(u==='/v1/classic-sessions/'+sessionId)data={onChain:false,wager:false,rewards:false,
    session:{...lifecycle,viewerSeat:subject===a?0:1,
     privateView:{mine:'PRIVATE-'+subject,opponentHand:'DO-NOT-SHOW'}}};
   else if(u==='/v1/classic-sessions/'+sessionId+'/events')
    data={onChain:false,wager:false,rewards:false,sequence:1,events:[publicEvent]};
   else status=404;
   await route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
  });
  const view=await context.newPage();
  await view.goto(origin+'/games/chess',{waitUntil:'domcontentloaded'});
  await view.locator('main .games-game-page').waitFor({timeout:10_000});
  return {context,view,principal};
 };
 const left=await mkContext(a),right=await mkContext(b);
 const sync=async({view,principal})=>view.evaluate(async ({room,principal})=>{
  const {ClassicCommunicationsController}=await import('/core/classic-communications.js');
  const {renderClassicRooms}=await import('/core/classic-rooms.js');
  const live=new ClassicCommunicationsController({enabled:true});
  const state=await live.sync({room,viewer:principal});
  const html=renderClassicRooms({status:'ready',viewer:principal,selected:room,
   friends:[],rooms:[],notice:''},{enabled:true,roomId:room.id,live:state});
  const node=document.createElement('section');node.innerHTML=html;
  document.body.append(node);
  return {state,html};
 },{room,principal});
 let [first,second]=await Promise.all([sync(left),sync(right)]);
 assert.equal(first.state.status,'connected');
 assert.equal(second.state.status,'connected');
 assert.equal(first.state.session.viewerSeat,0);
 assert.equal(second.state.session.viewerSeat,1);
 assert.match(first.state.notice,/your turn/i);
 assert.doesNotMatch(second.state.notice,/your turn/i);
 for(const actual of [first,second]){
  const entire=JSON.stringify(actual);
  assert.doesNotMatch(entire,/PRIVATE-|DO-NOT-SHOW|opponentHand|seed|wagerAmount/);
  assert.match(actual.html,/Live room status|Waiting for another player/);
 }
 outage=true;
 const down=await sync(right);
 assert.equal(down.state.status,'reconnecting');
 assert.doesNotMatch(down.html,/PRIVATE-|DO-NOT-SHOW/);
 outage=false;
 await right.view.reload({waitUntil:'domcontentloaded'});
 const restored=await sync(right);
 assert.equal(restored.state.status,'connected');
 assert.equal(restored.state.session.viewerSeat,1);
 await left.context.close();await right.context.close();await desktop.close();
 assert.deepEqual(errors,[],'uncaught browser page exceptions');
 assert.ok(Date.now()-start<120_000,'local browser qualification exceeded 120 seconds');
 console.log('BC-0.12 Chromium desktop/mobile/axe/two-context/reconnect acceptance PASS (mock transport only)');
}finally{
 if(browser)await browser.close();
 await close();
}
