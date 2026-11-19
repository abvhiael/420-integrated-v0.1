import { TOKEN_SERVICE_ID_420, TOKEN_COMMUNITY_VAULT_ID_420, TOKEN_CREATION_FEE_WEI_420 } from '../core/token-runtime.js';
import { TOKEN_COMPONENT_ID_420, TOKEN_GENESIS_V3_420, TOKEN_TEMPLATES_420, ZERO_WORD,
  tokenHashText420, tokenHashHex420, tokenReadCall420, tokenEncodeAbi420 } from '../core/token-sdk.js';

export const addr = n => '0x' + BigInt(n).toString(16).padStart(40,'0');
export const digest = n => '0x' + BigInt(n).toString(16).padStart(64,'0');
export const controller = addr(11), account = addr(12);
export const state = Object.freeze({controller, factoryAddress:addr(13), smartAccount:account,
  deployed:true, owner:controller, controllerIsOwner:true, entryPoint:addr(14),
  capabilityRegistry:addr(15), expectedChainId:420});
export const order = ['GovernanceTimelock','ProtocolRegistry','AssetVault420','VaultRegistry420',
  'VaultAccounting420','VaultAuthorization420','VaultPolicyRegistry420','CapabilityRegistry420',
  'TokenTemplateRegistry420','TokenFactory420'];
const vaultNames = order.slice(2,8);
const timelock = addr(0x429), registry = addr(0x434);
export const serviceHash = tokenHashText420(TOKEN_SERVICE_ID_420);
export const componentHash = tokenHashText420(TOKEN_COMPONENT_ID_420);
export const vaultHash = tokenHashText420(TOKEN_COMMUNITY_VAULT_ID_420);
const policyTypes = ['AUTHORIZATION','ASSET','RELEASE','ACCOUNTING'].map(x=>tokenHashText420('420/VAULT/POLICY/'+x+'/V1'));
export const word = x => typeof x==='string' && x.startsWith('0x') ? x.slice(2).padStart(64,'0') : BigInt(x).toString(16).padStart(64,'0');
export const abi = (...xs) => '0x'+xs.map(word).join('');
export const draftFor = (profile=TOKEN_TEMPLATES_420[0]) => ({
  template:profile.key,userSalt:digest(1),
  ...(profile.standard==='ERC20'?{name:'Token 🌿',symbol:'TOK',initialSupply:'100',cap:profile.capped?'200':'0'}:
    profile.standard==='ERC721'?{name:'Collection',symbol:'NFT',baseURI:'ipfs://collection/'}:{uri:'ipfs://{id}.json'})
});

