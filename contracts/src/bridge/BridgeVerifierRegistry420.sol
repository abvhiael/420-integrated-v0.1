// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../system/GenesisResidentAccess420.sol";
import "./BridgeIds420.sol";
import "./BridgeChainRegistry420.sol";
import "./BridgeVerifierProxy420.sol";

/// @notice Governance qualification of an exact consumer, implementation and live public configuration.
/// @dev A probe manifest is part of the audited qualification, not an assertion of consensus validity.
/// Direct profiles certify nondelegating runtimes; arbitrary proxy self-reports are never trusted.
contract BridgeVerifierRegistry420 is GenesisResidentAccess420 {
    enum Status { NONE, UNQUALIFIED, APPROVED, REVOKED }
    enum ProxyKind { DIRECT, ERC1167, MANAGED, AUDITED_PUBLIC }
    struct Identity { address target; bytes32 runtimeHash; ProxyKind kind; address implementation; bytes32 implementationHash; uint256 version; }
    struct Probe { uint16 identity; bool trustedRoot; bytes data; bytes32 expectedResultHash; }
    struct Registration {
        Identity consumer; Identity verifier; bytes4 verifierGetter;
        bytes32 sourceChainKey; bytes32 destinationChainKey; bytes32 proofSystem;
        bytes32 configurationHash; bytes32 evidenceHash; uint64 validUntil; uint8 directions;
        Identity[] dependencies; Probe[] probes;
    }
    struct Approval {
        address consumer; address verifier; address chainRegistry; bytes32 chainRuntimeHash; bytes32 sourceChainKey; bytes32 destinationChainKey;
        bytes32 sourceIdentity; bytes32 destinationIdentity; bytes32 proofSystem; bytes32 configurationHash;
        bytes32 trustedRootsHash; bytes32 evidenceHash; bytes32 snapshotHash; uint64 validUntil; uint8 directions;
        Status status;
    }
    mapping(bytes32=>Approval) private approvals;
    mapping(bytes32=>bytes) private registrations;
    mapping(address=>bytes32) public currentApproval;
    struct ProxyProfile { uint256 revision; bytes32 evidenceHash; bool active; }
    mapping(bytes32=>ProxyProfile) public proxyProfiles;
    mapping(address=>bool) public managedProxies;
    mapping(bytes32=>mapping(bytes32=>bytes32)) public approvedRouteHashes;
    uint256 public sequence;
    event QualificationRecorded(bytes32 indexed id,address indexed consumer,address indexed verifier,Status status,bytes32 evidenceHash);
    event QualificationRevoked(bytes32 indexed id,bytes32 reasonHash);
    event VerifierProxyCreated(address indexed proxy,address indexed implementation);
    constructor(address governance,address registry_,bytes32 config) GenesisResidentAccess420(governance,registry_,config) {}
    function componentId() public pure override returns(bytes32){return BridgeIds420.VERIFIER_REGISTRY;}
    function deployVerifierProxy(address implementation_,bytes calldata initialization) external returns(address proxy){
        _requireGenesisGovernance(BridgeIds420.ACTION_CONFIGURE);
        proxy=address(new BridgeVerifierProxy420(governanceTimelock,implementation_,initialization));
        managedProxies[proxy]=true; emit VerifierProxyCreated(proxy,implementation_);
    }
    event ProxyRuntimeQualified(bytes32 indexed runtimeHash,uint256 revision,bool active,bytes32 evidenceHash);
    /// @notice Qualifies proxy runtimes with an audited native, nondelegating implementation() getter.
    /// May be batched with instance qualification in the existing governance timelock execution.
    function qualifyProxyRuntime(bytes32 runtimeHash,bytes32 evidenceHash,bool active) external {
        _requireGenesisGovernance(BridgeIds420.ACTION_CONFIGURE);require(runtimeHash!=0 && evidenceHash!=0,"proxy evidence");
        ProxyProfile storage p=proxyProfiles[runtimeHash];++p.revision;p.evidenceHash=evidenceHash;p.active=active;
        emit ProxyRuntimeQualified(runtimeHash,p.revision,active,evidenceHash);
    }
    /// @notice Returns an identity witness. DIRECT requires an audited nondelegating code profile.
    function identity(address target,ProxyKind kind) public view returns(Identity memory value){
        require(target.code.length!=0,"identity code");value.target=target;value.runtimeHash=target.codehash;value.kind=kind;
        if(kind==ProxyKind.DIRECT){require(!managedProxies[target] && !_isClone(target) && proxyProfiles[target.codehash].revision==0,"proxy profile");value.implementation=target;}
        else if(kind==ProxyKind.ERC1167){require(_isClone(target),"clone profile");bytes memory code=target.code;address implementation_;assembly{implementation_:=shr(96,mload(add(code,42)))}value.implementation=implementation_;}
        else if(kind==ProxyKind.AUDITED_PUBLIC){require(!managedProxies[target] && !_isClone(target),"proxy profile kind");ProxyProfile memory profile=proxyProfiles[target.codehash];require(profile.active && profile.revision!=0,"unqualified proxy runtime");bytes memory observed=_read(target,abi.encodeWithSignature("implementation()"));require(observed.length==32,"proxy implementation ABI");value.implementation=abi.decode(observed,(address));value.version=profile.revision;}
        else {require(managedProxies[target],"untracked proxy");BridgeVerifierProxy420 proxy=BridgeVerifierProxy420(payable(target));require(proxy.governanceTimelock()==governanceTimelock,"proxy governance");value.implementation=proxy.implementation();value.version=proxy.implementationVersion();}
        require(value.implementation.code.length!=0,"implementation code");
        // Nested delegation must have its own explicitly supported profile, never be hidden.
        require(!managedProxies[value.implementation] && !_isClone(value.implementation) && (kind==ProxyKind.DIRECT || proxyProfiles[value.implementation.codehash].revision==0),"nested proxy");
        value.implementationHash=value.implementation.codehash;
    }
    function _isClone(address target) private view returns(bool){
        bytes memory code=target.code;if(code.length!=45)return false;
        bytes10 prefix;bytes15 suffix;assembly{prefix:=mload(add(code,32)) suffix:=mload(add(code,62))}
        return prefix==hex"363d3d373d3d3d363d73" && suffix==hex"5af43d82803e903d91602b57fd5bf3";
    }
    function record(Registration calldata r,bytes32 expectedPrevious,bool qualified) external returns(bytes32 id){
        _requireGenesisGovernance(BridgeIds420.ACTION_CONFIGURE);
        require(currentApproval[r.consumer.target]==expectedPrevious,"approval race");
        require(r.configurationHash!=0 && r.evidenceHash!=0 && r.proofSystem!=0 && r.directions>0 && r.directions<4,"qualification metadata");
        require(r.validUntil==0 || r.validUntil>block.timestamp,"expired qualification");
        require(r.verifierGetter==0 || r.verifierGetter==bytes4(keccak256("verifier()")),"verifier getter");
        // Bound calldata before converting the nested manifest to memory.
        require(r.dependencies.length<=16 && r.probes.length>=2 && r.probes.length<=64,"manifest bounds");
        for(uint256 i;i<r.probes.length;++i)require(r.probes[i].data.length>=4 && r.probes[i].data.length<=512,"probe calldata bounds");
        (bytes32 snapshot,bytes32 roots)=_snapshot(r);
        BridgeChainRegistry420 chains=BridgeChainRegistry420(_resolveRequired(BridgeIds420.CHAIN_REGISTRY));
        BridgeChainRegistry420.Chain memory source=chains.requireActive(r.sourceChainKey);
        BridgeChainRegistry420.Chain memory destination=chains.requireActive(r.destinationChainKey);
        require(r.sourceChainKey!=r.destinationChainKey && destination.routeChainId==block.chainid,"qualification chain");
        require(chains.isActiveRoute(r.sourceChainKey,source.routeChainId) && chains.isActiveRoute(r.destinationChainKey,destination.routeChainId),"chain binding");
        id=keccak256(abi.encode(block.chainid,address(this),++sequence,r.consumer.target,r.verifier.target,snapshot,r.evidenceHash));
        approvals[id]=Approval(r.consumer.target,r.verifier.target,address(chains),address(chains).codehash,r.sourceChainKey,r.destinationChainKey,chains.identityHash(r.sourceChainKey),chains.identityHash(r.destinationChainKey),r.proofSystem,r.configurationHash,roots,r.evidenceHash,snapshot,r.validUntil,r.directions,qualified?Status.APPROVED:Status.UNQUALIFIED);
        registrations[id]=abi.encode(r);
        if(qualified)currentApproval[r.consumer.target]=id;
        emit QualificationRecorded(id,r.consumer.target,r.verifier.target,approvals[id].status,r.evidenceHash);
    }
    function revoke(bytes32 id,bytes32 reason) external {
        _requireGenesisGovernance(BridgeIds420.ACTION_CONFIGURE);require(reason!=0 && approvals[id].status==Status.APPROVED,"revocation");
        approvals[id].status=Status.REVOKED;if(currentApproval[approvals[id].consumer]==id)delete currentApproval[approvals[id].consumer];emit QualificationRevoked(id,reason);
    }
    function approval(bytes32 id) external view returns(Approval memory){return approvals[id];}
    function registration(bytes32 id) external view returns(bytes memory){return registrations[id];}
    function requireCurrent(address consumer) public view returns(bytes32 id){
        _requireResidentActive();id=currentApproval[consumer];Approval memory a=approvals[id];
        require(a.status==Status.APPROVED && a.consumer==consumer && (a.validUntil==0||block.timestamp<a.validUntil),"unqualified verifier");
        BridgeChainRegistry420 chains=BridgeChainRegistry420(_resolveRequired(BridgeIds420.CHAIN_REGISTRY));
        require(address(chains)==a.chainRegistry && address(chains).codehash==a.chainRuntimeHash && chains.identityHash(a.sourceChainKey)==a.sourceIdentity && chains.identityHash(a.destinationChainKey)==a.destinationIdentity,"stale chain qualification");
        (uint64 destinationId,,,,,)=chains.chains(a.destinationChainKey);require(destinationId==block.chainid,"wrong destination chain");
        Registration memory r=abi.decode(registrations[id],(Registration));(bytes32 live,)=_snapshot(r);require(live==a.snapshotHash,"stale verifier qualification");
    }
    function isCurrent(address consumer) external view returns(bool){try this.requireCurrent(consumer) returns(bytes32){return true;}catch{return false;}}
    function pinRoute(bytes32 approvalId,bytes32 routeId,bytes32 routeHash) external {
        require(msg.sender==_resolveRequired(BridgeIds420.ROUTE_REGISTRY),"route registry");
        require(approvalId!=0 && routeId!=0 && routeHash!=0 && requireCurrent(approvals[approvalId].consumer)==approvalId,"route approval");
        bytes32 previous=approvedRouteHashes[approvalId][routeId];require(previous==0||previous==routeHash,"route requires new qualification");
        approvedRouteHashes[approvalId][routeId]=routeHash;
    }
    function requireDirection(address consumer,uint8 direction) external view returns(bytes32 id){require(direction==1||direction==2,"direction");id=requireCurrent(consumer);require(approvals[id].directions&direction==direction,"unqualified direction");}
    function requireRoute(address consumer,uint64 source,uint64 destination,bytes32 configuration,uint8 directions) external view returns(bytes32 id){
        id=requireCurrent(consumer);Approval memory a=approvals[id];BridgeChainRegistry420 chains=BridgeChainRegistry420(a.chainRegistry);
        (uint64 sourceId,,,,,)=chains.chains(a.sourceChainKey);(uint64 destinationId,,,,,)=chains.chains(a.destinationChainKey);
        require(sourceId==source && destinationId==destination && a.configurationHash==configuration && directions&a.directions==directions,"route qualification");
    }
    function _check(Identity memory expected) private view {
        Identity memory actual=identity(expected.target,expected.kind);require(keccak256(abi.encode(expected))==keccak256(abi.encode(actual)),"changed implementation");
    }
    function _snapshot(Registration memory r) private view returns(bytes32 snapshot,bytes32 roots){
        require(r.dependencies.length<=16 && r.probes.length>=2 && r.probes.length<=64,"manifest bounds");_check(r.consumer);_check(r.verifier);
        if(r.verifierGetter==0){require(r.consumer.target==r.verifier.target,"self verifier");require(!_hasVerifierGetter(r.consumer.target),"external verifier omitted");}
        else {bytes memory result=_read(r.consumer.target,abi.encodeWithSelector(r.verifierGetter));require(result.length==32 && abi.decode(result,(address))==r.verifier.target,"verifier substitution");}
        for(uint256 i;i<r.dependencies.length;++i)_check(r.dependencies[i]);
        bool hasRoot;bool hasConfig;bytes32 config;
        for(uint256 i;i<r.probes.length;++i){Probe memory p=r.probes[i];require(p.expectedResultHash!=0 && p.data.length>=4 && p.data.length<=512,"probe");
            address target=p.identity==0?r.consumer.target:p.identity==1?r.verifier.target:r.dependencies[p.identity-2].target;
            require(keccak256(_read(target,p.data))==p.expectedResultHash,"configuration drift");
            if(p.trustedRoot){hasRoot=true;roots=keccak256(abi.encode(roots,p));}else{hasConfig=true;config=keccak256(abi.encode(config,p));}
        }
        require(hasRoot&&hasConfig,"root/config manifest");snapshot=keccak256(abi.encode(r.consumer,r.verifier,r.verifierGetter,r.dependencies,roots,config));
    }
    function _hasVerifierGetter(address target) private view returns(bool){bytes memory data=abi.encodeWithSignature("verifier()");bool ok;uint256 size;assembly{ok:=staticcall(50000,target,add(data,32),4,0,0) size:=returndatasize()}return ok&&size==32;}
    function _read(address target,bytes memory data) private view returns(bytes memory result){
        bool ok;uint256 size;
        assembly {ok:=staticcall(50000,target,add(data,32),mload(data),0,0) size:=returndatasize()}
        require(ok && size>0 && size<=4096,"identity probe failed");result=new bytes(size);assembly{returndatacopy(add(result,32),0,size)}
    }
}
