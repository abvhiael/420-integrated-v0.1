import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolveRoute} from '../src/app.js';
import {mountSkills} from '../src/skills.js';
class Node {
 constructor(tag){this.tagName=tag;this.children=[];this.textContent='';this.events={};this.attributes={};}
 append(...items){this.children.push(...items);}
 replaceChildren(...items){this.children=[...items];}
 addEventListener(name,cb){this.events[name]=cb;}
 setAttribute(key,val){this.attributes[key]=val;}
}
const doc={createElement:name=>new Node(name)};
test('skills route is served without a wallet',()=>{
 assert.equal(resolveRoute('/skills'),'/skills');
 const main=new Node('main');
 mountSkills({document:doc,main,runtime:{mode:'offline'}});
 assert.match(main.children[0].textContent,/Local guest gameplay remains available/);
 assert.equal(main.children.length,1);
});
test('registered skills view renders version cost prerequisite and capped effect',async()=>{
 const main=new Node('main');const calls=[];
 mountSkills({document:doc,main,runtime:{mode:'connected',apiUrl:'https://economy.example'},
  authenticate:async()=> 'verified-account-token',fetchImpl:async(url,init)=>{
   calls.push({url:String(url),init});
   return {ok:true,json:async()=>({ok:true,result:{
    version:'HC-SKILL-RESEARCH-V1',availableBuds:100,records:[{
     id:'archive-index-I',kind:'skill',points:2,requiredPoints:2,cost:10,minLevel:1,
     unlocked:false,prerequisites:[],effect:'archive-filters',effectValue:1,cap:1
    }]}})};
  }});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(calls.length,1);
 assert.equal(new URL(calls[0].url).pathname,'/progression/snapshot');
 assert.equal(calls[0].init.headers.authorization,'Bearer verified-account-token');
 assert.match(main.children[0].textContent,/Authenticated progression loaded/);
 const pane=main.children[1],card=pane.children[2];
 assert.match(card.children[1].textContent,/cost 10 BUDS/);
 assert.match(card.children[3].textContent,/No canonical assets or protected scoring benefit/);
 assert.equal(card.children[4].textContent,'Unlock for 10 BUDS');
});
test('anonymous credentials prevent requesting player records',async()=>{
 let calls=0;const main=new Node('main');
 mountSkills({document:doc,main,runtime:{mode:'connected',apiUrl:'https://economy.example'},
  authenticate:async()=>null,fetchImpl:async()=>{calls++;throw Error('unexpected');}});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(calls,0);
 assert.match(main.children[0].textContent,/registered-session-required/);
});
