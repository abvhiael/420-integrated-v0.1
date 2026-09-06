// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../shared/CreativeTypes420.sol";
import "../shared/CreativeErrors420.sol";
import "../shared/CreativeEvents420.sol";

interface IRightsProfiles420 {
    function isAuthorized(CreatorId creatorId, address account) external view returns (bool);
}

interface IRightsWorkController420 {
    function registrantProfileOf(WorkId workId) external view returns (CreatorId);
}

interface IRightsRecordingController420 {
    function registrantProfileOf(RecordingId recordingId) external view returns (CreatorId);
}

interface IRoyaltyAccounting420 {
    function checkpointHolder(bytes32 assetKey, uint256 profileId, uint16 oldBps) external;
    function syncHolder(bytes32 assetKey, uint256 profileId, uint16 newBps) external;
}

contract RightsRegistry420 is CreativeEvents420 {
    struct SplitState {
        bytes32 splitHash;
        uint32 proposalVersion;
        uint32 rightsVersion;
        SplitStatus status;
        uint16 acceptedCount;
    }

    struct RightsTransfer {
        bytes32 assetKey;
        uint256 fromProfileId;
        uint256 toProfileId;
        uint16 bps;
        uint64 expiresAt;
        bool pending;
    }

    IRightsProfiles420 public immutable creatorProfiles;
    IRightsWorkController420 public immutable works;
    IRightsRecordingController420 public immutable recordings;
    address public immutable governanceTimelock;
    address public royaltyAccounting;

    uint256 private _nextTransferId = 1;
    mapping(bytes32 => SplitState) private _splits;
    mapping(bytes32 => uint256[]) private _proposalHolders;
    mapping(bytes32 => mapping(uint256 => uint16)) private _proposalBps;
    mapping(bytes32 => mapping(uint256 => bool)) private _proposalAccepted;
    mapping(bytes32 => uint256[]) private _currentHolders;
    mapping(bytes32 => mapping(uint256 => bool)) private _isCurrentHolder;
    mapping(bytes32 => mapping(uint256 => uint16)) private _currentBps;
    mapping(bytes32 => mapping(uint32 => mapping(uint256 => uint16))) private _historicalBps;
    mapping(bytes32 => mapping(uint256 => uint16)) private _reservedOutgoingBps;
    mapping(uint256 => RightsTransfer) private _transfers;

    constructor(address governanceTimelock_, address creatorProfiles_, address workRegistry_, address recordingRegistry_) {
        if (governanceTimelock_ == address(0) || creatorProfiles_ == address(0) || workRegistry_ == address(0) || recordingRegistry_ == address(0)) {
            revert CreativeErrors420.ZeroAddress();
        }
        governanceTimelock = governanceTimelock_;
        creatorProfiles = IRightsProfiles420(creatorProfiles_);
        works = IRightsWorkController420(workRegistry_);
        recordings = IRightsRecordingController420(recordingRegistry_);
    }

    function setRoyaltyAccounting(address royaltyAccounting_) external {
        if (msg.sender != governanceTimelock) revert CreativeErrors420.Unauthorized();
        if (royaltyAccounting_ == address(0)) revert CreativeErrors420.ZeroAddress();
        royaltyAccounting = royaltyAccounting_;
    }

    function proposeInitialSplit(
        CreativeAssetType assetType,
        uint256 assetId,
        uint256[] calldata holderProfileIds,
        uint16[] calldata bps
    ) external returns (bytes32 splitHash) {
        if (!_authorizedController(assetType, assetId, msg.sender)) revert CreativeErrors420.Unauthorized();
        bytes32 assetKey = CreativeAssetKeys420.key(assetType, assetId);
        SplitState storage state = _splits[assetKey];
        if (state.status == SplitStatus.FINALIZED) revert CreativeErrors420.SplitAlreadyFinalized();
        if (holderProfileIds.length == 0 || holderProfileIds.length != bps.length) revert CreativeErrors420.InvalidSplitTotal(0);
        if (holderProfileIds.length > CreativeConstants420.MAX_RIGHTS_HOLDERS) {
            revert CreativeErrors420.TooManyRightsHolders(holderProfileIds.length);
        }

        uint256 total;
        for (uint256 i = 0; i < holderProfileIds.length; ++i) {
            if (holderProfileIds[i] == 0 || bps[i] == 0) revert CreativeErrors420.InvalidId();
            total += bps[i];
            for (uint256 j = 0; j < i; ++j) {
                if (holderProfileIds[j] == holderProfileIds[i]) revert CreativeErrors420.DuplicateHolder(holderProfileIds[i]);
            }
        }
        if (total != CreativeConstants420.BPS_DENOMINATOR) revert CreativeErrors420.InvalidSplitTotal(total);

        splitHash = keccak256(abi.encode(assetKey, holderProfileIds, bps, state.proposalVersion + 1));
        delete _proposalHolders[assetKey];
        for (uint256 i = 0; i < holderProfileIds.length; ++i) {
            _proposalHolders[assetKey].push(holderProfileIds[i]);
            _proposalBps[splitHash][holderProfileIds[i]] = bps[i];
        }
        state.splitHash = splitHash;
        state.proposalVersion += 1;
        state.acceptedCount = 0;
        state.status = SplitStatus.PROPOSED;
        emit SplitProposed(assetKey, splitHash, state.proposalVersion);
    }

    function acceptInitialShare(CreativeAssetType assetType, uint256 assetId) external {
        bytes32 assetKey = CreativeAssetKeys420.key(assetType, assetId);
        SplitState storage state = _splits[assetKey];
        if (state.status != SplitStatus.PROPOSED && state.status != SplitStatus.PARTIALLY_ACCEPTED) {
            revert CreativeErrors420.InvalidState();
        }
        uint256[] storage holders = _proposalHolders[assetKey];
        uint256 matchedProfile;
        uint16 share;
        for (uint256 i = 0; i < holders.length; ++i) {
            uint256 profileId = holders[i];
            if (creatorProfiles.isAuthorized(CreatorId.wrap(profileId), msg.sender)) {
                matchedProfile = profileId;
                share = _proposalBps[state.splitHash][profileId];
                break;
            }
        }
        if (matchedProfile == 0) revert CreativeErrors420.Unauthorized();
        if (_proposalAccepted[state.splitHash][matchedProfile]) revert CreativeErrors420.InvalidState();
        _proposalAccepted[state.splitHash][matchedProfile] = true;
        state.acceptedCount += 1;
        state.status = state.acceptedCount == holders.length ? SplitStatus.PARTIALLY_ACCEPTED : SplitStatus.PARTIALLY_ACCEPTED;
        emit RightsShareAccepted(assetKey, state.splitHash, matchedProfile, share);
    }

    function finalizeInitialSplit(CreativeAssetType assetType, uint256 assetId) external {
        if (!_authorizedController(assetType, assetId, msg.sender)) revert CreativeErrors420.Unauthorized();
        bytes32 assetKey = CreativeAssetKeys420.key(assetType, assetId);
        SplitState storage state = _splits[assetKey];
        if (state.status == SplitStatus.FINALIZED) revert CreativeErrors420.SplitAlreadyFinalized();
        uint256[] storage holders = _proposalHolders[assetKey];
        if (holders.length == 0 || state.acceptedCount != holders.length) revert CreativeErrors420.InvalidState();

        for (uint256 i = 0; i < holders.length; ++i) {
            uint256 profileId = holders[i];
            if (!_proposalAccepted[state.splitHash][profileId]) revert CreativeErrors420.ShareNotAccepted(profileId);
            uint16 share = _proposalBps[state.splitHash][profileId];
            _currentHolders[assetKey].push(profileId);
            _isCurrentHolder[assetKey][profileId] = true;
            _currentBps[assetKey][profileId] = share;
        }
        state.rightsVersion = 1;
        state.status = SplitStatus.FINALIZED;
        _snapshot(assetKey, state.rightsVersion);
        emit SplitFinalized(assetKey, state.splitHash, state.rightsVersion);
    }

    function proposeTransfer(
        CreativeAssetType assetType,
        uint256 assetId,
        uint256 fromProfileId,
        uint256 toProfileId,
        uint16 bps,
        uint64 expiresAt
    ) external returns (uint256 transferId) {
        if (fromProfileId == 0 || toProfileId == 0 || fromProfileId == toProfileId || bps == 0) revert CreativeErrors420.InvalidId();
        if (!creatorProfiles.isAuthorized(CreatorId.wrap(fromProfileId), msg.sender)) revert CreativeErrors420.Unauthorized();
        bytes32 assetKey = CreativeAssetKeys420.key(assetType, assetId);
        if (_splits[assetKey].status != SplitStatus.FINALIZED) revert CreativeErrors420.InvalidState();
        uint16 available = _currentBps[assetKey][fromProfileId] - _reservedOutgoingBps[assetKey][fromProfileId];
        if (bps > available) revert CreativeErrors420.InsufficientRights(available, bps);
        transferId = _nextTransferId++;
        _reservedOutgoingBps[assetKey][fromProfileId] += bps;
        _transfers[transferId] = RightsTransfer({
            assetKey: assetKey,
            fromProfileId: fromProfileId,
            toProfileId: toProfileId,
            bps: bps,
            expiresAt: expiresAt,
            pending: true
        });
        emit RightsTransferProposed(transferId, assetKey, fromProfileId, toProfileId, bps);
    }

    function acceptTransfer(uint256 transferId) external {
        RightsTransfer storage transfer_ = _transfers[transferId];
        if (!transfer_.pending) revert CreativeErrors420.TransferNotPending();
        if (transfer_.expiresAt != 0 && block.timestamp > transfer_.expiresAt) revert CreativeErrors420.TransferNotPending();
        if (!creatorProfiles.isAuthorized(CreatorId.wrap(transfer_.toProfileId), msg.sender)) revert CreativeErrors420.Unauthorized();

        uint16 fromOld = _currentBps[transfer_.assetKey][transfer_.fromProfileId];
        uint16 toOld = _currentBps[transfer_.assetKey][transfer_.toProfileId];
        if (royaltyAccounting != address(0)) {
            IRoyaltyAccounting420(royaltyAccounting).checkpointHolder(transfer_.assetKey, transfer_.fromProfileId, fromOld);
            IRoyaltyAccounting420(royaltyAccounting).checkpointHolder(transfer_.assetKey, transfer_.toProfileId, toOld);
        }

        _currentBps[transfer_.assetKey][transfer_.fromProfileId] = fromOld - transfer_.bps;
        _currentBps[transfer_.assetKey][transfer_.toProfileId] = toOld + transfer_.bps;
        _reservedOutgoingBps[transfer_.assetKey][transfer_.fromProfileId] -= transfer_.bps;
        if (!_isCurrentHolder[transfer_.assetKey][transfer_.toProfileId]) {
            _isCurrentHolder[transfer_.assetKey][transfer_.toProfileId] = true;
            _currentHolders[transfer_.assetKey].push(transfer_.toProfileId);
        }
        transfer_.pending = false;

        if (royaltyAccounting != address(0)) {
            IRoyaltyAccounting420(royaltyAccounting).syncHolder(transfer_.assetKey, transfer_.fromProfileId, fromOld - transfer_.bps);
            IRoyaltyAccounting420(royaltyAccounting).syncHolder(transfer_.assetKey, transfer_.toProfileId, toOld + transfer_.bps);
        }

        SplitState storage state = _splits[transfer_.assetKey];
        state.rightsVersion += 1;
        state.splitHash = _currentSplitHash(transfer_.assetKey);
        _snapshot(transfer_.assetKey, state.rightsVersion);
        emit RightsTransferAccepted(transferId, transfer_.assetKey, state.rightsVersion);
    }

    function isFinalized(bytes32 assetKey) external view returns (bool) {
        return _splits[assetKey].status == SplitStatus.FINALIZED;
    }

    function currentShare(bytes32 assetKey, uint256 profileId) external view returns (uint16) {
        return _currentBps[assetKey][profileId];
    }

    function shareAt(bytes32 assetKey, uint32 version, uint256 profileId) external view returns (uint16) {
        return _historicalBps[assetKey][version][profileId];
    }

    function rightsVersion(bytes32 assetKey) external view returns (uint32) {
        return _splits[assetKey].rightsVersion;
    }

    function splitState(bytes32 assetKey) external view returns (SplitState memory) {
        return _splits[assetKey];
    }

    function currentHolders(bytes32 assetKey) external view returns (uint256[] memory) {
        return _currentHolders[assetKey];
    }

    function _authorizedController(CreativeAssetType assetType, uint256 assetId, address account) internal view returns (bool) {
        CreatorId controller;
        if (assetType == CreativeAssetType.WORK) controller = works.registrantProfileOf(WorkId.wrap(assetId));
        else if (assetType == CreativeAssetType.RECORDING) controller = recordings.registrantProfileOf(RecordingId.wrap(assetId));
        else revert CreativeErrors420.InvalidId();
        return creatorProfiles.isAuthorized(controller, account);
    }

    function _snapshot(bytes32 assetKey, uint32 version) internal {
        uint256[] storage holders = _currentHolders[assetKey];
        for (uint256 i = 0; i < holders.length; ++i) {
            _historicalBps[assetKey][version][holders[i]] = _currentBps[assetKey][holders[i]];
        }
    }

    function _currentSplitHash(bytes32 assetKey) internal view returns (bytes32) {
        uint256[] storage holders = _currentHolders[assetKey];
        bytes32 running = keccak256(abi.encode(assetKey, _splits[assetKey].rightsVersion + 1));
        for (uint256 i = 0; i < holders.length; ++i) {
            running = keccak256(abi.encode(running, holders[i], _currentBps[assetKey][holders[i]]));
        }
        return running;
    }
}
