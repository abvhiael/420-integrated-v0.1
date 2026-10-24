import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolveRoute} from '../src/app.js';
import {mountMissions} from '../src/missions.js';
class Node{
 constructor(tag){this.tagName=tag;this.children=[];this.textContent='';this.attributes={};this.events={};}
 append(...xs){this.children.push(...xs);}
 replaceChildren(...xs){this.children=[...xs];}
 setAttribute(k,v){this.attributes[k]=v;}
 addEventListener(k,cb){this.events[k]=cb;}
}
const doc={createElement:tag=>new Node(tag)};
test('missions page is routable and guest never requests wallet or API',()=>{
 assert.equal(resolveRoute('/missions'),'/missions');
 const root=new Node('main');
 mountMissions({document:doc,main:root,runtime:{mode:'offline'}});
 assert.match(root.children[0].textContent,/Offline guest play remains available/);
 assert.equal(root.children.length,1);
});
test('registered mission page renders server-supplied objective progress and claim',async()=>{
 const root=new Node('main');
 const calls=[];
 mountMissions({document:doc,main:root,runtime:{mode:'connected',apiUrl:'https://api.example'},
  authenticate:async()=> 'valid-token',fetchImpl:async(url,opts)=>{
   calls.push({url:String(url),opts});
   return {ok:true,json:async()=>({ok:true,result:{version:'HC-MISSIONS-V1',missions:[{
    id:'journal-first-steps',objective:'verified-journal-entry',target:2,maxPerProof:1,
    progress:2,status:'complete',deadline:12345678,rewardUnits:0
   }]}})};
  }});
 await new Promise(ok=>setImmediate(ok));
 assert.equal(new URL(calls[0].url).pathname,'/missions/snapshot');
 assert.equal(calls[0].opts.headers.authorization,'Bearer valid-token');
 assert.match(root.children[1].children[1].children[1].textContent,/2\/2/);
 assert.equal(root.children[1].children[1].children[3].textContent,'Claim completed mission');
});
test('anonymous mission page fails closed',async()=>{
 const root=new Node('main');let calls=0;
 mountMissions({document:doc,main:root,runtime:{mode:'connected',apiUrl:'https://api.example'},
 authenticate:async()=>null,fetchImpl:async()=>{calls++;throw Error('unexpected');}});
 await new Promise(ok=>setImmediate(ok));
 assert.equal(calls,0);assert.match(root.children[0].textContent,/registered-session-required/);
});
