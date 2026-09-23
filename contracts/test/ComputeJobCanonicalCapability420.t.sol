// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/system/CapabilityRegistry420.sol";
import "../src/compute/ComputeAuthorization420.sol";

interface VmCanonicalCompute420 {
    function prank(address caller) external;
    function warp(uint256 timestamp) external;
}

/// @notice Exercises the actual shared CapabilityRegistry, not a map-based
/// authorization fixture. Deployment registrar/authority configuration still
/// requires checking the target chain's governance and component registrations.
contract ComputeJobCanonicalCapability420Test {
    VmCanonicalCompute420 private constant vm = VmCanonicalCompute420(
        address(uint160(uint256(keccak256("hevm cheat code")))));
    address private constant OPERATOR = address(0xC0FFEE);
    address private constant OUTSIDER = address(0xBAD);
    address private constant UNAUTHORIZED_ISSUER = address(0xBAD1);
    CapabilityRegistry420 private registry;
    ComputeAuthorization420 private auth;

    function setUp() public {
        registry = new CapabilityRegistry420();
        auth = new ComputeAuthorization420(address(registry));
        registry.registerProtocolComponent(auth.COMPONENT_COMPUTE(), address(this));
    }

    function _grant(bytes32 jobId, bytes32 action, uint256 nonce, uint64 expires)
        private returns (bytes32 grantId) {
        grantId = keccak256(abi.encode(jobId, action, nonce));
        registry.createGrant(grantId, OPERATOR, auth.COMPONENT_COMPUTE(), action,
            auth.scopeJob(jobId), 0, 0, 0, uint64(block.timestamp), expires);
    }

    function testCanonicalRegistrarJobScopedGrantsAndRevocation() public {
        bytes32 jobId = keccak256("signed-paid-job");
        bytes32 anotherJob = keccak256("unfunded-job");
        bytes32 acceptance = auth.ACTION_ACCEPT_MATCH();
        bytes32 execute = auth.ACTION_EXECUTE_ATTEMPT();
        bytes32 receipt = auth.ACTION_SUBMIT_RECEIPT();
        require(!auth.isAuthorized(OPERATOR, acceptance, auth.scopeJob(jobId), 0),
            "operator authorized before grant");
        bytes32 a = _grant(jobId, acceptance, 1, uint64(block.timestamp + 100));
        bytes32 e = _grant(jobId, execute, 2, uint64(block.timestamp + 100));
        bytes32 r = _grant(jobId, receipt, 3, uint64(block.timestamp + 100));
        require(auth.isAuthorized(OPERATOR, acceptance, auth.scopeJob(jobId), 0)
            && auth.isAuthorized(OPERATOR, execute, auth.scopeJob(jobId), 0)
            && auth.isAuthorized(OPERATOR, receipt, auth.scopeJob(jobId), 0),
            "canonical component grants ignored");
        require(!auth.isAuthorized(OPERATOR, acceptance, auth.scopeJob(anotherJob), 0)
            && !auth.isAuthorized(OUTSIDER, execute, auth.scopeJob(jobId), 0)
            && !auth.isAuthorized(OPERATOR, auth.ACTION_SETTLE(), auth.scopeJob(jobId), 0),
            "principal/job/action scope leaked");
        registry.revokeGrant(e);
        require(!auth.isAuthorized(OPERATOR, execute, auth.scopeJob(jobId), 0)
            && auth.isAuthorized(OPERATOR, acceptance, auth.scopeJob(jobId), 0)
            && auth.isAuthorized(OPERATOR, receipt, auth.scopeJob(jobId), 0),
            "revocation affected wrong grant");
        registry.revokeGrant(a);
        registry.revokeGrant(r);
        require(!auth.isAuthorized(OPERATOR, acceptance, auth.scopeJob(jobId), 0)
            && !auth.isAuthorized(OPERATOR, receipt, auth.scopeJob(jobId), 0),
            "revoked grants still authorize");
    }

    function testUnregisteredComponentUnauthorizedIssuerAndExpiry() public {
        bytes32 jobId = keccak256("bounded-job");
        bytes32 action = auth.ACTION_ACCEPT_MATCH();
        bytes32 component = auth.COMPONENT_COMPUTE();
        bytes32 scope = auth.scopeJob(jobId);
        bytes32 grantId = _grant(jobId, action, 4, uint64(block.timestamp + 10));
        vm.prank(UNAUTHORIZED_ISSUER);
        (bool ok,) = address(registry).call(abi.encodeCall(registry.revokeGrant, (grantId)));
        require(!ok, "foreign issuer revoked grant");
        // Resolve all external getters before vm.prank: an external getter inside
        // abi.encodeCall arguments would consume the one-shot spoofed caller.
        vm.prank(UNAUTHORIZED_ISSUER);
        (ok,) = address(registry).call(abi.encodeCall(registry.createGrant,
            (keccak256("foreign-grant"), OPERATOR, component, action,
             scope, uint256(0), uint256(0), uint64(0), uint64(block.timestamp),
             uint64(block.timestamp + 10))));
        require(!ok, "foreign issuer granted compute permission");
        vm.warp(block.timestamp + 11);
        require(!auth.isAuthorized(OPERATOR, action, scope, 0),
            "expired canonical grant authorized");
    }
}
