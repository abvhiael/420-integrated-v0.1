import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
import {writeFileSync,mkdirSync} from 'node:fs';
const chrome=process.env.CHROME_BIN||'/usr/bin/google-chrome';
const browser=await puppeteer.launch({headless:true,executablePath:chrome,args:['--no-sandbox','--disable-dev-shm-usage']});
try{
 mkdirSync('qualification/sin-city',{recursive:true});
 for(const [name,width,height] of [['desktop',1440,900],['mobile',390,844]]){
  const page=await browser.newPage();
  await page.setViewport({width,height,deviceScaleFactor:1});
  const errors=[];
  page.on('pageerror',error=>errors.push(String(error)));
  await page.goto('http://127.0.0.1:4173/#game=slots&machine=sin-city-high-rollers',{waitUntil:'networkidle0'});
  await page.waitForSelector('.sc-game');
  const initial=await page.evaluate(()=>{
   const rect=sel=>{const node=document.querySelector(sel);if(!node)throw Error('Missing '+sel);const r=node.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom};};
   const images=[...document.querySelectorAll('.sc-game img')].map(img=>({src:img.getAttribute('src'),loaded:img.complete&&img.naturalWidth>0,width:img.naturalWidth,height:img.naturalHeight}));
   return {reels:rect('.sc-reels'),bobby:rect('.sc-mascot'),portrait:rect('.sc-bobby'),logo:rect('.sc-logo'),cabinet:rect('.sc-cabinet'),cells:[...document.querySelectorAll('.sc-reel')].map(col=>[...col.querySelectorAll('.sc-symbol')].map(cell=>{const r=cell.getBoundingClientRect();return {y:r.y,bottom:r.bottom,height:r.height};})),images,cellCount:document.querySelectorAll('.sc-symbol').length,columns:document.querySelectorAll('.sc-reel').length,bodyScroll:document.documentElement.scrollWidth,wallpaper:getComputedStyle(document.querySelector('main.immersive')).backgroundImage,headerBackground:getComputedStyle(document.querySelector('.gamebar')).backgroundColor};
  });
  assert.equal(initial.cellCount,20,'Must render exactly 20 positions');
  assert.equal(initial.columns,5);
  assert.ok(initial.cells.every(col=>col.length===4),'Each reel must show four rows');
  for(const col of initial.cells){
   assert.ok(col.every(cell=>cell.height>=30),'Collapsed symbol row: '+JSON.stringify(col));
   assert.ok(col[0].y>=initial.reels.y-4,'Top symbol escapes reel grid');
   assert.ok(col[3].bottom<=initial.reels.bottom+4,'Fourth row must be fully visible, not cropped');
  }
  assert.ok(initial.reels.w>200&&initial.reels.h>150,'Reels must be visible');
  assert.ok(initial.bobby.w>80&&initial.bobby.h>(name==='mobile'?90:140),'Bobby character panel must be visible');
  assert.ok(initial.logo.w>(name==='desktop'?370:100),'Title must be rendered large');
  if(name==='desktop')assert.ok(initial.portrait.w>=300,'Bobby must be the large dominant character illustration');
  assert.ok(initial.images.every(x=>x.loaded),'All artwork must load: '+JSON.stringify(initial.images.filter(x=>!x.loaded)));
  // Both desktop side-by-side and narrow stacked layouts must not overlap.
  const horizontalOverlap=Math.min(initial.bobby.right,initial.reels.right)-Math.max(initial.bobby.x,initial.reels.x);
  const verticalOverlap=Math.min(initial.bobby.bottom,initial.reels.bottom)-Math.max(initial.bobby.y,initial.reels.y);
  assert.ok(horizontalOverlap<=1||verticalOverlap<=1,'Bobby panel overlaps the reels');
  assert.ok(initial.bodyScroll<=width+3,'Unexpected horizontal overflow');
  assert.match(initial.wallpaper,/bg_las_vegas_strip/,'Vegas wallpaper must extend behind title bar');
  if(name==='desktop')assert.ok(initial.cabinet.bottom<=height,'Cabinet should fit vertically on a 900px desktop viewport: '+JSON.stringify(initial.cabinet));
  await page.screenshot({path:'qualification/sin-city/'+name+'.png',fullPage:true});
  await page.locator('button').count?.();
  await page.evaluate(()=>{const b=[...document.querySelectorAll('.sc-control')].find(b=>b.textContent.includes('INFO'));b?.click();});
  await page.waitForSelector('.sc-modal');
  await page.evaluate(()=>document.querySelector('.sc-modal-close')?.click());
  await page.evaluate(()=>{const b=[...document.querySelectorAll('.sc-control')].find(b=>b.textContent.includes('TURBO'));b?.click();});
  await page.evaluate(()=>document.querySelector('.sc-spin')?.click());
  const track=await page.evaluate(()=>({count:document.querySelectorAll('.sc-spin-track').length,animation:getComputedStyle(document.querySelector('.sc-spin-track')).animationName}));
  assert.equal(track.count,5,'All five reels show their own continuous track');
  assert.match(track.animation,/sc-smooth-scroll/,'Rolling animation must use GPU-transformed track');
  const rollingGeometry=await page.evaluate(()=>{
   const box=node=>{const r=node.getBoundingClientRect();return {width:r.width,height:r.height};};
   const reel=document.querySelector('.sc-reel-spinning');
   return {cell:box(reel.querySelector('.sc-symbol')),tile:box(reel.querySelector('.sc-spin-tile')),image:box(reel.querySelector('.sc-spin-tile img'))};
  });
  assert.ok(rollingGeometry.tile.height<=rollingGeometry.cell.height+3,'Each spinning tile must fit one symbol frame');
  assert.ok(rollingGeometry.image.height<=rollingGeometry.cell.height,'Spinning art is taller than the frame');
  assert.ok(rollingGeometry.image.width<=rollingGeometry.cell.width,'Spinning art is wider than the frame');
  await page.screenshot({path:'qualification/sin-city/'+name+'-spinning.png',fullPage:true});

  await new Promise(resolve=>setTimeout(resolve,960));
  const stopCount=await page.evaluate(()=>document.querySelectorAll('.sc-reel-spinning').length);
  assert.equal(stopCount,4,'Only first reel should settle before next 750ms stop');
  await page.waitForFunction(()=>!document.querySelector('.sc-reel-spinning'),{timeout:5000});
  assert.deepEqual(errors,[],'Browser JS errors');
  console.log(name,JSON.stringify({reels:initial.reels,bobby:initial.bobby,logo:initial.logo,artworks:initial.images.length}));
  await page.close();
 }
}finally{await browser.close();}
