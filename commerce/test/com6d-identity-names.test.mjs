import test from 'node:test';
import assert from 'node:assert/strict';
import {Interface,keccak256} from 'ethers';
import {validateDisplayBindings,optionalMerchantDisplay} from '../src/identity-names.mjs';
import {setup,checkout,seller,attacker,b32} from './fixtures.mjs';
const address=n=>'0x'+n.toString(16).padStart(40,'0'),zero=b32(0),hash=keccak256('0x6000');
function fixture(){
 const identity={address:address(90),codeHash:hash,verified:true,manifestApproved:true,version:3};
 const names={address:address(91),codeHash:hash,verified:true,manifestApproved:true,version:3};
 const config={identity,names,chainId:'420',credentialType:b32(404)};
 const profileId=b32(12),labelHash=b32(13),controller=seller.address.toLowerCase();
 let valid=true,hasCredential=true,expiry=2500,reverse=labelHash,wrongCode=false;
 const abis={
  profile:new Interface(['function profiles(bytes32) view returns(address,address,bytes32,bytes32,uint64,uint64,bool)','function hasValidCredential(bytes32,bytes32) view returns(bool)','function protocolVersion() view returns(uint32)']),
  names:new Interface(['function reverseResolve(address) view returns(bytes32)','function resolve(bytes32) view returns(tuple(address owner,address pendingOwner,address resolvedAddress,bytes32 profileId,bytes32 serviceId,uint64 expiresAt,uint8 labelLength))','function nameClaimsProfile(bytes32,bytes32) view returns(bool)','function protocolVersion() view returns(uint32)'])
 };
 const send=async(method,params)=>{
  if(method==='eth_getCode')return wrongCode?'0x6001':'0x6000';
  const {to,data}=params[0],abi=to===identity.address?abis.profile:abis.names;
  for(const fragment of abi.fragments){
   if(fragment.type==='function'&&data.startsWith(fragment.selector)){
    const name=fragment.name;
    let output;
    if(name==='protocolVersion')output=[3];
    else if(name==='profiles')output=[controller,address(0),b32(1),labelHash,1,2,valid];
    else if(name==='hasValidCredential')output=[hasCredential];
    else if(name==='reverseResolve')output=[reverse];
    else if(name==='resolve')output=[[controller,address(0),controller,profileId,zero,expiry,8]];
    else if(name==='nameClaimsProfile')output=[valid];
    return abi.encodeFunctionResult(name,output);
   }
  }
  throw Error('unexpected RPC');
 };
 return {config,send,profileId,controller,setActive:v=>valid=v,setCredential:v=>hasCredential=v,setExpiry:v=>expiry=v,setReverse:v=>reverse=v,setCode:v=>wrongCode=v};
}
const ctx=f=>({send:f.send,tag:{blockHash:b32(321),requireCanonical:true},deadline:1000,now:()=>10,blockTimestamp:1000});
test('COM-6D canonical Identity and Names display is controller-bound, current, version pinned and non-authoritative',async()=>{
 const f=fixture();
 const result=await optionalMerchantDisplay(f.config,ctx(f),{profileId:f.profileId,controller:f.controller});
 assert.equal(result.identity.status,'CREDENTIAL_VALID');assert.equal(result.identity.authorizesPayout,false);
 assert.equal(result.names.status,'FORWARD_REVERSE_PROFILE_MATCH');assert.equal(result.names.authorizesMerchantActions,false);
 f.setCredential(false);assert.equal((await optionalMerchantDisplay(f.config,ctx(f),{profileId:f.profileId,controller:f.controller})).identity.status,'PROFILE_CONTROLLER_MATCH');
 f.setActive(false);assert.equal((await optionalMerchantDisplay(f.config,ctx(f),{profileId:f.profileId,controller:f.controller})).names.status,'NOT_VERIFIED');
 f.setActive(true);f.setExpiry(999);assert.equal((await optionalMerchantDisplay(f.config,ctx(f),{profileId:f.profileId,controller:f.controller})).names.status,'NOT_VERIFIED');
 f.setExpiry(2500);f.setReverse(zero);assert.equal((await optionalMerchantDisplay(f.config,ctx(f),{profileId:f.profileId,controller:f.controller})).names.status,'NOT_VERIFIED');
 f.setCode(true);await assert.rejects(()=>optionalMerchantDisplay(f.config,ctx(f),{profileId:f.profileId,controller:f.controller}),e=>e.code==='display_code_mismatch');
});
test('COM-6D missing or unapproved optional bindings do not invent verified credentials',async()=>{
 const f=fixture();
 const missing=await optionalMerchantDisplay(null,ctx(f),{profileId:f.profileId,controller:f.controller});
 assert.equal(missing.identity.status,'NOT_VERIFIED');
 const other=structuredClone(f.config);other.identity.verified=false;
 assert.throws(()=>validateDisplayBindings(other,'420'));
 const alias=structuredClone(f.config);alias.names.address=alias.identity.address;
 assert.throws(()=>validateDisplayBindings(alias,'420'));
});
test('COM-6D merchant integration preserves mandatory Pay controller authority',async t=>{
 const f=setup();t.after(()=>f.close());const {store}=await checkout(f);
 const original=await f.service.merchantIntegrations(seller.address,store.store_id);
 assert.equal(original.identity.status,'NOT_VERIFIED');assert.equal(original.names.status,'NOT_VERIFIED');
 f.source.merchantDisplay=async()=>({identity:{status:'CREDENTIAL_VALID',authorizesPayout:false},names:{status:'FORWARD_REVERSE_PROFILE_MATCH',authorizesMerchantActions:false}});
 const display=await f.service.merchantIntegrations(seller.address,store.store_id);
 assert.equal(display.identity.status,'CREDENTIAL_VALID');
 await assert.rejects(()=>f.service.merchantIntegrations(attacker.address,store.store_id),e=>e.code==='forbidden');
});
