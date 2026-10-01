// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../system/SystemAccess.sol";
import "./ICivicElectorateSource420.sol";

/// @notice Canonical equal-weight Merkle electorate adapter for 420 Civic.
/// @dev Governance publishes append-only block checkpoints. Membership is one address = one vote;
/// stake, token balance and delegated weight are deliberately absent from this adapter.
contract CivicMerkleElectorateSource420 is SystemAccess, ICivicElectorateSource420 {
    bytes32 public constant COMMUNITY_SOURCE_TYPE = keccak256("420CIVIC_COMMUNITY_EQUAL_WEIGHT_MERKLE_V1");
    bytes32 public constant VALIDATOR_SOURCE_TYPE = keccak256("420CIVIC_VALIDATOR_EQUAL_WEIGHT_MERKLE_V1");

    struct Checkpoint {
        uint64 effectiveBlock;
        bytes32 electorateRoot;
        uint256 totalWeight;
    }

    bytes32 private immutable _sourceType;
    Checkpoint[] private _checkpoints;

    error InvalidSourceType();
    error InvalidCheckpoint();
    error NoCheckpoint();
    error InvalidProof();

    event ElectorateCheckpointPublished(
        uint64 indexed effectiveBlock, bytes32 indexed electorateRoot, uint256 totalWeight
    );

    constructor(
        address timelock_,
        bytes32 sourceType_
    ) SystemAccess(timelock_) {
        if (sourceType_ != COMMUNITY_SOURCE_TYPE && sourceType_ != VALIDATOR_SOURCE_TYPE) {
            revert InvalidSourceType();
        }
        _sourceType = sourceType_;
    }

    function sourceType() external view returns (bytes32) {
        return _sourceType;
    }

    function checkpointCount() external view returns (uint256) {
        return _checkpoints.length;
    }

    function checkpoint(
        uint256 index
    ) external view returns (Checkpoint memory) {
        return _checkpoints[index];
    }

    /// @notice Publish a prospective electorate checkpoint.
    /// @dev Roots commit sorted-pair Merkle leaves keccak256(abi.encode(voter)); every valid leaf has weight 1.
    function publishCheckpoint(
        uint64 effectiveBlock,
        bytes32 electorateRoot,
        uint256 totalWeight
    ) external onlyGovernance {
        if (electorateRoot == bytes32(0) || totalWeight == 0 || effectiveBlock <= block.number) {
            revert InvalidCheckpoint();
        }
        uint256 n = _checkpoints.length;
        if (n != 0 && effectiveBlock <= _checkpoints[n - 1].effectiveBlock) revert InvalidCheckpoint();
        _checkpoints.push(Checkpoint(effectiveBlock, electorateRoot, totalWeight));
        emit ElectorateCheckpointPublished(effectiveBlock, electorateRoot, totalWeight);
    }

    function snapshotAt(
        uint64 snapshotBlock
    ) external view returns (bytes32 electorateRoot, uint256 totalWeight) {
        uint256 n = _checkpoints.length;
        if (n == 0 || snapshotBlock < _checkpoints[0].effectiveBlock) revert NoCheckpoint();

        uint256 low;
        uint256 high = n;
        while (low + 1 < high) {
            uint256 mid = (low + high) >> 1;
            if (_checkpoints[mid].effectiveBlock <= snapshotBlock) low = mid;
            else high = mid;
        }
        Checkpoint memory cp = _checkpoints[low];
        return (cp.electorateRoot, cp.totalWeight);
    }

    function votingWeight(
        bytes32 electorateRoot,
        address voter,
        bytes calldata proofData
    ) external pure returns (uint256 weight) {
        bytes32[] memory proof = abi.decode(proofData, (bytes32[]));
        bytes32 computed = keccak256(abi.encode(voter));
        for (uint256 i; i < proof.length; ++i) {
            bytes32 sibling = proof[i];
            computed = computed <= sibling
                ? keccak256(abi.encodePacked(computed, sibling))
                : keccak256(abi.encodePacked(sibling, computed));
        }
        if (computed != electorateRoot) revert InvalidProof();
        return 1;
    }
}
