// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/interfaces/genesis/ICapabilityRegistry420.sol";
import "../src/vpn/VPNIds420.sol";
import "../src/vpn/VPNAuthorization420.sol";
import "../src/vpn/VPNPolicyRegistry420.sol";
import "../src/vpn/VPNProviderRegistry420.sol";
import "../src/vpn/VPNNodeRegistry420.sol";

interface VmVPN420 {
    function prank(address) external;
    function expectRevert(bytes4) external;
    function warp(uint256) external;
}

contract MockCapabilityRegistryVPN420 is ICapabilityRegistry420 {
    mapping(bytes32 => CapabilityGrant) private _grants;
    mapping(bytes32 => bool) public allowed;

    function setAllowed(address principal, bytes32 componentId, bytes32 capabilityId, bytes32 scopeHash, bool value) external {
        allowed[keccak256(abi.encode(principal, componentId, capabilityId, scopeHash))] = value;
    }

    function grant(bytes32 grantId) external view returns (CapabilityGrant memory) { return _grants[grantId]; }

    function isAuthorized(address principal, bytes32 componentId, bytes32 capabilityId, bytes32 scopeHash, uint256) external view returns (bool) {
        return allowed[keccak256(abi.encode(principal, componentId, capabilityId, scopeHash))];
    }
}

