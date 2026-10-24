import test from 'node:test';
import assert from 'node:assert/strict';
import {createMarketplaceClient,mountMarketplace} from '../src/marketplace.js';
import {resolveRoute} from '../src/app.js';

test('Marketplace is a real navigable High Country route',()=>{
 assert.equal(resolveRoute('/marketplace'),'/marketplace');
});
test('wallet-free client authenticates server snapshot and reviewed operations only',async()=>{
 const actions=[],client=createMarketplaceClient({apiUrl:'https://market.example',
  authenticate:async()=> 'signed-session-token',
  fetchImpl:async(url,options)=>{
   actions.push({url:String(url),options});
   return {ok:true,json:async()=>({ok:true,result:{status:'ok'}})};
  }});
 await client.snapshot();
 await client.buy({operation:'purchase',listing:'listing'});
 await client.cancel({operation:'cancel',listing:'listing'});
 await client.expire({operation:'expire',listing:'listing'});
 await client.dispute({operation:'dispute',listing:'listing',reason:'payment'});
 assert.deepEqual(actions.map(x=>new URL(x.url).pathname),
  ['/market/snapshot','/market/buy','/market/cancel','/market/expire','/market/dispute']);
 assert.ok(actions.every(x=>x.options.headers.authorization==='Bearer signed-session-token'));
 assert.ok(actions.every(x=>!Object.hasOwn(JSON.parse(x.options.body),'buyer')));
 assert.throws(()=>client.buy({operation:'op',listing:'bad',owner:'victim'}),/marketplace-input-invalid/); // no caller-supplied principal accepted
});
test('invalid inputs and unavailable auth fail closed before sending',async()=>{
 let calls=0;
 const client=createMarketplaceClient({apiUrl:'https://market.example',
  authenticate:async()=>null,fetchImpl:async()=>{calls++;throw Error('should not fetch');}});
 await assert.rejects(client.snapshot(),/marketplace-sign-in-required/);
 assert.throws(()=>client.list({operation:'op',listing:'l',asset:'a',quantity:0,price:1,expiresAt:Date.now()+60000}),/marketplace-input-invalid/);
 assert.throws(()=>client.dispute({operation:'d',listing:'l',reason:'refund-now'}),/marketplace-dispute-invalid/);
 assert.equal(calls,0);
});
class Element {
 constructor(tag){this.tagName=tag;this.children=[];this.textContent='';this.events={};this.value='';this.attributes={};}
 append(...args){this.children.push(...args);}
 replaceChildren(...args){this.children=[...args];}
 setAttribute(k,v){this.attributes[k]=v;}
 addEventListener(k,fn){this.events[k]=fn;}
}
test('offline marketplace renders disclosure without service requests or wallet prompt',()=>{
 const doc={createElement:tag=>new Element(tag)},main=new Element('main');
 mountMarketplace({document:doc,main,runtime:{mode:'offline'}});
 assert.match(main.children[0].textContent,/unavailable offline/);
 assert.equal(main.children.length,1);
});
test('ordinary marketplace renders real browse, listing and history without wallet provider',async()=>{
 const doc={createElement:tag=>new Element(tag)},main=new Element('main');
 let fetched=0;
 const snapshot={mode:'ordinary',principal:'alice',walletRequired:false,feePolicy:'zero',
  buds:{available:50,reserved:10},inventory:[{asset:'lot',available:2,reserved:1}],
  browse:[{listing:'sale',seller:'bob',asset:'lot',quantity:1,price:12,expiresAt:Date.now()+60000,status:'active'}],
  history:[{listing:'old',seller:'alice',buyer:'bob',asset:'lot',quantity:1,price:10,status:'sold'}],
  disputes:[{listing:'old',reason:'payment',status:'open'}]};
 mountMarketplace({document:doc,main,runtime:{mode:'connected',apiUrl:'https://market.example'},
  authenticate:async()=> 'session',fetchImpl:async()=>{fetched++;return {ok:true,json:async()=>({ok:true,result:snapshot})};}});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(fetched,1);
 const region=main.children[1];
 assert.ok(region.children.length>4);
 assert.match(main.children[0].textContent,/Server-verified marketplace/);
 assert.ok(region.children.some(x=>x.children?.some(y=>y.textContent==='Create a listing')));
 assert.ok(region.children.some(x=>x.children?.some(y=>y.textContent==='My dispute status')));
});
