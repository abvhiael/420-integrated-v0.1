// Browser-safe deterministic connected Wallet RPC fixture shared by discovery and catalogue tests.
import {encodeGetAddress,encodeAddressGetter,encodeUintGetter,encodeExecute,ZERO_ADDRESS,ZERO_BYTES32} from '../core/abi.js';
import {fixture,abi,addr,controller,account,state,digest,vaultHash} from './token-test-fixture.js';
import {tokenReadCall420,decodeTokenCreation420,tokenHashText420,TOKEN_TEMPLATES_420,tokenEncodeAbi420} from '../core/token-sdk.js';

export function connected() {
  const f=fixture();
  const config={schema:'420-wallet-runtime-config-v1',network:{chainId:'0x1a4',rpcUrl:null},
    smartAccount:{factoryAddress:state.factoryAddress,recoveryAuthority:ZERO_ADDRESS,salt:ZERO_BYTES32},
    services:[],trackedAssets:[],
    deployment:{environment:'testnet',protocolRegistryAddress:f.binding.registry.address,
      entryPointAddress:state.entryPoint,capabilityRegistryAddress:f.binding.vaultGraph.CapabilityRegistry420.address},
    token:{environment:'testnet',binding:f.binding}};
  const selected={...state,expectedChainId:'0x1a4',capabilityRegistry:config.deployment.capabilityRegistryAddress};
  const control={accounts:[controller],owner:controller,account,accountDeployed:true,factoryDeployed:true,
    entryPoint:state.entryPoint,capabilityRegistry:config.deployment.capabilityRegistryAddress,afterAccountRead:null,epoch:1,policyVersion:1,gasPrice:'0x3b9aca00',gasEstimate:'0x100000',
    smartBalance:'0x'+(100n*10n**18n).toString(16),controllerBalance:'0x'+(10n**18n).toString(16),
    simulationResult:abi(32,32,addr(77)),creatorNonce:0,simulationError:null,estimateError:null,onEstimate:null};
  const calls=[];
  const provider={request:async(method,args=[])=>{
    calls.push([method,args]);
    if(method==='eth_accounts')return [...control.accounts];
    if(method==='eth_gasPrice')return control.gasPrice;
    if(method==='eth_getBalance')return args[0]===control.account?control.smartBalance:args[0]===controller?control.controllerBalance:(()=>{throw Error('unexpected balance address')})();
    if(method==='eth_estimateGas'){if(control.estimateError)throw Error(control.estimateError);control.onEstimate?.();return control.gasEstimate;}
    if(method==='eth_getCode' && (args[0]===state.factoryAddress||args[0]===control.account)&&(args[1]==='latest'||args[1]==='0x10')){
      if(args[0]===state.factoryAddress)return control.factoryDeployed?'0x6001':'0x';
      if(args[0]===control.account)return control.accountDeployed?'0x6002':'0x';
      throw Error('unexpected latest code read');
    }
    if(method==='eth_call'&&args[0].to===f.binding.factory.address&&args[0].data===tokenReadCall420('creatorNonce(address)',['address'],[control.account]))return abi(control.creatorNonce);
    if(method==='eth_call' && (args[0].to===state.factoryAddress||args[0].to===control.account)&&(args[1]==='latest'||args[1]==='0x10')){
      const {to,data}=args[0];
      if(to===state.factoryAddress){
        if(data!==encodeGetAddress(controller,ZERO_ADDRESS,ZERO_BYTES32))throw Error('unexpected factory calldata');
        return abi(control.account);
      }
      if(to===control.account){
        const getters=new Map([
          [encodeAddressGetter('owner'),abi(control.owner)],
          [encodeAddressGetter('recoveryAuthority'),abi(ZERO_ADDRESS)],
          [encodeUintGetter('authorizationEpoch'),abi(control.epoch)],
          [encodeUintGetter('authorizationPolicyVersion'),abi(control.policyVersion)],
          [encodeAddressGetter('pendingRecoveryOwner'),abi(ZERO_ADDRESS)],
          [encodeUintGetter('recoveryExecutableAt'),abi(0)],
          [encodeAddressGetter('entryPoint'),abi(control.entryPoint)],
          [encodeAddressGetter('capabilityRegistry'),abi(control.capabilityRegistry)],
        ]);
        if(!getters.has(data)){
          if(args[0].from===controller&&args[0].value==='0x0'&&data.startsWith(encodeExecute(f.binding.factory.address,42n*10n**18n).slice(0,138))){
            if(control.simulationError)throw Error(control.simulationError);return control.simulationResult;
          }throw Error('unexpected account getter');
        }
        const value=getters.get(data);
        control.afterAccountRead?.(data);
        return value;
      }
      throw Error('unexpected latest call');
    }
    return f.provider.request(method,args);
  }};
  return {...f,config,selected,control,tokenControl:f.control,provider,calls};
}

 // Explicit opt-in synthetic broadcast/receipt fixture. Existing read-only tests
 // never enable this adapter. The actual reviewed outer calldata is decoded.
