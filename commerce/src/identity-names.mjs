import {Interface,keccak256} from 'ethers';
import {requireThat,bytes32,wallet} from './security.mjs';
const zero='0x'+'0'.repeat(64);
const profileABI=['function profiles(bytes32) view returns(address controller,address pendingController,bytes32 metadataHash,bytes32 primaryName,uint64 createdAt,uint64 updatedAt,bool active)','function hasValidCredential(bytes32,bytes32) view returns(bool)','function protocolVersion() view returns(uint32)'];
const nameABI=['function reverseResolve(address) view returns(bytes32)','function resolve(bytes32) view returns(tuple(address owner,address pendingOwner,address resolvedAddress,bytes32 profileId,bytes32 serviceId,uint64 expiresAt,uint8 labelLength))','function nameClaimsProfile(bytes32,bytes32) view returns(bool)','function protocolVersion() view returns(uint32)'];
export function validateDisplayBindings(config,chainId){
 if(!config)return null;
 requireThat(String(config.chainId)===String(chainId),'display_chain_mismatch',503);
 for(const key of ['identity','names']){
  const x=config[key];requireThat(x&&x.verified===true&&x.manifestApproved===true,'display_manifest_unapproved',503);
  wallet(x.address);bytes32(x.codeHash);
  requireThat(x.codeHash!==zero&&Number(x.version)===3,'display_version_unapproved',503);
 }
 if(config.credentialType){bytes32(config.credentialType);requireThat(config.credentialType!==zero,'display_credential_type_invalid',503);}
 requireThat(wallet(config.identity.address)!==wallet(config.names.address),'display_contract_alias',503);
 return config;
}
export async function optionalMerchantDisplay(config,{send,tag,deadline,now,blockTimestamp},merchant){
 if(!config)return {identity:{status:'NOT_VERIFIED',authority:'420Identity/420Verify'},names:{status:'NOT_VERIFIED',authority:'420Names'}};
 validateDisplayBindings(config,config.chainId);
 const call=async(binding,abi,fn,args=[])=>{
  requireThat(now()<deadline,'display_deadline',503);
  const iface=new Interface(abi);
  const raw=await send('eth_call',[{to:binding.address,data:iface.encodeFunctionData(fn,args)},tag]);
  return iface.decodeFunctionResult(fn,raw);
 };
 for(const [binding,abi] of [[config.identity,profileABI],[config.names,nameABI]]){
  const code=await send('eth_getCode',[binding.address,tag]);
  requireThat(code!=='0x'&&keccak256(code)===binding.codeHash,'display_code_mismatch',503);
  requireThat(Number((await call(binding,abi,'protocolVersion'))[0])===3,'display_version_mismatch',503);
 }
 const profileId=bytes32(merchant.profileId),controller=wallet(merchant.controller);
 const profile= (await call(config.identity,profileABI,'profiles',[profileId]));
 const identityValid=profileId!==zero&&profile[6]===true&&wallet(profile[0])===controller;
 const verifiedCredential=identityValid&&!!config.credentialType&&(await call(config.identity,profileABI,'hasValidCredential',[profileId,config.credentialType]))[0]===true;
 const identity={status:verifiedCredential?'CREDENTIAL_VALID':identityValid?'PROFILE_CONTROLLER_MATCH':'NOT_VERIFIED',authority:'420Identity',profileId:identityValid?profileId:null,credentialType:verifiedCredential?config.credentialType:null,authorizesMerchantActions:false,authorizesPayout:false};
 const labelHash=(await call(config.names,nameABI,'reverseResolve',[controller]))[0];
 let names={status:'NOT_VERIFIED',authority:'420Names',authorizesMerchantActions:false};
 if(labelHash!==zero){
  const r=(await call(config.names,nameABI,'resolve',[labelHash]))[0];
  const valid=wallet(r.resolvedAddress)===controller&&BigInt(r.expiresAt)>BigInt(blockTimestamp)&&
    identityValid&&r.profileId===profileId&&
    (await call(config.names,nameABI,'nameClaimsProfile',[labelHash,profileId]))[0]===true;
  if(valid)names={status:'FORWARD_REVERSE_PROFILE_MATCH',authority:'420Names',labelHash,profileId,authorizesMerchantActions:false};
 }
 return {identity,names};
}
