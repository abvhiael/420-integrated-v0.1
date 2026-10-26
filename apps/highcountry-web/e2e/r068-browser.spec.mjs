import {test,expect} from '@playwright/test';
import {createHighCountryServer} from '../server.mjs';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';

let server,origin;
test.beforeAll(async()=>{
 const config={schema:'highcountry-web-runtime-v1',mode:'offline'};
 server=createHighCountryServer({config});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 origin='http://127.0.0.1:'+server.address().port;
});
test.afterAll(async()=>{if(server?.listening)await new Promise(resolve=>server.close(resolve));});

test('real Chromium: guest starts, grows, returns, harvests and never requires wallet',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.clock.install({time:new Date('2026-10-15T12:00:00Z')});
 await page.goto(origin+'/play');
 await expect(page.getByRole('heading',{name:'Play'})).toBeVisible();
 await expect(page.getByText('Network: offline / not configured')).toBeVisible();
 await page.getByRole('button',{name:'Start guest game'}).click();
 await page.getByRole('button',{name:'Plant locally'}).click();
 await expect(page.getByText('Plant stage: germination')).toBeVisible();
 await expect(page.locator('.game-panel img')).toHaveAttribute('src',/hc-stage-germination-tray\.png/);
 const id=await page.getByText(/Local preview plant:/).innerText();
 await page.reload();
 await expect(page.getByText(id)).toBeVisible();
 await page.clock.fastForward(18*86400000);
 await page.getByRole('button',{name:'Recheck elapsed time'}).click();
 await expect(page.getByText('Plant stage: ready')).toBeVisible();
 await expect(page.locator('.game-panel img')).toHaveAttribute('src',/hc-stage-flowering-pot\.png/);
 await page.getByRole('button',{name:'Harvest local preview'}).click();
 await expect(page.getByText('Completed local harvests: 1')).toBeVisible();
 await expect(page.getByText(/Local FLOWER preview:/)).toContainText('nontransferable');
 await page.goto(origin+'/account');
 await expect(page.getByText(/Account sign-in unavailable/)).toBeVisible();
 await page.goto(origin+'/play');
 await expect(page.getByText('Completed local harvests: 1')).toBeVisible();
 expect(errors).toEqual([]);
});
test('real Chromium: invalid route, no implicit wallet, bad save, offline and asset transport',async({page})=>{
 let walletCalls=0;await page.addInitScript(()=>{window.ethereum={request:async()=>{window.__walletCalls=(window.__walletCalls||0)+1;throw Error('not-authorized');}};});
 await page.goto(origin+'/play');
 const img=page.locator('header img');
 await expect(img).toBeVisible();
 const response=await page.request.get(origin+'/assets/cultivation/hc-stage-vegetative-pot.png');
 expect(response.status()).toBe(200);
 expect(response.headers()['content-type']).toBeTruthy();
 const bytes=await response.body();expect(bytes.subarray(0,8).toString('hex')).toBe('89504e470d0a1a0a');
 await page.evaluate(()=>localStorage.setItem('highcountry.guest.v1','{broken'));
 await page.reload();
 await expect(page.getByRole('alert')).toContainText('guest-save-corrupt');
 expect(await page.evaluate(()=>window.__walletCalls||0)).toBe(0);
 await page.goto(origin+'/this-route-does-not-exist');
 expect((await page.locator('body').innerText())).toContain('Not found');
});
test('real Chromium: unavailable artwork degrades to local fallback without gameplay loss',async({page})=>{
 await page.route('**/assets/cultivation/hc-stage-germination-tray.png',route=>route.abort());
 await page.goto(origin+'/play');
 await page.getByRole('button',{name:'Start guest game'}).click();
 await page.getByRole('button',{name:'Plant locally'}).click();
 await expect(page.locator('.game-panel img')).toHaveAttribute('src',/highcountry-growing\.svg/);
 await expect(page.getByRole('button',{name:'Recheck elapsed time'})).toBeEnabled();
});

