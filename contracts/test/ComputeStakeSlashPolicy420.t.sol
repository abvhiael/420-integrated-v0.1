// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/compute/ComputeStakeSlashPolicy420.sol";

interface VmComputeStakeSlashPolicy420 {
    function prank(address caller) external;
}

contract DummySlashEvidenceAdapter420 {}

contract ComputeStakeSlashPolicy420Test {
    VmComputeStakeSlashPolicy420 private constant vm =
        VmComputeStakeSlashPolicy420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address private constant GOV = address(0x420);
    address private constant OUTSIDER = address(0xBAD);
    bytes32 private constant STAKE_POLICY = keccak256("stake-policy");
    bytes32 private constant VIOLATION = keccak256("violation");

    ComputeStakeSlashPolicy420 private policies;
    DummySlashEvidenceAdapter420 private adapter;

    function setUp() public {
        policies = new ComputeStakeSlashPolicy420(GOV);
        adapter = new DummySlashEvidenceAdapter420();
    }

    function testOnlyGovernanceCanPublishAndPolicyMustBeWellFormed() public {
        vm.prank(OUTSIDER);
        (bool ok,) = address(policies).call(
            abi.encodeCall(
                policies.publish,
                (STAKE_POLICY, uint8(1), address(adapter), VIOLATION, bytes32(0), uint32(0), bytes32(0), uint16(1000), uint256(0))
            )
        );
        require(!ok, "outsider published");

        vm.prank(GOV);
        (ok,) = address(policies).call(
            abi.encodeCall(
                policies.publish,
                (STAKE_POLICY, uint8(1), address(adapter), VIOLATION, bytes32(0), uint32(0), bytes32(0), uint16(0), uint256(0))
            )
        );
        require(!ok, "zero bps accepted");

        vm.prank(GOV);
        (ok,) = address(policies).call(
            abi.encodeCall(
                policies.publish,
                (STAKE_POLICY, uint8(3), address(adapter), VIOLATION, bytes32(0), uint32(0), bytes32(0), uint16(1000), uint256(0))
            )
        );
        require(!ok, "unknown subject accepted");

        vm.prank(GOV);
        (ok,) = address(policies).call(
            abi.encodeCall(
                policies.publish,
                (STAKE_POLICY, uint8(1), address(adapter), VIOLATION, keccak256("verify"), uint32(0), bytes32(0), uint16(1000), uint256(0))
            )
        );
        require(!ok, "partial verification tuple accepted");
    }

    function testRevisionsAndCommitmentsAreAppendOnly() public {
        vm.prank(GOV);
        uint32 r1 = policies.publish(
            STAKE_POLICY, 1, address(adapter), VIOLATION,
            bytes32(0), 0, bytes32(0), 1000, 5 ether
        );
        bytes32 c1 = policies.commitment(STAKE_POLICY, 1, r1);

        vm.prank(GOV);
        uint32 r2 = policies.publish(
            STAKE_POLICY, 1, address(adapter), VIOLATION,
            bytes32(0), 0, bytes32(0), 2500, 10 ether
        );
        bytes32 c2 = policies.commitment(STAKE_POLICY, 1, r2);

        require(r1 == 1 && r2 == 2, "revision sequence");
        require(c1 != c2, "commitment unchanged");
        require(policies.policy(STAKE_POLICY, 1, r1).slashBps == 1000, "r1 rewritten");
        require(policies.policy(STAKE_POLICY, 1, r2).slashBps == 2500, "r2 wrong");
        require(policies.commitment(STAKE_POLICY, 1, r1) == c1, "historical commitment changed");
    }

    function testPolicyFreezesEvidenceAdapterCodeHash() public {
        vm.prank(GOV);
        uint32 revision = policies.publish(
            STAKE_POLICY, 2, address(adapter), VIOLATION,
            keccak256("verify-policy"), 4, keccak256("verify-commitment"),
            5000, 0
        );
        ComputeStakeSlashPolicy420.Policy memory p = policies.policy(STAKE_POLICY, 2, revision);
        require(p.evidenceAdapter == address(adapter), "adapter");
        require(p.evidenceAdapterCodeHash == address(adapter).codehash, "code hash");
        require(p.requiredVerificationPolicyRevision == 4, "verification revision");
    }
}
