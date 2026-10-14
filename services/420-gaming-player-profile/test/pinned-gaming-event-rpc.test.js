import test from 'node:test';
import assert from 'node:assert/strict';
import {PinnedGamingEventRpc420} from '../src/pinned-gaming-event-rpc.js';
import {keccak256} from '../../highcountry-economy/src/keccak.js';
const h=x=>'0x'+x.repeat(64),contract='0x'+'a'.repeat(40),bytecode='0x60006000';
const spec={claims:{address:contract,codeHash:keccak256(Buffer.from(bytecode.slice(2),'hex'))}};
const block={number:'0x2',hash:h('1'),parentHash:h('2')};
let chain='0x1a4',code=bytecode,logs=[],anchor=true,blockReads=0;
const fetchImpl=async(_url,opts)=>{
 const request=JSON.parse(opts.body),method=request.method;
 let result;
 if(method==='eth_chainId')result=chain;
 if(method==='eth_getBlockByNumber')result=anchor?block:++blockReads===1?block:{...block,hash:h('3')};
 if(method==='eth_getCode')result=code;
 if(method==='eth_getLogs')result=logs;
 return {ok:true,json:async()=>({jsonrpc:'2.0',id:request.id,result})};
};
const source=()=>new PinnedGamingEventRpc420({url:'http://127.0.0.1:8545',
 chainId:420,contracts:spec,fetchImpl});
test('R05.6 JSON RPC verifies chain, code, block and log identities',async()=>{
 const s=source(),r=await s.fetchBlock({chainId:'420',contract,number:'2'});
 assert.equal(r.hash,block.hash);assert.deepEqual(r.logs,[]);
 chain='0x1a5';
 await assert.rejects(()=>s.fetchBlock({chainId:'420',contract,number:'2'}),/events-rpc-wrong-chain/);
 chain='0x1a4';code='0x6001';
 await assert.rejects(()=>s.fetchBlock({chainId:'420',contract,number:'2'}),/events-rpc-code-drift/);
 code=bytecode;logs=[{removed:true,address:contract,blockHash:block.hash,transactionHash:h('4'),
 transactionIndex:'0x0',logIndex:'0x0',topics:[h('5')],data:'0x'}];
 await assert.rejects(()=>s.fetchBlock({chainId:'420',contract,number:'2'}),/events-rpc-log-invalid/);
 logs=[];anchor=false;blockReads=0;
 await assert.rejects(()=>s.fetchBlock({chainId:'420',contract,number:'2'}),/events-rpc-chain-moved|events-rpc-code-drift/);
 anchor=true;
});
