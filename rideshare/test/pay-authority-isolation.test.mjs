import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync} from 'node:crypto';
import {createPayAuthority} from '../src/pay-authority.mjs';

const addr=n=>'0x'+n.toString(16).padStart(40,'0');
const methods=['prepare','wallet','event','operation','meter','rules','funding','beneficiary'];
const pem=()=>generateKeyPairSync('rsa',{modulusLength:2048,publicKeyEncoding:{type:'spki',format:'pem'},privateKeyEncoding:{type:'pkcs8',format:'pem'}}).publicKey;
const payConfig={chainId:420,merchant:addr(5),asset:addr(6),payRouter:addr(7),paymentRegistry:addr(8),refundManager:addr(9),settlementRouter:addr(10),developmentVault:addr(11),platformController:addr(12),passThroughController:addr(13),disbursementRegistry:addr(14)};

test('PT-03 rejects wallet-consent signer reuse by any financial projection authority',()=>{
 const walletKey=pem(),financialKey=pem();
 const authorities=Object.fromEntries(methods.map(method=>[method,{issuer:'issuer_'+method,audience:'liftd-api',keys:{key1:method==='wallet'||method==='beneficiary'?walletKey:financialKey}}]));
 const resolvers=Object.fromEntries(methods.map(method=>[method,async()=>{throw Error('unused in configuration validation')}]));
 const make=()=>createPayAuthority({config:payConfig,authorities,resolvers,clock:()=>100});
 assert.ok(make());
 for(const method of ['prepare','event','operation','meter','rules','funding']){
  const original=authorities[method];
  authorities[method]={...original,keys:{key1:walletKey}};
  assert.throws(make,{code:'SEPARATE_WALLET_AUTHORITY_REQUIRED'},method);
  authorities[method]=original;
 }
 // Owner-defined wallet/beneficiary authority sharing remains permitted.
 assert.ok(make());
});
