import test from 'node:test';
import assert from 'node:assert/strict';
import { BongGogglesModerationOperationsProjection } from '../src/moderationOperations.js';
import {
  buildEmergencyHideWorkspace,
  prepareEmergencyHideIntent,
  reconcileEmergencyHideProjection,
} from '../src/moderationEmergencyHide.js';

function log(eventName,args,n=1){
  return {eventName,args,chainId:420,blockNumber:n,blockHash:`0xblock${n}`,transactionHash:`0xtx${n}`,transactionIndex:0,logIndex:0};
}

test('workspace exposes current emergency hide visibility without mutating canonical content', () => {
  const p=new BongGogglesModerationOperationsProjection();
  p.apply(log('EmergencyHideSet',{targetScope:'scope-1',hiddenUntil:2000,operator:'0xop'},1));
  const workspace=buildEmergencyHideWorkspace(p.snapshot(),{
    now:1000,
    targets:[{scope:'scope-1',targetType:'POST',targetId:'post-1',subjectAccount:'0xsubject'}],
  });
  assert.equal(workspace.activeCount,1);
  assert.equal(workspace.items[0].presentationHidden,true);
  assert.equal(workspace.items[0].canonicalContentMutated,false);
  assert.equal(workspace.items[0].authoritative,false);
});

test('expired emergency hide is no longer presented as hidden', () => {
  const p=new BongGogglesModerationOperationsProjection();
  p.apply(log('EmergencyHideSet',{targetScope:'scope-1',hiddenUntil:1200,operator:'0xop'},1));
  const workspace=buildEmergencyHideWorkspace(p.snapshot(),{
    now:1300,
    targets:[{scope:'scope-1',targetType:'POST',targetId:'post-1',subjectAccount:'0xsubject'}],
  });
  assert.equal(workspace.items[0].active,false);
  assert.equal(workspace.items[0].hiddenUntil,0);
});

test('intent preparation enforces future expiry and canonical one-day maximum', async () => {
  const base={
    targetType:'PROFILE',targetId:'profile-1',subjectAccount:'0xsubject',
    now:1000,deriveScope:async()=> '0xscope',isAuthorized:async()=> true,
  };
  await assert.rejects(()=>prepareEmergencyHideIntent({...base,hiddenUntil:1000}),/expire in the future/);
  await assert.rejects(()=>prepareEmergencyHideIntent({...base,hiddenUntil:1000+86401}),/one-day maximum/);
});

test('authorized emergency hide intent is Wallet-bound and presentation-only', async () => {
  const calls=[];
  const intent=await prepareEmergencyHideIntent({
    targetType:'POST',targetId:'post-1',subjectAccount:'0xsubject',hiddenUntil:2000,now:1000,
    deriveScope:async (...args)=>{calls.push(args);return '0xscope';},
    isAuthorized:async ({actionId,scope})=>actionId==='ACTION_SAFETY_EMERGENCY_HIDE'&&scope==='0xscope',
  });
  assert.deepEqual(calls,[['POST','post-1','0xsubject']]);
  assert.deepEqual(intent.args,['POST','post-1','0xsubject',2000]);
  assert.equal(intent.presentationOnly,true);
  assert.equal(intent.canonicalContentMutation,false);
  assert.equal(intent.walletConfirmationRequired,true);
  assert.equal(intent.signed,false);
  assert.equal(intent.broadcast,false);
});

test('emergency hide intent fails closed without capability', async () => {
  await assert.rejects(()=>prepareEmergencyHideIntent({
    targetType:'POST',targetId:'post-1',subjectAccount:'0xsubject',hiddenUntil:2000,now:1000,
    deriveScope:async()=> '0xscope',isAuthorized:async()=> false,
  }),/lacks emergency-hide capability/);
});

test('reconciliation drops expired presentation state deterministically', () => {
  const p=new BongGogglesModerationOperationsProjection();
  p.apply(log('EmergencyHideSet',{targetScope:'scope-1',hiddenUntil:2000,operator:'0xop'},1));
  const workspace=buildEmergencyHideWorkspace(p.snapshot(),{
    now:1000,
    targets:[{scope:'scope-1',targetType:'POST',targetId:'post-1',subjectAccount:'0xsubject'}],
  });
  const reconciled=reconcileEmergencyHideProjection(workspace,{now:2500});
  assert.equal(reconciled.items[0].active,false);
  assert.equal(reconciled.items[0].presentationHidden,false);
  assert.equal(reconciled.items[0].canonicalContentMutated,false);
});
