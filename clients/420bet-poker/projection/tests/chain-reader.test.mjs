import test from 'node:test';
import assert from 'node:assert/strict';
import {keccak256} from 'viem';
import {createCanonicalPokerReader,NATIVE_PHASES} from '../chain-reader.mjs';
const wallet='0x'+'1'.repeat(40),other='0x'+'2'.repeat(40),operator='0x'+'3'.repeat(40);
const id='0x'+'a'.repeat(64),configHash='0x'+'b'.repeat(64),stateRoot='0x'+'c'.repeat(64),
 handId='0x'+'d'.repeat(64),deckRoot='0x'+'e'.repeat(64),ZERO='0x'+'0'.repeat(64);
const chainId=11155111,bytecode='0x60016000',runtimeHash=keccak256(bytecode);
const contractNames=['registry','ledger','engine','deals','shuffle','reveals'];
const contracts={...Object.fromEntries(contractNames.map((k,i)=>[k,'0x'+(i+4).toString(16).repeat(40)])),
 codeHashes:Object.fromEntries(contractNames.map(k=>[k,runtimeHash]))};
const binding={tableId:id,configHash,name:'Garden',smallBlind:5,bigBlind:10,tableVersion:1};
function mock({active=false,phase=3,badCode=false,badSlot=false,wrongPot=false}={}){
 const calls=[];
 const rpc={
  async getChainId(){return chainId;},
  async getBlock({blockTag}){assert.equal(blockTag,'finalized');return {number:120n,hash:'0x'+'f'.repeat(64),timestamp:1800000000n};},
  async getBytecode({address,blockNumber}){assert.equal(blockNumber,120n);return badCode&&address===contracts.reveals?'0x6000':bytecode;},
  async readContract(args){
   calls.push(args);
   assert.equal(args.blockNumber,120n,'every read pinned to finalized block');
   switch(args.functionName){
    case 'getTable':return {exists:true,status:3,configHash,
     config:{tableId:id,operatorId:stateRoot,seats:2,smallBlind:5n,bigBlind:10n}};
    case 'operators':return operator;
    case 'isActive':return true;
    case 'seatingEpoch':return 3n;
    case 'activeHand':return active?handId:ZERO;
    case 'seatOf':return {player:args.args[1]===0?wallet:other,
      chips:args.args[1]===0?500n:600n,sittingOut:false,epoch:3n};
    case 'ledger':return contracts.ledger;
    case 'deals':return contracts.deals;
    case 'shuffle':return contracts.shuffle;
    case 'revealForTable':return contracts.reveals;
    case 'gameOf':return {initialized:true,tableId:id,stateRoot,seatsMask:3n,
      phase,button:1n,toAct:0n,deadline:1800000005n,nonce:4n,
      pot:wrongPot?30n:20n};
    case 'getHand':return {tableId:id,configHash,epoch:3n,state:2n,nonce:4n,transcriptCommitment:stateRoot};
    case 'recordOf':return {stage:2n,finalDeckRoot:deckRoot};
    case 'playerOf':return {stack:args.args[1]===0?490n:590n,contributed:10n,
      folded:false,allIn:false};
    case 'slotOf':return {opened:!badSlot,shareA:true,shareB:true,
      card:BigInt(args.args[1])};
    default:throw Error('unexpected read: '+args.functionName);
   }
  }
 };
 return {rpc,calls};
}
test('reader pins exact code hashes, finalized block, config, seat ledger and rejects wrong network',async()=>{
 const {rpc,calls}=mock();
 const reader=createCanonicalPokerReader({chainId,contracts,clientOverride:rpc});
 const v=await reader.readTable(binding,{subject:wallet,chainId});
 assert.equal(v.blockNumber,120);assert.equal(v.finalized,true);
 assert.equal(v.config.seatCount,2);assert.equal(v.seats[0].owner,wallet);
 assert.equal(v.seats[1].owner,other);assert.equal(v.hand.phase,'TABLE_OPEN');
 assert.deepEqual(v.hand.community,[]);
 assert(calls.length>=6);
 await assert.rejects(()=>reader.readTable(binding,{subject:wallet,chainId:1}),/scope/i);
});
test('reader refuses a deployment with unexpected on-chain runtime bytecode',async()=>{
 const {rpc}=mock({badCode:true});
 await assert.rejects(()=>createCanonicalPokerReader({chainId,contracts,clientOverride:rpc})
  .readTable(binding,{subject:wallet,chainId}),/runtime code hash/i);
});
test('active hand binds verified dual-provider shuffle and proven public slots',async()=>{
 const {rpc}=mock({active:true,phase:3});
 const result=await createCanonicalPokerReader({chainId,contracts,clientOverride:rpc})
  .readTable(binding,{subject:wallet,chainId});
 assert.equal(result.hand.phase,'FLOP');
 assert.equal(result.hand.community.length,3);
 assert.equal(result.dealProofVerified,true);
 assert.equal(result.revealsVerified,true);
 assert.equal(result.hand.pot,20);
 assert.equal(result.stateHash,stateRoot);
 assert.equal(result.deckRoot,deckRoot);
});
test('native on-chain waiting states never fabricate unrevealed cards or settlement',async()=>{
 assert.deepEqual(NATIVE_PHASES,[
  'NONE','PREFLOP','AWAIT_FLOP','FLOP','AWAIT_TURN','TURN','AWAIT_RIVER','RIVER','SHOWDOWN','UNCONTESTED'
 ]);
 for(const [phase,count] of [[1,0],[2,0],[3,3],[4,3],[5,4],[6,4],[7,5],[8,5],[9,0]]){
  const {rpc}=mock({active:true,phase});
  const v=await createCanonicalPokerReader({chainId,contracts,clientOverride:rpc})
   .readTable(binding,{subject:wallet,chainId});
  assert.equal(v.hand.phase,NATIVE_PHASES[phase]);
  assert.equal(v.hand.community.length,count,'phase '+phase);
 }
});
test('reader rejects any missing proof-verified public reveal or invalid native pot',async()=>{
 for(const variant of [{badSlot:true},{wrongPot:true}]){
  const {rpc}=mock({active:true,phase:3,...variant});
  await assert.rejects(()=>createCanonicalPokerReader({chainId,contracts,clientOverride:rpc})
   .readTable(binding,{subject:wallet,chainId}));
 }
});
