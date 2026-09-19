import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { assetBudget, BROWSER_MATRIX, GENESIS_RELEASE_DRILLS, qualifiedReleaseState, releaseGate, staleApiDrill, walletInvalidationDrill } from '../core/release-qualification.js';
import { WalletSession } from '../core/wallet-session.js';

const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const fixture=(name)=>JSON.parse(fs.readFileSync(path.join(root,'fixtures',name),'utf8'));

test('Genesis release drill matrix covers all critical paths',()=>{
  for(const drill of ['MARKET_BROWSE','SWAP_REVIEW','LIMIT_ORDER_REVIEW','BRIDGE_REVIEW','WALLET_NETWORK_CHANGE','STALE_API','REORG_REPLACEMENT','MOBILE_BROWSER','PRODUCTION_ARTIFACT']){
    assert.equal(GENESIS_RELEASE_DRILLS.includes(drill),true);
  }
  assert.equal(BROWSER_MATRIX.length>=6,true);
});

test('integrated market/swap/order/bridge review qualifies with current wallet generation',()=>{
  const wallet=new WalletSession();
  wallet.connected({account:'0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',chainId:'0x1a4'});
  const market=fixture('markets.json')[0];
  const quote=fixture('swap-quote.json');
  const order=fixture('limit-orders.json')[0];
  const bridgeRoute=fixture('bridge-routes.json').find((x)=>x.qualified&&x.routeActive&&!x.paused&&x.settlementHealthy);
  const result=releaseGate({
    market,quote,order,bridgeRoute,
    walletSession:wallet,
    expectedChainId:'0x1a4',
    nowSeconds:quote.observedAt,
  });
  assert.equal(result.wallet.ok,true);
  assert.equal(result.swap.ok,true);
  assert.equal(result.bridge.ok,true);
  assert.match(result.swapReviewDigest,/^[0-9a-f]{8}$/);
  assert.match(result.orderReviewDigest,/^[0-9a-f]{8}$/);
  assert.match(result.bridgeReviewDigest,/^[0-9a-f]{8}$/);
});

test('wallet account change invalidates prior session generation',()=>{
  const wallet=new WalletSession();
  wallet.connected({account:'0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',chainId:'0x1a4'});
  assert.equal(walletInvalidationDrill(wallet,'0x1111111111111111111111111111111111111111'),true);
});

test('stale/degraded API drill remains fail safe',()=>{
  assert.deepEqual(staleApiDrill({status:503}),{state:'degraded',retryable:true,message:'Exchange API temporarily unavailable'});
  assert.deepEqual(staleApiDrill({status:406,code:'UNSUPPORTED_VERSION'}),{state:'blocked',retryable:false,message:'Exchange API version mismatch'});
});

test('static asset budget is explicit and bounded',()=>{
  assert.equal(assetBudget({html:50_000,js:250_000,css:100_000,other:100_000}).ok,true);
  assert.equal(assetBudget({html:50_000,js:350_000,css:100_000,other:0}).ok,false);
});

test('repository qualification is distinct from production-live operational gates',()=>{
  const state=qualifiedReleaseState({
    ciGreen:true,
    artifactQualified:true,
    operationalGates:[
      {id:'dns',status:'pending'},
      {id:'production-api',status:'pending'},
    ],
  });
  assert.equal(state.repositoryQualified,true);
  assert.equal(state.productionLive,false);
  assert.deepEqual(state.pendingOperationalGates,['dns','production-api']);
});
