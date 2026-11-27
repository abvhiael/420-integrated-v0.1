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
    function testFixedCrossLanguageVectors() public {
        ResourceAuthorization420 auth = new ResourceAuthorization420(address(new CapabilityRegistry420()));
        require(ResourceIds420.COMPONENT_RESOURCE == 0xe4f6904bd8a488ecb6a9a20c1b876c3cbb0c75ff9d01804c4869d36f32c77c44, "ResourceIds420.COMPONENT_RESOURCE");
        require(ResourceIds420.SERVICE_RELAY == 0xfdb1cd663fffea1c8c2c2716a12b4c697cebe69eadaca31ef8f4986db8b6b347, "ResourceIds420.SERVICE_RELAY");
        require(ResourceIds420.SERVICE_STORE == 0x435882bf152dc6f2c18dbafe60e0f31cee7e12ff978a73449c02fe3a4bc375d8, "ResourceIds420.SERVICE_STORE");
        require(ResourceIds420.SERVICE_CACHE == 0x19441aad2fb5f62762627057cf49586403eb4e59d72f11a8c65421b9bda69e4f, "ResourceIds420.SERVICE_CACHE");
        require(ResourceIds420.SERVICE_GATEWAY == 0x1fef60d800106225817aedbab1410eb15624e25d614f0d1afee6692580429d9f, "ResourceIds420.SERVICE_GATEWAY");
        require(ResourceIds420.ACTION_REGISTER_PROVIDER == 0x53275d41e20a890499c487e8a55b6f572f51910c81193f09d97db9eb3c11d0c7, "ResourceIds420.ACTION_REGISTER_PROVIDER");
        require(ResourceIds420.ACTION_UPDATE_PROVIDER == 0x9d9bc9ffabe5bfc4c5d71e284aae89857fcce796d80d84c5e221dc9eeb882b80, "ResourceIds420.ACTION_UPDATE_PROVIDER");
        require(ResourceIds420.ACTION_SET_PROVIDER_STATE == 0xe4ab77ff7e48e2caf2a5dbf6bd2c1f3927d26eb87d1410ae94852bfc8e759478, "ResourceIds420.ACTION_SET_PROVIDER_STATE");
        require(ResourceIds420.ACTION_REGISTER_NODE == 0xdaed1f98ca475cb38483835f842f86262536eed81a3233184254f30e0c37dc3d, "ResourceIds420.ACTION_REGISTER_NODE");
        require(ResourceIds420.ACTION_UPDATE_NODE == 0x7e576cb1b81003815bc05c586429e8fc4667272e612b85a68874fb9a339f440c, "ResourceIds420.ACTION_UPDATE_NODE");
        require(ResourceIds420.ACTION_SET_NODE_STATE == 0x3ea2f2769ec13e3d02c6604abf72649c9dc14120148a731213f823dabda90f12, "ResourceIds420.ACTION_SET_NODE_STATE");
        require(ResourceIds420.ACTION_PUBLISH_OFFER == 0x58e8ea2e61737a654fec3612f914f73a9b48f0b8146cefd989c6a61433daf5db, "ResourceIds420.ACTION_PUBLISH_OFFER");
        require(ResourceIds420.ACTION_SUBMIT_RECEIPT == 0xaab522b3abb5a5d32dd12376cd30e5ef7c8dce0984f02d3e84dc4ec2694e3009, "ResourceIds420.ACTION_SUBMIT_RECEIPT");
        require(ResourceIds420.ACTION_SETTLE == 0x090934bbd56033174a6b65398d26082e445f6a0ffa68b0859e08d10f2f17d686, "ResourceIds420.ACTION_SETTLE");
        require(StorageIds420.ACTION_CONFIGURE_STORAGE_CAPACITY == 0x265674b1135776ef86c512f9a45a410374a61a619977ea843ed33e0a08041fa0, "StorageIds420.ACTION_CONFIGURE_STORAGE_CAPACITY");
        require(StorageIds420.ACTION_RESERVE_STORAGE_CAPACITY == 0x49ccea9e57bf747dd60ac7e88425e9ef0b395a0456109326339c86a4ac5f60cb, "StorageIds420.ACTION_RESERVE_STORAGE_CAPACITY");
        require(StorageIds420.RESERVATION_DOMAIN == 0x8fa1d10273a1f7759384ffd2439750121d1c58a464757ee0b4f6342e64a98874, "StorageIds420.RESERVATION_DOMAIN");
        require(StorageProofIds420.PROOF_REPLICA_COMMITMENT == 0xa29b0d555bd771a1c1e2e6f7baca50d40f39c11ee296edb41fd9b24788e250f3, "StorageProofIds420.PROOF_REPLICA_COMMITMENT");
        require(StorageProofIds420.PROOF_AVAILABILITY_WINDOW == 0x6358f45676371cc52216ac1a80c2c9ba9a4e5ed54a282c19a0014e0fa0bfd357, "StorageProofIds420.PROOF_AVAILABILITY_WINDOW");
        require(StorageProofIds420.PROOF_AUDIT_RESPONSE == 0x3133e2f8c364521fb2fdbf11749de27000890ac7bb759d630aa2353e70627747, "StorageProofIds420.PROOF_AUDIT_RESPONSE");
        require(StorageProofIds420.ACTION_REGISTER_PROOF_SCHEME == 0x56c1740c194a5fe1ca444ff46b90ed307cdbc2b8c3600d4680e3941a5737ea91, "StorageProofIds420.ACTION_REGISTER_PROOF_SCHEME");
        require(StorageProofIds420.ACTION_SET_PROOF_SCHEME_STATE == 0x30087425d6607f633041b898200322e094ce5f02b0271d0895613dc2fb7e2920, "StorageProofIds420.ACTION_SET_PROOF_SCHEME_STATE");
        require(StorageProofIds420.ACTION_REGISTER_STORAGE_COMMITMENT == 0xa195396a715a1330bcec0d5c73593fd1b5e0d53d9eb43a9c3ac2b6e24915716a, "StorageProofIds420.ACTION_REGISTER_STORAGE_COMMITMENT");
        require(StorageProofIds420.ACTION_ACCEPT_STORAGE_AGREEMENT == 0x0d8876f9f13056433a29c22b9d7a8dc47b4bba231cdcb3691337ee2400fa7b93, "StorageProofIds420.ACTION_ACCEPT_STORAGE_AGREEMENT");
        require(ServiceIds420.RESOURCE_PROTOCOL == 0xfef6f99a887056ff7aa1e565e707b9b5066da9ceb6054e4d73d5086bba4f2115, "ServiceIds420.RESOURCE_PROTOCOL");
        require(auth.scopeProvider(P) == 0xd46023cff368d0e5370a3f39ec8bf7d0d51d6e211354a7a0b9c285b0248f9d36, "provider vector");
        require(auth.scopeNode(P,N) == 0xf2c5643a364f1f2502ab07e3db0bd271d10b6092a12fee9b26789901dd9cf09b, "node vector");
        require(auth.scopeSession(P) == 0x3e6cdceda11222e1f76a2c7514139cfd2695fecdb5615aaa4a937f669dce5d4e, "session vector");
        require(auth.scopeProofScheme(P) == 0x2e2b0c5eddba9efbf3c7d8a3e470763f4ab051c71fa5d5c44da78a4c145857a7, "proofScheme vector");
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
