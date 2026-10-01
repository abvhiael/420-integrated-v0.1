import test from 'node:test';
import assert from 'node:assert/strict';
import { ZERO_ADDRESS, ZERO_BYTES32 } from '../core/abi.js';
import { createIdentity420Client, IDENTITY420_VERSION, IDENTITY420_TRUST_CLASSES } from '../core/identity-management.js';

const identity='0x0000000000000000000000000000000000000436';
const names='0x0000000000000000000000000000000000000435';
const account='0x1111111111111111111111111111111111111111';
const next='0x2222222222222222222222222222222222222222';
const profileId='0x'+'11'.repeat(32);
const metadata='0x'+'22'.repeat(32);
const label='0x'+'33'.repeat(32);
const issuerId='0x'+'44'.repeat(32);
const credentialId='0x'+'55'.repeat(32);
const credentialType='0x'+'66'.repeat(32);
const claimHash='0x'+'77'.repeat(32);
const txHash='0x'+'88'.repeat(32);

const word=(hex)=>hex.replace(/^0x/,'').padStart(64,'0');
const uintWord=(n)=>BigInt(n).toString(16).padStart(64,'0');
const addressWord=(a)=>word(a);
const bytes32Word=(b)=>b.slice(2);
const result=(...words)=>'0x'+words.join('');
const abiString=(text)=>{
  const data=Buffer.from(text,'utf8').toString('hex');
  const padded=data.padEnd(Math.ceil(data.length/64)*64,'0');
  return result(uintWord(32),uintWord(data.length/2),padded);
};

function profileResult({controller=account,pending=ZERO_ADDRESS,metadataHash=metadata,primaryName=ZERO_BYTES32,createdAt=10,updatedAt=11,active=true}={}){
  return result(addressWord(controller),addressWord(pending),bytes32Word(metadataHash),bytes32Word(primaryName),uintWord(createdAt),uintWord(updatedAt),uintWord(active?1:0));
}
function issuerResult({controller=next,metadataHash=metadata,trustClass=2,active=true}={}){
  return result(addressWord(controller),bytes32Word(metadataHash),uintWord(trustClass),uintWord(active?1:0));
}
function credentialResult({issuer=issuerId,subject=profileId,type=credentialType,claim=claimHash,issuedAt=12,expiresAt=0,revokedAt=0,rejected=false}={}){
  return result(bytes32Word(issuer),bytes32Word(subject),bytes32Word(type),bytes32Word(claim),uintWord(issuedAt),uintWord(expiresAt),uintWord(revokedAt),uintWord(rejected?1:0));
}

class FakeProvider {
  constructor(){
    this.calls=[];
    this.profile=profileResult({controller:ZERO_ADDRESS,active:false});
    this.issuer=issuerResult();
    this.credential=credentialResult();
    this.valid=true;
    this.namesClaim=true;
    this.chainId='0x1a4';
    this.accounts=[account];
    this.code='0x6001';
    this.receipt={status:'0x1',blockNumber:'0x10'};
  }
  async request(method,params=[]){
    this.calls.push({method,params});
    if(method==='eth_chainId') return this.chainId;
    if(method==='eth_accounts') return this.accounts;
    if(method==='eth_getCode') return this.code;
    if(method==='eth_getTransactionReceipt') return this.receipt;
    if(method==='eth_estimateGas') return '0x5208';
    if(method==='eth_sendTransaction') return txHash;
    if(method==='eth_call'){
      const [{to,data}]=params;
      const sel=data.slice(0,10);
      if(to===identity){
        if(sel==='0x'+selector('systemName()')) return abiString('Identity420');
        if(sel==='0x'+selector('protocolVersion()')) return result(uintWord(IDENTITY420_VERSION));
        if(sel==='0x'+selector('profiles(bytes32)')) return this.profile;
        if(sel==='0x'+selector('issuers(bytes32)')) return this.issuer;
        if(sel==='0x'+selector('credentials(bytes32)')) return this.credential;
        if(sel==='0x'+selector('credentialValid(bytes32)')) return result(uintWord(this.valid?1:0));
        return '0x';
      }
      if(to===names && sel==='0x'+selector('nameClaimsProfile(bytes32,bytes32)')) return result(uintWord(this.namesClaim?1:0));
      throw new Error('unexpected eth_call');
    }
    throw new Error('unexpected '+method);
  }
}

import { keccak256Hex } from '../core/keccak.js';
const selector=(signature)=>keccak256Hex(new TextEncoder().encode(signature)).slice(2,10);

test('Identity client verifies chain, deployed code, contract identity and protocol version', async()=>{
  const p=new FakeProvider();
  const client=createIdentity420Client({provider:p,identityAddress:identity,namesAddress:names,chainId:'0x1a4',account});
  const verified=await client.verifySession();
  assert.equal(verified.systemName,'Identity420');
  assert.equal(verified.version,3n);
  assert.equal(p.calls.filter((c)=>c.method==='eth_getCode').length,2);
});

