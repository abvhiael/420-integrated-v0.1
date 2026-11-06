import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {readFileSync} from 'node:fs';
import {
 POKER_SOURCE,pokerApiPath,parsePokerSession,parsePokerTables,
 parsePokerTable,createPokerReadOnlyClient
} from '../src/poker-authority-client.js';
import {createPokerRoomLive} from '../src/poker-live-ui.js';
const now=()=>Date.now();
const session=()=>({authenticated:true,scope:'poker:read',viewerId:'test-player',subject:'0x'+'2'.repeat(40),chainId:1,expiresAt:now()+300000});
const auth=()=>parsePokerSession(session());
const meta=(overrides={})=>({source:POKER_SOURCE,authority:'verified',viewerId:'test-player',chainId:1,
 stateHash:'0x'+'a'.repeat(64),blockNumber:120,sequence:2,observedAt:now(),...overrides});
const tableList=()=>({...meta(),tables:[
 {id:'garden',name:'Garden Table',seatCount:2,occupied:1,smallBlind:5,bigBlind:10,phase:'FLOP',tableVersion:1}
]});
const hand=(overrides={})=>({...meta(),table:{
 id:'garden',tableVersion:1,seatCount:2,dealerSeat:1,phase:'FLOP',handNonce:4,actionNonce:8,ledgerVersion:9,
 pot:80,deadline:now()+15000,turnSeat:0,community:[{rank:'10',suit:'♥'},{rank:'5',suit:'♦'},{rank:'A',suit:'♣'}],
 seats:[{index:0,status:'active',playerId:'test-player',displayName:'Me',stack:400,committed:20},
 {index:1,status:'empty',playerId:null,displayName:'',stack:0,committed:0}],
 viewer:{seatPlusOne:1,holeCards:[{rank:'K',suit:'♠'},{rank:'Q',suit:'♠'}]},
 ...overrides
 }});
test('Poker API path is strictly same-origin; no external credential exfiltration',()=>{
 assert.equal(pokerApiPath('/api/420bet/poker/v1'),'/api/420bet/poker/v1');
 for(const path of ['https://evil.test','//evil.test','/a?x=1','/a#x','/a\\evil','/a\nxx',''])assert.equal(pokerApiPath(path),null);
});
test('Session requires bounded expiry, subject, authorization and viewer identity',()=>{
 const a=auth();assert.equal(a.viewerId,'test-player');
 assert.throws(()=>parsePokerSession({...session(),authenticated:false}),/unauthenticated/i);
 assert.throws(()=>parsePokerSession({...session(),scope:'poker:write'}),/unauthenticated/i);
 assert.throws(()=>parsePokerSession({...session(),subject:'not-a-wallet'}),/subject/i);
 assert.throws(()=>parsePokerSession({...session(),expiresAt:now()-1000}),/expired/i);
});
test('Authenticated discovery cannot invent tables or cross viewer/chain authority',()=>{
 const a=auth();
 assert.equal(parsePokerTables(tableList(),a).tables[0].id,'garden');
 assert.throws(()=>parsePokerTables({...tableList(),authority:'hint'},a),/canonical authority/i);
 assert.throws(()=>parsePokerTables({...tableList(),chainId:2},a),/viewer or chain/i);
 assert.throws(()=>parsePokerTables({...tableList(),tables:[tableList().tables[0],tableList().tables[0]]},a),/duplicate/i);
 assert.throws(()=>parsePokerTables({...tableList(),observedAt:now()-60000},a),/stale/i);
});
test('Table state displays only personally owned hole cards and public street reveal',()=>{
 const a=auth(),h=parsePokerTable(hand(),a,'garden');
 assert.equal(h.pot,80);assert.equal(h.community.length,3);
 assert.equal(h.viewer.holeCards.length,2);assert.equal(h.viewer.seatPlusOne,1);
 assert.equal(h.seats.length,2);assert(!Object.hasOwn(h.seats[0],'holeCards'));
 assert.throws(()=>parsePokerTable(hand({seats:[{...hand().table.seats[0],holeCards:[{rank:'A',suit:'♠'}]},hand().table.seats[1]]}),a,'garden'),/private cards leaked/i);
 assert.throws(()=>parsePokerTable(hand({viewer:{seatPlusOne:2,holeCards:[{rank:'K',suit:'♠'},{rank:'Q',suit:'♠'}]}}),a,'garden'),/viewer seat/i);
 assert.throws(()=>parsePokerTable(hand({phase:'PREFLOP'}),a,'garden'),/premature community/i);
 assert.throws(()=>parsePokerTable(hand({deck:[{rank:'2',suit:'♥'}]}),a,'garden'),/hidden game state/i);
 assert.throws(()=>parsePokerTable(hand(),a,'other'),/table context/i);
});
test('Polling accepts an identical idle sequence, rejects mutations, rollback and stale hand',()=>{
 const a=auth(),first=parsePokerTable(hand(),a,'garden');
 assert.equal(parsePokerTable(hand(),a,'garden',first).sequence,2);
 assert.throws(()=>parsePokerTable(hand({...{}}),a,'garden',{...first,sequence:3}),/stale/i);
 assert.throws(()=>parsePokerTable({...hand(),stateHash:'0x'+'b'.repeat(64)},a,'garden',first),/same-version/i);
 assert.throws(()=>parsePokerTable({...hand(),sequence:3,blockNumber:119},a,'garden',first),/block regression/i);
 assert.throws(()=>parsePokerTable({...hand(),sequence:3,table:{...hand().table,handNonce:3}},a,'garden',first),/hand nonce regression/i);
});
test('Read-only client requires same-origin JSON, HttpOnly-cookie session and no writes',async()=>{
 const calls=[];const payloads=[session(),tableList(),hand()];
 const fetcher=async(url,options)=>{calls.push({url,options});return {ok:true,headers:{get:()=> 'application/json; charset=utf-8'},json:async()=>payloads.shift()};};
 const c=createPokerReadOnlyClient({base:'/api/420bet/poker/v1',fetcher});
 assert.deepEqual((await c.authenticate()).viewerId,'test-player');
 assert.equal((await c.discover()).tables.length,1);
 assert.equal((await c.readTable('garden')).pot,80);
 assert(calls.every(x=>x.options.method==='GET'&&x.options.credentials==='same-origin'&&x.options.cache==='no-store'));
 assert.deepEqual(calls.map(x=>x.url),['/api/420bet/poker/v1/session','/api/420bet/poker/v1/tables','/api/420bet/poker/v1/tables/garden/snapshot']);
 c.disconnect();await assert.rejects(()=>c.discover(),/session/i);
});
test('Authenticated table UI displays real snapshot values only, clears private cards on disconnect',async()=>{
 const {document}=parseHTML('<html><body></body></html>');
 const fake={authenticate:async()=>auth(),discover:async()=>parsePokerTables(tableList(),auth()),
 readTable:async(id)=>parsePokerTable(hand(),auth(),id),disconnect(){},dispose(){}};
 const view=createPokerRoomLive(document,{client:fake,autoPoll:false});
 await view.ready;await new Promise(setImmediate);
 assert.equal(view.dataset.mode,'authoritative-read-only');
 assert.equal(view.querySelectorAll('.pr-table-list .pr-table-choice').length,1);
 assert.equal(view.querySelectorAll('.pr-seat').length,2);
 assert.match(view.querySelector('.pr-pot').textContent,/80/);
 assert.equal(view.querySelectorAll('.pr-community .pr-card').length,3);
 assert.equal(view.querySelectorAll('.pr-hole-cards .pr-card').length,2);
 assert(view.querySelectorAll('.pr-action').length===4);
 for(const b of view.querySelectorAll('.pr-action'))assert.equal(b.disabled,true);
 view.stopAnimation();
 assert.equal(view.querySelectorAll('.pr-community .pr-card').length,0);
 assert.equal(view.querySelectorAll('.pr-hole-cards .pr-card').length,0);
 assert.equal(view.liveState.connected,false);
});
test('Live Poker route uses authoritative client rather than demo samples',()=>{
 const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 assert(main.includes("createPokerRoomLive(document,{base:config.pokerApiBase??'/api/420bet/poker/v1'})"));
 const file=readFileSync(new URL('../src/poker-live-ui.js',import.meta.url),'utf8');
 assert(file.includes('createPokerReadOnlyClient'));
 assert(!file.includes('new WebSocket'));
 assert(file.includes('root.stopAnimation='));
});

