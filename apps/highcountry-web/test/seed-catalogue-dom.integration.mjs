import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {mountSeedCatalogue,createSeedCatalogueClient} from '../src/seed-catalogue.js';
import {publicSeedCatalogue} from '../../../scripts/highcountry/build_seed_catalogue.mjs';
const tick=()=>new Promise(r=>setTimeout(r,20));
function page(){const dom=new JSDOM('<html><head></head><body><main></main></body></html>',{url:'https://hc.example/seeds'});return {dom,document:dom.window.document,main:dom.window.document.querySelector('main')};}

test('public catalogue renders all 65 and filters, ancestry navigation and empty state work offline',async()=>{
 const p=page();let auth=0;const view=mountSeedCatalogue({...p,runtime:{mode:'offline'},authenticate:()=>auth++,fetchImpl:async()=>({ok:true,json:publicSeedCatalogue})});await view.ready;
 assert.equal(p.document.querySelectorAll('.seed-tile').length,65);assert.equal(auth,0);
 const region=p.document.querySelector('[aria-label="Region"]');region.value='Red Mesa';region.dispatchEvent(new p.dom.window.Event('change'));assert.equal(p.document.querySelectorAll('.seed-tile').length,21);
 const tier=p.document.querySelector('[aria-label="Rarity"]');tier.value='common';tier.dispatchEvent(new p.dom.window.Event('change'));assert.equal(p.document.querySelectorAll('.seed-tile').length,7);
 const search=p.document.querySelector('[aria-label="Search cultivars"]');search.value='not-a-cultivar';search.dispatchEvent(new p.dom.window.Event('input'));assert.match(p.main.textContent,/No cultivars match/);
 region.value='';tier.value='';search.value='Blue Moon';search.dispatchEvent(new p.dom.window.Event('input'));p.document.querySelector('.seed-tile button').click();assert.match(p.document.querySelector('.seed-detail').textContent,/Blueberry/);
 p.document.querySelector('.seed-detail button').click();assert.match(p.document.querySelector('.seed-detail h3').textContent,/Blueberry/);
 assert.match(p.main.textContent,/Offline browsing/);p.dom.window.close();
});
test('authenticated refresh and harvest award render personal card without client-owned reward fields',async()=>{
 const p=page(),publicData=await publicSeedCatalogue(),requests=[];let awarded=false;
 const clientState=()=>({ownershipStatus:'verified-finalized',entries:publicData.entries.map(e=>({id:e.id,discovered:e.id==='HC-C-blue-dream',ownedSeeds:e.id==='HC-C-blue-dream'?3:0,harvested:awarded&&e.id==='HC-C-blue-dream'})),cards:awarded?[{id:'HC-HARVEST-CARD:HC-C-blue-dream',cultivarId:'HC-C-blue-dream',nonTransferable:true,cosmeticOnly:true,firstHarvest:{successful:true,sourceKey:'authenticated-test-harvest',plantId:'7',qualityBps:9000,quantityGrams:200}}]:[]});
 const view=mountSeedCatalogue({...p,runtime:{mode:'connected',apiUrl:'https://api.example'},authenticate:async()=> 'signed-token',fetchImpl:async(url,opt)=>{
  if(String(url).startsWith('/assets/'))return {ok:true,json:async()=>publicData};
  requests.push({url:String(url),opt});if(String(url).endsWith('/harvest-card'))awarded=true;
  return {ok:true,json:async()=>({ok:true,result:clientState()})};
 }});await view.ready;await view.refresh();assert.match(p.main.textContent,/3 seeds owned/);
 p.document.querySelector('[aria-label="Harvested plant ID"]').value='7';[...p.document.querySelectorAll('button')].find(b=>b.textContent==='Verify harvest and earn card').click();await tick();
 assert.equal(p.document.querySelectorAll('.seed-earned').length,1);assert.equal(p.document.querySelectorAll('.seed-harvest-seal').length,1);const claim=requests.find(r=>r.url.endsWith('/harvest-card'));assert.deepEqual(JSON.parse(claim.opt.body),{plantId:'7'});assert.equal(claim.opt.headers.authorization,'Bearer signed-token');p.dom.window.close();
});
test('client denies unsigned/invalid claims before fetching and exposes no owner argument',async()=>{
 let calls=0;const c=createSeedCatalogueClient({apiUrl:'https://api.example',authenticate:async()=>null,fetchImpl:async()=>{calls++;throw Error('unexpected');}});
 await assert.rejects(c.collection(),/sign-in-required/);assert.throws(()=>c.claim('0'));assert.throws(()=>c.claim('18446744073709551616'));assert.equal(calls,0);
});
test('malicious markup is rendered as text; unavailable catalogue or collection never awards',async()=>{
 const p=page(),data=await publicSeedCatalogue();data.entries[0].name='<img src=x onerror=alert(1)>';
 const view=mountSeedCatalogue({...p,runtime:{mode:'connected',apiUrl:'https://api.example'},authenticate:async()=> 'token',fetchImpl:async(url)=>String(url).startsWith('/assets/')?{ok:true,json:async()=>data}:{ok:false,status:503}});await view.ready;await view.refresh();assert.equal(p.document.querySelectorAll('.seed-tile img').length,65);assert.equal(p.document.querySelectorAll('img[src="x"],img[onerror]').length,0);assert.match(p.main.textContent,/Collection unavailable/);assert.equal(p.document.querySelectorAll('.seed-earned').length,0);p.dom.window.close();
});
test('approved art appears but forged harvested flags never add authenticated seal overlays',async()=>{const p=page(),data=await publicSeedCatalogue();const view=mountSeedCatalogue({...p,runtime:{mode:'connected',apiUrl:'https://api.example'},authenticate:async()=> 'signed',fetchImpl:async url=>String(url).startsWith('/assets/')?{ok:true,json:async()=>data}:{ok:true,json:async()=>({ok:true,result:{ownershipStatus:'verified-finalized',entries:data.entries.map(e=>({id:e.id,harvested:true,discovered:true,ownedSeeds:99})),cards:[{cultivarId:data.entries[0].id,firstHarvest:{plantId:'7'}}]}})}});await view.ready;await view.refresh();assert.equal(p.document.querySelectorAll('.seed-cultivar-art').length,65);assert.equal(p.document.querySelectorAll('.seed-harvest-seal,.seed-earned').length,0);p.dom.window.close();});
