import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {readOnlyReviewLines,mountReadOnlySwapReview} from '../read-only-swap-review-ui.js';

const address=n=>'0x'+BigInt(n).toString(16).padStart(40,'0');
const id=n=>'0x'+BigInt(n).toString(16).padStart(64,'0');
const account=address(1),recipient=address(2),tokenIn=address(3),tokenOut=address(4);
const assetIn=id(100),assetOut=id(101),marketId=id(10);
const request={account,recipient,tokenIn,tokenOut,amountInRaw:'1000000000000000000',minimumOutputRaw:'4000000'};
const review={status:'REVIEW_CANDIDATE_ONLY',prepared:{context:{account,chainId:'0x420',observedAt:1000,expiresAt:1050}},projection:{
 amountIn:'1',amountInRaw:'1000000000000000000',minimumOutput:'4.1',minimumOutputRaw:'4100000',
 input:{symbol:'BOB',address:tokenIn},output:{symbol:'ARRR',address:tokenOut},recipient,
 quoteId:id(99),expectedPathHash:id(900),hops:[{marketId:id(10),routeId:id(11),tokenOut,minAmountOutRaw:'4100000'}],
 envelope:{to:address(100),transactionFingerprint:id(700)},
 fees:{status:'DISCLOSED',totalFeeRaw:'10000',totalFee:'0.01',rateBps:25,components:[]},
}};
const catalogue={schema:'420-exchange-review-catalogue-v1',qualification:'QUALIFIED_CONFIG',authority:'METADATA_ONLY',demo:false,fixture:false,chainId:'0x420',maxRouteHops:2,
 assets:[
  {assetId:assetIn,address:tokenIn,symbol:'BOB',name:'Bob Token',decimals:18,verified:true,reviewEligible:true},
  {assetId:assetOut,address:tokenOut,symbol:'ARRR',name:'Arrr Token',decimals:6,verified:true,reviewEligible:true},
 ],
 markets:[{marketId,inputAssetId:assetIn,outputAssetId:assetOut,label:'BOB → ARRR',active:true,reviewEligible:true}],
};

class Node {
 constructor(tag='div'){this.tag=tag;this.children=[];this.parentElement=null;this.listeners=new Map();this.textContent='';this.hidden=false;this.disabled=false;this.value='';this.id='';this.attributes={};this.className='';this.style={};this.focused=false;}
 append(...children){for(const child of children){if(child.parentElement)child.remove();this.children.push(child);child.parentElement=this;}}
 remove(){if(this.parentElement){const p=this.parentElement;p.children=p.children.filter(c=>c!==this);this.parentElement=null;}}
 replaceChildren(...children){for(const child of this.children)child.parentElement=null;this.children=[];this.textContent='';this.append(...children);}
 setAttribute(name,value){this.attributes[name]=String(value);if(name==='id')this.id=String(value);}
 removeAttribute(name){delete this.attributes[name];}
 addEventListener(name,listener){const set=this.listeners.get(name)??new Set();set.add(listener);this.listeners.set(name,set);}
 removeEventListener(name,listener){this.listeners.get(name)?.delete(listener);}
 querySelector(selector){
  const visit=node=>{
   if(selector.startsWith('#')&&node.id===selector.slice(1))return node;
   if(selector.startsWith('[data-review-key="')&&node.attributes['data-review-key']===selector.slice(18,-2))return node;
   for(const child of node.children){const found=visit(child);if(found)return found;}
   return null;
  };return visit(this);
 }
 async emit(name){for(const listener of this.listeners.get(name)??[])await listener();}
 focus(){this.focused=true;}
}
function browserHarness({configured=true,qualified=true}={}){
 const view=new Node('section'),swap=new Node('button');swap.id='swap-review';view.append(swap);
 const documentRef={createElement:tag=>new Node(tag),querySelector:id=>id==='#app-view'?view:null};
 const wallet={session:{account,chainId:'0x420',generation:1}};
 const runtime={deployment:{status:'RESOLVED',environment:'testnet'},network:{chainId:'0x420'},api:{executableQuoteUrl:configured?'https://api.example.invalid/executable-swap-quote':null},reviewCatalogue:qualified?catalogue:{...catalogue,qualification:'UNRESOLVED'}};
 const controller={
  runtime,wallet,generation:1,
  captureExecutionContext(){return Object.freeze({wallet,account,chainId:'0x420',walletGeneration:wallet.session.generation,controllerGeneration:this.generation,runtime:this.runtime});},
  assertExecutionContext(token){if(token.wallet!==this.wallet||token.controllerGeneration!==this.generation||token.runtime!==this.runtime)throw Object.assign(Error('stale'),{code:'STALE_SESSION'});return token;},
  invalidateExecution(){this.generation++;},
 };
 return {view,documentRef,controller};
}
const flatten=node=>[node.textContent,...node.children.flatMap(flatten)].filter(Boolean).join('\n');

