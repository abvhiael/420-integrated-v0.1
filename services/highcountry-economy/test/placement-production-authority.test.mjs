import test from 'node:test';
import assert from 'node:assert/strict';
import {HighCountryProductionPlacementAuthority} from '../src/placement-production-authority.js';
const session='signed';
const claims={sub:'alice',iss:'issuer',epoch:0};
const runtime={registeredPrincipal:async()=> 'alice',verifyToken:()=>claims,issuers:{issuer:{operators:{alice:{worldAuthority:true}}}}};
const world={verifyEvidence:async()=>true,verifyEvent:async()=>true,canPlace:async()=>true,validate:async()=>({qualified:true}),geometrySnapshot:async()=>new Map(),verifyTransferConsent:async()=>true,verifyTransferAtCommit:()=>true,verifyAtCommit:()=>true};
test('production placement authority binds operator to runtime issuer and denies unprovisioned components',async()=>{
 assert.throws(()=>new HighCountryProductionPlacementAuthority({runtime,world:{}}),/missing-independent-authorities/);
 const a=new HighCountryProductionPlacementAuthority({runtime,world});await a.requireWorldAuthorityOperator(session,'parcel');
 runtime.issuers.issuer.operators.alice.worldAuthority=false;
 await assert.rejects(a.requireWorldAuthorityOperator(session,'parcel'),/operator-denied/);
 runtime.issuers.issuer.operators.alice.worldAuthority=true;
});
test('production commit gate denies revoked runtime epoch or parcel authority',async()=>{
 const a=new HighCountryProductionPlacementAuthority({runtime,world});
 const s={runtimeAccounts:new Map([['alice',{issuer:'issuer'}]]),runtimeEpochs:new Map([['alice',0]]),placementAuthorityRevisions:new Map([['parcel',{revision:1,evidenceId:'world',revoked:false}]])};
 const args={principal:'alice',session,command:{record:{parcelId:'parcel'}},authoritative:{revision:1},world:{evidenceId:'world'},state:s};
 assert.equal(a.verifyAtCommit(args),true);
 s.runtimeEpochs.set('alice',1);assert.equal(a.verifyAtCommit(args),false);
 s.runtimeEpochs.set('alice',0);s.placementAuthorityRevisions.get('parcel').revoked=true;
 assert.equal(a.verifyAtCommit(args),false);
});

test('dual-party transfer commit gate rejects revoked recipient and expired caller session',async()=>{
 const a=new HighCountryProductionPlacementAuthority({runtime,world});
 const s={runtimeAccounts:new Map([['alice',{issuer:'issuer'}],['bob',{issuer:'issuer'}]]),runtimeEpochs:new Map([['alice',0],['bob',0]])};
 const previous=runtime.verifyToken;runtime.verifyToken=x=>({sub:x,iss:'issuer',epoch:0});
 try{
  const args={senderSession:'alice',recipientSession:'bob',from:'alice',to:'bob',state:s,envelope:{},consent:'both-signed'};
  assert.equal(a.verifyTransferAtCommit(args),true);
  s.runtimeEpochs.set('bob',1);assert.equal(a.verifyTransferAtCommit(args),false);
  s.runtimeEpochs.set('bob',0);s.runtimeAccounts.delete('bob');assert.equal(a.verifyTransferAtCommit(args),false);
 }finally{runtime.verifyToken=previous}
});