test('real Chromium: marketplace route is bundled and wallet-free offline disclosure is visible',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/marketplace');
 await expect(page.getByRole('heading',{name:'Marketplace'})).toBeVisible();
 await expect(page.getByText(/Marketplace unavailable offline/)).toBeVisible();
 await expect(page.getByRole('navigation',{name:'Main navigation'}).getByRole('link',{name:'Marketplace'})).toHaveAttribute('aria-current','page');
 expect(errors).toEqual([]);
});

test('real Chromium: skills and research route protects offline play and does not request wallet',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.ethereum={request:async()=>{throw Error('unexpected-wallet-request');}};});
 await page.goto(origin+'/skills');
 await expect(page.getByRole('heading',{name:'Skills & Research'})).toBeVisible();
 await expect(page.getByText(/Skills and research require a verified registered profile/)).toBeVisible();
 await expect(page.getByRole('link',{name:'Skills & Research'})).toHaveAttribute('aria-current','page');
 expect(errors).toEqual([]);
});

test('HC-GFX-2.1.2: real Chromium loads each of nine approved cultivation backgrounds',async({page})=>{
 const failures=[];page.on('pageerror',error=>failures.push(error.message));
 await page.goto(origin+'/play');
 await page.getByRole('button',{name:'Start guest game'}).click();
 const regionSelect=page.getByRole('combobox',{name:'Preview region'});
 const environmentSelect=page.getByRole('combobox',{name:'Preview environment'});
 for(const region of ['emerald-coast','golden-prairie','red-mesa']){
  await regionSelect.selectOption(region);
  for(const environment of ['outdoor','greenhouse','indoor']){
   await environmentSelect.selectOption(environment);
   const name='hc-env-'+region+'-'+environment+'-background.png';
   const image=page.locator('.cultivation-scene-image');
   await expect(image).toHaveAttribute('src','/assets/cultivation/environments/'+name);
   await expect(image).toBeVisible();
   await expect.poll(()=>image.evaluate(element=>element.complete&&element.naturalWidth>0)).toBe(true);
   const response=await page.request.get(origin+'/assets/cultivation/environments/'+name);
   expect(response.status(),name).toBe(200);
   const bytes=await response.body();
   expect(bytes.subarray(0,8).toString('hex'),name).toBe('89504e470d0a1a0a');
  }
 }
 expect(failures).toEqual([]);
 await expect(page.getByText(/not a verified parcel/)).toBeVisible();
});

test('HC-GFX-2.1.2: failed background fetch leaves local cultivation usable',async({page})=>{
 await page.route('**/assets/cultivation/environments/hc-env-emerald-coast-outdoor-background.png',route=>route.abort());
 await page.goto(origin+'/play');
 await page.getByRole('button',{name:'Start guest game'}).click();
 await expect(page.getByText(/Regional scene artwork has not been uploaded or could not be loaded/)).toBeVisible();
 await page.getByRole('button',{name:'Plant locally'}).click();
 await expect(page.getByText('Plant stage: germination')).toBeVisible();
});

test('HC-GFX-2.1.4: scene overlays and anchors render across nine backgrounds',async({page})=>{
 await page.goto(origin+'/play');
 const region=page.getByRole('combobox',{name:'Preview region'});
 const environment=page.getByRole('combobox',{name:'Preview environment'});
 for(const r of ['emerald-coast','golden-prairie','red-mesa']){
  await region.selectOption(r);
  for(const e of ['outdoor','greenhouse','indoor']){
   await environment.selectOption(e);
   const canvas=page.locator('.cultivation-scene-canvas');
   await expect(canvas).toBeVisible();
   await expect(canvas.locator('.cultivation-scene-prop')).toHaveCount(3);
   const objects=await canvas.locator('.cultivation-scene-prop').evaluateAll(items=>items.map(el=>({
    width:parseFloat(el.style.width),left:parseFloat(el.style.left),top:parseFloat(el.style.top),
    transform:getComputedStyle(el).transform,src:el.getAttribute('src')
   })));
   expect(objects[0].width).toBeGreaterThan(objects[2].width);
   for(const obj of objects){expect(obj.left).toBeGreaterThan(0);expect(obj.left).toBeLessThan(100);expect(obj.top).toBeGreaterThan(0);expect(obj.top).toBeLessThan(100);expect(obj.src).toMatch(/^\\/assets\\/cultivation\\/props\\//);}
  }
 }
});
