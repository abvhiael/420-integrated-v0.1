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
  const artworkLayout=await page.evaluate(()=>{
   const rect=node=>{const r=node.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom};};
   const cabinet=document.querySelector('.sc-cabinet');
   const mast=cabinet.querySelector(':scope > .sc-masthead');
   const logo=mast?.querySelector('.sc-logo');
   const guide=document.querySelector('.sc-machine > .sc-bonus-guide img');
   const paytable=cabinet.querySelector('.sc-ways-side');
   return {
    mast:mast&&rect(mast),logo:logo&&rect(logo),guide:guide&&rect(guide),
    paytable:paytable&&rect(paytable),
    logoLoaded:logo?.complete&&logo.naturalWidth>0,guideLoaded:guide?.complete&&guide.naturalWidth>0,
    logoSrc:logo?.getAttribute('src'),guideSrc:guide?.getAttribute('src')
   };
  });
  assert.ok(artworkLayout.mast,'Wide logo must be above reels inside cabinet');
  assert.ok(artworkLayout.logoLoaded&&artworkLayout.guideLoaded,'Both newly uploaded PNGs must load');
  assert.match(artworkLayout.logoSrc,/branding\/logo_sin_city_high_rollers\.png/);
  const logoRendering=await page.evaluate(()=>{
   const logo=document.querySelector('.sc-cabinet > .sc-masthead .sc-logo');
   const board=document.querySelector('.sc-reels');
   const css=getComputedStyle(logo);
   const rect=logo.getBoundingClientRect(),boardRect=board.getBoundingClientRect();
   const naturalRatio=logo.naturalWidth/logo.naturalHeight;
   const fittedWidth=Math.min(rect.width,rect.height*naturalRatio);
   const fittedHeight=fittedWidth/naturalRatio;
   const fittedLeft=rect.left+(rect.width-fittedWidth)/2;
   const fittedCenter=fittedLeft+fittedWidth/2;
   return {fit:css.objectFit,position:css.objectPosition,naturalRatio,fittedRatio:fittedWidth/fittedHeight,
    imageCenter:fittedCenter,boardCenter:boardRect.left+boardRect.width/2};
  });
  assert.equal(logoRendering.fit,'contain','Approved logo must never be stretched with object-fit:fill');
  assert.equal(logoRendering.position,'50% 50%','Approved logo must be centered in its space');
  assert.ok(Math.abs(logoRendering.fittedRatio-logoRendering.naturalRatio)<.001,
    'Rendered logo must retain the original uploaded PNG aspect ratio');
  assert.ok(Math.abs(logoRendering.imageCenter-logoRendering.boardCenter)<8,
    'Approved logo must be centered horizontally over the five-reel board: '+JSON.stringify(logoRendering));

  assert.match(artworkLayout.guideSrc,/features\/bonus_triggers_sin_city_high_rollers\.png/);
  if(name==='desktop'){
   assert.ok(artworkLayout.guide.x>=artworkLayout.paytable.right-3,
    'Bonus trigger graphic must be OUTSIDE the gameboard to the right of the paytable');
   assert.ok(artworkLayout.logo.bottom<=initial.reels.y+5,
    'Wide logo must sit immediately above reel area');
   assert.ok(artworkLayout.logo.w>=initial.reels.w*.85,
    'The new logo must be horizontally aligned to approximately reelboard width');
   assert.ok(initial.reels.w>=425,'The third column must not make five reels too narrow');
  }else{
   assert.ok(artworkLayout.guide.y>=artworkLayout.paytable.bottom-3,
    'On mobile, bonus trigger art must stack after the paytable');
  }

  const payout=await page.evaluate(()=>{
   const panel=document.querySelector('.sc-play-area .sc-ways-side');
   const reel=document.querySelector('.sc-reels');
   const box=node=>{const r=node.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,w:r.width,h:r.height};};
   return {side:panel?box(panel):null,reel:box(reel),tiers:panel?.querySelectorAll('.sc-ways-tier:not(.sc-ways-tier-head)').length,heading:panel?.querySelector('.sc-ways-heading')?.textContent};
  });
  assert.ok(payout.side,'The paytable must be visible without opening INFO');
  assert.equal(payout.tiers,17,'Every paying symbol must have a live paytable row');
  assert.equal(payout.heading,'GAME PAYTABLE');
  if(name==='desktop'){
   assert.ok(payout.side.x>=payout.reel.right+4,'Paytable must sit RIGHT of reels');
   assert.ok(payout.side.w>=180,'Paytable must be readable');
  }else{
   assert.ok(payout.side.y>=payout.reel.bottom,'Paytable must stack BELOW reels on narrow screens');
  }
  assert.ok(payout.reel.w>200,'Adding paytable must not collapse reel width');

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
  // Completion layout geometry: use exactly the same DOM classes and symbol
  // asset as the real free-spin completion, without needing random bonus RNG.
  const completion=await page.evaluate(()=>{
   const host=document.querySelector('.sc-game');
   const overlay=document.createElement('div');overlay.className='sc-free-complete';
   const chips=document.createElement('div');chips.className='sc-complete-chips';
   const image=document.createElement('img');image.className='sc-complete-chip-art';
   image.src='/assets/420bet/sin-city-high-rollers/symbols/sym_chips.png';
   const face=document.createElement('strong');face.className='sc-complete-chip-face';face.textContent='FREE SPINS COMPLETE';
   chips.append(image,face);
   const total=document.createElement('div');total.className='sc-free-complete-value';total.textContent='12345.67 PRACTICE CREDITS';
   const next=document.createElement('p');next.className='sc-free-complete-click';next.textContent='CLICK TO CONTINUE';
   overlay.append(chips,total,next);host.append(overlay);
   const box=node=>{const r=node.getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:r.height,left:r.left,right:r.right};};
   return {chips:box(chips),total:box(total),next:box(next),overlay:box(overlay)};
  });
  assert.ok(completion.total.top>=completion.chips.bottom+8,
   'Free spin total must render BELOW chip graphic with a visible gap: '+JSON.stringify(completion));
  assert.ok(completion.next.top>=completion.total.bottom+8,
   'Click to continue must render below the entire winnings total');
  assert.ok(completion.total.bottom<=completion.overlay.bottom+1,
   'Total credits must remain visible inside completion overlay');
  await page.screenshot({path:'qualification/sin-city/'+name+'-free-complete.png',fullPage:true});
  await page.evaluate(()=>document.querySelector('.sc-free-complete')?.remove());

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
  assert.ok(stopCount>0&&stopCount<5,'Reels must settle sequentially, leaving some still spinning during capture');
  await page.waitForFunction(()=>!document.querySelector('.sc-reel-spinning'),{timeout:5000});
  assert.deepEqual(errors,[],'Browser JS errors');
  console.log(name,JSON.stringify({reels:initial.reels,bobby:initial.bobby,logo:initial.logo,artworks:initial.images.length}));
  await page.close();
 }
}finally{await browser.close();}
