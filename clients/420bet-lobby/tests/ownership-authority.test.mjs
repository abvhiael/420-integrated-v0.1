import test from 'node:test';
import assert from 'node:assert/strict';
import {encodeAbiParameters,toFunctionSelector} from 'viem';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {EVENT_SPECS,eventTopic} from '../server/indexer-event-abi.mjs';
import {createRpcCanonicalOwnershipSource,createBetOwnershipAuthority} from '../server/ownership-authority.mjs';
import {createPrivateOwnerDirectories} from '../server/ownership-directories.mjs';
import {createOwnershipHTTPHandler} from '../server/ownership-http.mjs';
import {createRemoteBetOwnershipResolver} from '../server/ownership-resolver.mjs';
const H=n=>'0x'+BigInt(n).toString(16).padStart(64,'0'),A=n=>'0x'+BigInt(n).toString(16).padStart(40,'0');
const WP=H(12),VER=H(10),TX=H(27),BLOCK=H(100),OWNER=A(7),REGISTRY=A(9);
const manifest=['casino-router','casino-settlement','poker-ledger','poker-canonical','fantasy-contest','sports-tickets']
 .map((role,i)=>({id:'source-'+i,role,address:A(i+1),fromBlock:'1'}));
const roles={casino:'casino-router',poker:'poker-ledger',fantasy:'fantasy-contest',sportsbook:'sports-tickets'};
const types={casino:'WAGER_ACCEPTED',poker:'POKER_HAND_SETTLED',fantasy:'FANTASY_ENTRY_ACCEPTED',sportsbook:'SPORTS_TICKET_FUNDED'};
const kinds={casino:'wager-accepted',poker:'poker-hand-settled',fantasy:'fantasy-entry-accepted',sportsbook:'sports-ticket-funded'};
const fields=types=>types.map((type,i)=>({name:'f'+i,type}));
const encode=(types,values)=>encodeAbiParameters([{type:'tuple',components:fields(types)}],[values]);
const wagerTypes=['bytes32','address','bytes32','bytes32','bytes32','address','uint256','uint256',
 'bytes32','bytes32','bytes32','bytes32','bytes32','bytes32','bytes32','uint64','uint64','uint8'];
