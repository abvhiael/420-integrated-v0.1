// BC-2.7: two physically isolated Chromium contexts, independently seated
// fixture service. The Go/Postgres suite is the authoritative rules/420ID test;
// this is browser acceptance, not a deployed production 420ID sign-on.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {dirname,extname,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const room='20000000-2222-4222-8222-222222222222';
const match='10000000-1111-4111-8111-111111111111';
const people=['30000000-3333-4333-8333-333333333333','40000000-4444-4444-8444-444444444444'];
const hand=[[0,1,2,3,4,5,6,7,8],[13,14,15,16,17,18,19,20,21]];
const count=[9,9],discarded=[false,false];
let sequence=1,turn=0,status='active',winner=null,cribCount=0;
const types={'.js':'text/javascript','.mjs':'text/javascript','.json':'application/json',
 '.css':'text/css','.html':'text/html','.png':'image/png','.svg':'image/svg+xml'};
const reply=(res,code,data)=>{
 res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store'});
 res.end(JSON.stringify(data));
};
const principals=req=>{
 const cookie=req.headers.cookie??'';
 const actor=/bg_test_actor=([01])(?:;|$)/.exec(cookie)?.[1];
 return actor===undefined?null:Number(actor);
};
const snapshot=seat=>({onChain:false,wager:false,rewards:false,session:{
 id:match,roomId:room,gameId:'labyrinth-cribbage',seatCount:2,status,
 rulesVersion:'v2.0',
 rulesHash:'9eed3af244d95dd1757b2ce82c1f66d85581a9b0656e0f36eba825cf8ddbc791',
 sequence,turnSeat:status==='active'?turn:null,
 deadline:status==='active'?'2027-01-03T05:00:00Z':null,
 winnerSeat:winner,finishedReason:status==='resigned'?'resigned':'',
 updatedAt:'2026-11-23T22:30:00Z',viewerSeat:seat,privateView:{
 gameId:'labyrinth-cribbage',variant:'labyrinth-2p',round:1,phase:'discard',
 dealer:1,turn,seat,scores:[0,0],hand:hand[seat],cardCounts:count,
 cribCount,discarded,starter:-1,pegCount:0,pegPile:[],pegged:[[],[]],
 saidGo:[false,false],lastShow:[],lastAwards:[],losers:[],winner
 }}});
