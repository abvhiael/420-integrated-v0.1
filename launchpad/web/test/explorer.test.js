import test from 'node:test';
import assert from 'node:assert/strict';
import {explorerTransactionLink420} from '../core/explorer.js';
const hash='0x'+'AB'.repeat(32);
const config={network:{chainId:'0x1a4',explorerUrl:'https://explorer.420integrated.org/'}};
const wallet={account:'0x000000000000000000000000000000000000a11c',chainId:'0x1a4'};
test('420Explorer is a configured read-only exact-network raw transaction handoff',()=>{
  assert.equal(explorerTransactionLink420({config,wallet,txHash:hash}),
    'https://explorer.420integrated.org/#/transactions/'+hash.toLowerCase());
  assert.throws(()=>explorerTransactionLink420({config,wallet:{...wallet,chainId:'0x1'},txHash:hash}),/network or hash/);
  assert.throws(()=>explorerTransactionLink420({config,wallet,txHash:'0xdeadbeef'}),/network or hash/);
});
test('unconfigured or malicious Explorer destinations fail closed without fallback',()=>{
  for(const base of [null,'http://explorer.420integrated.org/','https://evil.invalid/checkout',
    'https://explorer.420integrated.org/?redirect=evil','https://user:pw@explorer.420integrated.org/',
    'https://explorer.420integrated.org/#/transactions/0xdead']){
    assert.throws(()=>explorerTransactionLink420({config:{network:{chainId:'0x1a4',explorerUrl:base}},wallet,txHash:hash}));
  }
});
