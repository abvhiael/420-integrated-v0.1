import assert from 'node:assert/strict';
import {once} from 'node:events';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import {createHighCountryServer} from '../server.mjs';
const server=createHighCountryServer({config:{schema:'highcountry-web-runtime-v1',mode:'offline'}});server.listen(0,'127.0.0.1');await once(server,'listening');
const base='http://127.0.0.1:'+server.address().port;
const launch={headless:true};
if(process.env.HC_TEST_CHROMIUM_PATH)launch.executablePath=process.env.HC_TEST_CHROMIUM_PATH;
if(process.env.HC_TEST_CHROMIUM_NO_SANDBOX)launch.args=['--no-sandbox'];
const browser=await chromium.launch(launch);
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 assert.equal((await page.goto(base+'/seeds')).status(),200);
 await page.waitForSelector('.seed-tile');assert.equal(await page.locator('.seed-tile').count(),65);
 await page.getByLabel('Rarity',{exact:true}).selectOption('rare');assert.equal(await page.locator('.seed-tile').count(),26);
 await page.getByLabel('Search cultivars',{exact:true}).fill('Blue Moon');assert.equal(await page.locator('.seed-tile').count(),1);
 await page.getByRole('button',{name:'View Blue Moon',exact:true}).click();assert.match(await page.locator('.seed-detail').innerText(),/Blueberry/);
 await page.locator('.seed-detail').getByRole('button',{name:'Blueberry',exact:true}).click();assert.equal(await page.locator('.seed-detail h3').innerText(),'Blueberry');
 await page.getByLabel('Search cultivars',{exact:true}).fill('');await page.getByLabel('Rarity',{exact:true}).selectOption('');
 await page.getByLabel('Region',{exact:true}).selectOption('Emerald Coast');assert.equal(await page.locator('.seed-tile').count(),23);
 await page.getByLabel('Region',{exact:true}).selectOption('');await page.locator('.seed-detail').evaluate(e=>e.hidden=true);
 await mkdir(new URL('../../../artifacts/highcountry/',import.meta.url),{recursive:true});
 await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:new URL('../../../artifacts/highcountry/hc-seed-05-desktop.png',import.meta.url).pathname,fullPage:false});
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'mobile horizontal overflow');
 await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:new URL('../../../artifacts/highcountry/hc-seed-05-mobile.png',import.meta.url).pathname,fullPage:false});
 assert.deepEqual(errors,[]);console.log('Actual Chromium: /seeds deep link, 65 cards, rare/region/search filters, parent navigation, responsive layout and zero page errors PASS');
}finally{await browser.close();server.close();await once(server,'close');}
