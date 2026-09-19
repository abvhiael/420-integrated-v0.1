import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {explicitSwapReviewRequest,readOnlyReviewLines,mountReadOnlySwapReview} from '../read-only-swap-review-ui.js';

const address=n=>'0x'+BigInt(n).toString(16).padStart(40,'0');
const id=n=>'0x'+BigInt(n).toString(16).padStart(64,'0');
const account=address(1),recipient=address(2),tokenIn=address(3),tokenOut=address(4);
const request={account,recipient,tokenIn,tokenOut,amountInRaw:'1000000000000000000',minimumOutputRaw:'4000000'};
const review={status:'REVIEW_CANDIDATE_ONLY',prepared:{context:{account,chainId:'0x420',observedAt:1000,expiresAt:1050}},projection:{amountIn:'1',minimumOutput:'4.1',input:{symbol:'BOB',address:tokenIn},output:{symbol:'ARRR',address:tokenOut},recipient,quoteId:id(99),expectedPathHash:id(900),hops:[{marketId:id(10),routeId:id(11),tokenOut}],envelope:{to:address(100),transactionFingerprint:'0xreview'}}};

test('only explicit canonical raw-unit requests are accepted; V14 display amounts are not imported',()=>{
 assert.deepEqual(explicitSwapReviewRequest(request),request);
 for(const change of [{amountInRaw:'1.0'},{amountInRaw:'01'},{minimumOutputRaw:'4.1'},{minimumOutputRaw:'0'},{tokenIn:'BOB'},{recipient:'demo'}]){
  assert.throws(()=>explicitSwapReviewRequest({...request,...change}));
 }
});
test('read-only review includes wallet, chain, route, router and actual fingerprint without approval',()=>{
 const lines=readOnlyReviewLines(review).join('\n');
 for(const item of ['REVIEW CANDIDATE ONLY','1 BOB','4.1 ARRR',account,id(99),id(11),address(100),'0xreview','submission remain disabled'])assert.ok(lines.includes(item),item);
 assert.throws(()=>readOnlyReviewLines({...review,status:'AUTHORIZED'}));
});

class Node {
 constructor(tag){this.tag=tag;this.children=[];this.parentElement=null;this.listeners=new Map();this.textContent='';this.hidden=false;this.disabled=false;this.value='';this.id='';}
 append(child){if(child.parentElement)child.remove();this.children.push(child);child.parentElement=this;}
 remove(){if(this.parentElement){const p=this.parentElement;p.children=p.children.filter(c=>c!==this);this.parentElement=null;}}
 setAttribute(name,value){this[name]=value;}
 addEventListener(name,listener){this.listeners.set(name,listener);}
 removeEventListener(name){this.listeners.delete(name);}
 querySelector(selector){if(selector[0]!=='#')return null;const id=selector.slice(1);const visit=node=>{if(node.id===id)return node;for(const child of node.children){const found=visit(child);if(found)return found;}return null;};return visit(this);}
 async emit(name){return this.listeners.get(name)?.();}
}
function browserHarness({configured=true}={}){
 const view=new Node('section'),swap=new Node('button');swap.id='swap-review';view.append(swap);
 const documentRef={createElement:tag=>new Node(tag),querySelector:id=>id==='#app-view'?view:null};
 const controller={runtime:{deployment:{status:'RESOLVED',environment:'testnet'},network:{chainId:'0x420'},api:{executableQuoteUrl:configured?'https://api.example.invalid/executable-swap-quote':null}},wallet:{session:{account,chainId:'0x420',generation:1}},generation:1};
 return {view,documentRef,controller};
}
test('mounted read-only surface renders a candidate without any wallet send/sign path; input edits clear it',async()=>{
 const {view,documentRef,controller}=browserHarness();
 let fetches=0,signs=0;controller.submit=()=>{signs++;throw Error('wallet submission forbidden');};
 const surface=mountReadOnlySwapReview({documentRef,controller,nowSeconds:()=>1010,fetchReview:async({request:received})=>{fetches++;assert.deepEqual(received,request);return structuredClone(review);}});
 assert.equal(surface.panel.parentElement,view);
 const fields=surface.panel.children.filter(c=>c.tag==='label').map(c=>c.children[0]);
 for(const [index,key] of ['tokenIn','tokenOut','recipient','amountInRaw','minimumOutputRaw'].entries())fields[index].value=request[key];
 await surface.panel.querySelector('#v15-quote-review-fetch').emit('click');
 const result=surface.panel.querySelector('#v15-quote-review-result');
 assert.equal(fetches,1);assert.equal(signs,0);assert.equal(result.hidden,false);assert.match(result.textContent,/REVIEW CANDIDATE ONLY/);
 fields[3].value='2';fields[3].emit('input');
 assert.equal(result.hidden,true);assert.equal(result.textContent,'');assert.throws(()=>surface.session.current());
 surface.dispose();assert.equal(surface.panel.parentElement,null);
});
test('surface is disabled with no executable endpoint and is invalidated on navigation',()=>{
 const {view,documentRef,controller}=browserHarness({configured:false});
 const surface=mountReadOnlySwapReview({documentRef,controller,nowSeconds:()=>1010});
 assert.equal(surface.panel.querySelector('#v15-quote-review-fetch').disabled,true);
 view.children=view.children.filter(child=>child.id!=='swap-review');surface.refresh();
 assert.equal(surface.panel.parentElement,null);
 surface.dispose();
});
test('browser entrypoint and deployment copy the read-only module while legacy execution stays locked',()=>{
 const root=path.resolve(import.meta.dirname,'..');
 const browser=fs.readFileSync(path.join(root,'browser-wallet-ui.js'),'utf8');
 const build=fs.readFileSync(path.join(root,'scripts/build.mjs'),'utf8');
 assert.match(browser,/mountReadOnlySwapReview\(\{documentRef,controller:context\.controller\}\)/);
 assert.match(browser,/context\.quoteSurface\?\.clear/);
 assert.match(browser,/button\.disabled=true/);
 assert.match(build,/read-only-swap-review-ui\.js/);
 const reviewUI=fs.readFileSync(path.join(root,'read-only-swap-review-ui.js'),'utf8');
 assert.doesNotMatch(reviewUI,/eth_sendTransaction|eth_signTypedData_v4|\.submit\(|\.signOrder\(/);
});
