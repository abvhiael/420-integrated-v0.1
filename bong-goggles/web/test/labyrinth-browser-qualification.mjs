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
 console.log('BC-2.4 Chromium approved board, desktop/mobile sizing, navigation and fail-closed preview PASS');
}finally{
 if(browser)await browser.close();
 await new Promise(resolve=>server.close(resolve));
}
