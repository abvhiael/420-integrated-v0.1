// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "../interfaces/ICommons420.sol";
import "./CommonsAuthorization420.sol";
import "./CommonsSpaceRegistry420.sol";
import "./CommonsMembershipRegistry420.sol";

contract CommonsRouter420 is I420System, ICommons420 {
    CommonsAuthorization420 public immutable authorization;
    CommonsSpaceRegistry420 public immutable spaceRegistry;
    CommonsMembershipRegistry420 public immutable membershipRegistry;

    error ZeroAddress();

    constructor(address authorization_, address spaceRegistry_, address membershipRegistry_) {
        if (authorization_ == address(0) || spaceRegistry_ == address(0) || membershipRegistry_ == address(0)) revert ZeroAddress();
        authorization = CommonsAuthorization420(authorization_);
        spaceRegistry = CommonsSpaceRegistry420(spaceRegistry_);
        membershipRegistry = CommonsMembershipRegistry420(membershipRegistry_);
    }

    function systemName() external pure returns (string memory) { return "CommonsRouter420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function readSpace(bytes32 spaceId) external view returns (SpaceRead memory out) {
        CommonsSpaceRegistry420.Space memory space = spaceRegistry.getSpace(spaceId);
        out = SpaceRead({
            creatorAccount: space.creatorAccount,
            treasuryAccount: space.treasuryAccount,
            spaceType: space.spaceType,
            visibility: space.visibility,
            membershipPolicyId: space.membershipPolicyId,
            metadataHash: space.metadataHash,
            manifestHash: space.manifestHash,
            createdAt: space.createdAt,
            revision: space.revision,
            active: space.active
        });
    }

    function readMembership(bytes32 spaceId, address memberAccount) external view returns (MembershipRead memory out) {
        CommonsMembershipRegistry420.Membership memory membership = membershipRegistry.getMembership(spaceId, memberAccount);
        out = MembershipRead({
            membershipClass: membership.membershipClass,
            policyId: membership.policyId,
            joinedAt: membership.joinedAt,
            expiresAt: membership.expiresAt,
            revision: membership.revision,
            state: uint8(membership.state),
            activeNow: membershipRegistry.isActiveMember(spaceId, memberAccount)
        });
    }

    function isAuthorized(bytes32 spaceId, address principal, bytes32 actionId) external view returns (bool) {
        return authorization.isAuthorized(spaceId, principal, actionId);
    }
}