test('awaiting-reveal phases never admit cards before their canonical street',()=>{
 const a=auth();
 for(const phase of ['AWAIT_FLOP','AWAIT_TURN','AWAIT_RIVER']){
  const board=phase==='AWAIT_FLOP'?[]:phase==='AWAIT_TURN'?hand().table.community:
   [...hand().table.community,{rank:'9',suit:'♣'}];
  assert.equal(parsePokerTable(hand({phase,community:board}),a,'garden').phase,phase);
  const forbidden=[...board,{rank:'3',suit:'♠'}];
  assert.throws(()=>parsePokerTable(hand({phase,community:forbidden}),a,'garden'),/premature community/i);
 }
 assert.equal(parsePokerTable(hand({phase:'UNCONTESTED'}),a,'garden').phase,'UNCONTESTED');
});

test('Read-only wallet login verifies exact host, chain, nonce and never signs a poker action',async()=>{
 const origin='https://420bet.420integrated.org',address='0x'+'2'.repeat(40),chainId=1;
 const nonce='x'.repeat(43);
 const message=[
  '420bet.420integrated.org requests a read-only 420Bet poker session:',
  address,'','URI: '+origin+'/api/420bet/poker/v1','Version: 1','Chain ID: 1',
  'Nonce: '+nonce,'Issued At: '+new Date(Date.now()).toISOString(),
  'Expiration Time: '+new Date(Date.now()+120000).toISOString(),
  'Statement: Read-only poker tables; no wagers, signing of actions, or withdrawals.'
 ].join('\\n');
 const requests=[];
 const wallet={request:async({method,params})=>{
  requests.push({method,params});
  if(method==='eth_requestAccounts')return[address];
  if(method==='eth_chainId')return '0x1';
  if(method==='personal_sign'){assert.equal(params[0],message);return '0x'+'1'.repeat(130);}
  throw Error('unexpected wallet method');
 }};
 const fetcher=async(url,opts)=>{
  requests.push({url,opts});
  let data;
  if(url.endsWith('/auth/challenge'))data={message,nonce,chainId,expiresAt:Date.now()+120000};
  else if(url.endsWith('/auth/verify'))data={authenticated:true,scope:'poker:read'};
  else data=session();
  return{ok:true,headers:{get:()=> 'application/json'},json:async()=>data};
 };
 const client=createPokerReadOnlyClient({base:'/api/420bet/poker/v1',fetcher});
 const auth=await client.loginWallet(wallet,origin);
 assert.equal(auth.viewerId,'test-player');
 assert.deepEqual(requests.filter(x=>x.method).map(x=>x.method),[
  'eth_requestAccounts','eth_chainId','personal_sign'
 ]);
 assert(requests.filter(x=>x.opts).every(x=>x.opts.credentials==='same-origin'));
 assert(!requests.some(x=>x.method==='eth_sendTransaction'||x.method==='eth_signTransaction'));
 client.dispose();
});
