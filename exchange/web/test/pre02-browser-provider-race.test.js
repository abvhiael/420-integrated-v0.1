import test from 'node:test';
import assert from 'node:assert/strict';
import { mountWalletUI } from '../browser-wallet-ui.js';

class Element {
  constructor(tag='div') { this.tag=tag;this.id='';this.value='';this.textContent='';this.disabled=false;this.hidden=false;this.children=[];this.parentElement=null;this.listeners=new Map();this.style={}; }
  append(...children){for(const child of children){child.remove?.();this.children.push(child);child.parentElement=this;}}
  insertBefore(child){this.append(child);}
  remove(){if(this.parentElement){this.parentElement.children=this.parentElement.children.filter(item=>item!==this);this.parentElement=null;}}
  replaceChildren(...children){for(const old of this.children)old.parentElement=null;this.children=[];this.append(...children);}
  setAttribute(name,value){this[name]=value;}
  addEventListener(name,callback){const callbacks=this.listeners.get(name)??new Set();callbacks.add(callback);this.listeners.set(name,callbacks);}
  removeEventListener(name,callback){this.listeners.get(name)?.delete(callback);}
  dispatch(name,event={}){for(const callback of this.listeners.get(name)??[])callback(event);}
  querySelector(selector){if(!selector.startsWith('#'))return null;const id=selector.slice(1);const visit=node=>{if(node.id===id)return node;for(const child of node.children){const found=visit(child);if(found)return found;}return null;};return visit(this);}
  querySelectorAll(){return [];}
}
function eventTarget(){const listeners=new Map();return {listeners,addEventListener(name,callback){const set=listeners.get(name)??new Set();set.add(callback);listeners.set(name,set);},removeEventListener(name,callback){listeners.get(name)?.delete(callback);},dispatch(name,event={}){for(const callback of listeners.get(name)??[])callback(event);}};}
const account='0x'+'11'.repeat(20);
function provider({deferred=false}={}){
  const listeners=new Map();let release;
  const gate=deferred?new Promise(resolve=>{release=resolve;}):null;
  return {listeners,release:()=>release?.(),on(name,callback){listeners.set(name,callback);},removeListener(name,callback){if(listeners.get(name)===callback)listeners.delete(name);},async request({method}){
    if(method==='eth_requestAccounts'){if(gate)await gate;return [account];}
    if(method==='eth_accounts')return [account];
    if(method==='eth_chainId')return '0x420';
    throw Error('Unexpected provider method '+method);
  }};
}
function harness(){
  const documentRef=eventTarget(),windowRef=eventTarget(),root=new Element(),view=new Element(),connect=new Element('button');
  connect.id='connect';view.id='app-view';root.append(connect,view);
  documentRef.createElement=tag=>new Element(tag);
  documentRef.querySelector=selector=>root.querySelector(selector);
  documentRef.querySelectorAll=()=>[];
  documentRef.hidden=false;
  return {documentRef,windowRef,connect,view};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('PRE-02 mounted UI rejects delayed connection after provider dropdown changes and cleans listeners',async()=>{
  const {documentRef,windowRef,connect}=harness();
  const first=provider({deferred:true}),second=provider();
  const ethereum={providers:[first,second]};
  const runtime={deployment:{status:'UNRESOLVED',environment:'testnet'},network:{chainId:'0x420'},api:{executableQuoteUrl:null}};
  const ui=mountWalletUI({documentRef,windowRef,ethereum,loadRuntime:async()=>runtime});
  await tick();
  const selector=documentRef.querySelector('#v15-wallet-provider');
  const providerOptions=selector.children.filter(option=>option.value);
  assert.equal(providerOptions.length,2);
  selector.value=providerOptions[0].value;
  selector.dispatch('change');
  documentRef.dispatch('click',{target:{closest:()=>connect},preventDefault(){},stopImmediatePropagation(){}});
  await tick();
  assert.equal(ui.context.pending,true);
  selector.value=providerOptions[1].value;
  selector.dispatch('change');
  assert.equal(ui.context.controller.wallet,null,'changing provider must synchronously revoke the in-flight wallet');
  first.release();
  await tick();
  assert.equal(ui.context.controller.wallet,null,'late first provider must never restore a wallet');
  assert.equal(first.listeners.size,0,'old provider event handlers must be released');
  assert.equal(ui.context.quoteSurface.session.candidate,null);
  assert.equal(connect.disabled,false);
  ui.dispose();
  assert.equal(selector.listeners.get('change')?.size,0);
  assert.equal(documentRef.listeners.get('click')?.size,0);
  assert.equal(windowRef.listeners.get('popstate')?.size,0);
});
