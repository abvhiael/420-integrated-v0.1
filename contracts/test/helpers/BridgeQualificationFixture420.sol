// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./GenesisMocks420.sol";
import "../../src/bridge/BridgeVerifierRegistry420.sol";
import "../../src/bridge/BridgeRouteRegistry.sol";

/// @dev Controlled governance qualification fixtures, never production evidence or mock consensus approval.
library BridgeQualificationFixture420 {
    function registry(GenesisMockEnvironment420 env) internal returns(BridgeVerifierRegistry420 q){
        Types420.ContractRef memory ref=env.registry().component(BridgeIds420.VERIFIER_REGISTRY);
        if(ref.implementation==address(0)){q=new BridgeVerifierRegistry420(address(this),address(env.registry()),keccak256("qualification fixture"));env.registerResident(address(q),q.componentId());}
        else q=BridgeVerifierRegistry420(ref.implementation);
    }
    function approveRoute(GenesisMockEnvironment420 env,BridgeRouteRegistry routes,bytes32 route,address consumer,address verifier,bytes4 getter,bytes memory rootCall,bytes memory configCall,bool bind) internal returns(bytes32 id){
        BridgeVerifierRegistry420 q=registry(env);
        BridgeVerifierRegistry420.Registration memory r;
        r.consumer=q.identity(consumer,BridgeVerifierRegistry420.ProxyKind.DIRECT);r.verifier=q.identity(verifier,BridgeVerifierRegistry420.ProxyKind.DIRECT);r.verifierGetter=getter;
        (bytes32 asset,uint64 source,uint64 destination,,,bytes32 adapter,bytes32 config,,BridgeRouteRegistry.Status status,,)=routes.routes(route);asset;adapter;status;
        BridgeChainRegistry420 chains=BridgeChainRegistry420(env.registry().component(BridgeIds420.CHAIN_REGISTRY).implementation);
        r.sourceChainKey=chains.chainKeyByRouteId(source);r.destinationChainKey=chains.chainKeyByRouteId(destination);
        r.proofSystem=keccak256("CONTROLLED QUALIFICATION FIXTURE / NOT PRODUCTION");r.configurationHash=config;r.evidenceHash=keccak256("controlled unit/integration fixture");r.directions=3;
        r.dependencies=new BridgeVerifierRegistry420.Identity[](0);
        r.probes=new BridgeVerifierRegistry420.Probe[](2);
        r.probes[0]=BridgeVerifierRegistry420.Probe(1,true,rootCall,resultHash(verifier,rootCall));
        r.probes[1]=BridgeVerifierRegistry420.Probe(1,false,configCall,resultHash(verifier,configCall));
        id=q.record(r,q.currentApproval(consumer),true);
        if(bind)routes.bindVerifier(route,id);
    }
    function resultHash(address target,bytes memory data) internal view returns(bytes32){(bool ok,bytes memory result)=target.staticcall(data);require(ok&&result.length>0,"fixture probe");return keccak256(result);}
}
