// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../src/resource/ResourceAuthorization420.sol";
import "../src/resource/ResourceIds420.sol";
import "../src/resource/StorageIds420.sol";
import "../src/resource/StorageProofIds420.sol";
import "../src/system/CapabilityRegistry420.sol";
import "../src/libraries/ServiceIds420.sol";

contract ResourceIdentifierDomains420Test {
    address constant PRINCIPAL = address(0x1234);
    bytes32 constant P = bytes32(uint256(1));
    bytes32 constant N = bytes32(uint256(2));
    function testAllActionsAgainstAllDomainsAndLegacyGrants() public {
        CapabilityRegistry420 caps = new CapabilityRegistry420();
        ResourceAuthorization420 auth = new ResourceAuthorization420(address(caps));
        bytes32 component = ResourceIds420.COMPONENT_RESOURCE;
        require(component != ServiceIds420.RESOURCE_PROTOCOL, "service/component collision");
        caps.registerProtocolComponent(component, address(this));
        caps.registerProtocolComponent(ServiceIds420.RESOURCE_PROTOCOL, address(this));
        require(caps.protocolComponentManaged(component) && caps.componentAuthority(component)==address(this), "registration");
        bytes32[17] memory actions = [ResourceIds420.ACTION_REGISTER_PROVIDER, ResourceIds420.ACTION_UPDATE_PROVIDER, ResourceIds420.ACTION_SET_PROVIDER_STATE, ResourceIds420.ACTION_REGISTER_NODE, ResourceIds420.ACTION_UPDATE_NODE, ResourceIds420.ACTION_SET_NODE_STATE, ResourceIds420.ACTION_PUBLISH_OFFER, ResourceIds420.ACTION_SUBMIT_RECEIPT, ResourceIds420.ACTION_SETTLE, StorageIds420.ACTION_CONFIGURE_STORAGE_CAPACITY, StorageIds420.ACTION_RESERVE_STORAGE_CAPACITY, StorageProofIds420.ACTION_REGISTER_PROOF_SCHEME, StorageProofIds420.ACTION_SET_PROOF_SCHEME_STATE, StorageProofIds420.ACTION_REGISTER_STORAGE_COMMITMENT, StorageProofIds420.ACTION_ACCEPT_STORAGE_AGREEMENT, keccak256("420/RESOURCE/ACTION/OPEN_SESSION/V1"), bytes32(uint256(999))];
        uint8[17] memory kinds = [uint8(0),0,0,1,1,1,1,1,2,1,1,3,3,1,1,4,4];
        bytes32[4] memory scopes = [auth.scopeProvider(P),auth.scopeNode(P,N),auth.scopeSession(P),auth.scopeProofScheme(P)];
        for(uint256 i; i<4; ++i) {
            for(uint256 j=i+1; j<4; ++j) require(scopes[i]!=scopes[j],"domain collision");
        }
        require(auth.scopeNode(P,N)!=auth.scopeNode(N,P),"node order");
        require(auth.scopeNode(P,N)!=auth.scopeNode(N,N),"provider binding");
        for(uint256 i; i<actions.length; ++i) {
            bytes32 a=actions[i];
            for(uint256 j; j<4; ++j) {
                caps.createGrant(keccak256(abi.encode("wrong-component",i,j)),PRINCIPAL,ServiceIds420.RESOURCE_PROTOCOL,a,scopes[j],0,0,0,0,0);
            }
            _check(auth,a,4);
            caps.createGrant(keccak256(abi.encode("old-single",i)),PRINCIPAL,component,a,keccak256(abi.encode(P)),0,0,0,0,0);
            caps.createGrant(keccak256(abi.encode("old-pair",i)),PRINCIPAL,component,a,keccak256(abi.encode(P,N)),0,0,0,0,0);
            _check(auth,a,4);
            for(uint256 j; j<4; ++j) {
                caps.createGrant(keccak256(abi.encode("canonical",i,j)),PRINCIPAL,component,a,scopes[j],0,0,0,0,0);
            }
            _check(auth,a,kinds[i]);
        }
    }
    function _check(ResourceAuthorization420 auth, bytes32 a, uint8 kind) private view {
        require(auth.isProviderAuthorized(PRINCIPAL,P,a)==(kind==0),"provider allowlist");
        require(auth.isNodeAuthorized(PRINCIPAL,P,N,a)==(kind==1),"node allowlist");
        require(auth.isSessionAuthorized(PRINCIPAL,P,a,1)==(kind==2),"session allowlist");
        require(auth.isProofSchemeAuthorized(PRINCIPAL,P,a)==(kind==3),"proof allowlist");
        require(!auth.isProviderAuthorized(PRINCIPAL,N,a),"wrong provider");
        require(!auth.isNodeAuthorized(PRINCIPAL,N,P,a),"wrong node");
        require(!auth.isSessionAuthorized(PRINCIPAL,N,a,1),"wrong session");
        require(!auth.isProofSchemeAuthorized(PRINCIPAL,N,a),"wrong scheme");
        require(!auth.isProviderAuthorized(PRINCIPAL,0,a),"zero provider");
        require(!auth.isNodeAuthorized(PRINCIPAL,P,0,a),"zero node");
        require(!auth.isSessionAuthorized(PRINCIPAL,0,a,1),"zero session");
        require(!auth.isProofSchemeAuthorized(PRINCIPAL,0,a),"zero scheme");
    }
    function testFuzzScopeDomains(bytes32 p, bytes32 n) public {
        ResourceAuthorization420 auth = new ResourceAuthorization420(address(new CapabilityRegistry420()));
        require(auth.scopeProvider(p)!=auth.scopeSession(p),"provider/session");
        require(auth.scopeProvider(p)!=auth.scopeProofScheme(p),"provider/proof");
        require(auth.scopeSession(p)!=auth.scopeProofScheme(p),"session/proof");
        require(auth.scopeNode(p,n)!=auth.scopeProvider(p),"node/provider");
        require(auth.scopeNode(p,n)!=auth.scopeSession(p),"node/session");
        require(auth.scopeNode(p,n)!=auth.scopeProofScheme(p),"node/proof");
    }
}
