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
let browser,seq=1,board=fixture().privateView.board,last='',san='',outage=false,posts=0,dropReply=false,failedReads=0,authenticatedReads=0;const errors=[];
const moves=['e2e4','e7e5','g1f3','b8c6'];const notation=['e4','e5','Nf3','Nc6'];
const index=sq=>(Number(sq[1])-1)*8+'abcdefgh'.indexOf(sq[0]);
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
   if(outage&&seat===0){failedReads++;await r.abort('internetdisconnected');return;}
   assert.ok(cookie.includes('bc34_actor='+subject),'original authenticated cookie must survive');
   if(p==='/v1/me'&&seat===0)authenticatedReads++;
   let status=200,data;
   if(p==='/v1/me')data={walletRequired:false,profile:{subject}};
   else if(p==='/v1/classic-sessions/'+id+'/chess-actions')data=envelope({sequence:seq,actions:seat===(seq-1)%2?[{type:'move',uci:moves[seq-1]},{type:'resign'}]:[{type:'resign'}]}).data;
   else if(p==='/v1/classic-sessions/'+id+'/action'){
    const b=r.request().postDataJSON();assert.equal(b.expectedSequence,seq+1);assert.equal(seat,(seq-1)%2);
    assert.deepEqual(b.move,{type:'move',uci:seat?'e7e5':'e2e4'});posts++;
    const a=board.split(''),from=index(b.move.uci.slice(0,2)),to=index(b.move.uci.slice(2,4));a[to]=a[from];a[from]='.';board=a.join('');last=b.move.uci;san=notation[seq-1];seq++;
    if(dropReply&&seat===0){dropReply=false;outage=true;await r.abort('connectionreset');return;}
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
 const move=async(page,uci,san)=>{
  await page.locator('[data-chess-square="'+uci.slice(0,2)+'"]').click();
  await page.locator('[data-chess-square="'+uci.slice(2,4)+'"].target').waitFor({timeout:15000});
  await page.locator('[data-chess-square="'+uci.slice(2,4)+'"]').click();
  if(san)await page.getByText('Last move: '+san,{exact:true}).waitFor({timeout:15000});
 };
 const url=w.url();
 await w.evaluate(()=>{window.bc37DocumentMarker='same-document';});
 await move(w,'e2e4','e4');
 await b.getByText('Black to move · Your turn',{exact:true}).waitFor({timeout:15000});
 // Transport failure, not a 401 or logout. Only White loses connectivity.
 outage=true;await white.context.setOffline(true);
 await w.locator('[data-chess-square]').first().waitFor({state:'detached',timeout:15000});
 await w.getByText('Chess session unavailable.',{exact:true}).waitFor();
 assert.equal(await w.locator('[data-chess-action], [data-chess-promotion]').count(),0);
 assert.equal(posts,1);
 await move(b,'e7e5','e5');
 assert.equal(posts,2);assert.equal(seq,3);
 // Same authenticated browser document, no navigation or manual refresh.
 const priorReads=authenticatedReads;
 outage=false;await white.context.setOffline(false);
 await w.getByText('Last move: e5',{exact:true}).waitFor({timeout:15000});
 await w.getByText('White to move · Your turn',{exact:true}).waitFor();
 assert.ok(authenticatedReads>priorReads);
 assert.equal(w.url(),url);assert.equal(await w.evaluate(()=>window.bc37DocumentMarker),'same-document');
 assert.equal(await w.locator('[data-chess-square="e5"]').getAttribute('aria-label'),'e5, Black pawn');
 // Lose the response AFTER the server has committed a move. The client
 // must reconcile the committed revision, never blindly resend a POST.
 dropReply=true;await move(w,'g1f3',null);
 await w.locator('[data-chess-square]').first().waitFor({state:'detached',timeout:15000});
 await w.getByText('Chess session unavailable.',{exact:true}).waitFor();
 assert.equal(posts,3);assert.equal(seq,4);
 await b.getByText('Black to move · Your turn',{exact:true}).waitFor({timeout:15000});
 outage=false;
 await w.getByText('Last move: Nf3',{exact:true}).waitFor({timeout:15000});
 await w.getByText('Black to move · Waiting for opponent',{exact:true}).waitFor();
 assert.equal(posts,3);assert.equal(await w.evaluate(()=>window.bc37DocumentMarker),'same-document');
 await move(b,'b8c6','Nc6');
 await w.getByText('Last move: Nc6',{exact:true}).waitFor({timeout:15000});
 await w.getByText('White to move · Your turn',{exact:true}).waitFor();
 assert.equal(posts,4);assert.equal(seq,5);assert.ok(failedReads>0);
 assert.equal(w.url(),url);assert.equal(await w.evaluate(()=>window.bc37DocumentMarker),'same-document');
 assert.deepEqual(errors,[]);
 console.log('BC-3.7 Chromium: temporary network loss, same-document reconnect, opponent progress, lost committed response, no duplicate POST and resumed gameplay passed');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