test('PRE-03 review text exposes complete canonical fields and source limitation',()=>{
 const entry={market:{label:'BOB → ARRR',marketId}};
 const lines=readOnlyReviewLines(review,entry).join('\n');
 for(const item of ['REVIEW CANDIDATE ONLY','BOB → ARRR','0x420','1000000000000000000','4100000','0.01 ARRR',recipient,address(100),id(99),id(900),id(11),id(700),'submission remain disabled'])assert.ok(lines.includes(item),item);
});

test('PRE-03 metadata-driven form derives raw units and renders exact structured review without wallet execution',async()=>{
 const {view,documentRef,controller}=browserHarness();
 let fetches=0,signs=0;controller.submit=()=>{signs++;throw Error('wallet submission forbidden');};
 const surface=mountReadOnlySwapReview({documentRef,controller,nowSeconds:()=>1010,fetchReview:async({request:received})=>{fetches++;assert.deepEqual(received,request);return structuredClone(review);}});
 assert.equal(surface.panel.parentElement,view);
 assert.equal(surface.market.children.length,2,'only configured qualified market is offered');
 surface.market.value=marketId;await surface.market.emit('change');
 surface.amount.value='1';await surface.amount.emit('input');
 surface.minimum.value='4';await surface.minimum.emit('input');
 surface.recipient.value=recipient;await surface.recipient.emit('input');
 assert.match(surface.panel.querySelector('#v15-review-raw-preview').textContent,/1000000000000000000 raw BOB/);
 await surface.panel.querySelector('#v15-quote-review-fetch').emit('click');
 const result=surface.panel.querySelector('#v15-quote-review-result');
 assert.equal(fetches,1);assert.equal(signs,0);assert.equal(result.hidden,false);assert.equal(result.focused,true);
 const rendered=flatten(result);
 for(const exact of [tokenIn,tokenOut,recipient,address(100),id(99),id(900),id(11),id(700),'1000000000000000000','4100000','0.01 ARRR'])assert.ok(rendered.includes(exact),exact);
 const generation=controller.generation;surface.amount.value='2';await surface.amount.emit('input');
 assert.ok(controller.generation>generation);assert.equal(result.hidden,true);assert.throws(()=>surface.session.current());
 surface.dispose();assert.equal(surface.panel.parentElement,null);
});

test('PRE-03 fails closed for unresolved catalogue, endpoint and malformed entry',async()=>{
 for(const options of [{qualified:false},{configured:false}]){
  const {documentRef,controller}=browserHarness(options);
  const surface=mountReadOnlySwapReview({documentRef,controller,nowSeconds:()=>1010});
  assert.equal(surface.panel.querySelector('#v15-quote-review-fetch').disabled,true);
  surface.dispose();
 }
 const {documentRef,controller}=browserHarness();
 const surface=mountReadOnlySwapReview({documentRef,controller,nowSeconds:()=>1010,fetchReview:async()=>review});
 surface.market.value=marketId;surface.amount.value='1.0000000000000000001';surface.minimum.value='4';surface.recipient.value=recipient;
 await surface.panel.querySelector('#v15-quote-review-fetch').emit('click');
 assert.match(surface.panel.querySelector('#v15-quote-review-status').textContent,/precision|decimal/i);
 assert.equal(surface.panel.querySelector('#v15-quote-review-result').hidden,true);
 surface.dispose();
});

test('PRE-03 rejects candidate asset substitution and oversized route before display',async()=>{
 for(const bad of [
  {...review,projection:{...review.projection,input:{...review.projection.input,address:address(9)}}},
  {...review,projection:{...review.projection,hops:[review.projection.hops[0],{...review.projection.hops[0],routeId:id(12)},{...review.projection.hops[0],routeId:id(13)}]}},
 ]){
  const {documentRef,controller}=browserHarness();
  const surface=mountReadOnlySwapReview({documentRef,controller,nowSeconds:()=>1010,fetchReview:async()=>structuredClone(bad)});
  surface.market.value=marketId;surface.amount.value='1';surface.minimum.value='4';surface.recipient.value=recipient;
  await surface.panel.querySelector('#v15-quote-review-fetch').emit('click');
  assert.equal(surface.panel.querySelector('#v15-quote-review-result').hidden,true);
  assert.match(surface.panel.querySelector('#v15-quote-review-status').textContent,/assets differ|route exceeds/i);
  surface.dispose();
 }
});

test('browser entrypoint remains read-only and deployment includes the PRE-03 module',()=>{
 const root=path.resolve(import.meta.dirname,'..');
 const browser=fs.readFileSync(path.join(root,'browser-wallet-ui.js'),'utf8');
 const build=fs.readFileSync(path.join(root,'scripts/build.mjs'),'utf8');
 assert.match(browser,/mountReadOnlySwapReview\(\{documentRef,controller:context\.controller\}\)/);
 assert.match(build,/copyDir\('core'\)/);
 const reviewUI=fs.readFileSync(path.join(root,'read-only-swap-review-ui.js'),'utf8');
 assert.doesNotMatch(reviewUI,/eth_sendTransaction|eth_signTypedData_v4|\.submit\(|\.signOrder\(/);
 assert.doesNotMatch(reviewUI,/Input token address|Output token address|integer raw units/);
});
