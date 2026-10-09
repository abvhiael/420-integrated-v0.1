import test from 'node:test';
import assert from 'node:assert/strict';
import {Interface,keccak256} from 'ethers';
import {finalizedArbitrationBinding,validateArbitrationBinding,MARKET_ARBITRATION_DOMAIN,MARKET_ORIGIN_COMPONENT} from '../src/arbitration.mjs';
const b32=n=>'0x'+n.toString(16).padStart(64,'0'),address=n=>'0x'+n.toString(16).padStart(40,'0');
function fixture(){
 const ids={registry:address(1),router:address(21),policies:address(22),cases:address(23),rulings:address(24)};
 const codeHash=keccak256('0x6000');
 const binding={serviceId:'420/service/arbitration/v1',chainId:'420',version:1,router:{address:ids.router,codeHash,verified:true},dependencies:Object.fromEntries(['policies','cases','rulings'].map(n=>[n,{address:ids[n],codeHash,verified:true}])),manifestHash:b32(10),interfaceHash:b32(11),dependencyRoot:b32(12)};
 const config={chainId:'420',registry:{address:ids.registry},arbitration:binding};
 const serviceABI=new Interface(['function getService(bytes32) view returns(tuple(address implementation,bytes32 codeHash,bytes32 metadataHash,uint32 version,uint64 publishedAt,bool active))','function getRegistrationProfile(bytes32,uint32) view returns(tuple(uint8 componentType,bytes32 manifestHash,bytes32 dependencyRoot,bytes32 interfaceHash))']);
 const policyABI=new Interface(['function getPolicy(bytes32) view returns(tuple(address resolver,address appealResolver,uint64 evidenceWindow,uint64 appealWindow,uint8 maxAppeals,bool active,bool exists))']);
 const caseABI=new Interface(['function getCase(bytes32) view returns(tuple(address claimant,address respondent,bytes32 domainId,bytes32 originComponentId,bytes32 originObjectId,bytes32 claimHash,bytes32 requestedRemedyHash,address resolver,address appealResolver,uint64 evidenceWindow,uint64 appealWindow,uint64 openedAt,uint64 evidenceDeadline,uint64 appealDeadline,uint8 maxAppeals,uint8 round,uint8 state,bool exists))']);
 const rulingABI=new Interface(['function getRuling(bytes32,uint8) view returns(tuple(uint32 outcomeCode,bytes32 rulingHash,bytes32 remedyCommitment,bytes32 panelCommitment,address resolver,uint64 ruledAt,bool exists))']);
 const links=[['router','policies','policies'],['router','cases','cases'],['router','rulings','rulings'],['cases','policies','policies'],['cases','rulingRegistry','rulings'],['rulings','cases','cases']];
 let active=true,wrongGraph=false,wrongCode=false;
 const send=async(method,params)=>{
  assert.equal(params.at(-1).blockHash,b32(901));
  if(method==='eth_getCode')return wrongCode?'0x6001':'0x6000';
  if(method!=='eth_call')throw Error('Unexpected method '+method);
  const to=params[0].to.toLowerCase(),data=params[0].data;
  if(to===ids.registry){
   if(data.startsWith(serviceABI.getFunction('getService').selector))return serviceABI.encodeFunctionResult('getService',[[ids.router,codeHash,b32(1),1,0,active]]);
   if(data.startsWith(serviceABI.getFunction('getRegistrationProfile').selector))return serviceABI.encodeFunctionResult('getRegistrationProfile',[[1,binding.manifestHash,binding.dependencyRoot,binding.interfaceHash]]);
  }
  const versionABI=new Interface(['function protocolVersion() view returns(uint32)']);
  if(data.startsWith(versionABI.getFunction('protocolVersion').selector))return versionABI.encodeFunctionResult('protocolVersion',[1]);
  for(const [owner,getter,target] of links){
   if(to===ids[owner]&&data.startsWith(new Interface(['function '+getter+'() view returns(address)']).getFunction(getter).selector)){
    const iface=new Interface(['function '+getter+'() view returns(address)']);
    return iface.encodeFunctionResult(getter,[wrongGraph&&owner==='router'&&getter==='cases'?address(999):ids[target]]);
   }
  }
  if(to===ids.router&&data.startsWith(policyABI.getFunction('getPolicy').selector))return policyABI.encodeFunctionResult('getPolicy',[[address(50),address(51),100,200,1,true,true]]);
  if(to===ids.cases&&data.startsWith(caseABI.getFunction('getCase').selector))return caseABI.encodeFunctionResult('getCase',[[address(52),address(53),MARKET_ARBITRATION_DOMAIN,MARKET_ORIGIN_COMPONENT,b32(54),b32(55),b32(56),address(50),address(51),100,200,1000,1100,0,1,0,1,true]]);
  if(to===ids.rulings&&data.startsWith(rulingABI.getFunction('getRuling').selector))return rulingABI.encodeFunctionResult('getRuling',[[1,b32(60),b32(61),b32(62),address(50),1200,true]]);
  throw Error('Unexpected read '+to+' '+data.slice(0,10));
 };
 return {config,ids,send,setActive:v=>active=v,setGraph:v=>wrongGraph=v,setCode:v=>wrongCode=v};
}
const options=f=>({send:f.send,tag:{blockHash:b32(901),requireCanonical:true},deadline:1000,now:()=>10});
test('COM-6B Arbitration adapter verifies approved Registry service, immutable graph and finalized case/ruling proofs',async()=>{
 const f=fixture();
 const a=await finalizedArbitrationBinding(f.config,options(f));
 assert.equal(a.domainId,MARKET_ARBITRATION_DOMAIN);
 assert.equal(a.componentId,MARKET_ORIGIN_COMPONENT);
 assert.equal((await a.policy()).active,true);
 assert.equal((await a.getCase(b32(77))).originObjectId,b32(54));
 assert.equal((await a.getRuling(b32(77),0)).rulingHash,b32(60));
 const intent=a.intent('openCase',[MARKET_ARBITRATION_DOMAIN,address(53),MARKET_ORIGIN_COMPONENT,b32(54),b32(55),b32(56)]);
 assert.equal(intent.target,f.ids.cases);assert.equal(intent.requiresWalletAuthorization,true);
});
test('COM-6B arbitration rejects deprecated service, graph substitution, altered runtime and aliased contracts',async()=>{
 for(const fault of ['inactive','graph','code']){
  const f=fixture();
  if(fault==='inactive')f.setActive(false);
  if(fault==='graph')f.setGraph(true);
  if(fault==='code')f.setCode(true);
  await assert.rejects(()=>finalizedArbitrationBinding(f.config,options(f)));
 }
 const f=fixture();f.config.arbitration.dependencies.cases.address=f.config.arbitration.router.address;
 assert.throws(()=>validateArbitrationBinding(f.config.arbitration,'420'));
});
