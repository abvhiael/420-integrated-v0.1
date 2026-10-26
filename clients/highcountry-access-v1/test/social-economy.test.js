import test from 'node:test';
import assert from 'node:assert/strict';
import {SocialEconomyController,OPERATIONS,SocialEconomyError} from '../src/social-economy-controller.js';
function harness(overrides={}){
 const calls=[];
 const gateway={
  async authenticate(session){calls.push(['authenticate',session]);return {registered:true,principal:'player-a'};},
  async snapshot(){return {organizations:[{id:'org-a'}],cooperatives:[{id:'coop-a'}],permissions:[]};},
  async authorize(ctx){calls.push(['authorize',ctx.action]);return {allowed:true,proof:'verified-proof'};},
  async submit(ctx){calls.push(['submit',ctx.action]);return {operationId:'op-1'};},
  async receipt(){return {operationId:'op-1',finalized:true,authorized:true,action:OPERATIONS.join,isFundTransfer:false};},
  async history(){return {entries:[],nextCursor:null}},
  ...overrides
 };
 return {controller:new SocialEconomyController({gateway,scope:'HC-GAME'}),calls};
}
test('unauthenticated operations and absent privileged gateway fail closed',async()=>{
 assert.throws(()=>new SocialEconomyController({gateway:{},scope:'HC-GAME'}),SocialEconomyError);
 const {controller}=harness();
 await assert.rejects(controller.act(OPERATIONS.join,{organization:'org-a'}),/session required/);
 await assert.rejects(controller.history('treasury','org-a'),/invalid history/);
});
test('every social mutation requires authorization and a finalized receipt',async()=>{
 const {controller,calls}=harness();
 await controller.connect('session');
 const outcome=await controller.act(OPERATIONS.join,{organization:'org-a'});
 assert.equal(outcome.receipt.authorized,true);
 assert.deepEqual(calls.map(x=>x[0]),['authenticate','authorize','submit']);
 assert.equal(outcome.snapshot.revision,2);
});
test('authorization denial never submits',async()=>{
 let calls=0;const {controller}=harness({authorize:async()=>({allowed:false}),submit:async()=>{calls++;}});
 await controller.connect('session');
 await assert.rejects(controller.act(OPERATIONS.invite,{organization:'org-a',account:'player-b'}),/authorization denied/);
 assert.equal(calls,0);
});
test('pending or forged receipt cannot masquerade as completed activity',async()=>{
 for(const receipt of [{operationId:'op-1',finalized:false,authorized:true,action:OPERATIONS.join},{operationId:'op-2',finalized:true,authorized:true,action:OPERATIONS.join},{operationId:'op-1',finalized:true,authorized:true,action:OPERATIONS.vote}]){
  const {controller}=harness({receipt:async()=>receipt});await controller.connect('session');
  await assert.rejects(controller.act(OPERATIONS.join),/finalized canonical/);
 }
});
test('treasury permission is never treated as a transfer receipt',async()=>{
 const {controller}=harness({history:async()=>({entries:[{id:'grant-1',state:'approved',settled:true,settlementProof:{canonical:true,receiptId:'FAKE'}}]})});
 await controller.connect('session');
 const h=await controller.history('treasury','org-a');
 assert.equal(h.entries[0].settled,false);assert.equal(h.entries[0].settlementProof,null);
 await assert.rejects(controller.act(OPERATIONS.execute,{kind:'treasury'}),/governance cannot execute treasury transfers/);
});
test('settled history requires canonical ledger proof',async()=>{
 const {controller}=harness({history:async()=>({entries:[{id:'payout-1',state:'settled'}]})});
 await controller.connect('session');
 await assert.rejects(controller.history('treasury','org-a'),/canonical settlement receipt missing/);
});
test('fund transfer masquerading as social action is denied',async()=>{
 const {controller}=harness({receipt:async()=>({operationId:'op-1',finalized:true,authorized:true,action:OPERATIONS.join,isFundTransfer:true})});
 await controller.connect('session');
 await assert.rejects(controller.act(OPERATIONS.join),/fund transfers require/);
});
test('unknown operations and unregistered players rejected',async()=>{
 const h=harness({authenticate:async()=>({registered:false,principal:'guest'})});
 await assert.rejects(h.controller.connect('guest'),/registered authenticated/);
 const {controller}=harness();await controller.connect('session');
 await assert.rejects(controller.act('wallet.transfer',{}),/unsupported operation/);
});
