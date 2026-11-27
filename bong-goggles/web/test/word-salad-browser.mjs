import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {chromium} from 'playwright';
import {BOARD_SPECS} from '../core/word-salad-rules.js';
import {TILE_VALUES} from '../core/word-salad-tiles.js';
import {SALAD_ART} from '../core/word-salad-ui.js';
import {normalizeSalad} from '../core/word-salad-session.js';

const OUT=resolve('bc442-browser-evidence');
await mkdir(OUT,{recursive:true});
const sizes=[11,13,15,17,19,21];
const views=[{width:1920,height:1080},{width:1366,height:768},{width:768,height:1024},{width:390,height:844}];
const id='11111111-1111-4111-8111-111111111111',roomId='22222222-2222-4222-8222-222222222222',actor='33333333-3333-4333-8333-333333333333';
const envelope={onChain:false,wager:false,rewards:false};
const live=process.argv.includes('--live');
const results=[];
const report={mode:live?'live-authenticated':'fixture-backed-real-app',sha:process.env.BC442_SHA,results};
const browser=await chromium.launch();
let server;
function snapshot(n){
 const p=BOARD_SPECS[n],count=p.maxPlayers;
 const symbols=['A','T','?','SH','E','R','S','N'].slice(0,p.rackSize);
 return {id,roomId,gameId:'scrabble',rulesVersion:'v1',rulesHash:'a'.repeat(64),sequence:1,seatCount:count,viewerSeat:0,status:'active',turnSeat:0,deadline:null,winnerSeat:null,privateView:{variant:n+':classic-salad:untimed',board:{0:'TH',1:'A'},blankCells:[1],rack:symbols.map((symbol,id)=>({id,symbol,value:TILE_VALUES[symbol]})),rackCounts:Array(count).fill(p.rackSize),bagCount:p.tileCount-count*p.rackSize-2,scores:Array(count).fill(12),turn:0,terminal:false,winners:null,forfeit:Array(count).fill(false),ending:''}};
}
async function localServer(){
 const root=resolve('dist'),mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'};
 const headerText=await readFile(resolve(root,'_headers'),'utf8');
 const globalHeaders=Object.fromEntries(headerText.split(/\n\s*\n/)[0].split('\n').slice(1).filter(line=>line.includes(':')).map(line=>{const i=line.indexOf(':');return [line.slice(0,i).trim(),line.slice(i+1).trim()];}));
 assert.match(globalHeaders['Content-Security-Policy'],/frame-ancestors 'none'/);
 assert.equal(globalHeaders['X-Frame-Options'],'DENY');
 server=createServer(async(req,res)=>{
  try{
   const url=new URL(req.url,'http://localhost'),path=resolve(root,'.'+decodeURIComponent(url.pathname));
   if(path!==root&&!path.startsWith(root+sep)){res.writeHead(403).end();return;}
   const target=url.pathname==='/'||url.pathname.startsWith('/games/')?resolve(root,'index.html'):path;
   let data=await readFile(target);
   if(url.pathname==='/runtime-config.json'){
    const config=JSON.parse(data);config.environment='staging';config.features={...config.features,accountSocial:true,accountGames:true,classicRooms:true,classicCommunications:true,wordSaladRestricted:true,chessRestricted:false,publicDiscoverFeed:false};data=JSON.stringify(config);
   }
   res.writeHead(200,{...globalHeaders,'Content-Type':mime[extname(target)]||'application/octet-stream'}).end(data);
  }catch{res.writeHead(404).end();}
 });
 await new Promise((ok,fail)=>{server.once('error',fail);server.listen(0,'127.0.0.1',ok);});
 return 'http://127.0.0.1:'+server.address().port;
}
function observe(page,origin){
 const problems=[];
 page.on('pageerror',e=>problems.push(live?'uncaught application exception':'uncaught application exception: '+e.message));
 page.on('console',m=>{if(m.type()==='error'&& !/Failed to load resource/.test(m.text()))problems.push(live?'browser console error':'browser console error: '+m.text()+' @ '+JSON.stringify(m.location()));});
 page.on('response',r=>{if(r.url().startsWith(origin+'/assets/games/word-salad/')&&r.status()>=400)problems.push('Word Salad artwork HTTP '+r.status());});
 page.on('requestfailed',r=>{if(r.url().startsWith(origin+'/assets/games/word-salad/'))problems.push('Word Salad artwork request failed');});
 return problems;
}
async function inspect(page,n,view){
 const table=page.locator('.ws-table');
 await table.waitFor({timeout:45000});
 assert.equal(await table.locator('.ws-cell').count(),n*n);
 assert.equal(await table.locator('.ws-rack-tile,.ws-rack-empty').count(),BOARD_SPECS[n].rackSize);
 for(const selector of ['.ws-logo','.ws-board','.ws-rack','.ws-turn','.ws-player','.ws-bag','[data-ws-action="play-word"]','[data-ws-action="pass"]']){
  assert.ok(await table.locator(selector).first().isVisible(),'Missing '+selector);
 }
 const geometry=await table.evaluate(async el=>{
  const bad=[];const scroll=el.querySelector('.ws-board-scroll'),board=el.querySelector('.ws-board');
  for(const image of el.querySelectorAll('img')){try{await image.decode();if(!image.naturalWidth)bad.push('empty image');}catch{bad.push('broken image');}}
  for(const selector of ['.ws-table','.ws-board','.ws-rack']){
   const node=selector==='.ws-table'?el:el.querySelector(selector);
   const url=getComputedStyle(node).backgroundImage.match(/url\("?(.*?)"?\)/)?.[1];
   if(!url){bad.push('missing background '+selector);continue;}
   try{const i=new Image();i.src=url;await i.decode();}catch{bad.push('broken background '+selector);}
  }
  const box=node=>node.getBoundingClientRect(),tr=box(el),br=box(board),sr=box(scroll);
  if(tr.left< -1||tr.right>innerWidth+1)bad.push('table overflows viewport');
  if(document.documentElement.scrollWidth>innerWidth+2){
   const offenders=[...document.querySelectorAll('body *')].filter(node=>!scroll.contains(node)&&getComputedStyle(node).position!=='fixed').map(node=>({node,r:box(node)})).filter(({r})=>r.right>innerWidth+2||r.left< -2).slice(0,15).map(({node,r})=>({tag:node.tagName,classes:typeof node.className==='string'?node.className:'',left:Math.round(r.left),right:Math.round(r.right)}));
   bad.push('document horizontal overflow: '+JSON.stringify({viewport:innerWidth,document:document.documentElement.scrollWidth,offenders}));
  }
  const shell=el.closest('.app-shell'),layout=el.closest('.app-layout'),main=el.closest('.app-content');
  const lr=box(layout),mr=box(main);
  if(mr.width<lr.width-30)bad.push('game does not occupy full layout lane');
  if(innerWidth>=1101&&br.width<Math.min(750,innerWidth*.55))bad.push('desktop board too narrow');
  for(const rail of shell.querySelectorAll('.app-sidebar,.app-rail,.ecosystem-rail')){
   if(getComputedStyle(rail).display!=='none'&&box(rail).top<mr.bottom-1)bad.push('sidebar competes with game lane');
  }
  const mobileNav=shell.querySelector('.app-nav--mobile');
  if(innerWidth<=760&&mobileNav&&getComputedStyle(mobileNav).display!=='none'&&['fixed','sticky'].includes(getComputedStyle(mobileNav).position))bad.push('mobile navigation overlays gameplay');
  if(Math.abs(br.width-br.height)>2)bad.push('board not square');
  if(sr.right>tr.right+1)bad.push('board scroll container escapes table');
  for(const node of el.querySelectorAll('.ws-rack,.ws-side,.ws-panel,.ws-action,.ws-blank-picker')){
   const r=box(node);if(r.left<tr.left-1||r.right>tr.right+1||r.width<=0||r.height<=0)bad.push('clipped '+node.className);
   if(node.scrollWidth>node.clientWidth+2)bad.push('internal horizontal overflow '+node.className);
  }
  const cells=[...el.querySelectorAll('.ws-cell')].map(box);
  if(cells.some(r=>r.width<12||r.height<12))bad.push('unusable board cell');
  const columns=Math.round(Math.sqrt(cells.length));
  if(cells.some((r,i)=>i%columns!==0&&r.left<cells[i-1].right-.5||i>=columns&&r.top<cells[i-columns].bottom-.5))bad.push('overlapping cells');
  // Intentional horizontal scroll on narrow screens is valid, but last cell must be reachable.
  scroll.scrollLeft=scroll.scrollWidth;const last=box(el.querySelector('.ws-cell:last-child'));
  if(last.right>box(scroll).right+1)bad.push('last cell unreachable');
  scroll.scrollLeft=0;
  // Measure text contrast against composited solid panel backgrounds, not image pixels.
  const rgba=s=>s.match(/[\d.]+/g)?.map(Number)||[];
  const blend=(fg,bg)=>fg.slice(0,3).map((v,i)=>v*(fg[3]??1)+bg[i]*(1-(fg[3]??1)));
  const lum=c=>c.map(x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4;}).reduce((a,x,i)=>a+x*[.2126,.7152,.0722][i],0);
  let minContrast=Infinity;
  for(const node of el.querySelectorAll('.ws-header h2,.ws-header p,.ws-header a,.ws-panel h3,.ws-player strong,.ws-player small,.ws-score,.ws-turn,.ws-bag strong,.ws-feedback p,.ws-instruction,.ws-blank-picker,.ws-blank-picker select,.ws-action:not(:disabled) span,.ws-panel summary')){
   let bg=[255,255,255],chain=[];for(let p=node;p&&p!==el;p=p.parentElement)chain.unshift(p);
   for(const p of chain)bg=blend(rgba(getComputedStyle(p).backgroundColor),bg);
   const fg=blend(rgba(getComputedStyle(node).color),bg),a=lum(fg),b=lum(bg),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
   minContrast=Math.min(minContrast,ratio);if(ratio<4.5)bad.push('contrast below 4.5:1 '+node.className);
  }
  return {bad,minContrast,boardWidth:br.width,boardHeight:br.height,scrollable:scroll.scrollWidth>scroll.clientWidth+2};
 });
 assert.deepEqual(geometry.bad,[]);
 return {viewport:view,board:n,...geometry};
}
async function fixtureRun(origin){
 for(const n of sizes)for(const view of views){
  const context=await browser.newContext({viewport:view,reducedMotion:'reduce'});
  try{
   const s=snapshot(n),posts=[];
   assert.ok(normalizeSalad({status:200,data:{...envelope,session:s}},id));
   await context.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(url.origin!==origin){await route.abort();return;}
    if(!url.pathname.startsWith('/social-api/')){await route.continue();return;}
    const path=url.pathname,reply=(data,status=200)=>route.fulfill({status,json:data});
    if(path.endsWith('/v1/me'))return reply({walletRequired:false,profile:{subject:actor,displayName:'Qualification fixture'}});
    if(path.endsWith('/classic-sessions/'+id+'/action')){
     posts.push(route.request().postDataJSON());return reply({},400);
    }
    if(path.endsWith('/classic-sessions/'+id))return reply({...envelope,session:s});
    if(path.endsWith('/classic-rooms/'+roomId))return reply({...envelope,room:{id:roomId,gameId:'scrabble',seats:Array.from({length:s.seatCount},(_,index)=>index===0?{index,controller:'human',subject:actor}:{index,controller:'bot',difficulty:'hard'})}});
    if(path.endsWith('/classic-sessions'))return reply({...envelope,sessions:[s]});
    return reply({},404);
   });
   const page=await context.newPage(),problems=observe(page,origin);
   const navigation=await page.goto(origin+'/games/scrabble/play?session='+id);
   assert.match((await navigation.headerValue('content-security-policy'))||'',/frame-ancestors 'none'/);
   assert.equal(await navigation.headerValue('x-frame-options'),'DENY');
   const measured=await inspect(page,n,view);
   // Decode every approved published asset, including art not shown in this state.
   if(n===11&&view.width===1920)assert.equal(await page.evaluate(async paths=>{let count=0;for(const path of paths){const img=new Image();img.src='/assets/games/word-salad/'+path;await img.decode();count++;}return count;},SALAD_ART),SALAD_ART.length);
   const tag=n+'-'+view.width+'x'+view.height;
   await page.screenshot({path:resolve(OUT,'fixture-'+tag+'.png'),fullPage:true});
   await page.locator('[data-ws-tile="0"]').click();
   await page.locator('[data-ws-cell="2"]').click();
   assert.equal(await page.locator('.ws-draft').count(),1);
   await page.locator('[data-ws-action="play-word"]').click();
   await page.locator('.ws-error').waitFor();
   assert.equal(posts.length,1);assert.equal(posts[0].expectedSequence,2);
   assert.equal(await page.locator('.ws-draft').count(),1);
   await page.locator('[data-ws-action="recall"]').click();
   assert.equal(await page.locator('.ws-draft').count(),0);
   assert.deepEqual(problems,[]);
   results.push({...measured,interaction:'draft, rejected move, recall',status:'passed'});
  }finally{await context.close();}
 }
}
async function startupJourney(origin){
 for(const [n,difficulty] of [[11,'easy'],[13,'medium'],[15,'hard'],[17,'easy'],[19,'medium'],[21,'hard']]){
  const context=await browser.newContext({viewport:{width:1366,height:768}});
  try{
   const s=snapshot(n),writes=[],count=s.seatCount,variant=s.privateView.variant;
   const room={id:roomId,host:actor,gameId:'scrabble',seatCount:count,visibility:'private',status:'open',revision:1,variantId:variant,format:variant,invites:[],seats:Array.from({length:count},(_,index)=>index===0?{index,controller:'human',subject:actor,team:index}:{index,controller:'empty',team:index})};
   let started=false;
   await context.route('**/*',async route=>{
    const url=new URL(route.request().url()),path=url.pathname,method=route.request().method(),reply=(data,status=200)=>route.fulfill({status,json:data});
    if(url.origin!==origin)return route.abort();
    if(!path.startsWith('/social-api/'))return route.continue();
    const env={...envelope,playable:false};
    if(path.endsWith('/v1/me'))return reply({walletRequired:false,profile:{subject:actor,displayName:'Qualification fixture'}});
    if(path.endsWith('/classic-rooms')&&method==='POST'){
     const b=route.request().postDataJSON();assert.deepEqual(b,{gameId:'scrabble',seatCount:count,visibility:'private',format:variant});writes.push('create');return reply({...env,room},201);
    }
    if(path.endsWith('/classic-rooms/'+roomId+'/change')&&method==='POST'){
     const b=route.request().postDataJSON();assert.equal(b.expectedRevision,room.revision);assert.equal(b.action,'bot');assert.equal(b.difficulty,difficulty);assert.equal(room.seats[b.seat].controller,'empty');
     room.seats[b.seat]={index:b.seat,team:b.seat,controller:'bot',difficulty};room.revision++;if(room.seats.every(x=>x.controller!=='empty'))room.status='ready';writes.push('bot');return reply({...env,room});
    }
    if(path.endsWith('/classic-sessions')&&method==='POST'){
     assert.equal(room.status,'ready');assert.deepEqual(route.request().postDataJSON(),{roomId});writes.push('start');started=true;room.status='in_game';return reply({...envelope,session:s},201);
    }
    if(path.endsWith('/classic-sessions/'+id+'/action')&&method==='POST'){
     const b=route.request().postDataJSON();assert.equal(b.expectedSequence,s.sequence+1);assert.equal(b.move.type,'pass');s.sequence++;writes.push('move');return reply({...envelope,session:s});
    }
    if(path.endsWith('/classic-sessions/'+id))return reply({...envelope,session:s},started?200:404);
    if(path.endsWith('/classic-rooms/'+roomId))return reply({...env,room});
    if(path.endsWith('/classic-sessions'))return reply({...envelope,sessions:started?[s]:[]});
    return reply({},404);
   });
   const page=await context.newPage(),problems=observe(page,origin);page.on('dialog',dialog=>dialog.accept());
   await page.goto(origin+'/games/scrabble');
   const form=page.locator('[data-salad-create]');await form.waitFor({timeout:45000});
   await form.locator('[name=size]').selectOption(String(n));await form.locator('[name=count]').selectOption(String(count));await form.locator('[name=opponents]').selectOption(difficulty);
   await form.getByRole('button',{name:'Create Game'}).click();
   await page.waitForURL('**/games/scrabble/play?session='+id,{timeout:45000});
   await page.locator('.ws-table').waitFor({timeout:45000});
   assert.deepEqual(writes,['create',...Array(count-1).fill('bot'),'start']);
   await page.locator('[data-ws-action=pass]').click();
   await page.waitForFunction(()=>document.querySelector('.ws-header')?.textContent.includes('Revision 2'));
   assert.equal(writes.at(-1),'move');
   await page.reload();await page.locator('.ws-table').waitFor({timeout:45000});assert.match(await page.locator('.ws-header').innerText(),/Revision 2/);
   assert.deepEqual(problems,[]);
   results.push({board:n,difficulty,players:count,interaction:'setup, computer seats, authoritative session start, pass, cold reload (fixture)',status:'passed'});
  }finally{await context.close();}
 }
}
async function liveRun(){
 const origin='https://bonggoggles.420integrated.org';
 const raw=process.env.BC442_COOKIE,session=process.env.BC442_SESSION_ID,hash=process.env.BC442_RULES_HASH;
 if(!raw&&!session&&!hash){report.status='skipped';report.reason='No authorized dedicated live test session configured';return;}
 const key=/^([A-Za-z0-9_-]{1,80})=([^;\s]{1,4096})$/.exec(raw||'');
 assert.ok(key&&/^[0-9a-f-]{36}$/.test(session||'')&&/^[a-f0-9]{64}$/.test(hash||''),'Incomplete live acceptance configuration');
 const read=async(page,path)=>page.evaluate(async path=>{const r=await fetch(path,{credentials:'same-origin',cache:'no-store',redirect:'error'});return {status:r.status,data:await r.json()};},path);
 for(const view of views){
  const context=await browser.newContext({viewport:view,reducedMotion:'reduce'});
  try{
   await context.addCookies([{name:key[1],value:key[2],url:origin,secure:true,httpOnly:true,sameSite:'Strict'}]);
   const page=await context.newPage(),problems=observe(page,origin);
   await page.goto(origin+'/games/scrabble/play?session='+session,{waitUntil:'domcontentloaded'});
   const me=await read(page,'/social-api/v1/me');assert.ok(me.status===200&&me.data.walletRequired===false&&/^[0-9a-f-]{36}$/.test(me.data.profile?.subject||''),'Live identity not verified');
   const response=await read(page,'/social-api/v1/classic-sessions/'+session),s=normalizeSalad(response,session);
   assert.ok(s&&s.rulesHash===hash&&s.status==='active','Live test session is not authoritative or has wrong rules');
   const measured=await inspect(page,s.format.p.size,view);
   await page.reload({waitUntil:'domcontentloaded'});await page.locator('.ws-table').waitFor({timeout:45000});
   const recovered=normalizeSalad(await read(page,'/social-api/v1/classic-sessions/'+session),session);
   assert.ok(recovered&&recovered.viewerSeat===s.viewerSeat&&recovered.rulesHash===hash&&recovered.sequence>=s.sequence,'Live reload recovery failed');
   // Retain game surface only; mask rack, board, score and identity-sensitive state.
   await page.locator('.ws-table').screenshot({path:resolve(OUT,'live-'+view.width+'x'+view.height+'.png'),mask:[page.locator('.ws-rack'),page.locator('.ws-board'),page.locator('.ws-player'),page.locator('.ws-turn'),page.locator('.ws-feedback')]});
   assert.deepEqual(problems,[]);
   results.push({...measured,status:'passed',interaction:'authenticated authoritative state and reload (read-only)'});
  }finally{await context.close();}
 }
}
try{
 if(live)await liveRun();else {const origin=await localServer();await startupJourney(origin);await fixtureRun(origin);}
 if(report.status!=='skipped')report.status='passed';
}catch(error){report.status='failed';if(!live)report.error=String(error);else report.error='Live acceptance failed; sensitive error details suppressed';process.exitCode=1;}
finally{await browser.close();if(server)await new Promise(ok=>server.close(ok));await writeFile(resolve(OUT,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));}
