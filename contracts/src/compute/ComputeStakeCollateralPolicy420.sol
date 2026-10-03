// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "../interfaces/IComputeStakeSource420.sol";
import "../interfaces/IComputeVerifierStakeSource420.sol";
import "../system/SystemAccess.sol";

/// @notice Canonical versioned minimum-collateral policy for Compute worker/verifier stake.
/// @dev This contract never custodies funds and never selects collateral sources. It defines immutable
///      per-revision thresholds plus a separate new-acceptance gate. Source binding/integration remains later work.
contract ComputeStakeCollateralPolicy420 is SystemAccess, I420System {
    bytes32 public constant POLICY_DOMAIN =
        keccak256("420Integrated.ComputeMarket.StakeCollateralPolicy.v1");

    struct Policy {
        bool workerRequired;
        uint256 minimumWorkerActiveAmount;
        uint256 minimumWorkerSlashableAmount;
        bool rejectWorkerExiting;
        bool verifierRequired;
        uint256 minimumVerifierActiveAmount;
        uint256 minimumVerifierSlashableAmount;
        bool rejectVerifierExiting;
        uint32 revision;
        bool exists;
    }

    mapping(bytes32 => uint32) public latestRevision;
    mapping(bytes32 => mapping(uint32 => Policy)) private _revisions;
    mapping(bytes32 => bool) public acceptingNew;

    error InvalidPolicy();
    error UnknownPolicy();
    error RevisionOverflow();

    event CollateralPolicyPublished(
        bytes32 indexed stakePolicyId,
        uint32 indexed revision,
        bytes32 indexed commitment
    );
    event NewAcceptanceSet(bytes32 indexed stakePolicyId, bool accepting);

    constructor(address timelock_) SystemAccess(timelock_) {}

    function systemName() external pure returns (string memory) {
        return "ComputeStakeCollateralPolicy420";
    }

    function protocolVersion() external pure returns (uint32) {
        return 1;
    }

    function publish(
        bytes32 stakePolicyId,
        bool workerRequired,
        uint256 minimumWorkerActiveAmount,
        uint256 minimumWorkerSlashableAmount,
        bool rejectWorkerExiting,
        bool verifierRequired,
        uint256 minimumVerifierActiveAmount,
        uint256 minimumVerifierSlashableAmount,
        bool rejectVerifierExiting
    ) external onlyGovernance returns (uint32 revision) {
        if (stakePolicyId == bytes32(0) || (!workerRequired && !verifierRequired)) {
            revert InvalidPolicy();
        }
        _validateRole(workerRequired, minimumWorkerActiveAmount, minimumWorkerSlashableAmount);
        _validateRole(verifierRequired, minimumVerifierActiveAmount, minimumVerifierSlashableAmount);

        uint32 previous = latestRevision[stakePolicyId];
        if (previous == type(uint32).max) revert RevisionOverflow();
        revision = previous + 1;

        _revisions[stakePolicyId][revision] = Policy({
            workerRequired: workerRequired,
            minimumWorkerActiveAmount: minimumWorkerActiveAmount,
            minimumWorkerSlashableAmount: minimumWorkerSlashableAmount,
            rejectWorkerExiting: rejectWorkerExiting,
            verifierRequired: verifierRequired,
            minimumVerifierActiveAmount: minimumVerifierActiveAmount,
            minimumVerifierSlashableAmount: minimumVerifierSlashableAmount,
            rejectVerifierExiting: rejectVerifierExiting,
            revision: revision,
            exists: true
        });
        latestRevision[stakePolicyId] = revision;
        acceptingNew[stakePolicyId] = true;

        emit CollateralPolicyPublished(stakePolicyId, revision, commitment(stakePolicyId, revision));
        emit NewAcceptanceSet(stakePolicyId, true);
    }

    function setNewAcceptance(bytes32 stakePolicyId, bool accepting) external onlyGovernance {
        if (latestRevision[stakePolicyId] == 0) revert UnknownPolicy();
        acceptingNew[stakePolicyId] = accepting;
        emit NewAcceptanceSet(stakePolicyId, accepting);
    }

    function policy(bytes32 stakePolicyId, uint32 revision)
        public
        view
        returns (Policy memory p)
    {
        p = _revisions[stakePolicyId][revision];
        if (!p.exists) revert UnknownPolicy();
    }

    function currentPolicy(bytes32 stakePolicyId) external view returns (Policy memory p) {
        uint32 revision = latestRevision[stakePolicyId];
        if (revision == 0) revert UnknownPolicy();
        return _revisions[stakePolicyId][revision];
    }

    function commitment(bytes32 stakePolicyId, uint32 revision) public view returns (bytes32) {
        Policy memory p = policy(stakePolicyId, revision);
        return keccak256(
            abi.encode(
                POLICY_DOMAIN,
                block.chainid,
                address(this),
                stakePolicyId,
                p.workerRequired,
                p.minimumWorkerActiveAmount,
                p.minimumWorkerSlashableAmount,
                p.rejectWorkerExiting,
                p.verifierRequired,
                p.minimumVerifierActiveAmount,
                p.minimumVerifierSlashableAmount,
                p.rejectVerifierExiting,
                p.revision
            )
        );
    }

    function isCurrentAcceptable(
        bytes32 stakePolicyId,
        uint32 revision,
        bytes32 exactCommitment
    ) external view returns (bool) {
        return acceptingNew[stakePolicyId]
            && revision != 0
            && revision == latestRevision[stakePolicyId]
            && exactCommitment != bytes32(0)
            && exactCommitment == commitment(stakePolicyId, revision);
    }

    function workerPositionPasses(
        bytes32 stakePolicyId,
        uint32 revision,
        IComputeStakeSource420.PositionRead memory position
    ) public view returns (bool) {
        Policy memory p = policy(stakePolicyId, revision);
        if (!p.workerRequired) return true;
        return position.positionId != bytes32(0)
            && position.positionRevision != 0
            && position.active
            && position.activeAmount >= p.minimumWorkerActiveAmount
            && position.slashableAmount >= p.minimumWorkerSlashableAmount
            && (!p.rejectWorkerExiting || !position.exiting);
    }

    function verifierPositionPasses(
        bytes32 stakePolicyId,
        uint32 revision,
        IComputeVerifierStakeSource420.PositionRead memory position
    ) public view returns (bool) {
        Policy memory p = policy(stakePolicyId, revision);
        if (!p.verifierRequired) return true;
        return position.positionId != bytes32(0)
            && position.positionRevision != 0
            && position.authority != address(0)
            && position.verifierRevision != 0
            && position.active
            && position.activeAmount >= p.minimumVerifierActiveAmount
            && position.slashableAmount >= p.minimumVerifierSlashableAmount
            && (!p.rejectVerifierExiting || !position.exiting);
    }

    function _validateRole(
        bool required,
        uint256 minimumActiveAmount,
        uint256 minimumSlashableAmount
    ) private pure {
        if (required) {
            if (
                minimumActiveAmount == 0
                    || minimumSlashableAmount == 0
                    || minimumSlashableAmount > minimumActiveAmount
            ) revert InvalidPolicy();
        } else if (minimumActiveAmount != 0 || minimumSlashableAmount != 0) {
            revert InvalidPolicy();
        }
    }
}