export function enableTokenSubmissionFixture420(f){
  const original=f.provider.request;let sequence=500;
  const transactions=new Map(),control={pending:false,reverted:false,reorganized:false,sendError:null,beforeSend:null};
  f.provider.request=async(method,args=[])=>{
    const hash=args[0],entry=transactions.get(hash);
    if(method==='eth_sendTransaction'){
      f.calls.push([method,args]);control.beforeSend?.();if(control.sendError)throw control.sendError;
      const tx=args[0],len=Number(BigInt('0x'+tx.data.slice(202,266)));
      const creation=decodeTokenCreation420('0x'+tx.data.slice(266,266+len*2));
      const token=addr(77),h=digest(++sequence),blockHash=f.tokenControl.canonicalHash,blockNumber='0x10';
      const common={address:f.binding.factory.address,blockHash,blockNumber,transactionHash:h,transactionIndex:'0x0',removed:false};
      const receipt={transactionHash:h,blockHash,blockNumber,transactionIndex:'0x0',status:'0x1',from:tx.from,to:tx.to,gasUsed:'0x100',effectiveGasPrice:tx.gasPrice,logs:[
        {...common,logIndex:'0x0',topics:[tokenHashText420('TokenDeployed(address,address,bytes32,uint32,bytes32,uint256)'),abi(token),abi(account),creation.template.id],data:abi(1,creation.configHash,42n*10n**18n)},
        {...common,logIndex:'0x1',topics:[tokenHashText420('CreationFeeDeposited(address,bytes32,uint256)'),abi(f.binding.communityTreasuryVault.address),vaultHash],data:abi(42n*10n**18n)}]};
      transactions.set(h,{tx:{...tx,hash:h,blockHash,blockNumber,input:tx.data},receipt});return h;
    }
    if(method==='eth_getTransactionByHash'){f.calls.push([method,args]);return entry?.tx??null;}
    if(method==='eth_getTransactionReceipt'){f.calls.push([method,args]);if(!entry||control.pending)return null;return control.reverted?{...entry.receipt,status:'0x0',logs:[]}:structuredClone(entry.receipt);}
    if(method==='eth_blockNumber'){f.calls.push([method,args]);return '0x10';}
    if(method==='eth_getBlockByNumber'&&args[0]==='0x10'&&control.reorganized){f.calls.push([method,args]);return {number:'0x10',hash:digest(999)};}
    if(method==='eth_getCode'&&args[0]===addr(77)&&args[1]==='0x10'){f.calls.push([method,args]);return '0x6001';}
    if(method==='eth_call'&&args[0].to===f.binding.factory.address&&args[0].data===tokenReadCall420('isFactoryDeployment(address)',['address'],[addr(77)])){f.calls.push([method,args]);return abi(1);}
    return original(method,args);
  };
  return control;
}

 // Canonical factory portfolio fixture: deliberately independent of send history.
