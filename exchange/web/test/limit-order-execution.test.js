import test from 'node:test';
import assert from 'node:assert/strict';
import {buildLimitOrderFillTransaction,encodeFillOrder,readLimitOrderState} from '../core/limit-order-execution.js';
import {functionSelector,uintWord} from '../core/abi.js';
import {qualifyLiveLimitOrder,LimitOrderQualificationError} from '../core/live-limit-order-qualification.js';

const addr=n=>'0x'+BigInt(n).toString(16).padStart(40,'0');
const id=n=>'0x'+BigInt(n).toString(16).padStart(64,'0');
const order={maker:addr(1),sellToken:addr(2),buyToken:addr(3),sellAmountRaw:'1000',minBuyAmountRaw:'500',recipient:addr(1),marketId:id(4),nonce:'1',expiry:'4102444800',allowPartial:true};
const hops=[{marketId:id(4),routeId:id(5),tokenOut:addr(3),minAmountOutRaw:'200',routeData:'0x'}];
const signature='0x'+'11'.repeat(65);
const runtime={deployment:{status:'RESOLVED',environment:'testnet'},network:{chainId:'0x420'},contracts:{ExchangeLimitOrderSettlement420:addr(9)}};

test('fillOrder selector and ABI offsets bind exact signed order',()=>{
 const data=encodeFillOrder({order,fillSellAmountRaw:'400',signature,expectedPathHash:id(6),hops});
 assert.equal(data.slice(0,10),functionSelector('fillOrder((address,address,address,uint128,uint128,address,bytes32,uint256,uint64,bool),uint128,bytes,bytes32,(bytes32,bytes32,address,uint256,bytes)[])'));
 assert.equal(data.slice(10+10*64,10+11*64),uintWord('400'));
 assert.equal(data.slice(10+11*64,10+12*64),uintWord(14*32));
 assert.equal(data.slice(10+13*64,10+14*64),uintWord(14*32+32+96));
 assert.ok(data.endsWith(''.padStart(64,'0')));
});

test('fill builder binds deployed settlement, filler and chain',()=>{
 const tx=buildLimitOrderFillTransaction({runtime,filler:addr(8),order,fillSellAmountRaw:'400',signature,expectedPathHash:id(6),hops});
 assert.equal(tx.request.to,addr(9));assert.equal(tx.request.from,addr(8));assert.equal(tx.chainId,'0x420');assert.equal(tx.kind,'ORDER_FILL');
});

test('partial fills, market drift and unresolved runtime fail closed',()=>{
 const args={runtime,filler:addr(8),order,fillSellAmountRaw:'400',signature,expectedPathHash:id(6),hops};
 assert.throws(()=>buildLimitOrderFillTransaction({...args,fillSellAmountRaw:'1001'}),/exceeds/);
 assert.throws(()=>buildLimitOrderFillTransaction({...args,order:{...order,allowPartial:false}}),/partial fill/);
 assert.throws(()=>buildLimitOrderFillTransaction({...args,hops:[{...hops[0],marketId:id(77)}]}),/market differs/);
 assert.throws(()=>buildLimitOrderFillTransaction({...args,runtime:{...runtime,deployment:{status:'UNRESOLVED_UNTIL_DEPLOYMENT',environment:'testnet'}}}),/resolved/);
});

test('storage reads preserve canonical hash, filled amount and cancellation',async()=>{
 const calls=[];
 const provider={request:async({method,params})=>{
  assert.equal(method,'eth_call');calls.push(params[0].data);
  const selector=params[0].data.slice(0,10);
  if(selector===functionSelector('hashOrder((address,address,address,uint128,uint128,address,bytes32,uint256,uint64,bool))'))return id(15);
  if(selector===functionSelector('filledSellAmount(bytes32)'))return '0x'+uintWord(400);
  if(selector===functionSelector('cancelledOrder(bytes32)'))return '0x'+uintWord(1);
  if(selector===functionSelector('cancelledNonce(address,uint256)'))return '0x'+uintWord(0);
  if(selector===functionSelector('minValidNonce(address)'))return '0x'+uintWord(0);
  if(selector===functionSelector('nonceOrderHash(address,uint256)'))return id(15);
  throw new Error('unexpected read');
 }};
 const state=await readLimitOrderState({provider,runtime,order});
 assert.equal(state.orderHash,id(15));assert.equal(state.filledSellAmountRaw,'400');assert.equal(state.cancelled,true);assert.equal(state.boundHash,id(15));assert.equal(calls.length,6);
});

test('live drill cannot start with unresolved deployment',async()=>{
 await assert.rejects(qualifyLiveLimitOrder({runtime:{...runtime,deployment:{status:'UNRESOLVED_UNTIL_DEPLOYMENT',environment:'testnet'}}}),error=>error instanceof LimitOrderQualificationError&&error.code==='TESTNET_REQUIRED');
});
