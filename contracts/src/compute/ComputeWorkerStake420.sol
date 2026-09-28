// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "../interfaces/IComputeStakeSource420.sol";
import "../system/SystemAccess.sol";
import "./ComputeWorkerRegistry420.sol";

/// @notice Fail-closed worker admission adapter for the future CMP-1.5 ComputeStake authority.
/// @dev This contract never custodies stake and never copies a mutable balance as an independent authority.
contract ComputeWorkerStake420 is SystemAccess, I420System {
    bytes32 public constant EXPECTED_SOURCE_ID =
        keccak256("420Integrated.ComputeMarket.ComputeStakeSource.v1");
    bytes32 public constant REFERENCE_DOMAIN_V1 =
        keccak256("420Integrated.ComputeMarket.WorkerStakeReference.v1");

    struct SourceBinding {
        address source;
        uint32 revision;
        bool active;
        bool exists;
    }

    struct StakePolicy {
        uint256 minimumActiveAmount;
        uint256 minimumSlashableAmount;
        bool rejectExiting;
        uint32 revision;
        bool acceptingNew;
        bool exists;
    }

    struct StakeReference {
        bytes32 workerId;
        uint64 workerRevision;
        bytes32 stakePolicyId;
        uint32 stakePolicyRevision;
        uint32 sourceBindingRevision;
        address source;
        bytes32 positionId;
        uint64 positionRevision;
        uint256 activeAmount;
        uint256 slashableAmount;
        bool exiting;
        bytes32 snapshotCommitment;
        uint64 capturedAt;
        bool exists;
    }

    ComputeWorkerRegistry420 public immutable workers;

    uint32 public latestSourceBindingRevision;
    uint64 public nextReferenceSerial;

    mapping(uint32 => SourceBinding) private _sourceBindings;
    mapping(bytes32 => uint32) public latestStakePolicyRevision;
    mapping(bytes32 => mapping(uint32 => StakePolicy)) private _stakePolicies;
    mapping(bytes32 => StakeReference) private _references;

    error InvalidConfiguration();
    error InvalidSource();
    error UnknownSourceBinding();
    error InvalidPolicy();
    error UnknownPolicy();
    error UnauthorizedOperator();
    error InvalidReference();
    error UnknownReference();
    error SerialExhausted();

    event ComputeStakeSourceBound(uint32 indexed revision, address indexed source, bool active);
    event StakePolicyPublished(
        bytes32 indexed stakePolicyId,
        uint32 indexed revision,
        uint256 minimumActiveAmount,
        uint256 minimumSlashableAmount,
        bool rejectExiting
    );
    event StakePolicyAcceptanceSet(bytes32 indexed stakePolicyId, bool acceptingNew);
    event StakeReferenceCaptured(
        bytes32 indexed referenceId,
        bytes32 indexed workerId,
        uint64 indexed workerRevision,
        bytes32 stakePolicyId,
        uint32 stakePolicyRevision,
        uint32 sourceBindingRevision,
        bytes32 positionId,
        uint64 positionRevision
    );

    constructor(address workerRegistry_, address timelock_) SystemAccess(timelock_) {
        if (workerRegistry_ == address(0) || workerRegistry_.code.length == 0) {
            revert InvalidConfiguration();
        }
        workers = ComputeWorkerRegistry420(workerRegistry_);
    }

    function systemName() external pure returns (string memory) {
        return "ComputeWorkerStake420";
    }

    function protocolVersion() external pure returns (uint32) {
        return 1;
    }

    function sourceBinding(uint32 revision) public view returns (SourceBinding memory b) {
        b = _sourceBindings[revision];
        if (!b.exists) revert UnknownSourceBinding();
    }

    function currentSourceBinding() public view returns (SourceBinding memory b) {
        uint32 revision = latestSourceBindingRevision;
        if (revision == 0) revert UnknownSourceBinding();
        b = _sourceBindings[revision];
    }

    /// @notice Binds a source only if it positively identifies as the CMP-1.5 compute-stake interface.
    /// @dev The initial unbound state intentionally makes every stake-required admission fail closed.
    function bindSource(address source, bool active) external onlyGovernance returns (uint32 revision) {
        if (source == address(0) || source.code.length == 0) revert InvalidSource();

        try IComputeStakeSource420(source).computeStakeSourceId() returns (bytes32 sourceId) {
            if (sourceId != EXPECTED_SOURCE_ID) revert InvalidSource();
        } catch {
            revert InvalidSource();
        }

        uint32 previous = latestSourceBindingRevision;
        if (previous == type(uint32).max) revert InvalidSource();
        revision = previous + 1;
        _sourceBindings[revision] = SourceBinding({
            source: source,
            revision: revision,
            active: active,
            exists: true
        });
        latestSourceBindingRevision = revision;
        emit ComputeStakeSourceBound(revision, source, active);
    }

    function publishPolicy(
        bytes32 stakePolicyId,
        uint256 minimumActiveAmount,
        uint256 minimumSlashableAmount,
        bool rejectExiting
    ) external onlyGovernance returns (uint32 revision) {
        if (
            stakePolicyId == bytes32(0)
                || minimumActiveAmount == 0
                || minimumSlashableAmount == 0
                || minimumSlashableAmount > minimumActiveAmount
        ) revert InvalidPolicy();

        uint32 previous = latestStakePolicyRevision[stakePolicyId];
        if (previous == type(uint32).max) revert InvalidPolicy();
        revision = previous + 1;

        _stakePolicies[stakePolicyId][revision] = StakePolicy({
            minimumActiveAmount: minimumActiveAmount,
            minimumSlashableAmount: minimumSlashableAmount,
            rejectExiting: rejectExiting,
            revision: revision,
            acceptingNew: true,
            exists: true
        });
        latestStakePolicyRevision[stakePolicyId] = revision;

        emit StakePolicyPublished(
            stakePolicyId,
            revision,
            minimumActiveAmount,
            minimumSlashableAmount,
            rejectExiting
        );
        emit StakePolicyAcceptanceSet(stakePolicyId, true);
    }

    function setPolicyAcceptance(bytes32 stakePolicyId, bool acceptingNew) external onlyGovernance {
        uint32 revision = latestStakePolicyRevision[stakePolicyId];
        if (revision == 0) revert UnknownPolicy();
        _stakePolicies[stakePolicyId][revision].acceptingNew = acceptingNew;
        emit StakePolicyAcceptanceSet(stakePolicyId, acceptingNew);
    }

    function stakePolicy(bytes32 stakePolicyId, uint32 revision)
        public
        view
        returns (StakePolicy memory p)
    {
        p = _stakePolicies[stakePolicyId][revision];
        if (!p.exists) revert UnknownPolicy();
    }

    function stakeReference(bytes32 referenceId) external view returns (StakeReference memory r) {
        r = _references[referenceId];
        if (!r.exists) revert UnknownReference();
    }

    function readLivePosition(bytes32 workerId, bytes32 stakePolicyId)
        public
        view
        returns (IComputeStakeSource420.PositionRead memory out)
    {
        SourceBinding memory b = currentSourceBinding();
        out = IComputeStakeSource420(b.source).readWorkerPosition(workerId, stakePolicyId);
    }

    function positionPasses(
        IComputeStakeSource420.PositionRead memory position,
        StakePolicy memory p
    ) public pure returns (bool) {
        return position.positionId != bytes32(0)
            && position.positionRevision != 0
            && position.active
            && position.activeAmount >= p.minimumActiveAmount
            && position.slashableAmount >= p.minimumSlashableAmount
            && (!p.rejectExiting || !position.exiting);
    }

    function captureReference(bytes32 workerId, uint64 workerRevision, bytes32 stakePolicyId)
        external
        returns (bytes32 referenceId)
    {
        ComputeWorkerRegistry420.Worker memory w = workers.revision(workerId, workerRevision);
        if (msg.sender != w.operator) revert UnauthorizedOperator();

        uint32 policyRevision = latestStakePolicyRevision[stakePolicyId];
        if (policyRevision == 0) revert UnknownPolicy();
        StakePolicy memory p = _stakePolicies[stakePolicyId][policyRevision];
        if (!p.acceptingNew) revert InvalidPolicy();

        uint32 bindingRevision = latestSourceBindingRevision;
        if (bindingRevision == 0) revert InvalidSource();
        SourceBinding memory b = _sourceBindings[bindingRevision];
        if (!b.active) revert InvalidSource();

        IComputeStakeSource420.PositionRead memory position =
            IComputeStakeSource420(b.source).readWorkerPosition(workerId, stakePolicyId);
        if (!positionPasses(position, p)) revert InvalidReference();

        if (nextReferenceSerial == type(uint64).max) revert SerialExhausted();
        uint64 serial = nextReferenceSerial + 1;

        bytes32 snapshotCommitment = keccak256(
            abi.encode(
                REFERENCE_DOMAIN_V1,
                block.chainid,
                address(this),
                workerId,
                workerRevision,
                stakePolicyId,
                policyRevision,
                bindingRevision,
                b.source,
                position.positionId,
                position.positionRevision,
                position.activeAmount,
                position.slashableAmount,
                position.active,
                position.exiting,
                position.withdrawableAt
            )
        );

        referenceId = keccak256(
            abi.encode(
                REFERENCE_DOMAIN_V1,
                block.chainid,
                address(this),
                serial,
                snapshotCommitment
            )
        );
        nextReferenceSerial = serial;

        _references[referenceId] = StakeReference({
            workerId: workerId,
            workerRevision: workerRevision,
            stakePolicyId: stakePolicyId,
            stakePolicyRevision: policyRevision,
            sourceBindingRevision: bindingRevision,
            source: b.source,
            positionId: position.positionId,
            positionRevision: position.positionRevision,
            activeAmount: position.activeAmount,
            slashableAmount: position.slashableAmount,
            exiting: position.exiting,
            snapshotCommitment: snapshotCommitment,
            capturedAt: uint64(block.timestamp),
            exists: true
        });

        emit StakeReferenceCaptured(
            referenceId,
            workerId,
            workerRevision,
            stakePolicyId,
            policyRevision,
            bindingRevision,
            position.positionId,
            position.positionRevision
        );
    }

    /// @notice New-admission predicate. Unbound/missing CMP-1.5 source always rejects stake-required work.
    function isEligible(
        bytes32 workerId,
        uint64 workerRevision,
        bytes32 stakePolicyId,
        bool requireReference,
        bytes32 referenceId
    ) external view returns (bool) {
        if (!workers.isEligible(workerId, workerRevision)) return false;

        uint32 policyRevision = latestStakePolicyRevision[stakePolicyId];
        if (policyRevision == 0) return false;
        StakePolicy memory p = _stakePolicies[stakePolicyId][policyRevision];
        if (!p.acceptingNew) return false;

        uint32 bindingRevision = latestSourceBindingRevision;
        if (bindingRevision == 0) return false;
        SourceBinding memory b = _sourceBindings[bindingRevision];
        if (!b.active) return false;

        IComputeStakeSource420.PositionRead memory position;
        try IComputeStakeSource420(b.source).readWorkerPosition(workerId, stakePolicyId)
            returns (IComputeStakeSource420.PositionRead memory out)
        {
            position = out;
        } catch {
            return false;
        }

        if (!positionPasses(position, p)) return false;

        if (!requireReference) return true;

        StakeReference storage r = _references[referenceId];
        if (
            !r.exists
                || r.workerId != workerId
                || r.workerRevision != workerRevision
                || r.stakePolicyId != stakePolicyId
                || r.stakePolicyRevision != policyRevision
                || r.sourceBindingRevision != bindingRevision
                || r.source != b.source
                || r.positionId != position.positionId
        ) return false;

        return true;
    }
}
