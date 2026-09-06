// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../../system/SystemAccess.sol";
import "../shared/CreativeTypes420.sol";
import "../shared/CreativeErrors420.sol";
import "../shared/CreativeEvents420.sol";

contract CreatorProfileRegistry420 is SystemAccess, CreativeEvents420 {
    uint256 private _nextCreatorId = 1;
    mapping(uint256 => CreatorProfile420) private _profiles;

    constructor(address governanceTimelock_) SystemAccess(governanceTimelock_) {}

    function createProfile(IdentityType identityType, bytes32 metadataHash) external returns (CreatorId creatorId) {
        uint256 id = _nextCreatorId++;
        _profiles[id] = CreatorProfile420({
            primaryAccount: msg.sender,
            metadataHash: metadataHash,
            createdAt: uint64(block.timestamp),
            updatedAt: uint64(block.timestamp),
            identityType: identityType,
            status: ProfileStatus.ACTIVE
        });
        emit CreatorProfileCreated(id, msg.sender, metadataHash);
        return CreatorId.wrap(id);
    }

    function updateMetadata(CreatorId creatorId, bytes32 metadataHash) external {
        uint256 id = CreatorId.unwrap(creatorId);
        CreatorProfile420 storage profile = _requireProfile(id);
        if (msg.sender != profile.primaryAccount) revert CreativeErrors420.Unauthorized();
        profile.metadataHash = metadataHash;
        profile.updatedAt = uint64(block.timestamp);
        emit CreatorProfileUpdated(id, metadataHash);
    }

    function setPrimaryAccount(CreatorId creatorId, address newAccount) external {
        if (newAccount == address(0)) revert CreativeErrors420.ZeroAddress();
        uint256 id = CreatorId.unwrap(creatorId);
        CreatorProfile420 storage profile = _requireProfile(id);
        if (msg.sender != profile.primaryAccount) revert CreativeErrors420.Unauthorized();
        profile.primaryAccount = newAccount;
        profile.updatedAt = uint64(block.timestamp);
    }

    function setStatus(CreatorId creatorId, ProfileStatus status) external onlyGovernance {
        CreatorProfile420 storage profile = _requireProfile(CreatorId.unwrap(creatorId));
        profile.status = status;
        profile.updatedAt = uint64(block.timestamp);
    }

    function isAuthorized(CreatorId creatorId, address account) external view returns (bool) {
        CreatorProfile420 storage profile = _profiles[CreatorId.unwrap(creatorId)];
        return profile.primaryAccount != address(0) && profile.status == ProfileStatus.ACTIVE && profile.primaryAccount == account;
    }

    function profile(CreatorId creatorId) external view returns (CreatorProfile420 memory) {
        CreatorProfile420 storage p = _requireProfile(CreatorId.unwrap(creatorId));
        return p;
    }

    function _requireProfile(uint256 id) internal view returns (CreatorProfile420 storage profile) {
        profile = _profiles[id];
        if (profile.primaryAccount == address(0)) revert CreativeErrors420.NotFound();
    }
}
