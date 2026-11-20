// Browser-safe deterministic connected Wallet RPC fixture shared by discovery and catalogue tests.
import {encodeGetAddress,encodeAddressGetter,encodeUintGetter,ZERO_ADDRESS,ZERO_BYTES32} from '../core/abi.js';
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
    entryPoint:state.entryPoint,capabilityRegistry:config.deployment.capabilityRegistryAddress,afterAccountRead:null};
  const calls=[];
  const provider={request:async(method,args=[])=>{
    calls.push([method,args]);
    if(method==='eth_accounts')return [...control.accounts];
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
          [encodeUintGetter('authorizationEpoch'),abi(1)],
          [encodeUintGetter('authorizationPolicyVersion'),abi(1)],
          [encodeAddressGetter('pendingRecoveryOwner'),abi(ZERO_ADDRESS)],
          [encodeUintGetter('recoveryExecutableAt'),abi(0)],
          [encodeAddressGetter('entryPoint'),abi(control.entryPoint)],
          [encodeAddressGetter('capabilityRegistry'),abi(control.capabilityRegistry)],
        ]);
        if(!getters.has(data))throw Error('unexpected account getter');
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
