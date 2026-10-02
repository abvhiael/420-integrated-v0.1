// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "../system/SystemAccess.sol";

/// @notice Append-only withdrawal-delay policy for CMP-1.5 collateral exits.
/// @dev Exit requests snapshot an exact revision/commitment so later governance changes
///      cannot accelerate or extend an already-requested withdrawal.
contract ComputeStakeExitPolicy420 is SystemAccess, I420System {
    bytes32 public constant POLICY_DOMAIN =
        keccak256("420Integrated.ComputeMarket.StakeExitPolicy.v1");

    struct Policy {
        uint64 withdrawalDelaySeconds;
        uint32 revision;
        bool exists;
    }

    mapping(bytes32 => uint32) public latestRevision;
    mapping(bytes32 => mapping(uint32 => Policy)) private _revisions;

    error InvalidPolicy();
    error UnknownPolicy();
    error RevisionOverflow();

    event ExitPolicyPublished(
        bytes32 indexed stakePolicyId,
        uint32 indexed revision,
        uint64 withdrawalDelaySeconds,
        bytes32 commitment
    );

    constructor(address timelock_) SystemAccess(timelock_) {}

    function systemName() external pure returns (string memory) {
        return "ComputeStakeExitPolicy420";
    }

    function protocolVersion() external pure returns (uint32) {
        return 1;
    }

    function publish(bytes32 stakePolicyId, uint64 withdrawalDelaySeconds)
        external
        onlyGovernance
        returns (uint32 revision)
    {
        if (stakePolicyId == bytes32(0) || withdrawalDelaySeconds == 0) {
            revert InvalidPolicy();
        }
        uint32 previous = latestRevision[stakePolicyId];
        if (previous == type(uint32).max) revert RevisionOverflow();

        revision = previous + 1;
        _revisions[stakePolicyId][revision] = Policy({
            withdrawalDelaySeconds: withdrawalDelaySeconds,
            revision: revision,
            exists: true
        });
        latestRevision[stakePolicyId] = revision;

        emit ExitPolicyPublished(
            stakePolicyId,
            revision,
            withdrawalDelaySeconds,
            commitment(stakePolicyId, revision)
        );
    }

    function policy(bytes32 stakePolicyId, uint32 revision)
        public
        view
        returns (Policy memory p)
    {
        p = _revisions[stakePolicyId][revision];
        if (!p.exists) revert UnknownPolicy();
    }

    function currentPolicy(bytes32 stakePolicyId)
        external
        view
        returns (Policy memory p, bytes32 exactCommitment)
    {
        uint32 revision = latestRevision[stakePolicyId];
        if (revision == 0) revert UnknownPolicy();
        p = _revisions[stakePolicyId][revision];
        exactCommitment = commitment(stakePolicyId, revision);
    }

    function commitment(bytes32 stakePolicyId, uint32 revision)
        public
        view
        returns (bytes32)
    {
        Policy memory p = policy(stakePolicyId, revision);
        return keccak256(
            abi.encode(
                POLICY_DOMAIN,
                block.chainid,
                address(this),
                stakePolicyId,
                p.withdrawalDelaySeconds,
                p.revision
            )
        );
    }
}
