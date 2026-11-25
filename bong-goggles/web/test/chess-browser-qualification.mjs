// Real Chromium transport/UI qualification; the independent Go gate exercises
// actual PostgreSQL and the authoritative server. No live release is implied.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {chromium} from 'playwright';
import {id,roomId,actor,fixture,envelope} from './chess-fixture.mjs';
const root=resolve(import.meta.dirname,'..'),peer='22222222-2222-4222-8222-222222222222';
const types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml'};
const server=createServer(async(req,res)=>{
 try{
  let p=new URL(req.url,'http://localhost').pathname;
  if(p==='/runtime-config.json'){
   const cfg=JSON.parse(await readFile(resolve(root,'runtime-config.example.json'),'utf8'));
   cfg.environment='staging';cfg.appOrigin='http://127.0.0.1:'+server.address().port;
   cfg.features={...cfg.features,accountSocial:true,accountGames:true,classicRooms:true,classicCommunications:true,chessRestricted:true};
   res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(cfg));return;
  }
  if(p==='/'||p.startsWith('/games/'))p='/index.html';
  const path=resolve(root,'.'+p);if(!path.startsWith(root+sep)){res.writeHead(403);res.end();return;}
  const bytes=await readFile(path);res.writeHead(200,{'Content-Type':types[extname(path)]??'application/octet-stream'});res.end(bytes);
 }catch{res.writeHead(404);res.end();}
});
let browser,seq=1,board=fixture().privateView.board,last='',san='',outage=false,posts=0;const errors=[];
const session=seat=>{const s=fixture(seat);s.sequence=seq;s.turnSeat=(seq-1)%2;Object.assign(s.privateView,{board,turn:s.turnSeat,lastMove:last,lastSAN:san});return s;};
try{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 async function open(seat,width){
  const context=await browser.newContext({viewport:{width,height:844},hasTouch:width<500});
  const subject=seat?peer:actor;
  await context.addCookies([{name:'bc34_actor',value:subject,url:origin,httpOnly:true}]);
  await context.route(/^https:\/\//,r=>r.abort());
  await context.route('**/social-api/**',async r=>{
   const p=new URL(r.request().url()).pathname.replace('/social-api','');
   const cookie=r.request().headers().cookie??'';
   if(outage&&seat||!cookie.includes('bc34_actor='+subject)){await r.fulfill({status:401,json:{error:'Unauthorized'}});return;}
   let status=200,data;
   if(p==='/v1/me')data={walletRequired:false,profile:{subject}};
   else if(p==='/v1/classic-sessions/'+id+'/chess-actions')data=envelope({sequence:seq,actions:seat===(seq-1)%2?[{type:'move',uci:seat?'e7e5':'e2e4'},{type:'resign'}]:[{type:'resign'}]}).data;
   else if(p==='/v1/classic-sessions/'+id+'/action'){
    const b=r.request().postDataJSON();assert.equal(b.expectedSequence,seq+1);assert.equal(seat,(seq-1)%2);
    assert.deepEqual(b.move,{type:'move',uci:seat?'e7e5':'e2e4'});posts++;
    const a=board.split(''),from=seat?52:12,to=seat?36:28;a[to]=a[from];a[from]='.';board=a.join('');last=b.move.uci;san=seat?'e5':'e4';seq++;
    data=envelope({session:session(seat)}).data;
   }else if(p==='/v1/classic-sessions/'+id)data=envelope({session:session(seat)}).data;
   else if(p==='/v1/classic-sessions')data=envelope({sessions:[session(seat)]}).data;
   else{status=404;data={error:'unavailable'};}
   await r.fulfill({status,json:data});
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/games/chess/play?session='+id);
  await page.locator('[data-chess-square]').first().waitFor({timeout:15000});
  assert.equal(await page.locator('[data-chess-square]').count(),64);
  return {page,context};
 }
 const white=await open(0,1366),black=await open(1,390),w=white.page,b=black.page;
 assert.equal(await w.locator('[data-chess-square]').first().getAttribute('data-chess-square'),'a8');
 assert.equal(await b.locator('[data-chess-square]').first().getAttribute('data-chess-square'),'h1');
 await w.locator('[data-chess-square="e2"]').click();await w.locator('[data-chess-square="e4"].target').waitFor();
 await w.locator('[data-chess-square="e4"]').click();
 await w.getByText('Last move: e4',{exact:true}).waitFor();
 await b.locator('[data-chess-square="e7"]').click({timeout:10000}); 
 // Polling is authoritative; wait until the opponent has actually received the turn.
 await b.getByText('Black to move · Your turn',{exact:true}).waitFor({timeout:15000});
 await b.locator('[data-chess-square="e7"]').click();
 await b.locator('[data-chess-square="e5"].target').waitFor();
 await b.locator('[data-chess-square="e5"]').click();
 await b.getByText('Last move: e5',{exact:true}).waitFor();
 assert.equal(posts,2);
 await w.reload();await w.getByText('Last move: e5',{exact:true}).waitFor({timeout:15000});
 await b.locator('[data-chess-flip]').click();assert.equal(await b.locator('[data-chess-square]').first().getAttribute('data-chess-square'),'a8');
 const width=await b.locator('.chess-board').evaluate(el=>({board:el.getBoundingClientRect().width,view:innerWidth}));assert.ok(width.board<=width.view);
 await w.locator('[data-chess-square="a8"]').focus();await w.keyboard.press('ArrowRight');assert.equal(await w.evaluate(()=>document.activeElement.dataset.chessSquare),'b8');
 await w.addScriptTag({url:origin+'/node_modules/axe-core/axe.min.js'});
 const audit=await w.evaluate(async()=>window.axe.run(document.querySelector('.chess-screen'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}}));
 assert.deepEqual(audit.violations.filter(v=>['critical','serious'].includes(v.impact)).flatMap(v=>v.nodes.map(n=>({rule:v.id,target:n.target,summary:n.failureSummary}))),[]);
 outage=true;await b.locator('[data-chess-square]').first().waitFor({state:'detached',timeout:15000});
 assert.deepEqual(errors,[]);
 console.log('BC-3.4 Chromium: two independent seats, legal moves, polling, reload, orientation, keyboard, mobile, axe and revocation passed');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
