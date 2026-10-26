import test from 'node:test';
import assert from 'node:assert/strict';
import {CanonicalSocialGateway} from '../src/canonical-social-gateway.js';
const H='0x'+'a'.repeat(64),B='0x'+'b'.repeat(64),W='0x'+'1'.repeat(40);
const identity={chainId:420,registeredPrincipal:async()=> 'alice',walletOf:async()=>W};
function fixture(overrides={}){
 const rows=new Map();let submitted=0;
 const pool={
  connect:async()=>({query:async(sql,args=[])=>{
   if(sql.startsWith('INSERT'))rows.set(args[1],{principal:args[2],wallet:args[3],action:args[4],tx_hash:args[5]});
   if(sql.startsWith('SELECT'))return {rows:[rows.get(args[1])].filter(Boolean)};
   return {rows:[]};
  },release(){}}),
  query:async(sql,args=[])=>sql.startsWith('SELECT')?{rows:[rows.get(args[1])].filter(Boolean)}:{rows:[]}
 };
 const chain={
  snapshot:async()=>({organizations:[],cooperatives:[],permissions:[]}),
  permission:async()=>({allowed:true,policyHash:H,blockHash:B}),
  transactionIntent:async()=>({from:W,to:W,chainId:420,value:'0x0',data:'0x1234'}),
  submitSigned:async()=>{submitted++;return {hash:H,signer:W,chainId:420,isFundTransfer:false};},
  finalizedReceipt:async()=>({hash:H,signer:W,action:'organization.join',finalized:true,success:true,isFundTransfer:false,blockHash:B}),
  verifyFinality:async()=>true,
  history:async()=>({entries:[],nextCursor:null}),
  verifyTreasurySettlement:async()=>false,
  ...overrides
 };
 const gateway=new CanonicalSocialGateway({identity,pool,chain,scope:'HC-GAME'});
 return {gateway,rows,get submissions(){return submitted;}};
}
const ctx={session:'signed-session',principal:'alice',scope:'HC-GAME',action:'organization.join',payload:{organization:'org-a'}};
test('registered player and canonical snapshot required',async()=>{
 const f=fixture();assert.equal((await f.gateway.authenticate('signed-session')).wallet,W);
 assert.deepEqual((await f.gateway.snapshot({session:'signed-session',scope:'HC-GAME'})).permissions,[]);
 await assert.rejects(f.gateway.snapshot({session:'signed-session',scope:'foreign'}),/scope mismatch/);
});
test('canonical permission changes and replay are rejected before sign',async()=>{
 let calls=0;
 const f=fixture({permission:async()=>({allowed:true,policyHash:++calls===1?H:B,blockHash:B})});
 const permit=await f.gateway.authorize(ctx);
 await assert.rejects(f.gateway.submit({...ctx,authorizationProof:permit.proof,signedRawTransaction:'0x1234'}),/permission changed/);
 assert.equal(f.submissions,0);
 await assert.rejects(f.gateway.submit({...ctx,authorizationProof:permit.proof}),/replayed/);
});
test('forged signer, protected actions and unfinalized receipts fail closed',async()=>{
 const f=fixture({submitSigned:async()=>({hash:H,signer:'0x'+'2'.repeat(40),chainId:420})});
 const p=await f.gateway.authorize(ctx);
 await assert.rejects(f.gateway.submit({...ctx,authorizationProof:p.proof,signedRawTransaction:'0x1234'}),/invalid signed/);
 await assert.rejects(f.gateway.authorize({...ctx,action:'wallet.transfer'}),/forbidden/);
 await assert.rejects(f.gateway.authorize({...ctx,action:'cooperative.execute',payload:{kind:'treasury'}}),/forbidden/);
});
test('persistent transaction requires real finality before completion',async()=>{
 const f=fixture({verifyFinality:async()=>false});
 const p=await f.gateway.authorize(ctx);const tx=await f.gateway.submit({...ctx,authorizationProof:p.proof});
 assert.equal(tx.operationId,H);
 await assert.rejects(f.gateway.receipt({session:'signed-session',scope:'HC-GAME',operationId:H}),/finality proof denied/);
});
test('private receipt cannot be read by other account',async()=>{
 const f=fixture();const p=await f.gateway.authorize(ctx);await f.gateway.submit({...ctx,authorizationProof:p.proof});
 f.rows.get(H).principal='mallory';
 await assert.rejects(f.gateway.receipt({session:'signed-session',scope:'HC-GAME',operationId:H}),/private operation denied/);
});
test('permission history never becomes settlement without independently verified ledger',async()=>{
 const e={id:'grant',state:'approved',blockHash:B,visibleTo:[W],settled:true};
 const f=fixture({history:async()=>({entries:[e]})});
 const h=await f.gateway.history({session:'signed-session',scope:'HC-GAME',kind:'treasury',id:'org-a'});
 assert.equal(h.entries[0].settled,false);
 assert.equal(h.entries[0].settlementProof,null);
});
test('fabricated paid transaction history is rejected',async()=>{
 const e={id:'transfer',state:'settled',blockHash:B,visibleTo:[W]};
 const f=fixture({history:async()=>({entries:[e]})});
 await assert.rejects(f.gateway.history({session:'signed-session',scope:'HC-GAME',kind:'treasury',id:'org-a'}),/settlement not verified/);
});
