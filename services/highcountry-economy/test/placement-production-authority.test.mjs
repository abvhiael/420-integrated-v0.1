import test from 'node:test';
import assert from 'node:assert/strict';
import {HighCountryProductionPlacementAuthority} from '../src/placement-production-authority.js';
import {composeOrdinaryMarketRuntime,runtimeHttpServer} from '../src/runtime-service.js';
const session='signed';
const claims={sub:'alice',iss:'issuer',epoch:0};
const runtime={registeredPrincipal:async()=> 'alice',verifyToken:()=>claims,issuers:{issuer:{operators:{alice:{worldAuthority:true}}}}};
const world={verifyEvidence:async()=>true,verifyEvent:async()=>true,canPlace:async()=>true,validate:async()=>({qualified:true}),geometrySnapshot:async()=>new Map(),verifyTransferConsent:async()=>true,verifyOrdinaryCustodyAtCommit:()=>true,verifyTransferAtCommit:()=>true,verifyAtCommit:()=>true};
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

test('operator commit gate rejects epoch, account and privilege revocation',()=>{
 const auth=new HighCountryProductionPlacementAuthority({runtime,world});
 const state={runtimeAccounts:new Map([['alice',{issuer:'issuer'}]]),runtimeEpochs:new Map([['alice',0]])};
 const args={session,parcelId:'parcel',state};
 assert.equal(auth.verifyOperatorAtCommit(args),true);
 state.runtimeEpochs.set('alice',1);assert.equal(auth.verifyOperatorAtCommit(args),false);
 state.runtimeEpochs.set('alice',0);state.runtimeAccounts.delete('alice');assert.equal(auth.verifyOperatorAtCommit(args),false);
 state.runtimeAccounts.set('alice',{issuer:'issuer'});runtime.issuers.issuer.operators.alice.worldAuthority=false;
 try{assert.equal(auth.verifyOperatorAtCommit(args),false)}finally{runtime.issuers.issuer.operators.alice.worldAuthority=true}
});
test('commit-time independent verifiers mandatory at composition',()=>{
 assert.throws(()=>new HighCountryProductionPlacementAuthority({runtime,world:{...world,verifyAtCommit:undefined}}),/missing-independent-authorities/);
 assert.throws(()=>new HighCountryProductionPlacementAuthority({runtime,world:{...world,verifyTransferAtCommit:undefined}}),/missing-independent-authorities/);
});

test('03 Package 4: ordinary runtime placement uses identical store and identity; fail closed without independent world authority',()=>{
 const store={transact:fn=>fn({})};
 const identity={store,registeredPrincipal:async()=> 'alice',requireTrustedIssuer:async()=>true,
  verifyToken:()=>({sub:'alice',iss:'issuer',epoch:0}),
  issuers:{issuer:{operators:{alice:{worldAuthority:true}}}}};
 const inventoryAuthority={verifyAssetReceipt:async()=>true,requireMarketOpen:async()=>true};
 const args={store,identity,inventoryAuthority,clock:()=>10};
 assert.equal(composeOrdinaryMarketRuntime(args).placement,null);
 const qualified={world:{...world},resolveGeometry:async()=>({}),resolveAssets:async()=>new Set()};
 const integrated=composeOrdinaryMarketRuntime({...args,placement:qualified});
 assert.equal(integrated.placement.transactions.store,store);
 assert.equal(integrated.placement.registry.store,store);
 assert.equal(integrated.placement.transfer.store,store);
 assert.equal(integrated.placement.transactions.auth.runtime,identity);
 assert.equal(integrated.market.store,store);
 assert.equal(integrated.marketView.store,store);
 assert.ok(Object.isFrozen(integrated.placement));
 assert.throws(()=>composeOrdinaryMarketRuntime({...args,placement:{...qualified,world:{...world,verifyAtCommit:undefined}}}),/missing-independent-authorities/);
 assert.throws(()=>composeOrdinaryMarketRuntime({...args,placement:{...qualified,world:{...world,verifyTransferAtCommit:undefined}}}),/unqualified placement authority wiring/);
 assert.throws(()=>composeOrdinaryMarketRuntime({...args,placement:{...qualified,resolveGeometry:null}}),/unqualified placement authority wiring/);
 assert.throws(()=>composeOrdinaryMarketRuntime({...args,identity:{...identity,store:{transact:store.transact}},placement:qualified}),/ordinary market trusted dependencies missing/);
});
test('03 Package 4: internal placement composition does not expose HTTP placement routes',async t=>{
 const store={transact:fn=>fn({})};
 const identity={store,registeredPrincipal:async()=> 'alice',requireTrustedIssuer:async()=>true,
  verifyToken:()=>({sub:'alice',iss:'issuer',epoch:0}),
  issuers:{issuer:{operators:{alice:{worldAuthority:true}}}}};
 const placement={world:{...world},resolveGeometry:async()=>({}),resolveAssets:async()=>new Set()};
 const runtime=composeOrdinaryMarketRuntime({store,identity,inventoryAuthority:{verifyAssetReceipt:async()=>true,requireMarketOpen:async()=>true},placement});
 const server=runtimeHttpServer(runtime,{origin:'https://hc.example'});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>server.close());
 const response=await fetch('http://127.0.0.1:'+server.address().port+'/placement/execute',{
  method:'POST',headers:{'content-type':'application/json',origin:'https://hc.example',authorization:'Bearer signed'},
  body:JSON.stringify({operation:'unauthorized',action:'place'})});
 assert.equal(response.status,403);
});
