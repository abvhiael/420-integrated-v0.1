// Disposable actual-contract Anvil R05.4 lifecycle: not a public-testnet finality claim.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {FinalizedRpc,calldata,word,words} from '../../highcountry-economy/src/finalized-rpc.js';
import {keccak256} from '../../highcountry-economy/src/keccak.js';
import {claimIdToBytes32} from '../src/gameclaims-adapter.js';
const url=process.env.HC_TEST_RPC_URL??'http://127.0.0.1:8545';
if(!['127.0.0.1','localhost','[::1]'].includes(new URL(url).hostname))
 throw Error('R05.4 requires disposable local Anvil');
const rpc=new FinalizedRpc({url,chainId:420,contracts:{}});
const accounts=await rpc.request('eth_accounts',[]);
const operator=accounts[0].toLowerCase(),player=accounts[1].toLowerCase(),stranger=accounts[2].toLowerCase();
async function receipt(hash){
 for(let i=0;i<100;i++){
  const r=await rpc.request('eth_getTransactionReceipt',[hash]);
  if(r){if(r.status!=='0x1')throw Error('failed EVM transaction '+hash);return r;}
  await new Promise(resolve=>setTimeout(resolve,100));
 }
 throw Error('EVM transaction timeout');
}
async function send(from,to,data){
 const hash=await rpc.request('eth_sendTransaction',[{from,to,data,gas:'0x1dcd6500'}]);
 return receipt(hash);
}
async function deny(from,to,data){
 let rejected=false;
 try{
  const hash=await rpc.request('eth_sendTransaction',[{from,to,data,gas:'0x1dcd6500'}]);
  const result=await receipt(hash);rejected=result.status!=='0x1';
 }catch{rejected=true;}
 assert.equal(rejected,true,'unauthorized transaction unexpectedly succeeded');
}
const artifact=JSON.parse(await readFile(new URL('../../../contracts/out/R05MigrationDeployment.sol/R05MigrationDeployment.json',import.meta.url),'utf8'));
const harness='0x'+keccak256(Buffer.from('HC.R05.4.DISPOSABLE.CHAIN')).slice(-40);
await rpc.request('anvil_setCode',[harness,artifact.deployedBytecode.object]);
await send(operator,harness,calldata('initialize(address)',operator));
async function get(name){
 const out=await rpc.request('eth_call',[{to:harness,data:calldata(name+'()')},'latest']);
 return '0x'+out.slice(-40);
}
const game=(await rpc.request('eth_call',[{to:harness,data:calldata('GAME()')},'latest'])).toLowerCase();
const identity=await get('identity'),claims=await get('claims'),bridge=await get('bridge'),migration=await get('migration'),growers=await get('growers');
const claim=claimIdToBytes32('77'),grower='12';
await send(operator,growers,calldata('register(uint64,address)',grower,player));
await send(player,identity,calldata('createProfile(bytes32,bytes32)',game,keccak256(Buffer.from('player-approved-profile'))));
await deny(stranger,bridge,calldata('bindGrowerProfile(uint64)',grower));
await send(player,bridge,calldata('bindGrowerProfile(uint64)',grower));
const guestAccount=keccak256(Buffer.from('approved-source')),
 saveRevision='4',stateHash=keccak256(Buffer.from('approved-state')),bodyHash=keccak256(Buffer.from('approved-body'));
const guest=(await rpc.request('eth_call',[{to:migration,data:calldata('guestStateCommitment(bytes32,uint64,bytes32)',
 guestAccount,saveRevision,stateHash)},'latest'])).toLowerCase();
const payload=(await rpc.request('eth_call',[{to:migration,data:calldata('migrationPayloadHash(bytes32,uint64,uint32,bytes32)',
 guest,grower,'7',bodyHash)},'latest'])).toLowerCase();
const now=Number(BigInt((await rpc.request('eth_getBlockByNumber',['latest',false])).timestamp));
const expires=String(now+3600);
const issue=calldata('issue(bytes32,bytes32,address,bytes32,bytes32,uint64)',claim,game,player,guest,payload,expires);
await deny(stranger,claims,issue);
await send(operator,claims,issue);
await deny(operator,claims,issue);
await deny(stranger,claims,calldata('consume(bytes32)',claim));
await send(player,claims,calldata('consume(bytes32)',claim));
await deny(player,claims,calldata('consume(bytes32)',claim));
const bind=calldata('bindConsumedMigrationClaim(bytes32,uint64,bytes32)',claim,grower,payload);
await deny(stranger,bridge,bind);
await deny(player,bridge,calldata('bindConsumedMigrationClaim(bytes32,uint64,bytes32)',claim,grower,keccak256(Buffer.from('forged'))));
await send(player,bridge,bind);
await deny(player,bridge,bind);
const ready=(await rpc.request('eth_call',[{to:migration,data:calldata('isReadyToApply(bytes32,uint64,bytes32,bytes32)',claim,grower,guest,payload)},'latest']));
assert.equal(BigInt(ready),1n);
const apply=calldata('markApplied(bytes32,uint64,bytes32,bytes32)',claim,grower,guest,payload);
await deny(stranger,migration,apply);
await send(operator,migration,apply);
await deny(operator,migration,apply);
const applied=words(await rpc.request('eth_call',[{to:migration,data:calldata('appliedMigration(bytes32)',claim)},'latest']));
assert.equal(BigInt('0x'+applied[0]),12n);
assert.equal('0x'+applied[1],guest);
assert.equal('0x'+applied[2],payload);
assert.equal(BigInt('0x'+applied[4]),1n);
assert.equal(BigInt(await rpc.request('eth_chainId',[])),420n);
console.log('R05.4 actual GameClaims -> target wallet consume -> grower bind -> operator receipt Anvil: PASS');
