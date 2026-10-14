// R05.6 real local Anvil log integration, reuses the qualified R05.4 wallet lifecycle.
// Only disposable development-wallet transactions, never production credentials.
import './gameclaims-anvil.integration.mjs';
import assert from 'node:assert/strict';
import {FinalizedRpc,calldata} from '../../highcountry-economy/src/finalized-rpc.js';
import {keccak256} from '../../highcountry-economy/src/keccak.js';
import {PinnedGamingEventRpc420} from '../src/pinned-gaming-event-rpc.js';
import {decodeGamingEvent420,GAMING_EVENT_TOPICS420,gamingEventContract420} from '../src/gaming-event-abi.js';
const url=process.env.HC_TEST_RPC_URL??'http://127.0.0.1:8545';
const chain=new FinalizedRpc({url,chainId:420,contracts:{}});
const harness='0x'+keccak256(Buffer.from('HC.R05.4.DISPOSABLE.CHAIN')).slice(-40);
const get=async name=>{
 const data=await chain.request('eth_call',[{to:harness,data:calldata(name+'()')},'latest']);
 return '0x'+data.slice(-40);
};
const addresses={games:await get('games'),identity:await get('identity'),
 claims:await get('claims'),bridge:await get('bridge'),migration:await get('migration')};
const specs={};
for(const [kind,address] of Object.entries(addresses)){
 const code=await chain.request('eth_getCode',[address,'latest']);
 assert.notEqual(code,'0x');
 specs[kind]={address,codeHash:keccak256(Buffer.from(code.slice(2),'hex'))};
}
const source=new PinnedGamingEventRpc420({url,chainId:420,contracts:specs});
const tip=Number(BigInt(await chain.request('eth_blockNumber',[])));
const observed=new Set();
for(let i=1;i<=tip;i++){
 for(const [owner,contract] of Object.entries(addresses)){
  // A contract is not deployed in earlier blocks. The production backfill
  // must begin at its verified deployment height, not block zero.
  const atHeight=await chain.request('eth_getCode',[contract,'0x'+i.toString(16)]);
  if(atHeight==='0x')continue;
  const block=await source.fetchBlock({chainId:'420',contract,number:String(i)});
  for(const log of block.logs){
   const decoded=decodeGamingEvent420(log);
   assert.equal(gamingEventContract420(decoded.kind),owner);
   observed.add(decoded.kind);
  }
 }
}
for(const kind of ['GameRegistered','GameProfileCreated','MigrationClaimIssued','MigrationClaimConsumed','GrowerGamingProfileBound',
 'MigrationClaimBound','MigrationApplied'])
 assert.ok(observed.has(kind),'missing actual emitted event '+kind);
assert.equal(observed.has('MigrationClaimCancelled'),false,
 'a cancelled claim is never manufactured by consumed-claim lifecycle');
console.log('R05.6 pinned chain/bytecode and actual wallet/GameClaims/HC event topics: PASS');
