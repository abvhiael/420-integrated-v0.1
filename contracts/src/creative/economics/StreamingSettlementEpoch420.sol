// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../shared/CreativeErrors420.sol";

/// @notice Canonical HZ-4 settlement-epoch boundary for 420Hz streaming economics.
/// @dev HZ-4.1 commits immutable playback/revenue inputs. Allocation and royalty routing are layered on top in HZ-4.2+.
contract StreamingSettlementEpoch420 {
    enum EpochState {
        NONE,
        COMMITTED,
        FINALIZED
    }

    struct SettlementEpoch420 {
        uint64 playbackEpoch;
        uint64 committedAt;
        uint64 finalizedAt;
        uint256 totalPlayCount;
        uint256 totalQualifiedMs;
        uint256 grossRevenue;
        bytes32 playbackRoot;
        bytes32 revenueRoot;
        EpochState state;
    }

    address public immutable governanceTimelock;
    address public immutable playbackAccounting;

    mapping(address => bool) public submitters;
    mapping(bytes32 => SettlementEpoch420) private _epochs;
    mapping(uint64 => bytes32) public settlementIdByPlaybackEpoch;

    event SubmitterUpdated(address indexed submitter, bool allowed);
    event SettlementEpochCommitted(
        bytes32 indexed settlementId,
        uint64 indexed playbackEpoch,
        bytes32 indexed playbackRoot,
        bytes32 revenueRoot,
        uint256 totalPlayCount,
        uint256 totalQualifiedMs,
        uint256 grossRevenue
    );
    event SettlementEpochFinalized(bytes32 indexed settlementId, uint64 indexed playbackEpoch);

    constructor(address governanceTimelock_, address playbackAccounting_) {
        if (governanceTimelock_ == address(0) || playbackAccounting_ == address(0)) {
            revert CreativeErrors420.ZeroAddress();
        }
        governanceTimelock = governanceTimelock_;
        playbackAccounting = playbackAccounting_;
    }

    function setSubmitter(address submitter, bool allowed) external {
        if (msg.sender != governanceTimelock) revert CreativeErrors420.Unauthorized();
        if (submitter == address(0)) revert CreativeErrors420.ZeroAddress();
        submitters[submitter] = allowed;
        emit SubmitterUpdated(submitter, allowed);
    }

    function commitSettlementEpoch(
        bytes32 settlementId,
        uint64 playbackEpoch,
        bytes32 playbackRoot,
        bytes32 revenueRoot,
        uint256 totalPlayCount,
        uint256 totalQualifiedMs,
        uint256 grossRevenue
    ) external {
        if (!submitters[msg.sender]) revert CreativeErrors420.Unauthorized();
        if (
            settlementId == bytes32(0) || playbackEpoch == 0 || playbackRoot == bytes32(0) || revenueRoot == bytes32(0)
        ) revert CreativeErrors420.InvalidId();
        if (totalPlayCount == 0 || totalQualifiedMs == 0 || grossRevenue == 0) {
            revert CreativeErrors420.InvalidState();
        }
        if (_epochs[settlementId].state != EpochState.NONE) revert CreativeErrors420.AlreadyExists();
        if (settlementIdByPlaybackEpoch[playbackEpoch] != bytes32(0)) revert CreativeErrors420.AlreadyExists();

        _epochs[settlementId] = SettlementEpoch420({
            playbackEpoch: playbackEpoch,
            committedAt: uint64(block.timestamp),
            finalizedAt: 0,
            totalPlayCount: totalPlayCount,
            totalQualifiedMs: totalQualifiedMs,
            grossRevenue: grossRevenue,
            playbackRoot: playbackRoot,
            revenueRoot: revenueRoot,
            state: EpochState.COMMITTED
        });
        settlementIdByPlaybackEpoch[playbackEpoch] = settlementId;

        emit SettlementEpochCommitted(
            settlementId,
            playbackEpoch,
            playbackRoot,
            revenueRoot,
            totalPlayCount,
            totalQualifiedMs,
            grossRevenue
        );
    }

    function finalizeSettlementEpoch(bytes32 settlementId) external {
        if (msg.sender != governanceTimelock) revert CreativeErrors420.Unauthorized();
        SettlementEpoch420 storage epoch = _epochs[settlementId];
        if (epoch.state == EpochState.NONE) revert CreativeErrors420.NotFound();
        if (epoch.state != EpochState.COMMITTED) revert CreativeErrors420.InvalidTransition();

        epoch.state = EpochState.FINALIZED;
        epoch.finalizedAt = uint64(block.timestamp);
        emit SettlementEpochFinalized(settlementId, epoch.playbackEpoch);
    }

    function epoch(bytes32 settlementId) external view returns (SettlementEpoch420 memory) {
        SettlementEpoch420 memory settlementEpoch = _epochs[settlementId];
        if (settlementEpoch.state == EpochState.NONE) revert CreativeErrors420.NotFound();
        return settlementEpoch;
    }

    function isFinalized(bytes32 settlementId) external view returns (bool) {
        return _epochs[settlementId].state == EpochState.FINALIZED;
    }
}
