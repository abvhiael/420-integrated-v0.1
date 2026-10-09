import test from 'node:test';
import assert from 'node:assert/strict';
import {Interface,keccak256,toUtf8Bytes} from 'ethers';
import {WalletSession,validateConfig} from '../core/wallet.js';
import {fixture} from './fixture.mjs';
const b32=n=>'0x'+n.toString(16).padStart(64,'0'),address=n=>'0x'+n.toString(16).padStart(40,'0');
const domain=keccak256(toUtf8Bytes('420/arbitration/domain/market/v1'));
const component=keccak256(toUtf8Bytes('420/component/market/v1'));
const codeHash=keccak256('0x6000');
function setup(){
 const f=fixture();
 const entries={router:address(201),policies:address(202),cases:address(203),rulings:address(204)};
 const binding={serviceId:'420/service/arbitration/v1',chainId:'420',version:1,router:{address:entries.router,codeHash,verified:true},dependencies:Object.fromEntries(['policies','cases','rulings'].map(name=>[name,{address:entries[name],codeHash,verified:true}])),manifestHash:b32(211),interfaceHash:b32(212),dependencyRoot:b32(213)};
 f.config.arbitration=binding;
 const session=new WalletSession(f.provider,f.config,{now:()=>f.now});
 const original=f.provider.request.bind(f.provider);
 const serviceABI=new Interface(['function getService(bytes32) view returns(tuple(address implementation,bytes32 codeHash,bytes32 metadataHash,uint32 version,uint64 publishedAt,bool active))','function getRegistrationProfile(bytes32,uint32) view returns(tuple(uint8 componentType,bytes32 manifestHash,bytes32 dependencyRoot,bytes32 interfaceHash))']);
 const routerABI=new Interface(['function policies() view returns(address)','function cases() view returns(address)','function rulings() view returns(address)','function getPolicy(bytes32) view returns(tuple(address resolver,address appealResolver,uint64 evidenceWindow,uint64 appealWindow,uint8 maxAppeals,bool active,bool exists))']);
 const caseABI=new Interface(['function policies() view returns(address)','function rulingRegistry() view returns(address)']);
 const rulingABI=new Interface(['function cases() view returns(address)']);
 const orderABI=new Interface(['function getOrder(bytes32) view returns(tuple(bytes32 listingId,uint32 listingRevision,address buyer,address seller,uint256 quantity,address paymentAsset,uint256 totalAmount,bytes32 settlementAdapterId,bytes32 paymentRef,bytes32 fulfillmentHash,bytes32 disputeHash,uint8 status,uint64 createdAt,uint64 updatedAt))']);
 let active=true,marketDisputed=true;
 const claim=b32(222),orderId=b32(223),remedy=b32(224),resolver=address(225);
 const request=async call=>{
  const {method,params}=call,tx=params?.[0];
  if(method==='eth_call'){
   const to=tx.to.toLowerCase(),data=tx.data;
   if(to===f.config.registry.address.toLowerCase()){
    if(data.startsWith(serviceABI.getFunction('getService').selector))return serviceABI.encodeFunctionResult('getService',[[entries.router,codeHash,b32(1),1,0,active]]);
    if(data.startsWith(serviceABI.getFunction('getRegistrationProfile').selector))return serviceABI.encodeFunctionResult('getRegistrationProfile',[[1,binding.manifestHash,binding.dependencyRoot,binding.interfaceHash]]);
   }
   if(to===entries.router.toLowerCase()){
    for(const name of ['policies','cases','rulings'])if(data.startsWith(routerABI.getFunction(name).selector))return routerABI.encodeFunctionResult(name,[entries[name]]);
    if(data.startsWith(routerABI.getFunction('getPolicy').selector))return routerABI.encodeFunctionResult('getPolicy',[[resolver,address(226),200,100,1,true,true]]);
   }
   if(to===entries.cases.toLowerCase()){
    for(const [name,target] of [['policies',entries.policies],['rulingRegistry',entries.rulings]])if(data.startsWith(caseABI.getFunction(name).selector))return caseABI.encodeFunctionResult(name,[target]);
   }
   if(to===entries.rulings.toLowerCase()&&data.startsWith(rulingABI.getFunction('cases').selector))return rulingABI.encodeFunctionResult('cases',[entries.cases]);
   if(to===f.config.contracts.OrderRegistry420.address.toLowerCase()&&data.startsWith(orderABI.getFunction('getOrder').selector))return orderABI.encodeFunctionResult('getOrder',[[b32(1),1,address(101),address(100),1,address(104),100,b32(41),b32(0),b32(0),claim,marketDisputed?6:2,10,11]]);
  }
  return original(call);
 };
 f.provider.request=request;
 const plan={requester:address(100),claimant:address(100),respondent:address(101),orderId,claimHash:claim,requestedRemedyHash:remedy,policy:{resolver},state:'ARBITRATION_WALLET_SUBMISSION_REQUIRED',intent:{contract:'ArbitrationCaseRegistry420',chainId:'420',target:entries.cases,method:'openCase',args:[domain,address(101),component,orderId,claim,remedy],requiresWalletAuthorization:true,canonicalAuthority:false}};
 return {f,session,plan,entries,setActive:v=>active=v,setMarket:v=>marketDisputed=v};
}
test('COM-6B Wallet pins Arbitration Registry service, code graph and Market disputed claim before explicit case open',async()=>{
 const {f,session,plan,entries}=setup();await session.connect();
 const receipt=await session.sendArbitrationAction(plan);
 assert.equal(receipt.finalized,false);assert.equal(receipt.arbitrationCaseOpened,false);
 const tx=f.calls.find(x=>x.method==='eth_sendTransaction').params[0];
 assert.equal(tx.to.toLowerCase(),entries.cases.toLowerCase());assert.equal(tx.from,address(100));assert.equal(tx.value,'0x0');
 assert.equal(f.calls.filter(x=>x.method==='eth_sendTransaction').length,1);
});
test('COM-6B Arbitration Wallet rejects inactive service, non-final Market dispute, wrong claim and tampered case address',async()=>{
 for(const fault of ['inactive','market','claim','target']){
  const {f,session,plan,setActive,setMarket}=setup();await session.connect();
  if(fault==='inactive')setActive(false);
  if(fault==='market')setMarket(false);
  if(fault==='claim')plan.intent.args[4]=b32(999);
  if(fault==='target')plan.intent.target=address(999);
  await assert.rejects(()=>session.sendArbitrationAction(plan));
  assert.equal(f.calls.some(x=>x.method==='eth_sendTransaction'),false);
 }
});
test('COM-6B manifest validation rejects false service ID, aliased dependency, wrong network and unverified code',()=>{
 const f=fixture();
 const valid=setup().f.config.arbitration;
 for(const mutation of [
  a=>a.serviceId='arbitrary',a=>a.chainId='1',
  a=>a.dependencies.cases.address=a.router.address,
  a=>a.dependencies.rulings.verified=false,
  a=>a.manifestHash=b32(0)
 ]){const config=structuredClone(f.config);config.arbitration=structuredClone(valid);mutation(config.arbitration);assert.throws(()=>validateConfig(config));}
});
