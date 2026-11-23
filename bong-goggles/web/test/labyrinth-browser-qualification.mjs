// BC-2.4 real-Chromium source-art, responsive layout and route smoke.
// Browser fixture is local and unauthenticated; it is NOT live 420ID acceptance.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {resolve,dirname,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const types={'.js':'text/javascript','.mjs':'text/javascript','.json':'application/json',
 '.css':'text/css','.html':'text/html','.png':'image/png','.svg':'image/svg+xml'};
const handler=async(req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/runtime-config.json'){
  const config=JSON.parse(await readFile(resolve(root,'runtime-config.example.json'),'utf8'));
  config.appOrigin='http://127.0.0.1:'+res.socket.localPort;
  config.environment='staging';
  config.features={...config.features,accountSocial:false,accountGames:false,
   classicRooms:false,classicCommunications:false};
  res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});
  res.end(JSON.stringify(config));return;
 }
 let name=decodeURIComponent(url.pathname);
 if(name==='/'||name==='/games'||name.startsWith('/games/')||
    name.startsWith('/classics/'))name='/index.html';
 if(name.includes('..')||name.includes('\\0')){res.writeHead(403);res.end();return}
 const full=resolve(root,'.'+name);
 if(!full.startsWith(root+sep)){res.writeHead(403);res.end();return}
 try{
  const bytes=await readFile(full);
  res.writeHead(200,{'Content-Type':types[extname(full)]||'application/octet-stream',
   'Cache-Control':'no-store'});res.end(bytes);
 }catch{res.writeHead(404);res.end('Not found')}
};
const server=createServer((req,res)=>void handler(req,res).catch(()=>{
 if(!res.headersSent)res.writeHead(500);res.end('Fixture error')
}));
let browser;
try{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 for(const viewport of [{width:1366,height:850},{width:390,height:844}]){
  const context=await browser.newContext({viewport,isMobile:viewport.width<500,hasTouch:viewport.width<500});
  const page=await context.newPage();const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(origin+'/games/labyrinth-cribbage',{waitUntil:'domcontentloaded'});
  await page.locator('main').waitFor();
  // This route must be a real application page, never an empty/404 fallback.
  assert.match(await page.locator('main').innerText(),/Labyrinth Cribbage/i);
  const board=page.locator('img[src="/assets/games/labyrinth-cribbage/labyrinth.png"]').first();
  assert.equal(await board.count(),1,'original board must be rendered on catalogue route');
  await board.evaluate(image=>image.decode());
  assert.deepEqual(await board.evaluate(image=>({width:image.naturalWidth,height:image.naturalHeight})),
   {width:1254,height:1254});
  const metrics=await board.evaluate(image=>({
   width:image.getBoundingClientRect().width,
   container:document.querySelector('.lab-board-art').getBoundingClientRect().width,
   viewport:window.innerWidth,
   document:document.documentElement.scrollWidth
  }));
  assert.ok(metrics.width>0&&Math.abs(metrics.width-metrics.container)<2,
   'board image must occupy the responsive square');
  assert.ok(metrics.document<=metrics.viewport+2,
   'Labyrinth preview must not cause horizontal overflow');
  assert.equal(await page.locator('.lab-peg-overlay').count(),0,
   'no physical peg without independently verified numbered map');
  assert.equal(await page.locator('[data-lab-art-missing]:visible').count(),0);
  assert.equal(await page.locator('.labyrinth-setup button:not([disabled])').count(),0);
  assert.deepEqual(errors,[]);
  await context.close();
 }
 // Exercise the real browser-loaded, signed-seat adapter (not just a static board).
 // Fixture response models the qualified account-games transport boundary;
 // it cannot substitute for deployed two-account authorization acceptance.
 const authenticated=await browser.newContext({viewport:{width:1280,height:800}});
 const tab=await authenticated.newPage();
 await tab.goto(origin+'/games/labyrinth-cribbage',{waitUntil:'domcontentloaded'});
 const sessionJourney=await tab.evaluate(async()=>{
  const {LabyrinthSessionController,LABYRINTH_RULES_HASH}=await import('/core/labyrinth-session.js');
  const {LABYRINTH_RULES_VERSION,LABYRINTH_MANIFEST_SHA,
    renderLabyrinthTable}=await import('/core/labyrinth-cribbage-ui.js');
  const subject='30000000-3333-4333-8333-333333333333';
  const id='10000000-1111-4111-8111-111111111111';
  const roomId='20000000-2222-4222-8222-222222222222';
  const hand=[0,1,2,3,4,5,6,7,8];
  let authorized=true,revision=1,actions=0;
  const snapshot=()=>({onChain:false,wager:false,rewards:false,
   session:{id,roomId,gameId:'labyrinth-cribbage',seatCount:2,status:'active',
    rulesVersion:LABYRINTH_RULES_VERSION,rulesHash:LABYRINTH_RULES_HASH,
    sequence:revision,turnSeat:revision===1?0:1,deadline:null,
    winnerSeat:null,updatedAt:'2026-11-23T18:00:00Z',viewerSeat:0,
    privateView:{gameId:'labyrinth-cribbage',variant:'labyrinth-2p',round:1,
     phase:'discard',dealer:1,turn:revision===1?0:1,seat:0,
     scores:[0,0],hand:revision===1?hand:hand.slice(3),
     cardCounts:[revision===1?9:6,9],cribCount:revision===1?0:3,
     discarded:[revision>1,false],starter:-1,pegCount:0,
     pegPile:[],pegged:[[],[]],saidGo:[false,false],lastShow:[],
     lastAwards:[],losers:[],winner:null}}});
  const reply=(body,status=200)=>new Response(JSON.stringify(body),{
   status,headers:{'Content-Type':'application/json'}});
  const mock=async(url,options={})=>{
   const p=new URL(url,location.origin).pathname.replace(/^\\/social-api(?=\\/v1\\/)/,'');
   if(!authorized)return reply({error:'not_authorized'},403);
   if(p==='/v1/me')return reply({walletRequired:false,profile:{subject}});
   if(p==='/v1/classic-sessions')return reply({onChain:false,wager:false,
    rewards:false,sessions:[{id,roomId,gameId:'labyrinth-cribbage',
     rulesVersion:LABYRINTH_RULES_VERSION,rulesHash:LABYRINTH_RULES_HASH,
     sequence:revision,status:'active'}]});
   if(p==='/v1/classic-sessions/'+id+'/action'){
    const body=JSON.parse(options.body||'{}');
    if(options.method!=='POST'||body.expectedSequence!==2||revision!==1||
       JSON.stringify(body.move)!==JSON.stringify({type:'discard',cards:[0,1,2]}))
      return reply({error:'conflict'},409);
    actions++;revision=2;return reply(snapshot());
   }
   if(p==='/v1/classic-sessions/'+id)return reply(snapshot());
   return reply({error:'missing'},404);
  };
  const controller=new LabyrinthSessionController({enabled:true,fetchImpl:mock});
  await controller.open(id);
  if(controller.state.status!=='ready'||controller.state.view.hand.length!==9)
   throw Error('authenticated browser table did not open');
  controller.select([0,1,2]);
  await controller.open(id,{quiet:true});
  if(controller.state.selection.join(',')!=='0,1,2')
   throw Error('refresh bounced back to menu or dropped selection');
  if(!renderLabyrinthTable({view:controller.state.view,selection:controller.state.selection})
      .includes('Send 3 cards to crib'))throw Error('private browser hand did not render');
  await controller.act({type:'discard',cards:[0,1,2]});
  if(actions!==1||controller.state.view.sequence!==2||
     controller.state.view.hand.length!==6||controller.state.status!=='ready')
   throw Error('server-confirmed browser discard or uninterrupted table failed');
  // Independent controller = browser cold reload, not in-memory resume.
  const cold=new LabyrinthSessionController({enabled:true,fetchImpl:mock});
  await cold.list();
  if(cold.state.recoverable.length!==1||cold.state.recoverable[0].id!==id)
   throw Error('My Games missing authenticated match after cold restart');
  await cold.open(id);
  if(cold.state.status!=='ready'||cold.state.view.sequence!==2)
   throw Error('cold resume did not recover canonical match');
  authorized=false;
  await cold.open(id,{quiet:true});
  if(cold.state.view!==null||cold.state.status==='ready')
   throw Error('revoked browser session leaked private cards');
  authorized=true;
  await cold.open(id,{quiet:true});
  if(cold.state.status!=='ready'||cold.state.view.hand.length!==6)
   throw Error('browser reconnect did not restore authenticated match');
  controller.invalidate();cold.invalidate();
  return {actions,revision,oldCardsHidden:!cold.state.view};
 });
 assert.deepEqual(sessionJourney,{actions:1,revision:2,oldCardsHidden:true});
 await authenticated.close();
 console.log('BC-2.4 Chromium approved board/mobile + signed-transport fixture move, cold resume, revocation and reconnect PASS');
}finally{
 if(browser)await browser.close();
 await new Promise(resolve=>server.close(resolve));
}