export function enableTokenPortfolioFixture420(f,rows=[]){
  const original=f.provider.request,controls={rows,receiptUnavailable:false,corruptFee:false,corruptTemplate:false,reorg:false,duplicate:false,wrongCount:null,unsafeMetadata:false,onRead:null};
  const txs=new Map();const blockHash=f.tokenControl.canonicalHash,tag='0x10',timestamp='0x64';
  const topic=tokenHashText420('TokenDeployed(address,address,bytes32,uint32,bytes32,uint256)'),feeTopic=tokenHashText420('CreationFeeDeposited(address,bytes32,uint256)');
  const factory=f.binding.factory.address,vault=f.binding.communityTreasuryVault.address;
  const data=(...x)=>abi(...x);
  const refreshTxs=()=>{
    txs.clear();for(let i=0;i<controls.rows.length;i++){
      const row=controls.rows[i],hash=digest(10000+i),common={address:factory,transactionHash:hash,blockHash,blockNumber:tag,transactionIndex:'0x0',removed:false};
      const event={...common,logIndex:'0x0',topics:[topic,abi(row.token),abi(row.creator),row.profile.id],data:data(1,row.configHash,42n*10n**18n)};
      const fee={...common,logIndex:'0x1',topics:[feeTopic,abi(vault),vaultHash],data:data(controls.corruptFee?41n*10n**18n:42n*10n**18n)};
      txs.set(hash,{event,receipt:{status:'0x1',transactionHash:hash,blockHash,blockNumber:tag,transactionIndex:'0x0',logs:[event,fee]}});
    }
  };
  f.provider.request=async(method,args=[])=>{
    controls.onRead?.(method,args);
    if(method==='eth_getBlockByNumber'&&(args[0]===tag||args[0]==='latest')){f.calls.push([method,args]);return {number:tag,hash:controls.reorg?digest(999):blockHash,timestamp};}
    if(method==='eth_getLogs'){f.calls.push([method,args]);if(controls.receiptUnavailable)throw Error('history range unavailable');refreshTxs();return [...txs.values()].map(v=>v.event).filter(e=>args[0].topics.every((v,i)=>e.topics[i]===v));}
    if(method==='eth_getTransactionReceipt'&&txs.has(args[0])){f.calls.push([method,args]);return structuredClone(txs.get(args[0]).receipt);}
    const row=controls.rows.find(r=>r.token===args[0]?.to||r.token===args[0]);
    if(method==='eth_getCode'&&row&&args[1]===tag){f.calls.push([method,args]);return '0x6001';}
    if(method==='eth_call'&&args[1]===tag){
      const {to,data:input}=args[0];let out;
      if(to===factory){
        if(input===tokenReadCall420('deploymentCount()'))out=abi(controls.rows.length);
        else if(input===tokenReadCall420('creatorNonce(address)',['address'],[account]))out=abi(controls.wrongCount??controls.rows.filter(r=>r.creator===account).length);
        else for(let i=0;i<controls.rows.length;i++){
          const row=controls.rows[i],r=controls.duplicate&&i===0?controls.rows[1]:row;
          if(input===tokenReadCall420('deployment(uint256)',['uint256'],[BigInt(i)])){out=abi(r.token,r.creator,r.profile.id,1,r.configHash,100);break;}
          if(input===tokenReadCall420('isFactoryDeployment(address)',['address'],[row.token])){out=abi(1);break;}
        }
      }else if(row){
        const strings={'name()':controls.unsafeMetadata?'Bad\u202eName':'Created token '+row.token.slice(-2),'symbol()':'TOK','uri()':'ipfs://example/{id}.json'};
        const ints={'templateId()':controls.corruptTemplate?digest(999):row.profile.id,'owner()':row.owner,'totalSupply()':1000000000000000000n,'decimals()':18};
        for(const [sig,v] of Object.entries(strings))if(input===tokenReadCall420(sig))out=tokenEncodeAbi420(['string'],[v]);
        for(const [sig,v] of Object.entries(ints))if(input===tokenReadCall420(sig))out=abi(v);
        if(input===tokenReadCall420('balanceOf(address)',['address'],[account]))out=abi(1n);
      }
      if(out!=null){f.calls.push([method,args]);return out;}
    }
    return original(method,args);
  };
  return controls;
}
export const portfolioRecord420=(n,profile=TOKEN_TEMPLATES_420[0],creator=account,owner=creator)=>({token:addr(1000+n),profile,creator,owner,configHash:digest(2000+n)});
