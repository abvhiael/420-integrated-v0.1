import test from 'node:test';
import assert from 'node:assert/strict';
import {validateRuntimeConfig} from '../core/runtime-config.js';
import {deriveBootstrapState,BOOTSTRAP_STATES} from '../core/bootstrap.js';
import {createBongGogglesServices} from '../core/services.js';
import {redactTelemetry} from '../core/telemetry.js';

const base={
  environment:'testnet',
  appOrigin:'https://bonggoggles.420integrated.org',
  chainId:420420,
  rpcUrl:'https://rpc.example',
  indexerUrl:'https://indexer.example',
  mediaUrl:'https://media.example',
  messengerUrl:'https://messenger.example',
  notificationsUrl:'https://notifications.example',
  walletUrl:'https://wallet.example',
  explorerUrl:'https://explorer.example',
  maintenance:false,
  features:{profiles:true},
};

test('BG-19.1 validates safe runtime configuration',()=>{
  const config=validateRuntimeConfig(base);
  assert.equal(config.schema,'bg-web-runtime-v1');
  assert.equal(config.authoritative,false);
  assert.equal(config.chainId,420420);
});

test('BG-19.1 production origin is fixed to Bong Goggles host',()=>{
  assert.throws(()=>validateRuntimeConfig({...base,environment:'production',appOrigin:'https://evil.example'}),/production appOrigin/);
});

test('BG-19.1 rejects insecure production service origins',()=>{
  assert.throws(()=>validateRuntimeConfig({...base,environment:'production',rpcUrl:'http://rpc.example'}),/must use https/);
});

test('BG-19.1 bootstrap states are deterministic',()=>{
  const config=validateRuntimeConfig(base);
  assert.equal(deriveBootstrapState({config}).state,BOOTSTRAP_STATES.READY);
  assert.equal(deriveBootstrapState({config,dependencyHealth:{media:false}}).state,BOOTSTRAP_STATES.DEGRADED);
  assert.equal(deriveBootstrapState({config,connectedChainId:1}).state,BOOTSTRAP_STATES.UNSUPPORTED_NETWORK);
  assert.equal(deriveBootstrapState({config:{...config,maintenance:true}}).state,BOOTSTRAP_STATES.MAINTENANCE);
});

test('BG-19.1 creates typed service boundaries without authority',()=>{
  const config=validateRuntimeConfig(base);
  const services=createBongGogglesServices(config,{fetchImpl:async()=>{throw new Error('unused')}});
  assert.equal(services.authoritative,false);
  assert.equal(services.indexer.name,'indexer');
  assert.equal(services.wallet.name,'wallet');
});

test('BG-19.1 telemetry recursively redacts sensitive fields',()=>{
  const out=redactTelemetry({account:'0xabc',authorization:'secret',nested:{sessionKey:'secret',ok:true}});
  assert.equal(out.authorization,'[REDACTED]');
  assert.equal(out.nested.sessionKey,'[REDACTED]');
  assert.equal(out.nested.ok,true);
});
