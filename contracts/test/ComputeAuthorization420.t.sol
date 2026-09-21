// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/compute/ComputeAuthorization420.sol";
import "../src/system/CapabilityRegistry420.sol";

interface VmComputeAuthorization420 {
    function warp(uint256) external;
    function prank(address) external;
    function expectRevert(bytes4) external;
}

contract ComputeAuthorization420Test {
    VmComputeAuthorization420 private constant vm = VmComputeAuthorization420(address(uint160(uint256(keccak256("hevm cheat code")))));
    address private constant PAYER = address(0xA11CE);
    address private constant PROVIDER = address(0xB0B);
    bytes32 private constant REQUEST_A = bytes32(uint256(11));
    bytes32 private constant REQUEST_B = bytes32(uint256(12));
    bytes32 private constant PROVIDER_A = bytes32(uint256(21));
    bytes32 private constant PROVIDER_B = bytes32(uint256(22));

    CapabilityRegistry420 private registry;
    ComputeAuthorization420 private authorization;

    function setUp() public {
        vm.warp(1_000);
        registry = new CapabilityRegistry420();
        authorization = new ComputeAuthorization420(address(registry));
        registry.registerProtocolComponent(authorization.COMPONENT_COMPUTE(), address(this));
    }

    function _grant(bytes32 id, address principal, bytes32 action, bytes32 scope, uint256 limit, uint64 until) private {
        registry.createGrant(id, principal, authorization.COMPONENT_COMPUTE(), action, scope, limit, 0, 0, 900, until);
    }

    function testPayerFundingGrantIsObjectActionAndAmountBound() public {
        bytes32 scope = authorization.scopeRequest(REQUEST_A);
        _grant(bytes32(uint256(1)), PAYER, authorization.ACTION_AUTHORIZE_FUNDING(), scope, 50, 2_000);
        require(authorization.isAuthorized(PAYER, authorization.ACTION_AUTHORIZE_FUNDING(), scope, 50), "valid payer rejected");
        require(!authorization.isAuthorized(PAYER, authorization.ACTION_AUTHORIZE_FUNDING(), scope, 51), "excess spend");
        require(!authorization.isAuthorized(PAYER, authorization.ACTION_AUTHORIZE_FUNDING(), authorization.scopeRequest(REQUEST_B), 1), "cross request");
        require(!authorization.isAuthorized(PROVIDER, authorization.ACTION_AUTHORIZE_FUNDING(), scope, 1), "provider used payer grant");
        require(!authorization.isAuthorized(PAYER, authorization.ACTION_SETTLE(), scope, 1), "action confused");
        vm.warp(2_001);
        require(!authorization.isAuthorized(PAYER, authorization.ACTION_AUTHORIZE_FUNDING(), scope, 1), "expired grant");
    }

    function testRevocationAndProviderSeparation() public {
        bytes32 scope = authorization.scopeProvider(PROVIDER_A);
        bytes32 id = bytes32(uint256(2));
        _grant(id, PROVIDER, authorization.ACTION_REGISTER_PROVIDER(), scope, 0, 2_000);
        require(authorization.isAuthorized(PROVIDER, authorization.ACTION_REGISTER_PROVIDER(), scope, 0), "grant missing");
        require(!authorization.isAuthorized(PROVIDER, authorization.ACTION_REGISTER_PROVIDER(), authorization.scopeProvider(PROVIDER_B), 0), "cross provider");
        require(!authorization.isAuthorized(PAYER, authorization.ACTION_REGISTER_PROVIDER(), scope, 0), "cross principal");
        registry.revokeGrant(id);
        require(!authorization.isAuthorized(PROVIDER, authorization.ACTION_REGISTER_PROVIDER(), scope, 0), "revoked grant");
    }

    function testScopeKindAndParentageAreSeparated() public {
        bytes32 nodeId = bytes32(uint256(31));
        bytes32 resourceId = bytes32(uint256(41));
        bytes32 a = authorization.scopeNode(PROVIDER_A, nodeId);
        bytes32 b = authorization.scopeNode(PROVIDER_B, nodeId);
        bytes32 c = authorization.scopeResource(PROVIDER_A, nodeId, resourceId);
        require(a != b && a != c && b != c, "scope collision");
        require(a != authorization.scopeProvider(PROVIDER_A), "kind collision");
        vm.expectRevert(ComputeAuthorization420.InvalidScope.selector);
        authorization.scopeNode(PROVIDER_A, bytes32(0));
        vm.expectRevert(ComputeAuthorization420.InvalidScope.selector);
        authorization.scopeAttempt(bytes32(uint256(1)), bytes32(uint256(2)), bytes32(0));
    }

    function testUnknownActionAndMissingGrantFailClosed() public {
        bytes32 scope = authorization.scopeRequest(REQUEST_A);
        require(!authorization.isAuthorized(PAYER, bytes32(uint256(999)), scope, 0), "unknown action");
        require(!authorization.isAuthorized(PAYER, authorization.ACTION_CREATE_REQUEST(), scope, 0), "ungranted actor");
        vm.expectRevert(ComputeAuthorization420.UnknownAction.selector);
        authorization.requireAuthorized(PAYER, bytes32(uint256(999)), scope, 0);
        vm.expectRevert(ComputeAuthorization420.Unauthorized.selector);
        authorization.requireAuthorized(PAYER, authorization.ACTION_CREATE_REQUEST(), scope, 0);
    }

    function testUnrelatedComponentNeverAuthorizesCompute() public {
        bytes32 scope = authorization.scopeRequest(REQUEST_A);
        registry.registerProtocolComponent(keccak256("unrelated"), address(this));
        registry.createGrant(bytes32(uint256(3)), PAYER, keccak256("unrelated"),
            authorization.ACTION_AUTHORIZE_FUNDING(), scope, 100, 0, 0, 900, 2_000);
        require(!authorization.isAuthorized(PAYER, authorization.ACTION_AUTHORIZE_FUNDING(), scope, 1), "component leakage");
    }
}