const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname.startsWith('/social-api/v1/')){
   const seat=principals(req);
   if(seat===null){reply(res,401,{error:'UNAUTHENTICATED'});return}
   const path=url.pathname.slice('/social-api'.length);
   if(path==='/v1/me'){
    reply(res,200,{walletRequired:false,profile:{subject:people[seat]}});return
   }
   if(path==='/v1/classic-sessions/'+match&&req.method==='GET'){
    reply(res,200,snapshot(seat));return
   }
   if(path==='/v1/classic-sessions/'+match+'/action'&&req.method==='POST'){
    let source='';for await(const part of req)source+=part;
    const action=JSON.parse(source);
    if(action.expectedSequence!==sequence+1||status!=='active'){
     reply(res,409,{error:'CONFLICT'});return
    }
    if(action.action==='resign'){
     status='resigned';winner=(seat+1)%2;turn=seat;sequence++;
     reply(res,200,snapshot(seat));return
    }
    if(action.action!=='move'||seat!==turn){
     reply(res,403,{error:'NOT_YOUR_TURN'});return
    }
    if(action.move?.type!=='discard'||!Array.isArray(action.move.cards)||
     action.move.cards.length!==3||action.move.cards.some(c=>!hand[seat].includes(c))||
     new Set(action.move.cards).size!==3){
     reply(res,400,{error:'ILLEGAL_MOVE'});return
    }
    hand[seat]=hand[seat].filter(c=>!action.move.cards.includes(c));
    count[seat]=6;discarded[seat]=true;cribCount+=3;turn=1;sequence++;
    reply(res,200,snapshot(seat));return
   }
   reply(res,404,{error:'UNKNOWN'});return
  }
  const path=url.pathname==='/'?'/index.html':url.pathname;
  if(path.includes('..')||path.includes('\\')){res.writeHead(403);res.end();return}
  const target=resolve(root,'.'+path);
  if(!target.startsWith(root+sep)){res.writeHead(403);res.end();return}
  const buffer=await readFile(target);
  res.writeHead(200,{'Content-Type':types[extname(target)]??'application/octet-stream','Cache-Control':'no-store'});
  res.end(buffer);
 }catch{if(!res.headersSent)res.writeHead(404);res.end('Not found')}
});
let browser;
try{
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const contexts=[],pages=[],errors=[];
 for(let seat=0;seat<2;seat++){
  const ctx=await browser.newContext({
   viewport:seat===0?{width:1280,height:820}:{width:390,height:844},
   isMobile:seat===1,hasTouch:seat===1
  });
  await ctx.addCookies([{name:'bg_test_actor',value:String(seat),url:origin}]);
  const page=await ctx.newPage();const failures=[];
  page.on('pageerror',e=>failures.push(e.message));
  await page.goto(origin+'/index.html',{waitUntil:'domcontentloaded'});
  // Inject the actual stylesheet and instantiate the real 420ID seat controller,
  // not an HTML mock. Source modules load from the real built web directory.
  await page.evaluate(async id=>{
   const {LabyrinthSessionController}=await import('/core/labyrinth-session.js');
   const {renderLabyrinthScreen,bindLabyrinthTable}=await import('/core/labyrinth-cribbage-ui.js');
   const ctl=new LabyrinthSessionController({enabled:true});
   window.__bc27={ctl,renderLabyrinthScreen,bindLabyrinthTable};
   await ctl.open(id);
   if(ctl.state.status!=='ready')throw Error('420ID seat failed to open');
   const style=document.createElement('link');style.rel='stylesheet';style.href='/labyrinth.css';document.head.append(style);
   let root=document.getElementById('bc27-stage');
   if(!root){root=document.createElement('main');root.id='bc27-stage';document.body.replaceChildren(root)}
   const paint=()=>{
    root.innerHTML=renderLabyrinthScreen({screen:'play',session:ctl.state.session,view:ctl.state.view,selection:ctl.state.selection});
    bindLabyrinthTable(root,{view:ctl.state.view,selection:ctl.state.selection,
     onSelection:v=>{ctl.select(v);paint()},
     onMove:move=>void ctl.act(move).then(paint)});
   };
   ctl.onChange=()=>{};
   paint();window.__bc27.paint=paint;
  },match);
  contexts.push(ctx);pages.push(page);errors.push(failures);
 }
 const [a,b]=pages;
 const privateCards=async page=>page.locator('[data-lab-card]').count();
 assert.equal(await privateCards(a),9);
 assert.equal(await privateCards(b),9);
 assert.notDeepEqual(await a.locator('[data-lab-card]').evaluateAll(es=>es.map(e=>e.dataset.labCard)),
  await b.locator('[data-lab-card]').evaluateAll(es=>es.map(e=>e.dataset.labCard)),
  'two 420ID principals must never receive the same concealed hand');
 assert.equal(await a.locator('[data-lab-action="discard"]').count(),1);
 assert.equal(await b.locator('[data-lab-action="discard"]').count(),1);
 assert.equal(await b.locator('[data-lab-action="discard"]').isDisabled(),true,
  'wrong 420ID seat must not be permitted to submit a discard');
 for(const card of ['0','1','2'])await a.locator('[data-lab-card="'+card+'"]').click();
 await a.locator('[data-lab-action="discard"]').click();
 await a.waitForFunction(()=>window.__bc27.ctl.state.session?.sequence===2);
 assert.equal(await privateCards(a),6,'confirmed live move removes exactly 3 cards');
 await b.evaluate(async id=>{await window.__bc27.ctl.open(id);window.__bc27.paint()},match);
 assert.equal(await b.locator('[data-lab-action="discard"]').isDisabled(),true===false,
  'server-advanced turn must grant seat 1 action');
 // Browser reload must recover the same server-owned sequence and private hand.
 await b.reload({waitUntil:'domcontentloaded'});
 await b.evaluate(async id=>{
  const {LabyrinthSessionController}=await import('/core/labyrinth-session.js');
  const ctl=new LabyrinthSessionController({enabled:true});window.__bc27={ctl};
  await ctl.open(id);
 },match);
 assert.equal(await b.evaluate(()=>window.__bc27.ctl.state.session.sequence),2);
 assert.equal(await b.evaluate(()=>window.__bc27.ctl.state.view.viewerSeat),1);
 await b.evaluate(async()=>{await window.__bc27.ctl.lifecycle('resign')});
 assert.equal(await b.evaluate(()=>window.__bc27.ctl.state.session.status),'resigned');
 await a.evaluate(async id=>await window.__bc27.ctl.open(id),match);
 assert.equal(await a.evaluate(()=>window.__bc27.ctl.state.session.status),'resigned');
 // Revocation clears private view despite already successful prior requests.
 await contexts[1].clearCookies();
 await b.evaluate(async id=>await window.__bc27.ctl.open(id),match);
 assert.equal(await b.evaluate(()=>window.__bc27.ctl.state.view),null);
 assert.ok(['guest','unavailable'].includes(await b.evaluate(()=>window.__bc27.ctl.state.status)));
 for(const failures of errors)assert.deepEqual(failures,[],'no browser JS crashes');
 for(const ctx of contexts)await ctx.close();
 console.log('BC-2.7 isolated Chromium desktop/mobile 420ID seat, hand, turn, reconnect, resign and revocation PASS');
}finally{
 await browser?.close();
 await new Promise(ok=>server.close(ok));
}
