import test from 'node:test';
import assert from 'node:assert/strict';
import { mountWalletUI } from '../browser-wallet-ui.js';

class Node {
  constructor(tag='div') { this.tag=tag; this.id=''; this.value=''; this.textContent=''; this.disabled=false; this.hidden=false; this.children=[]; this.parentElement=null; this.listeners=new Map(); this.style={}; }
  append(...children) { for(const child of children) { child.remove?.(); this.children.push(child); child.parentElement=this; } }
  insertBefore(child) { this.append(child); }
  remove() { if(this.parentElement) { this.parentElement.children=this.parentElement.children.filter(item=>item!==this); this.parentElement=null; } }
  replaceChildren(...children) { for(const child of this.children)child.parentElement=null; this.children=[]; this.append(...children); }
  setAttribute(name,value) { this[name]=value; }
  addEventListener(name,callback) { const callbacks=this.listeners.get(name)??new Set(); callbacks.add(callback); this.listeners.set(name,callbacks); }
  removeEventListener(name,callback) { this.listeners.get(name)?.delete(callback); }
  querySelector(selector) { if(!selector.startsWith('#'))return null; const id=selector.slice(1); const visit=node=>{if(node.id===id)return node;for(const child of node.children){const found=visit(child);if(found)return found;}return null;};return visit(this); }
  querySelectorAll() { return []; }
}
function eventTarget() { const listeners=new Map(); return {listeners,addEventListener(name,callback,capture=false){const entries=listeners.get(name)??[];entries.push({callback,capture:!!capture});listeners.set(name,entries);},removeEventListener(name,callback){listeners.set(name,(listeners.get(name)??[]).filter(entry=>entry.callback!==callback));},dispatch(name,event={}){for(const entry of listeners.get(name)??[])entry.callback(event);}}; }
const account='0x'+'11'.repeat(20);
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('PRE-02 V15 capture consumes connect gesture before V14 bubble and never sends or signs',async()=>{
  const documentRef=eventTarget(),windowRef=eventTarget(),root=new Node(),connect=new Node('button'),view=new Node();
  connect.id='connect';view.id='app-view';root.append(connect,view);
  documentRef.createElement=tag=>new Node(tag);documentRef.querySelector=selector=>root.querySelector(selector);documentRef.querySelectorAll=()=>[];documentRef.hidden=false;
  let legacyConnects=0;documentRef.addEventListener('click',event=>{if(event.target.closest('#connect'))legacyConnects++;});
  const methods=[];const providerListeners=new Map();
  const ethereum={on(name,callback){providerListeners.set(name,callback);},removeListener(name,callback){if(providerListeners.get(name)===callback)providerListeners.delete(name);},async request({method}){methods.push(method);if(method==='eth_requestAccounts'||method==='eth_accounts')return [account];if(method==='eth_chainId')return '0x420';throw Error('Unexpected method '+method);}};
  const runtime={deployment:{status:'UNRESOLVED',environment:'testnet'},network:{chainId:'0x420'},api:{executableQuoteUrl:null}};
  const ui=mountWalletUI({documentRef,windowRef,ethereum,loadRuntime:async()=>runtime});await tick();
  const selector=documentRef.querySelector('#v15-wallet-provider');assert.ok(selector.value,'single provider selected');
  function click(target) {const event={target:{closest:query=>query.includes('#'+target.id)?target:null},prevented:false,stopped:false,preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;}};for(const phase of [true,false]){for(const entry of documentRef.listeners.get('click')??[]){if(entry.capture===phase){entry.callback(event);if(event.stopped)break;}}if(event.stopped)break;}return event;}
  const event=click(connect);await tick();
  assert.equal(event.prevented,true);assert.equal(event.stopped,true);assert.equal(legacyConnects,0,'legacy V14 handler must never create a second session');
  assert.equal(ui.context.controller.wallet?.session.account,account);assert.equal(ui.context.quoteSurface.session.candidate,null);
  assert.equal(methods.filter(method=>method==='eth_requestAccounts').length,1);
  assert.equal(methods.includes('eth_sendTransaction'),false);assert.equal(methods.includes('eth_signTypedData_v4'),false);
  ui.dispose();assert.equal(providerListeners.size,0);
});