const wagerValues=[WP,OWNER,H(1),H(2),VER,A(6),1n,2n,H(3),H(4),H(5),H(6),H(7),H(8),H(9),10n,100n,1];
const poolTypes=['uint8','bytes32','address','uint64','uint64','uint64','uint64','uint64','uint256','uint256','uint256','bytes32'];
const entryTypes=['bytes32','bytes32','address','bytes32','uint64','bool','bool','uint32[7]'];
function fixture(vertical,{forged=false,reorg=false,wrongOwner=false,wrongVersion=false,
 identitySubject=H(33),ticketAuthority=null}={}){
 const role=roles[vertical],type=types[vertical],kind=kinds[vertical],source=manifest.find(x=>x.role===role);
 const spec=EVENT_SPECS[role].find(x=>x.type===type);
 const objectId=vertical==='casino'?WP:vertical==='poker'?H(45):vertical==='fantasy'?H(42):H(43);
 let topics=[spec.topic0],data='0x';
 if(vertical==='casino'){
  topics.push(objectId,'0x'+'0'.repeat(24)+OWNER.slice(2),VER);
  data+='0'.repeat(64*5);
 }else if(vertical==='poker'){
  topics.push(objectId,H(41));
  data+='0'.repeat(64*2);
 }else if(vertical==='fantasy'){
  topics.push(objectId,H(1),identitySubject);
  data='0x'+H(1).slice(2)+H(2).slice(2)+H(96).slice(2)+H(0).slice(2);
 }else{
  topics.push(objectId,H(47),'0x'+'0'.repeat(24)+OWNER.slice(2));
  data+='0'.repeat(64*3);
 }
 const log={address:source.address,transactionHash:TX,blockHash:BLOCK,blockNumber:'0x64',
  logIndex:'0x2',topics,data};
 const reservation={address:manifest[2].address,transactionHash:H(55),
  blockHash:H(96),blockNumber:'0x60',logIndex:'0x1',
  topics:[eventTopic('HandReserved(bytes32,bytes32,uint256,bytes32)'),H(45),H(41)],
  data:'0x'+'0'.repeat(64*2)};
 const calls=[];
 async function fetcher(_,options){
  const payload=JSON.parse(options.body),{method,params,id}=payload;
  calls.push({method,params});
  let result;
  if(method==='eth_chainId')result='0x1a4';
  else if(method==='eth_getTransactionReceipt')result=
   params[0]===H(55)?{status:'0x1',blockHash:H(96),blockNumber:'0x60',logs:[reservation]}:
    {status:'0x1',blockHash:reorg?H(99):BLOCK,blockNumber:'0x64',logs:[log]};
  else if(method==='eth_getBlockByNumber'){
   result=params[0]==='finalized'?{number:'0x70',hash:H(112)}:
    params[0]==='0x60'?{number:'0x60',hash:H(96)}:
    {number:'0x64',hash:BLOCK};
  }else if(method==='eth_getLogs')result=[reservation];
  else if(method==='eth_call'){
   const {to,data}=params[0];
   if(to===REGISTRY){
    result=encode(wagerTypes,wrongOwner?[WP,A(8),...wagerValues.slice(2)]:
     wrongVersion?[...wagerValues.slice(0,4),H(99),...wagerValues.slice(5)]:wagerValues);
   }else if(data.startsWith(toFunctionSelector('lockedMask(bytes32)'))){
    result=encodeAbiParameters([{type:'uint16'}],[3]);
   }else if(data.startsWith(toFunctionSelector('seatOf(bytes32,uint8)'))){
    const seat=BigInt('0x'+data.slice(-64));
    result=encode(['address','uint256','bool','uint64'],[seat===0n?OWNER:A(8),100n,false,1n]);
   }else if(data.startsWith(toFunctionSelector('poolOf(bytes32)'))){
    result=encode(poolTypes,[1,H(1),A(1),1n,0n,0n,0n,0n,0n,0n,0n,H(0)]);
   }else if(data.startsWith(toFunctionSelector('entryOf(bytes32,uint64)'))){
    result=encode(entryTypes,[identitySubject,H(34),wrongOwner?A(8):OWNER,H(35),1n,false,false,[0,0,0,0,0,0,0]]);
   }else throw Error('Unexpected eth_call selector '+data.slice(0,10));
  }else throw Error('Unexpected method '+method);
  return {ok:true,text:async()=>JSON.stringify({jsonrpc:'2.0',id,result})};
 }
 const e={chainId:'420',vertical,role,sourceId:source.id,sourceAddress:source.address,
  gameVersionId:vertical==='casino'?VER:null,objectId,
  account:['casino','sportsbook'].includes(vertical)?OWNER:null,kind,
  blockNumber:'100',blockHash:BLOCK,transactionHash:TX,logIndex:'2'};
 const rpc=createRpcCanonicalOwnershipSource({chainId:'420',sources:manifest,
  rpcUrl:'https://rpc.example/',betRegistryAddress:REGISTRY,fetcher,ticketAuthority});
 const authority=createBetOwnershipAuthority({chainId:'420',sources:manifest,canonicalSource:rpc,
  betRegistryAddress:REGISTRY,
  verifyRegistry:async()=>({result:{qualified:true},config:{chainId:'420',sources:manifest,
   contracts:{wagerRegistry:{address:REGISTRY}},
   games:[{vertical,gameVersionId:VER}]}}),
  resolveIdentity:async({account,subject})=>({verified:account===OWNER||vertical==='poker',active:true,account,
   userId:'subject-1',subject:subject??identitySubject}),
  subscriptions:async({tenant,userId})=>[{
   tenant,userId,id:'sub-1',channel:'notifications',recipient:'route-1',
   policyVersion:'p1',active:true,consent:true,muted:false,revoked:false
  }],
  now:()=>1762718400000});
 return {e,rpc,authority,calls,log};
}
test('real canonical RPC receipt + WagerRegistry owner, exact Identity and consent',async()=>{
 const f=fixture('casino');
 const response=await f.authority.resolve(f.e);
 assert.equal(response.authoritative,true);
 assert.equal(response.owners.length,1);
 assert.equal(response.owners[0].account,OWNER);
 assert.equal(response.owners[0].gameVersionId,VER);
 assert.equal(response.owners[0].proof.transactionHash,TX);
 assert.equal(f.calls.some(x=>x.method==='eth_call'),true);
 assert.equal(f.calls.some(x=>x.method==='eth_getTransactionReceipt'),true);
});
test('poker hand participants recovered from original canonical locked reservation seats',async()=>{
 const f=fixture('poker');
 const o=await f.authority.resolve(f.e);
 assert.equal(o.owners.length,2);
 assert.deepEqual(new Set(o.owners.map(x=>x.account)),new Set([OWNER,A(8)]));
 assert(f.calls.some(x=>x.method==='eth_getLogs'));
});
test('fantasy entry beneficiary and subject are independently matched at historical block',async()=>{
 const f=fixture('fantasy');
 const o=await f.authority.resolve(f.e);
 assert.equal(o.owners.length,1);
 assert.equal(o.owners[0].account,OWNER);
 await assert.rejects(fixture('fantasy',{wrongOwner:true}).authority.resolve(f.e),
  /unverified|account|identity/);
});
test('unimplemented sportsbook source refuses to manufacture canonical tickets',async()=>{
 const f=fixture('sportsbook');
 await assert.rejects(f.authority.resolve(f.e),/no deployed canonical sportsbook ticket reader/);
});
test('altered receipt, owner, version, topic and finality fail closed',async()=>{
 const f=fixture('casino');
 for(const altered of [{chainId:'421'},{sourceId:'forged'},{transactionHash:H(88)},
  {sourceAddress:A(13)},{objectId:H(99)},{account:A(14)},
  {gameVersionId:H(4)},{blockHash:H(4)},{kind:'sports-ticket-funded'}]){
  await assert.rejects(f.authority.resolve({...f.e,...altered}),/authority:/);
 }
 for(const opts of [{wrongOwner:true},{wrongVersion:true},{reorg:true}]){
  const g=fixture('casino',opts);
  await assert.rejects(g.authority.resolve(g.e),/authority:/);
 }
});
test('private HTTP authenticates and interoperates with existing 420Bet remote resolver',async()=>{
 const f=fixture('casino'),token='authority-service-secret-with-sufficient-length';
 const server=createServer(createOwnershipHTTPHandler({authority:f.authority,bearerToken:token}));
 server.listen(0,'127.0.0.1');await once(server,'listening');
 const base='http://127.0.0.1:'+server.address().port;
 try{
  const denied=await fetch(base+'/v1/420bet/ownership/resolve',{
   method:'POST',headers:{Authorization:'Bearer forged','Content-Type':'application/json'},
   body:JSON.stringify(f.e)});
  assert.equal(denied.status,403);
  const fetcher=(url,options)=>fetch(url.replace('https://owner.example',base),options);
  const client=createRemoteBetOwnershipResolver({origin:'https://owner.example/',chainId:'420',
   bearerToken:token,fetcher,now:()=>1762718400000});
  const resolved=await client(f.e);
  assert.equal(resolved[0].userId,'subject-1');
  assert.equal(resolved[0].subscriptions[0].recipient,'route-1');
 }finally{server.close();await once(server,'close');}
});
test('private owner directories reject forged identity subject and unapproved subscription',async()=>{
 const token='qualified-directory-service-token-000000000';
 const fetcher=async(url,options)=>{
  const body=JSON.parse(options.body);
  const result=url.includes('/wallet-subject')?
   {account:body.account,chainId:body.chainId,subjectId:H(33),revoked:false}:
   {subscriptions:[{tenant:'420bet',userId:body.userId,subscriptionId:'sub-1',
    recipient:'route-1',channel:'notifications',policyVersion:'p1',
    active:true,consent:true,muted:false,revoked:false}]};
  return {ok:true,text:async()=>JSON.stringify(result)};
 };
 const dir=createPrivateOwnerDirectories({chainId:'420',identityOrigin:'https://identity.example/',
  consentOrigin:'https://notifications.example/',identityToken:token,consentToken:token,fetcher});
 const owner=await dir.resolveIdentity({account:OWNER,chainId:'420',subject:H(33)});
 assert.equal(owner.userId,H(33));
 assert.equal((await dir.subscriptions({tenant:'420bet',userId:owner.userId}))[0].id,'sub-1');
 await assert.rejects(dir.resolveIdentity({account:OWNER,chainId:'420',subject:H(44)}),/subject/);
 await assert.rejects(dir.subscriptions({tenant:'other',userId:owner.userId}),/scope|audience|unapproved/);
});