test('Identity preflight fails closed on wrong chain, missing code, wrong identity and account drift', async()=>{
  const p=new FakeProvider();
  let client=createIdentity420Client({provider:p,identityAddress:identity,namesAddress:names,chainId:'0x1a4',account});
  p.chainId='0x1'; await assert.rejects(client.verifySession(),/Wrong network/);
  p.chainId='0x1a4'; p.code='0x'; await assert.rejects(client.verifySession(),/no deployed code/);
  p.code='0x6001'; p.accounts=[next]; await assert.rejects(client.verifySession(),/no longer authorized/);
});

test('profile and issuer/credential reads decode exact contract state and trust source', async()=>{
  const p=new FakeProvider();
  p.profile=profileResult({controller:account,pending:next,primaryName:label,active:true});
  const client=createIdentity420Client({provider:p,identityAddress:identity,namesAddress:names,chainId:'0x1a4',account});
  const profile=await client.profile(profileId);
  assert.equal(profile.controller,account);
  assert.equal(profile.pendingController,next);
  assert.equal(profile.primaryName,label);
  assert.equal(profile.active,true);
  const credential=await client.credential(credentialId);
  assert.equal(credential.valid,true);
  assert.equal(credential.issuer.trustLabel,'VERIFIED');
  assert.deepEqual(IDENTITY420_TRUST_CLASSES,['NONE','COMMUNITY','VERIFIED','INSTITUTIONAL','SYSTEM']);
});

test('bilateral primary-name status requires both Names and Identity agreement', async()=>{
  const p=new FakeProvider();
  p.profile=profileResult({primaryName:label});
  const client=createIdentity420Client({provider:p,identityAddress:identity,namesAddress:names,chainId:'0x1a4',account});
  let check=await client.bilateralPrimaryName(profileId,label);
  assert.equal(check.bilateral,true);
  p.namesClaim=false;
  check=await client.bilateralPrimaryName(profileId,label);
  assert.equal(check.identityClaims,true);
  assert.equal(check.namesClaims,false);
  assert.equal(check.bilateral,false);
});

test('setting a primary name fails closed unless Names420 already claims the profile', async()=>{
  const p=new FakeProvider();
  p.profile=profileResult({controller:account,primaryName:ZERO_BYTES32});
  p.namesClaim=false;
  const client=createIdentity420Client({provider:p,identityAddress:identity,namesAddress:names,chainId:'0x1a4',account});
  await assert.rejects(client.setPrimaryName({profileId,labelHash:label}),/Names420 does not currently claim this profile/);
  assert.equal(p.calls.some((c)=>c.method==='eth_sendTransaction'),false);
});

test('guarded profile writes simulate, estimate, revalidate and require wallet send', async()=>{
  const p=new FakeProvider();
  const client=createIdentity420Client({provider:p,identityAddress:identity,namesAddress:names,chainId:'0x1a4',account});
  const submitted=await client.createProfile({profileId,metadataHash:metadata});
  assert.equal(submitted.txHash,txHash);
  const methods=p.calls.map((c)=>c.method);
  assert.ok(methods.includes('eth_call'));
  assert.ok(methods.includes('eth_estimateGas'));
  assert.ok(methods.includes('eth_sendTransaction'));
  assert.ok(methods.filter((x)=>x==='eth_chainId').length>=2);
});

test('update and controller nomination fail closed for non-controller', async()=>{
  const p=new FakeProvider();
  p.profile=profileResult({controller:next});
  const client=createIdentity420Client({provider:p,identityAddress:identity,namesAddress:names,chainId:'0x1a4',account});
  await assert.rejects(client.updateProfile({profileId,metadataHash:metadata,active:false}),/not profile controller/);
  await assert.rejects(client.transferController({profileId,newController:next}),/not profile controller/);
});

test('controller acceptance requires current pending nomination', async()=>{
  const p=new FakeProvider();
  p.profile=profileResult({controller:next,pending:ZERO_ADDRESS});
  const client=createIdentity420Client({provider:p,identityAddress:identity,namesAddress:names,chainId:'0x1a4',account});
  await assert.rejects(client.acceptController({profileId}),/not pending controller/);
});

test('credential rejection is subject-controller scoped and duplicate rejection is blocked', async()=>{
  const p=new FakeProvider();
  p.profile=profileResult({controller:next});
  const client=createIdentity420Client({provider:p,identityAddress:identity,namesAddress:names,chainId:'0x1a4',account});
  await assert.rejects(client.rejectCredential({credentialId}),/not credential subject/);

  p.profile=profileResult({controller:account});
  p.credential=credentialResult({rejected:true});
  await assert.rejects(client.rejectCredential({credentialId}),/already rejected/);
});

test('unlinking primary name does not require a Names420 claim', async()=>{
  const p=new FakeProvider();
  p.profile=profileResult({controller:account,primaryName:label});
  p.namesClaim=false;
  const client=createIdentity420Client({provider:p,identityAddress:identity,namesAddress:names,chainId:'0x1a4',account});
  const submitted=await client.setPrimaryName({profileId,labelHash:ZERO_BYTES32});
  assert.equal(submitted.txHash,txHash);
});
