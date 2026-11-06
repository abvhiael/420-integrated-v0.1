import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
import {writeFileSync,mkdirSync} from 'node:fs';
const chrome=process.env.CHROME_BIN||'/usr/bin/google-chrome';
const browser=await puppeteer.launch({headless:true,executablePath:chrome,args:['--no-sandbox','--disable-dev-shm-usage']});
try{
 mkdirSync('qualification/sin-city',{recursive:true});
 for(const [name,width,height] of [['desktop',1440,1000],['mobile',390,844]]){
  const page=await browser.newPage();
  await page.setViewport({width,height,deviceScaleFactor:1});
  const errors=[];
  page.on('pageerror',error=>errors.push(String(error)));
  await page.goto('http://127.0.0.1:4173/#game=slots&machine=sin-city-high-rollers',{waitUntil:'networkidle0'});
  await page.waitForSelector('.sc-game');
  const initial=await page.evaluate(()=>{
   const rect=sel=>{const node=document.querySelector(sel);if(!node)throw Error('Missing '+sel);const r=node.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom};};
   const images=[...document.querySelectorAll('.sc-game img')].map(img=>({src:img.getAttribute('src'),loaded:img.complete&&img.naturalWidth>0,width:img.naturalWidth,height:img.naturalHeight}));
   return {reels:rect('.sc-reels'),bobby:rect('.sc-mascot'),logo:rect('.sc-logo'),cabinet:rect('.sc-cabinet'),images,cellCount:document.querySelectorAll('.sc-symbol').length,columns:document.querySelectorAll('.sc-reel').length,bodyScroll:document.documentElement.scrollWidth};
  });
  assert.equal(initial.cellCount,20,'Must render exactly 20 positions');
  assert.equal(initial.columns,5);
  assert.ok(initial.reels.w>200&&initial.reels.h>150,'Reels must be visible');
  assert.ok(initial.bobby.w>80&&initial.bobby.h>140,'Bobby character panel must be visible');
  assert.ok(initial.logo.w>100,'Title must be visible');
  assert.ok(initial.images.every(x=>x.loaded),'All artwork must load: '+JSON.stringify(initial.images.filter(x=>!x.loaded)));
  // Both desktop side-by-side and narrow stacked layouts must not overlap.
  const horizontalOverlap=Math.min(initial.bobby.right,initial.reels.right)-Math.max(initial.bobby.x,initial.reels.x);
  const verticalOverlap=Math.min(initial.bobby.bottom,initial.reels.bottom)-Math.max(initial.bobby.y,initial.reels.y);
  assert.ok(horizontalOverlap<=1||verticalOverlap<=1,'Bobby panel overlaps the reels');
  assert.ok(initial.bodyScroll<=width+3,'Unexpected horizontal overflow');
  await page.screenshot({path:'qualification/sin-city/'+name+'.png',fullPage:true});
  await page.locator('button').count?.();
  await page.evaluate(()=>{const b=[...document.querySelectorAll('.sc-control')].find(b=>b.textContent.includes('INFO'));b?.click();});
  await page.waitForSelector('.sc-modal');
  await page.evaluate(()=>document.querySelector('.sc-modal-close')?.click());
  await page.evaluate(()=>{const b=[...document.querySelectorAll('.sc-control')].find(b=>b.textContent.includes('TURBO'));b?.click();});
  await page.evaluate(()=>document.querySelector('.sc-spin')?.click());
  await page.waitForFunction(()=>!document.querySelector('.sc-reel-spinning'),{timeout:5000});
  assert.deepEqual(errors,[],'Browser JS errors');
  console.log(name,JSON.stringify({reels:initial.reels,bobby:initial.bobby,logo:initial.logo,artworks:initial.images.length}));
  await page.close();
 }
}finally{await browser.close();}
