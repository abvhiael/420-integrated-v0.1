// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/compute/ComputeVerifierIndependencePolicy420.sol";

interface VmVerifierPolicy420 {
    function prank(address caller) external;
    function warp(uint256 timestamp) external;
}

contract ComputeVerifierIndependencePolicy420Test {
    VmVerifierPolicy420 private constant vm = VmVerifierPolicy420(address(uint160(uint256(keccak256("hevm cheat code")))));
    address private constant GOVERNANCE = address(0x100);
    address private constant ATTESTOR = address(0x101);
    address private constant SELECTOR = address(0x102);
    address private constant OWNER = address(0x201);
    address private constant PAYER = address(0x202);
    address private constant OPERATOR = address(0x203);
    address private constant VERIFIER = address(0x204);
    address private constant VERIFIER_ALIAS = address(0x205);
    address private constant OUTSIDER = address(0x206);
    bytes32 private constant JOB = keccak256("job");
    bytes32 private constant PROFILE = keccak256("profile");
    ComputeVerifierIndependencePolicy420 private policy;

    function setUp() public {
        policy = new ComputeVerifierIndependencePolicy420(GOVERNANCE, ATTESTOR, SELECTOR);
        _attest(OWNER, keccak256("owner-control"), 1);
        _attest(PAYER, keccak256("payer-control"), 2);
        _attest(OPERATOR, keccak256("operator-control"), 3);
        _attest(VERIFIER, keccak256("independent-control"), 4);
        _attest(VERIFIER_ALIAS, keccak256("owner-control"), 5);
    }

    function _attest(address who, bytes32 controller, uint256 index) private {
        vm.prank(ATTESTOR);
        policy.attest(who, controller, keccak256(abi.encode("attestor-evidence", index)), uint64(block.timestamp + 1 days));
    }
    function _appoint(bytes32 jobId, address selected, uint64 until) private returns (bool) {
        vm.prank(SELECTOR);
        (bool ok,) = address(policy).call(abi.encodeCall(policy.appoint,
            (jobId, selected, PROFILE, OWNER, PAYER, OPERATOR,
             keccak256("reviewed-conflicts-and-selection"), until)));
        return ok;
    }
    function _eligible(bytes32 jobId, address selected) private view returns (bool) {
        return policy.eligible(jobId, selected, PROFILE, OWNER, PAYER, OPERATOR);
    }
    function testIndependentAppointmentRequiresDistinctAttestedControllers() public {
        require(_appoint(JOB, VERIFIER, uint64(block.timestamp + 100)), "independent appointment rejected");
        require(_eligible(JOB, VERIFIER), "appointed verifier not eligible");
        require(!_eligible(JOB, VERIFIER_ALIAS) && !_eligible(JOB, OWNER), "different signer bypassed appointment");
        require(!_appoint(keccak256("alias-job"), VERIFIER_ALIAS, uint64(block.timestamp + 100)),
            "owner-controlled alias approved");
        require(!_appoint(keccak256("unknown-job"), OUTSIDER, uint64(block.timestamp + 100)),
            "unattested verifier approved");
    }
    function testOnlyDesignatedAuthoritiesCanAttestSelectAndRevoke() public {
        vm.prank(OUTSIDER);
        (bool ok,) = address(policy).call(abi.encodeCall(policy.attest,
            (OUTSIDER, keccak256("forged-controller"), keccak256("forged-evidence"), uint64(block.timestamp + 100))));
        require(!ok, "unauthorized attest accepted");
        vm.prank(OUTSIDER);
        (ok,) = address(policy).call(abi.encodeCall(policy.appoint,
            (JOB, VERIFIER, PROFILE, OWNER, PAYER, OPERATOR, keccak256("forged-review"), uint64(block.timestamp + 100))));
        require(!ok, "unauthorized selection accepted");
        require(_appoint(JOB, VERIFIER, uint64(block.timestamp + 100)), "appointment failed");
        vm.prank(OUTSIDER);
        (ok,) = address(policy).call(abi.encodeCall(policy.revokeAppointment, (JOB)));
        require(!ok && _eligible(JOB, VERIFIER), "unauthorized revocation accepted");
        vm.prank(SELECTOR);
        policy.revokeAppointment(JOB);
        require(!_eligible(JOB, VERIFIER), "revoked appointment eligible");
    }
    function testRevocationExpirationAndControllerDriftFailClosed() public {
        require(_appoint(JOB, VERIFIER, uint64(block.timestamp + 100)), "appointment failed");
        vm.prank(ATTESTOR);
        policy.withdraw(VERIFIER);
        require(!_eligible(JOB, VERIFIER), "withdrawn identity eligible");
        _attest(VERIFIER, keccak256("owner-control"), 6);
        require(!_eligible(JOB, VERIFIER), "changed controller accepted under stale appointment");
        _attest(VERIFIER, keccak256("independent-control"), 7);
        require(_eligible(JOB, VERIFIER), "restored verified identity failed");
        vm.warp(block.timestamp + 101);
        require(!_eligible(JOB, VERIFIER), "expired appointment eligible");
    }
    function testGovernanceSuspendAndRotateAuthoritiesInvalidatesAppointment() public {
        require(_appoint(JOB, VERIFIER, uint64(block.timestamp + 100)), "appointment failed");
        vm.prank(GOVERNANCE);
        policy.suspendAccount(VERIFIER, true);
        require(!_eligible(JOB, VERIFIER), "suspended verifier eligible");
        vm.prank(GOVERNANCE);
        policy.suspendAccount(VERIFIER, false);
        require(_eligible(JOB, VERIFIER), "unsuspended verifier not eligible");
        vm.prank(GOVERNANCE);
        policy.setAuthorities(address(0x303), address(0x304));
        require(!_eligible(JOB, VERIFIER), "old appointment survived authority rotation");
        require(!_appoint(keccak256("new-job"), VERIFIER, uint64(block.timestamp + 100)),
            "old selector retained appointment privilege");
    }
}
