// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/compute/ComputeStakeSlashDistributionPolicy420.sol";

interface VmSlashDistributionPolicy420 {
    function prank(address caller) external;
}

contract MockRecipientResolverPolicy420 {
    function marker() external pure returns (bytes32) { return keccak256("resolver"); }
}

contract ComputeStakeSlashDistributionPolicy420Test {
    VmSlashDistributionPolicy420 private constant vm =
        VmSlashDistributionPolicy420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address private constant GOV = address(0x420);
    address private constant OUTSIDER = address(0xBAD);
    address private constant TREASURY = address(0x7777);
    bytes32 private constant SLASH_POLICY = keccak256("slash-policy");

    ComputeStakeSlashDistributionPolicy420 private policies;
    MockRecipientResolverPolicy420 private resolver;

    function setUp() public {
        policies = new ComputeStakeSlashDistributionPolicy420(GOV);
        resolver = new MockRecipientResolverPolicy420();
    }

    function testOnlyGovernanceCanPublishAndSharesMustTotalExactly() public {
        vm.prank(OUTSIDER);
        (bool ok,) = address(policies).call(
            abi.encodeCall(
                policies.publish,
                (SLASH_POLICY, address(resolver), TREASURY, 4000, 0, 1000, 5000)
            )
        );
        require(!ok, "outsider published");

        vm.prank(GOV);
        (ok,) = address(policies).call(
            abi.encodeCall(
                policies.publish,
                (SLASH_POLICY, address(resolver), TREASURY, 4000, 0, 1000, 4999)
            )
        );
        require(!ok, "non-100-percent policy accepted");
    }

    function testDynamicRecipientsRequireResolverAndTreasuryShareRequiresTreasury() public {
        vm.prank(GOV);
        (bool ok,) = address(policies).call(
            abi.encodeCall(
                policies.publish,
                (SLASH_POLICY, address(0), TREASURY, 5000, 0, 0, 5000)
            )
        );
        require(!ok, "dynamic route without resolver");

        vm.prank(GOV);
        (ok,) = address(policies).call(
            abi.encodeCall(
                policies.publish,
                (SLASH_POLICY, address(resolver), address(0), 5000, 0, 0, 5000)
            )
        );
        require(!ok, "treasury share without treasury");
    }

    function testTreasuryOnlyPolicyNeedsNoResolver() public {
        vm.prank(GOV);
        uint32 revision = policies.publish(
            SLASH_POLICY, address(0), TREASURY, 0, 0, 0, 10_000
        );
        ComputeStakeSlashDistributionPolicy420.Policy memory p =
            policies.policy(SLASH_POLICY, revision);
        require(
            p.recipientResolver == address(0)
                && p.protocolTreasury == TREASURY
                && p.protocolTreasuryBps == 10_000,
            "treasury policy"
        );
    }

    function testRevisionsAndCommitmentsAreAppendOnly() public {
        vm.prank(GOV);
        uint32 r1 = policies.publish(
            SLASH_POLICY, address(resolver), TREASURY, 4000, 0, 1000, 5000
        );
        bytes32 c1 = policies.commitment(SLASH_POLICY, r1);

        vm.prank(GOV);
        uint32 r2 = policies.publish(
            SLASH_POLICY, address(resolver), TREASURY, 2500, 2500, 0, 5000
        );
        bytes32 c2 = policies.commitment(SLASH_POLICY, r2);

        require(r1 == 1 && r2 == 2 && c1 != c2, "revision history");
        ComputeStakeSlashDistributionPolicy420.Policy memory p1 =
            policies.policy(SLASH_POLICY, r1);
        require(
            p1.harmedPayerBps == 4000
                && p1.challengerBps == 1000
                && p1.protocolTreasuryBps == 5000,
            "old revision rewritten"
        );
        require(policies.commitment(SLASH_POLICY, r1) == c1, "old commitment changed");
    }
}
