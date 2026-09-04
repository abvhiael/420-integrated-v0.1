// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

interface ICommons420 {
    struct SpaceRead {
        address creatorAccount;
        address treasuryAccount;
        bytes32 spaceType;
        bytes32 visibility;
        bytes32 membershipPolicyId;
        bytes32 metadataHash;
        bytes32 manifestHash;
        uint64 createdAt;
        uint32 revision;
        bool active;
    }

    struct MembershipRead {
        bytes32 membershipClass;
        bytes32 policyId;
        uint64 joinedAt;
        uint64 expiresAt;
        uint32 revision;
        uint8 state;
        bool activeNow;
    }

    function readSpace(bytes32 spaceId) external view returns (SpaceRead memory);
    function readMembership(bytes32 spaceId, address memberAccount) external view returns (MembershipRead memory);
    function isAuthorized(bytes32 spaceId, address principal, bytes32 actionId) external view returns (bool);
}
