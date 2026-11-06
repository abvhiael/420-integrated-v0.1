// M7 browser-level viewport and bonus-panel qualification.
// Run from clients/420bet-lobby after installing playwright + chromium.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';

const port=4177,base='http://127.0.0.1:'+port;
const artifactDir='artifacts/cannabis-cowboy-m7';
const dimensions=[
 {width:1920,height:1080,name:'desktop-1080p'},
 {width:1366,height:768,name:'desktop-laptop'},
 {width:1280,height:720,name:'desktop-720p'},
 {width:820,height:900,name:'tablet'},
 {width:390,height:844,name:'phone'}
];
const server=spawn('npm',['run','dev','--','--host','127.0.0.1','--port',String(port),'--strictPort'],{stdio:'ignore'});
let browser;
try{
 await mkdir(artifactDir,{recursive:true});
 let ready=false;
 for(let attempt=0;attempt<70;attempt++){
  try{const r=await fetch(base);if(r.ok){ready=true;break;}}catch{}
  await new Promise(resolve=>setTimeout(resolve,300));
 }
 assert(ready,'Vite dev server did not start');
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 for(const vp of dimensions){
  const page=await browser.newPage({viewport:{width:vp.width,height:vp.height},deviceScaleFactor:1});
  await page.goto(base+'/#game=slots&machine=cannabis-cowboy',{waitUntil:'domcontentloaded'});
  await page.locator('.cc-game').waitFor({timeout:15000});
  const result=await page.evaluate(()=>{
   const rect=s=>{const el=document.querySelector(s);if(!el)return null;const r=el.getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,height:r.height,width:r.width};};
   const cells=[...document.querySelectorAll('.cc-cell')];
   return {
    viewport:{width:window.innerWidth,height:window.innerHeight},
    fullWidth:document.documentElement.scrollWidth,
    game:rect('.cc-game'),gamebar:rect('.gamebar'),stage:rect('.cc-stage'),
    board:rect('.cc-symbol-grid'),lastCell:rect('.cc-cell:last-child'),
    console:rect('.cc-console'),status:rect('.cc-round-status'),
    rows:cells.length,
    firstRowHeight:cells[0]?.getBoundingClientRect().height||0,
    lastRowHeight:cells[47]?.getBoundingClientRect().height||0,
    overflowGame:document.querySelector('.cc-game').scrollWidth-document.querySelector('.cc-game').clientWidth
   };
  });
  await page.screenshot({path:artifactDir+'/'+vp.name+'.png',fullPage:true});
  console.log(vp.name,JSON.stringify(result));
  assert.equal(result.rows,48,vp.name+' lost a reel cell');
  assert(result.lastRowHeight>16,vp.name+' last reel row too small');
  assert(result.firstRowHeight>16,vp.name+' first reel row too small');
  assert(result.board.height>250,vp.name+' board too short');
  assert(result.fullWidth<=vp.width+3,vp.name+' has horizontal page overflow');
  assert(result.overflowGame<=3,vp.name+' game overflows horizontally');
  if(vp.width>=1051&&vp.height>=620){
   assert(result.game.bottom<=vp.height+3,vp.name+' cabinet extends below viewport');
   assert(result.console.bottom<=vp.height+3,vp.name+' practice controls below viewport');
   assert(result.lastCell.bottom<=result.board.bottom+2,vp.name+' last row clipped');
  }
  await page.close();
 }
 // Validate that live overlays remain inside the cabinet, rather than
 // sliding above the game title or offscreen at the target laptop size.
 const page=await browser.newPage({viewport:{width:1366,height:768}});
 await page.goto(base+'/#game=slots&machine=cannabis-cowboy',{waitUntil:'domcontentloaded'});
 await page.locator('.cc-game').waitFor();
 const roadMetrics=await page.evaluate(async()=>{
  const {createCannabisCowboyPractice}=await import('/src/cannabis-cowboy-game.js');
  const pattern=()=>Array.from({length:48},(_,i)=>(Math.floor(i/6)*3+i%6)%8);
  const road=pattern();[0,1,2].forEach(p=>road[p]=10);
  const tasks=[];
  const replacement=createCannabisCowboyPractice(document,{
   reducedMotion:true,credits:500,bet:20,rng:()=>.41,
   setTimeout:fn=>{tasks.push(fn);return tasks.length;},clearTimeout:()=>{},
   roundOptions:{baseBoard:road}
  });
  document.querySelector('.cc-game').replaceWith(replacement);
  replacement.querySelector('.cc-spin').click();
  let n=0;
  while(tasks.length&&!replacement.getPracticeState().roadActive&&n++<1500)tasks.shift()();
  while(tasks.length&&replacement.querySelector('.cc-road-panel').hidden&&n++<1500)tasks.shift()();
  const r=replacement.querySelector('.cc-road-panel').getBoundingClientRect();
  const m=replacement.querySelector('.cc-middle').getBoundingClientRect();
  const buttons=[...replacement.querySelectorAll('.cc-road-case')].map(b=>b.getBoundingClientRect());
  return {found:!replacement.querySelector('.cc-road-panel').hidden,picks:buttons.length,panel:{top:r.top,bottom:r.bottom},stage:{top:m.top,bottom:m.bottom},cases:buttons.map(x=>({top:x.top,bottom:x.bottom}))};
 });
 console.log('road-trip-panel',JSON.stringify(roadMetrics));
 await page.screenshot({path:artifactDir+'/road-trip-overlay.png',fullPage:true});
 assert(roadMetrics.found&&roadMetrics.picks===3,'Road Trip overlay missing guitar cases');
 assert(roadMetrics.panel.top>=roadMetrics.stage.top-3&&roadMetrics.panel.bottom<=roadMetrics.stage.bottom+3,'Road Trip overlay escapes cabinet');
 assert(roadMetrics.cases.every(x=>x.bottom<=roadMetrics.panel.bottom+2),'Guitar cases clipped by Road Trip overlay');
 await page.close();
 console.log('M7 viewport and Road Trip browser qualification passed.');
}finally{
 if(browser)await browser.close();
 server.kill('SIGTERM');
}