export function dependencyRoot(deps,manifestHash) {
  // Independent static ABI word concatenation: exact TOKEN-AUDIT-4 release order.
  return tokenHashHex420(abi(tokenHashText420('420/TOKEN/RELEASE/DEPENDENCIES/V1'),TOKEN_GENESIS_V3_420,
    ...order.flatMap(n=>[deps[n].address,deps[n].codeHash]),vaultHash,manifestHash));
}
export function fixture() {
  const codes = new Map(), deps={};
  for (let i=0;i<order.length;i++) {
    const address=i===0?timelock:i===1?registry:addr(20+i);
    const code='0x60'+(i+1).toString(16).padStart(2,'0')+'600052';
    codes.set(address,code);
    deps[order[i]]={address,codeHash:tokenHashHex420(code)};
  }
  const v=deps.AssetVault420.address, vr=deps.VaultRegistry420.address, l=deps.VaultAccounting420.address,
    a=deps.VaultAuthorization420.address, p=deps.VaultPolicyRegistry420.address, c=deps.CapabilityRegistry420.address,
    t=deps.TokenTemplateRegistry420.address, f=deps.TokenFactory420.address;
  const vaultRegistration={creator:addr(51),policyIds:[digest(101),digest(102),digest(103),digest(104)],
    beneficiarySetId:ZERO_WORD,metadataHash:digest(105),manifestHash:digest(106)};
  const release={metadataHash:digest(107),manifestHash:digest(108),interfaceHash:digest(109),
    dependencyRoot:dependencyRoot(deps,vaultRegistration.manifestHash)};
  const binding={serviceId:TOKEN_SERVICE_ID_420,componentId:TOKEN_COMPONENT_ID_420,chainId:420,version:1,
    genesisHash:digest(110),genesisConfigHash:TOKEN_GENESIS_V3_420,registry:deps.ProtocolRegistry,
    governanceTimelock:deps.GovernanceTimelock,factory:deps.TokenFactory420,templateRegistry:deps.TokenTemplateRegistry420,
    communityTreasuryVault:deps.AssetVault420,communityTreasuryVaultId:TOKEN_COMMUNITY_VAULT_ID_420,
    vaultGraph:Object.fromEntries(vaultNames.map(n=>[n,deps[n]])),vaultRegistration,release};
  const keys=new Map(), calls=[];
  const route=(to,sig,types=[],values=[])=>to+':'+tokenReadCall420(sig,types,values);
  const set=(to,sig,output,types=[],values=[])=>keys.set(route(to,sig,types,values),output);
  for(const [to,sig,val] of [[registry,'governanceTimelock()',timelock],[t,'governanceTimelock()',timelock],
    [f,'templates()',t],[f,'communityTreasuryVault()',v],[f,'CREATION_FEE()',TOKEN_CREATION_FEE_WEI_420],
    [v,'registry()',vr],[v,'accounting()',l],[v,'authorization()',a],[vr,'authorization()',a],
    [vr,'policies()',p],[l,'registry()',vr],[a,'capabilityRegistry()',c],[p,'governanceTimelock()',timelock],
    [v,'registrationCreator()',vaultRegistration.creator],[v,'vaultId()',vaultHash]])set(to,sig,abi(val));
  set(vr,'vaultIdForAddress(address)',abi(vaultHash),['address'],[v]);
  const vaultRecord=()=>abi(v,vaultRegistration.creator,tokenHashText420('420/VAULT/TYPE/COMMUNITY/V1'),
    ...vaultRegistration.policyIds,vaultRegistration.beneficiarySetId,vaultRegistration.metadataHash,
    vaultRegistration.manifestHash,1000,1,1,1);
  set(vr,'getVault(bytes32)',vaultRecord(),['bytes32'],[vaultHash]);
  for(let i=0;i<4;i++)set(p,'isActiveOfType(bytes32,bytes32)',abi(1),['bytes32','bytes32'],
    [vaultRegistration.policyIds[i],policyTypes[i]]);
  set(registry,'getService(bytes32)',abi(f,deps.TokenFactory420.codeHash,release.metadataHash,1,1000,1),['bytes32'],[serviceHash]);
  set(registry,'component(bytes32)',abi(componentHash,f,deps.TokenFactory420.codeHash,1,0,0,2),['bytes32'],[componentHash]);
  set(registry,'getRegistrationProfile(bytes32,uint32)',abi(3,release.manifestHash,release.dependencyRoot,release.interfaceHash),
    ['bytes32','uint256'],[serviceHash,1]);
  set(registry,'resolveActive(bytes32)',abi(f,1),['bytes32'],[serviceHash]);
  set(registry,'resolve(bytes32)',abi(f),['bytes32'],[componentHash]);
  const enable=(template,enabled,profileHash=template.profileHash)=>{
    set(t,'template(bytes32)',abi(1,template.standardWord,profileHash,enabled?1:0,1),['bytes32'],[template.id]);
    set(t,'enabled(bytes32)',abi(enabled?1:0),['bytes32'],[template.id]);
  };
  TOKEN_TEMPLATES_420.forEach(template=>enable(template,true));
  const control={chain:'0x1a4',canonicalHash:digest(111),tipHash:digest(111),genesisHash:binding.genesisHash,
    simulationError:null,estimateError:null,onEstimate:null};
  const provider={request:async(method,args=[])=>{
    calls.push([method,args]);
    if(method==='eth_chainId')return control.chain;
    if(method==='eth_getBlockByNumber'){
      if(args[0]==='0x0')return {number:'0x0',hash:control.genesisHash};
      if(args[0]==='latest')return {number:'0x10',hash:control.tipHash};
      if(args[0]==='0x10')return {number:'0x10',hash:control.canonicalHash};
    }
    if(method==='eth_getCode'){
      if(args[1]!=='0x10')throw Error('unpinned code read');
      return codes.get(args[0])||'0x';
    }
    if(method==='eth_call'){
      if(args[0].to===account){
        if(args[1]!=='latest'||args[0].from!==controller)throw Error('wrong SmartAccount simulation');
        if(control.simulationError)throw Error(control.simulationError);
        return '0x';
      }
      if(args[1]!=='0x10')throw Error('unpinned call');
      const result=keys.get(args[0].to+':'+args[0].data);
      if(result==null)throw Error('unexpected call '+args[0].to+':'+args[0].data);
      return result;
    }
    if(method==='eth_estimateGas'){
      if(control.estimateError)throw Error(control.estimateError);
      control.onEstimate?.();
      return '0x5208';
    }
    throw Error('forbidden RPC '+method);
  }};
  return {binding,provider,calls,codes,set,enable,deps,control,vaultRecord};
}