contract VPN420Test {
    VmVPN420 constant vm = VmVPN420(address(uint160(uint256(keccak256("hevm cheat code")))));
    address constant ALICE = address(0xA11CE);
    address constant BOB = address(0xB0B);
    bytes32 constant PROVIDER_ID = keccak256("vpn/provider/alice");
    bytes32 constant NODE_ID = keccak256("vpn/node/alice/1");

    struct Suite {
        MockCapabilityRegistryVPN420 caps;
        VPNAuthorization420 auth;
        VPNPolicyRegistry420 policies;
        VPNProviderRegistry420 providers;
        VPNNodeRegistry420 nodes;
    }

    function _deploy() private returns (Suite memory s) {
        s.caps = new MockCapabilityRegistryVPN420();
        s.auth = new VPNAuthorization420(address(s.caps));
        s.policies = new VPNPolicyRegistry420(address(this));
        s.providers = new VPNProviderRegistry420(address(s.auth));
        s.nodes = new VPNNodeRegistry420(address(s.auth), address(s.providers));
    }

    function _allowProvider(Suite memory s, address who, bytes32 actionId) private {
        s.caps.setAllowed(who, VPNIds420.COMPONENT_VPN, actionId, s.auth.scopeForProvider(PROVIDER_ID), true);
    }

    function _allowNode(Suite memory s, address who, bytes32 actionId) private {
        s.caps.setAllowed(who, VPNIds420.COMPONENT_VPN, actionId, s.auth.scopeForNode(PROVIDER_ID, NODE_ID), true);
    }

    function _registerAndActivateProvider(Suite memory s) private {
        _allowProvider(s, ALICE, VPNIds420.ACTION_REGISTER_PROVIDER);
        _allowProvider(s, ALICE, VPNIds420.ACTION_SET_PROVIDER_STATUS);
        vm.prank(ALICE);
        s.providers.registerProvider(PROVIDER_ID, ALICE, keccak256("provider-meta"), keccak256("stake-ref"));
        vm.prank(ALICE);
        s.providers.setState(PROVIDER_ID, VPNProviderRegistry420.ProviderState.ACTIVE);
    }

    function _registerAndActivateNode(Suite memory s, uint64 expiry) private {
        _allowNode(s, ALICE, VPNIds420.ACTION_REGISTER_NODE);
        _allowNode(s, ALICE, VPNIds420.ACTION_SET_NODE_STATUS);
        vm.prank(ALICE);
        s.nodes.registerNode(NODE_ID, PROVIDER_ID, ALICE, VPNIds420.NODE_ENTRY_RELAY, keccak256("endpoint"), expiry, bytes32(0));
        vm.prank(ALICE);
        s.nodes.setState(NODE_ID, VPNNodeRegistry420.NodeState.ACTIVE);
    }

    function testProviderRegistrationDefaultsToDeny() public {
        Suite memory s = _deploy();
        vm.prank(ALICE);
        vm.expectRevert(VPNProviderRegistry420.Unauthorized.selector);
        s.providers.registerProvider(PROVIDER_ID, ALICE, bytes32(0), bytes32(0));
    }

    function testAuthorizedProviderRegistrationBindsOperator() public {
        Suite memory s = _deploy();
        _allowProvider(s, ALICE, VPNIds420.ACTION_REGISTER_PROVIDER);
        vm.prank(ALICE);
        s.providers.registerProvider(PROVIDER_ID, ALICE, keccak256("meta"), keccak256("stake"));
        VPNProviderRegistry420.Provider memory p = s.providers.getProvider(PROVIDER_ID);
        require(p.operatorAccount == ALICE, "operator");
        require(p.state == VPNProviderRegistry420.ProviderState.REGISTERED, "state");
    }

    function testProviderCannotActivateWithoutStakeRef() public {
        Suite memory s = _deploy();
        _allowProvider(s, ALICE, VPNIds420.ACTION_REGISTER_PROVIDER);
        _allowProvider(s, ALICE, VPNIds420.ACTION_SET_PROVIDER_STATUS);
        vm.prank(ALICE);
        s.providers.registerProvider(PROVIDER_ID, ALICE, bytes32(0), bytes32(0));
        vm.prank(ALICE);
        vm.expectRevert(VPNProviderRegistry420.InvalidStakeRef.selector);
        s.providers.setState(PROVIDER_ID, VPNProviderRegistry420.ProviderState.ACTIVE);
    }

    function testStakeRefCannotRotateWhileActive() public {
        Suite memory s = _deploy();
        _registerAndActivateProvider(s);
        _allowProvider(s, ALICE, VPNIds420.ACTION_UPDATE_STAKE_REF);
        vm.prank(ALICE);
        vm.expectRevert(VPNProviderRegistry420.StakeRefLockedWhileActive.selector);
        s.providers.updateStakeRef(PROVIDER_ID, keccak256("stake-ref-2"));
    }

    function testNodeRegistrationRequiresActiveProviderAndCapability() public {
        Suite memory s = _deploy();
        _allowProvider(s, ALICE, VPNIds420.ACTION_REGISTER_PROVIDER);
        vm.prank(ALICE);
        s.providers.registerProvider(PROVIDER_ID, ALICE, bytes32(0), bytes32(0));
        _allowNode(s, ALICE, VPNIds420.ACTION_REGISTER_NODE);
        vm.prank(ALICE);
        vm.expectRevert(VPNNodeRegistry420.ProviderInactive.selector);
        s.nodes.registerNode(NODE_ID, PROVIDER_ID, ALICE, VPNIds420.NODE_EXIT_RELAY, keccak256("endpoint"), uint64(block.timestamp + 1 hours), bytes32(0));
    }

    function testNodeRejectsExpiredEndpointManifest() public {
        Suite memory s = _deploy();
        _registerAndActivateProvider(s);
        _allowNode(s, ALICE, VPNIds420.ACTION_REGISTER_NODE);
        vm.prank(ALICE);
        vm.expectRevert(VPNNodeRegistry420.InvalidEndpointManifest.selector);
        s.nodes.registerNode(NODE_ID, PROVIDER_ID, ALICE, VPNIds420.NODE_EXIT_RELAY, keccak256("endpoint"), uint64(block.timestamp), bytes32(0));
    }

    function testNodeProviderBindingCannotChange() public {
        Suite memory s = _deploy();
        _registerAndActivateProvider(s);
        _allowNode(s, ALICE, VPNIds420.ACTION_REGISTER_NODE);
        _allowNode(s, ALICE, VPNIds420.ACTION_UPDATE_NODE);
        vm.prank(ALICE);
        s.nodes.registerNode(NODE_ID, PROVIDER_ID, ALICE, VPNIds420.NODE_EXIT_RELAY, keccak256("endpoint-v1"), uint64(block.timestamp + 1 hours), bytes32(0));
        vm.prank(ALICE);
        s.nodes.updateNode(NODE_ID, keccak256("endpoint-v2"), uint64(block.timestamp + 2 hours), keccak256("node-meta"));
        VPNNodeRegistry420.Node memory n = s.nodes.getNode(NODE_ID);
        require(n.providerId == PROVIDER_ID, "provider binding");
        require(n.capabilityClass == VPNIds420.NODE_EXIT_RELAY, "capability binding");
    }

    function testOperationalNodeFailsClosedAfterProviderSuspension() public {
        Suite memory s = _deploy();
        _registerAndActivateProvider(s);
        _registerAndActivateNode(s, uint64(block.timestamp + 1 hours));
        require(s.nodes.isOperational(NODE_ID), "initially operational");
        vm.prank(ALICE);
        s.providers.setState(PROVIDER_ID, VPNProviderRegistry420.ProviderState.SUSPENDED);
        require(!s.nodes.isOperational(NODE_ID), "provider suspension must disable operation");
    }

    function testOperationalNodeFailsClosedAfterEndpointExpiry() public {
        Suite memory s = _deploy();
        _registerAndActivateProvider(s);
        uint64 expiry = uint64(block.timestamp + 1 hours);
        _registerAndActivateNode(s, expiry);
        require(s.nodes.isOperational(NODE_ID), "initially operational");
        vm.warp(uint256(expiry));
        require(!s.nodes.isOperational(NODE_ID), "expired endpoint must disable operation");
    }

    function testRetiredProviderCannotReactivate() public {
        Suite memory s = _deploy();
        _registerAndActivateProvider(s);
        vm.prank(ALICE);
        s.providers.setState(PROVIDER_ID, VPNProviderRegistry420.ProviderState.RETIRED);
        vm.prank(ALICE);
        vm.expectRevert(VPNProviderRegistry420.InvalidStateTransition.selector);
        s.providers.setState(PROVIDER_ID, VPNProviderRegistry420.ProviderState.ACTIVE);
    }

    function testRetiredNodeCannotReactivate() public {
        Suite memory s = _deploy();
        _registerAndActivateProvider(s);
        _allowNode(s, ALICE, VPNIds420.ACTION_REGISTER_NODE);
        _allowNode(s, ALICE, VPNIds420.ACTION_SET_NODE_STATUS);
        vm.prank(ALICE);
        s.nodes.registerNode(NODE_ID, PROVIDER_ID, ALICE, VPNIds420.NODE_ENTRY_RELAY, keccak256("endpoint"), uint64(block.timestamp + 1 hours), bytes32(0));
        vm.prank(ALICE);
        s.nodes.setState(NODE_ID, VPNNodeRegistry420.NodeState.RETIRED);
        vm.prank(ALICE);
        vm.expectRevert(VPNNodeRegistry420.InvalidStateTransition.selector);
        s.nodes.setState(NODE_ID, VPNNodeRegistry420.NodeState.ACTIVE);
    }

    function testPolicySemanticIdentityCannotChange() public {
        Suite memory s = _deploy();
        bytes32 policyId = keccak256("vpn/policy/route/basic");
        s.policies.setPolicy(policyId, VPNIds420.POLICY_ROUTE, keccak256("route-v1"), bytes32(0), true);
        vm.expectRevert(VPNPolicyRegistry420.PolicySemanticChange.selector);
        s.policies.setPolicy(policyId, VPNIds420.POLICY_ROUTE, keccak256("route-v2"), bytes32(0), true);
    }
}
