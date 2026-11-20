// Browser-safe deterministic connected Wallet RPC fixture shared by discovery and catalogue tests.
import {encodeGetAddress,encodeAddressGetter,encodeUintGetter,encodeExecute,ZERO_ADDRESS,ZERO_BYTES32} from '../core/abi.js';
import {fixture,abi,addr,controller,account,state} from './token-test-fixture.js';

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
    simulationResult:abi(32,32,addr(77)),simulationError:null,estimateError:null,onEstimate:null};
  const calls=[];
  const provider={request:async(method,args=[])=>{
    calls.push([method,args]);
    if(method==='eth_accounts')return [...control.accounts];
    if(method==='eth_gasPrice')return control.gasPrice;
    if(method==='eth_getBalance')return args[0]===control.account?control.smartBalance:args[0]===controller?control.controllerBalance:(()=>{throw Error('unexpected balance address')})();
    if(method==='eth_estimateGas'){if(control.estimateError)throw Error(control.estimateError);control.onEstimate?.();return control.gasEstimate;}
    if(method==='eth_getCode' && args[1]==='latest'){
      if(args[0]===state.factoryAddress)return control.factoryDeployed?'0x6001':'0x';
      if(args[0]===control.account)return control.accountDeployed?'0x6002':'0x';
      throw Error('unexpected latest code read');
    }
    if(method==='eth_call' && args[1]==='latest'){
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
