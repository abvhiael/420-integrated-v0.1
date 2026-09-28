import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addressHistoryPresentation420,
  assetTransfersPresentation420,
  contractPresentation420,
  diagnosticPresentation420,
  producerPresentation420,
  registryServicePresentation420,
  registryVersionPresentation420,
  routeLink420
} from './static/workflow-presentation.mjs';

const h = n => '0x'+BigInt(n).toString(16).padStart(64,'0');
const a = n => '0x'+BigInt(n).toString(16).padStart(40,'0');

function blockView(overrides={}) {
  const trace={
    executionBlockHash:h(77),consensusSlot:777,producerSeat:12,proposerRank:1,
    consensusBlockRoot:h(700),certified:true,
    executionAuthority:'node420 canonical execution block',
    consensusAuthority:'fourtwentyd consensus-produced block history',
    projectionAuthority:'420Indexer derived projection',
    canonicalAuthority:false,
    ...(overrides.trace||{})
  };
  const producer={
    consensusSlot:777,producerSeat:12,proposerRank:1,consensusBlockRoot:h(700),certified:true,
    ...(overrides.producer||{})
  };
  return {block:{number:77,hash:h(77),producer,...(overrides.block||{})},trace};
}

test('historical block producer fixture renders deterministic consensus navigation',()=>{
  const p=producerPresentation420(blockView());
  assert.equal(p.slot,'777');
  assert.equal(p.seat,'12');
  assert.match(p.consensusLink,/#\/consensus\/777/);
  assert.match(p.blockLink,/#\/blocks\/77/);
});

test('missing producer trace and consensus/execution divergence fail closed',()=>{
  assert.throws(()=>producerPresentation420({block:{number:77,hash:h(77)}}),/incomplete/);
  assert.throws(()=>producerPresentation420(blockView({producer:{producerSeat:13}})),/provenance mismatch/);
  assert.throws(()=>producerPresentation420(blockView({trace:{executionBlockHash:h(99)}})),/block provenance mismatch/);
  assert.throws(()=>producerPresentation420(blockView({trace:{canonicalAuthority:true}})),/canonical authority/);
});

test('validator consensus navigation does not invent identity authority',()=>{
  const html=routeLink420(['consensus','842'],'validator seat 4');
  assert.equal(html,'<a class="link mono" href="#/consensus/842">validator seat 4</a>');
  assert.ok(!html.includes('canonical'));
});

test('Registry implementation must match active history before contract navigation',()=>{
  const v={serviceId:'420Registry',activeVersion:2,implementation:a(2),versions:[
    {version:1,implementation:a(1),active:false},{version:2,implementation:a(2),active:true}
  ]};
  const p=registryServicePresentation420(v);
  assert.match(p.implementationLink,new RegExp(a(2)));
  assert.throws(()=>registryServicePresentation420({...v,implementation:a(9)}),/implementation mismatch/);
  assert.throws(()=>registryServicePresentation420({...v,activeVersion:1}),/not active in history/);
});

test('Registry version identity is rechecked before implementation contract navigation',()=>{
  const v={serviceId:'420Registry',version:2,implementation:a(2),active:true};
  const p=registryVersionPresentation420(v,'420Registry','2');
  assert.match(p.implementationLink,new RegExp(a(2)));
  assert.throws(()=>registryVersionPresentation420({...v,serviceId:'420Other'},'420Registry','2'),/identity mismatch/);
  assert.throws(()=>registryVersionPresentation420({...v,implementation:'javascript:alert(1)'},'420Registry','2'),/implementation/);
});

test('address history produces deterministic transaction block and counterparty links',()=>{
  const rows=addressHistoryPresentation420([
    {hash:h(10),blockNumber:9,from:a(1),to:a(2),valueWei:'420'},
    {hash:h(11),blockNumber:10,from:a(3),to:a(1),valueWei:'1'}
  ],a(1));
  assert.equal(rows[0].outgoing,true);
  assert.equal(rows[1].outgoing,false);
  assert.match(rows[0].txLink,/#\/transactions\//);
  assert.match(rows[0].blockLink,/#\/blocks\/9/);
});

test('asset transfers preserve cross-resource links and escape hostile asset labels',()=>{
  const rows=assetTransfersPresentation420([{blockNumber:9,transactionHash:h(10),from:a(1),to:a(2),amount:'420',assetKey:'<img src=x onerror=alert(1)>'}]);
  assert.ok(rows[0].label.includes('&lt;img'));
  assert.ok(!rows[0].label.includes('<img'));
  assert.match(rows[0].fromLink,/#\/addresses\//);
  assert.match(rows[0].toLink,/#\/addresses\//);
  assert.match(rows[0].txLink,/#\/transactions\//);
});

test('contract deployment cross-links transaction and block deterministically',()=>{
  const p=contractPresentation420({contract:{address:a(7),deploymentTxHash:h(8),deploymentBlockNumber:44}},a(7));
  assert.match(p.deploymentTxLink,/#\/transactions\//);
  assert.match(p.deploymentBlockLink,/#\/blocks\/44/);
});

test('malicious or malformed internal resource identifiers fail closed',()=>{
  assert.throws(()=>addressHistoryPresentation420([{hash:'javascript:alert(1)',blockNumber:1,from:a(1),to:a(2),valueWei:'1'}],a(1)),/transaction hash/);
  assert.throws(()=>assetTransfersPresentation420([{blockNumber:1,transactionHash:h(1),from:'\" onmouseover=\"alert(1)',to:a(2),amount:'1',assetKey:'x'}]),/from/);
  assert.throws(()=>contractPresentation420({contract:{address:'javascript:alert(1)',deploymentBlockNumber:1}},a(1)),/contract address/);
});

test('wrong-chain stale degraded and inconsistent states render explicit diagnostics',()=>{
  assert.equal(diagnosticPresentation420({wrongChain:true}).state,'WRONG CHAIN');
  assert.equal(diagnosticPresentation420({stale:true}).state,'STALE');
  assert.equal(diagnosticPresentation420({degraded:true}).state,'DEGRADED');
  assert.equal(diagnosticPresentation420({consistent:false}).state,'INCONSISTENT');
  assert.match(diagnosticPresentation420({stale:true}).banner,/non-canonical projection/);
  assert.throws(()=>diagnosticPresentation420({ready:true,wrongChain:true}),/contradicts/);
});
