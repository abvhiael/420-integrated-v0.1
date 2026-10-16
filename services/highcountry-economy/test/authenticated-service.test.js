import {test} from 'node:test';
import assert from 'node:assert/strict';
import {AuthenticatedEconomyService} from '../src/authenticated-service.js';
import {BudsLedger,MemoryTransactionFixture} from '../src/buds-ledger.js';
test('derive owner from authenticated session, reject guest and unauthorized issuer',async()=>{
 const store=new MemoryTransactionFixture(),ledger=new BudsLedger(store,{
  authorize:()=>true,sourceLimit:()=>100,authorizeSink:()=>true
 });
 const authority={
  async registeredPrincipal(session){if(session==='alice-session')return 'alice';throw Error('guest');},
  async requireTrustedIssuer(session){if(session!=='trusted-issuer')throw Error('issuer denied');},
  async requireMarketOperator(session){if(session!=='market-service')throw Error('market denied');}
 };
 const api=new AuthenticatedEconomyService(ledger,authority);
 await assert.rejects(api.earn('alice-session','bad','alice','mission','proof',50));
 await api.earn('trusted-issuer','good','alice','mission','proof',50);
 await assert.rejects(api.reserve('guest','guest-op',10));
 await api.reserve('alice-session','reserved',20);
 await assert.rejects(api.settleMarket('alice-session','fraud','alice','bob',20));
 await api.settleMarket('market-service','settled','alice','bob',20);
 assert.equal(store.state.balances.get('alice').available,30);
 assert.equal(store.state.balances.get('bob').available,20);
 assert.equal(store.state.operations.has('fraud'),false);
});
