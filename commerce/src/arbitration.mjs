import {Interface,keccak256,toUtf8Bytes} from 'ethers';
import {requireThat,wallet,bytes32} from './security.mjs';

// The approved Registry service is the sole arbitration discovery authority.
// No Commerce-owned case IDs, policy, resolver, ruling or remedy authority.
export const ARBITRATION_SERVICE_ID=keccak256(toUtf8Bytes('420/service/arbitration/v1'));
export const MARKET_ARBITRATION_DOMAIN=keccak256(toUtf8Bytes('420/arbitration/domain/market/v1'));
export const MARKET_ORIGIN_COMPONENT=keccak256(toUtf8Bytes('420/component/market/v1'));
export const CASE_STATES=['NONE','OPEN','RULED','FINALIZED'];
const registryABI=['function getService(bytes32) view returns(tuple(address implementation,bytes32 codeHash,bytes32 metadataHash,uint32 version,uint64 publishedAt,bool active))','function getRegistrationProfile(bytes32,uint32) view returns(tuple(uint8 componentType,bytes32 manifestHash,bytes32 dependencyRoot,bytes32 interfaceHash))'];
const linkABIs={
 router:['function policies() view returns(address)','function cases() view returns(address)','function rulings() view returns(address)','function protocolVersion() view returns(uint32)','function getPolicy(bytes32) view returns(tuple(address resolver,address appealResolver,uint64 evidenceWindow,uint64 appealWindow,uint8 maxAppeals,bool active,bool exists))'],
 policies:['function protocolVersion() view returns(uint32)','function getPolicy(bytes32) view returns(tuple(address resolver,address appealResolver,uint64 evidenceWindow,uint64 appealWindow,uint8 maxAppeals,bool active,bool exists))'],
 cases:['function protocolVersion() view returns(uint32)','function policies() view returns(address)','function rulingRegistry() view returns(address)','function getCase(bytes32) view returns(tuple(address claimant,address respondent,bytes32 domainId,bytes32 originComponentId,bytes32 originObjectId,bytes32 claimHash,bytes32 requestedRemedyHash,address resolver,address appealResolver,uint64 evidenceWindow,uint64 appealWindow,uint64 openedAt,uint64 evidenceDeadline,uint64 appealDeadline,uint8 maxAppeals,uint8 round,uint8 state,bool exists))'],
 rulings:['function protocolVersion() view returns(uint32)','function cases() view returns(address)','function getRuling(bytes32,uint8) view returns(tuple(uint32 outcomeCode,bytes32 rulingHash,bytes32 remedyCommitment,bytes32 panelCommitment,address resolver,uint64 ruledAt,bool exists))']
};
const normalize=x=>Object.fromEntries(Object.keys(x.toObject()).map(k=>[k,typeof x[k]==='bigint'?x[k].toString():x[k]]));

export function validateArbitrationBinding(binding,chainId) {
 requireThat(binding&&binding.serviceId==='420/service/arbitration/v1'&&String(binding.chainId)===String(chainId),'arbitration_service_mismatch',503);
 requireThat(Number.isInteger(binding.version)&&binding.version>0&&binding.version<=0xffffffff,'arbitration_version_missing',503);
 for(const name of ['router','policies','cases','rulings']){
   const item=name==='router'?binding.router:binding.dependencies?.[name];
   requireThat(item&&item.verified===true,'arbitration_binding_missing',503);
   wallet(item.address);bytes32(item.codeHash);
 }
 requireThat(new Set([binding.router.address,...Object.values(binding.dependencies).map(x=>x.address)].map(x=>wallet(x))).size===4,'arbitration_binding_alias',503);
 bytes32(binding.manifestHash);bytes32(binding.interfaceHash);bytes32(binding.dependencyRoot);
 return binding;
}

export async function finalizedArbitrationBinding(config,{send,tag,deadline,now}) {
 if(!config.arbitration)return null;
 const b=validateArbitrationBinding(config.arbitration,config.chainId);
 const query=async(address,abi,method,args=[])=>{
   requireThat(now()<deadline,'arbitration_deadline',503);
   const iface=new Interface(abi),out=await send('eth_call',[{to:address,data:iface.encodeFunctionData(method,args)},tag]);
   return iface.decodeFunctionResult(method,out);
 };
 const code=async item=>{
   const bytes=await send('eth_getCode',[item.address,tag]);
   requireThat(bytes!=='0x'&&keccak256(bytes)===item.codeHash,'arbitration_code_mismatch',503);
 };
 const entry=(await query(config.registry.address,registryABI,'getService',[ARBITRATION_SERVICE_ID]))[0];
 requireThat(entry.active&&Number(entry.version)===b.version&&wallet(entry.implementation)===wallet(b.router.address)&&entry.codeHash===b.router.codeHash,'arbitration_service_unapproved',503);
 const profile=(await query(config.registry.address,registryABI,'getRegistrationProfile',[ARBITRATION_SERVICE_ID,b.version]))[0];
 requireThat(profile.manifestHash===b.manifestHash&&profile.interfaceHash===b.interfaceHash&&profile.dependencyRoot===b.dependencyRoot,'arbitration_profile_mismatch',503);
 for(const name of ['router','policies','cases','rulings'])await code(name==='router'?b.router:b.dependencies[name]);
 const addr={router:b.router.address,...Object.fromEntries(['policies','cases','rulings'].map(name=>[name,b.dependencies[name].address]))};
 for(const name of ['router','policies','cases','rulings']){
  const version=(await query(addr[name],linkABIs[name],'protocolVersion'))[0];
  requireThat(Number(version)===1,'arbitration_contract_version',503);
 }
 for(const [owner,getter,target] of [['router','policies','policies'],['router','cases','cases'],['router','rulings','rulings'],['cases','policies','policies'],['cases','rulingRegistry','rulings'],['rulings','cases','cases']]){
  requireThat(wallet((await query(addr[owner],linkABIs[owner],getter))[0])===wallet(addr[target]),'arbitration_graph_mismatch',503);
 }
 return {
  router:addr.router,casesAddress:addr.cases,domainId:MARKET_ARBITRATION_DOMAIN,componentId:MARKET_ORIGIN_COMPONENT,
  policy:async()=>normalize((await query(addr.router,linkABIs.router,'getPolicy',[MARKET_ARBITRATION_DOMAIN]))[0]),
  getCase:async caseId=>normalize((await query(addr.cases,linkABIs.cases,'getCase',[bytes32(caseId)]))[0]),
  getRuling:async (caseId,round)=>normalize((await query(addr.rulings,linkABIs.rulings,'getRuling',[bytes32(caseId),Number(round)]))[0]),
  intent:(method,args)=>{
   requireThat(['openCase','submitEvidence','appeal'].includes(method),'unsupported_arbitration_action');
   return {chainId:config.chainId,target:addr.cases,contract:'ArbitrationCaseRegistry420',method,args,requiresWalletAuthorization:true,canonicalAuthority:false};
  }
 };
}
