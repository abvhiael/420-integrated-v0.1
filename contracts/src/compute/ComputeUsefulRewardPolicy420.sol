// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "../system/SystemAccess.sol";

/// @notice CMP-6.7 append-only policy for converting one frozen contribution metric into
///         transparent native-$420 reward-accounting units.
/// @dev Policy publication has no Vault, transfer, obligation, claim, mint or settlement authority.
contract ComputeUsefulRewardPolicy420 is SystemAccess, I420System {
    bytes32 public constant POLICY_DOMAIN =
        keccak256("420Integrated.ComputeMarket.UsefulRewardPolicy.v1");

    struct Policy {
        bytes32 policyId;
        bytes32 poolId;
        bytes32 metricId;
        uint256 numerator;
        uint256 denominator;
        uint256 perContributionCap;
        uint64 publishedAt;
        uint32 revision;
        bool exists;
    }

    mapping(bytes32 => uint32) public latestRevision;
    mapping(bytes32 => mapping(uint32 => Policy)) private _policies;

    error InvalidPolicy();
    error UnknownPolicy();
    error RevisionOverflow();

    event UsefulRewardPolicyPublished(
        bytes32 indexed policyId,
        uint32 indexed revision,
        bytes32 indexed poolId,
        bytes32 metricId,
        uint256 numerator,
        uint256 denominator,
        uint256 perContributionCap,
        bytes32 commitment
    );

    constructor(address timelock_) SystemAccess(timelock_) {}

    function systemName() external pure returns (string memory) {
        return "ComputeUsefulRewardPolicy420";
    }

    function protocolVersion() external pure returns (uint32) {
        return 1;
    }

    function publish(
        bytes32 policyId,
        bytes32 poolId,
        bytes32 metricId,
        uint256 numerator,
        uint256 denominator,
        uint256 perContributionCap
    ) external onlyGovernance returns (uint32 revision) {
        if (
            policyId == bytes32(0)
                || poolId == bytes32(0)
                || metricId == bytes32(0)
                || numerator == 0
                || denominator == 0
                || perContributionCap == 0
        ) revert InvalidPolicy();

        uint32 previous = latestRevision[policyId];
        if (previous == type(uint32).max) revert RevisionOverflow();
        revision = previous + 1;

        _policies[policyId][revision] = Policy({
            policyId: policyId,
            poolId: poolId,
            metricId: metricId,
            numerator: numerator,
            denominator: denominator,
            perContributionCap: perContributionCap,
            publishedAt: uint64(block.timestamp),
            revision: revision,
            exists: true
        });
        latestRevision[policyId] = revision;

        emit UsefulRewardPolicyPublished(
            policyId,
            revision,
            poolId,
            metricId,
            numerator,
            denominator,
            perContributionCap,
            commitment(policyId, revision)
        );
    }

    function policy(bytes32 policyId, uint32 revision)
        public
        view
        returns (Policy memory p)
    {
        p = _policies[policyId][revision];
        if (!p.exists) revert UnknownPolicy();
    }

    function commitment(bytes32 policyId, uint32 revision)
        public
        view
        returns (bytes32)
    {
        Policy memory p = policy(policyId, revision);
        return keccak256(
            abi.encode(
                POLICY_DOMAIN,
                block.chainid,
                address(this),
                p.policyId,
                p.poolId,
                p.metricId,
                p.numerator,
                p.denominator,
                p.perContributionCap,
                p.publishedAt,
                p.revision
            )
        );
    }
}
