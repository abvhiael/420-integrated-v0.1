import test from 'node:test';
import assert from 'node:assert/strict';
import { WalletController, WalletSession, buildSigningRequest, normalizeAccount, normalizeChainId, signingGate, validateNetwork } from '../core/wallet-session.js';

test('chain and account normalization are strict',()=>{
  assert.equal(normalizeChainId('0x01'),'0x1');
  assert.equal(normalizeChainId(420),'0x1a4');
  assert.equal(normalizeAccount('0xABCDEFabcdefABCDEFabcdefABCDEFabcdefABCD'),'0xabcdefabcdefabcdefabcdefabcdefabcdefabcd');
  assert.throws(()=>normalizeAccount('0x123'));
});

test('connect uses explicit eth_requestAccounts and chain read',async()=>{
  const calls=[];
  const provider={request:async(req)=>{calls.push(req.method); return req.method==='eth_requestAccounts'?['0xabcdefabcdefabcdefabcdefabcdefabcdefabcd']:'0x1a4';}};
  const c=new WalletController(provider,{expectedChainId:'0x1a4'});
  await c.connect();
  assert.deepEqual(calls,['eth_requestAccounts','eth_chainId']);
  assert.equal(c.session.status,'CONNECTED');
});

test('wrong chain is explicit and switch uses wallet_switchEthereumChain',async()=>{
  const calls=[];
  const provider={request:async(req)=>{calls.push(req); if(req.method==='eth_requestAccounts') return ['0xabcdefabcdefabcdefabcdefabcdefabcdefabcd']; if(req.method==='eth_chainId') return '0x1'; return null;}};
  const c=new WalletController(provider,{expectedChainId:'0x1a4'});
  await c.connect();
  assert.equal(c.session.status,'WRONG_CHAIN');
  await c.switchChain();
  assert.equal(calls.at(-1).method,'wallet_switchEthereumChain');
  assert.equal(c.session.status,'CONNECTED');
});

test('account or chain changes invalidate prior reviewed intent generation',()=>{
  const s=new WalletSession();
  s.connected({account:'0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',chainId:'0x1a4'});
  const generation=s.generation;
  assert.equal(signingGate({session:s,expectedChainId:'0x1a4',intent:{x:1},intentGeneration:generation}).ok,true);
  s.accountChanged('0x1111111111111111111111111111111111111111');
  assert.equal(signingGate({session:s,expectedChainId:'0x1a4',intent:{x:1},intentGeneration:generation}).reason,'stale-draft');
});

test('unconfigured chain fails closed',()=>{
  const s=new WalletSession();
  s.connected({account:'0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',chainId:'0x1a4'});
  assert.equal(validateNetwork(s,null).reason,'chain-unconfigured');
});

test('signing request is review-bound and explicit',()=>{
  const s=new WalletSession();
  s.connected({account:'0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',chainId:'0x1a4'});
  const request=buildSigningRequest({session:s,expectedChainId:'0x1a4',intent:{route:'r1'},intentGeneration:s.generation,kind:'SWAP'});
  assert.equal(request.account,s.account);
  assert.equal(request.kind,'SWAP');
  assert.throws(()=>buildSigningRequest({session:s,expectedChainId:'0x1a4',intent:null,intentGeneration:s.generation,kind:'SWAP'}));
});
