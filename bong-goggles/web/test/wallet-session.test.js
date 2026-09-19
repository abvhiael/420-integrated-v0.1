import test from 'node:test';
import assert from 'node:assert/strict';
import {
  discover420Wallet,normalizeChainId,buildWalletHandoffUrl,
  sessionPresentation,WalletSessionController420,clearBongGogglesSessionStorage
} from '../core/wallet-session.js';
import {prepareWalletIntent,submitWalletIntent,classifyTransactionReceipt} from '../core/transaction-intent.js';

function providerFixture({accounts=['0x1111111111111111111111111111111111111111'],chainId='0x66a44'}={}){
  const listeners=new Map();
  const requests=[];
  const provider={
    is420Wallet:true,
    async request({method,params=[]}){
      requests.push({method,params});
      if(method==='eth_accounts'||method==='eth_requestAccounts') return accounts;
      if(method==='eth_chainId') return chainId;
      if(method==='wallet_switchEthereumChain'){ chainId=params[0].chainId; return null; }
      if(method==='wallet_revokePermissions') return null;
      if(method==='eth_sendTransaction') return '0x'+'a'.repeat(64);
      throw Object.assign(new Error('unsupported'),{code:4200});
    },
    on(name,fn){listeners.set(name,fn);},
    removeListener(name){listeners.delete(name);}
  };
  return {provider,requests,listeners};
}

test('BG-19.2 discovers only the qualified 420 Wallet provider',()=>{
  const {provider}=providerFixture();
  assert.equal(discover420Wallet({ethereum:provider}),provider);
  assert.equal(discover420Wallet({ethereum:{request(){}}}),null);
});

test('BG-19.2 normalizes network and rejects invalid chain IDs',()=>{
  assert.equal(normalizeChainId(420420),'0x66a44');
  assert.equal(normalizeChainId('0x066A44'),'0x66a44');
  assert.throws(()=>normalizeChainId(0),/valid chain id/);
});

test('BG-19.2 exposes read-only mode until Wallet is connected',()=>{
  const view=sessionPresentation({expectedChainId:420420});
  assert.equal(view.connected,false);
  assert.equal(view.permission,'read-only');
  assert.equal(view.canWrite,false);
});

test('BG-19.2 marks wrong network unsupported and blocks writes',()=>{
  const view=sessionPresentation({
    account:'0x1111111111111111111111111111111111111111',
    chainId:'0x1',expectedChainId:420420,connected:true,permission:'wallet-confirmed'
  });
  assert.equal(view.supportedNetwork,false);
  assert.equal(view.canWrite,false);
});

test('BG-19.2 reacts to accounts and chain lifecycle from Wallet',async()=>{
  const {provider,listeners}=providerFixture();
  const seen=[];
  const controller=new WalletSessionController420({provider,expectedChainId:420420,storage:{removeItem(){}},onChange:v=>seen.push(v)});
  const connected=await controller.connect();
  assert.equal(connected.connected,true);
  assert.equal(connected.canWrite,true);
  listeners.get('chainChanged')?.('0x1');
  assert.equal(seen.at(-1).supportedNetwork,false);
  listeners.get('accountsChanged')?.([]);
  assert.equal(seen.at(-1).connected,false);
  controller.destroy();
});

test('BG-19.2 clears only Bong Goggles session-local material on signout',async()=>{
  const removed=[];
  const {provider}=providerFixture();
  const controller=new WalletSessionController420({provider,expectedChainId:420420,storage:{removeItem:k=>removed.push(k)}});
  await controller.connect();
  const signedOut=await controller.signOut();
  assert.equal(signedOut.connected,false);
  assert.deepEqual(removed.sort(),['bg.wallet.account','bg.wallet.capabilities','bg.wallet.chainId','bg.wallet.session'].sort());
});

test('BG-19.2 builds secure Wallet passkey/session handoffs',()=>{
  const url=new URL(buildWalletHandoffUrl('https://wallet.420integrated.org',{action:'passkeys',returnUrl:'https://bonggoggles.420integrated.org/settings'}));
  assert.equal(url.pathname,'/apps/bong-goggles');
  assert.equal(url.searchParams.get('action'),'passkeys');
  assert.match(url.searchParams.get('return'),/^https:\/\/bonggoggles\.420integrated\.org/);
});

test('BG-19.2 prepares reviewable non-authoritative transaction intents',()=>{
  const intent=prepareWalletIntent({
    method:'eth_sendTransaction',
    account:'0x1111111111111111111111111111111111111111',
    chainId:'0x66a44',
    target:'0x2222222222222222222222222222222222222222',
    value:'0x0',
    data:'0x1234',
    summary:'Publish canonical social object',
    canonicalAction:'SocialObjectRegistry420.publish'
  });
  assert.equal(intent.requiresWalletApproval,true);
  assert.equal(intent.locallyFinal,false);
  assert.equal(intent.authoritative,false);
});

test('BG-19.2 rejected Wallet transactions never become local success',async()=>{
  const intent=prepareWalletIntent({
    method:'eth_sendTransaction',
    account:'0x1111111111111111111111111111111111111111',
    chainId:'0x66a44',
    target:'0x2222222222222222222222222222222222222222',
    data:'0x',
    summary:'Test',
    canonicalAction:'test'
  });
  const result=await submitWalletIntent({request:async()=>{throw Object.assign(new Error('no'),{code:4001});}},intent);
  assert.equal(result.status,'rejected');
  assert.equal(result.authoritative,false);
});

test('BG-19.2 receipt classification distinguishes canonical confirm/revert/pending',()=>{
  assert.equal(classifyTransactionReceipt(null).status,'pending');
  assert.equal(classifyTransactionReceipt({status:'0x1',transactionHash:'0xabc'}).status,'confirmed');
  assert.equal(classifyTransactionReceipt({status:'0x0',transactionHash:'0xdef'}).status,'reverted');
});

test('BG-19.2 storage clearing tolerates unavailable browser storage',()=>{
  assert.doesNotThrow(()=>clearBongGogglesSessionStorage(null));
});
