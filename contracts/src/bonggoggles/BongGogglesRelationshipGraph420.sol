// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./BongGogglesAuthorization420.sol";
import "./BongGogglesProfileRegistry420.sol";
import "./BongGogglesIds420.sol";

contract BongGogglesRelationshipGraph420 {
    enum FriendRequestState { NONE, PENDING, ACCEPTED, DECLINED, CANCELLED, EXPIRED }

    struct FriendRequest {
        bytes32 requestId;
        address requester;
        address recipient;
        uint64 createdAt;
        uint64 resolvedAt;
        FriendRequestState state;
    }

    struct MuteState {
        uint32 scopes;
        uint64 createdAt;
        uint64 expiresAt;
    }

    BongGogglesAuthorization420 public immutable authorization;
    BongGogglesProfileRegistry420 public immutable profiles;

    mapping(bytes32 => FriendRequest) private _friendRequests;
    mapping(bytes32 => bool) private _friends;
    mapping(address => mapping(address => bool)) private _following;
    mapping(address => mapping(address => bool)) private _blocked;
    mapping(address => mapping(address => MuteState)) private _muted;
    mapping(address => uint256) public friendRequestNonce;

    error Unauthorized();
    error ZeroAddress();
    error SelfRelationship();
    error ProfileInactive();
    error Blocked();
    error AlreadyFriends();
    error NotFriends();
    error RequestPending();
    error RequestMissing();
    error RequestNotPending();
    error WrongRecipient();
    error WrongRequester();
    error FollowDisabled();
    error AlreadyFollowing();
    error NotFollowing();
    error AlreadyBlocked();
    error NotBlocked();
    error InvalidMute();

    event FriendRequestCreated(bytes32 indexed requestId, address indexed requester, address indexed recipient, address operator);
    event FriendRequestAccepted(bytes32 indexed requestId, bytes32 indexed friendshipId, address indexed recipient, address operator);
    event FriendRequestDeclined(bytes32 indexed requestId, address indexed recipient, address indexed operator);
    event FriendRequestCancelled(bytes32 indexed requestId, address indexed requester, address indexed operator);
    event FriendshipRemoved(bytes32 indexed friendshipId, address indexed accountA, address indexed accountB, address operator);
    event Followed(address indexed follower, address indexed subject, address indexed operator);
    event Unfollowed(address indexed follower, address indexed subject, address indexed operator);
    event Blocked(address indexed blocker, address indexed subject, address indexed operator);
    event Unblocked(address indexed blocker, address indexed subject, address indexed operator);
    event Muted(address indexed muter, address indexed subject, uint32 scopes, uint64 expiresAt, address operator);
    event Unmuted(address indexed muter, address indexed subject, address indexed operator);

    constructor(address authorization_, address profiles_) {
        if (authorization_ == address(0) || profiles_ == address(0)) revert ZeroAddress();
        authorization = BongGogglesAuthorization420(authorization_);
        profiles = BongGogglesProfileRegistry420(profiles_);
    }

    function friendshipId(address a, address b) public pure returns (bytes32) {
        (address x, address y) = a < b ? (a, b) : (b, a);
        return keccak256(abi.encode("420/BONG_GOGGLES/FRIENDSHIP/V1", x, y));
    }

    function areFriends(address a, address b) public view returns (bool) {
        if (a == b || isBlockedEither(a, b)) return false;
        return _friends[friendshipId(a, b)];
    }

    function isFollowing(address follower, address subject) public view returns (bool) {
        if (isBlockedEither(follower, subject)) return false;
        return _following[follower][subject];
    }

    function isBlocked(address blocker, address subject) external view returns (bool) { return _blocked[blocker][subject]; }
    function isBlockedEither(address a, address b) public view returns (bool) { return _blocked[a][b] || _blocked[b][a]; }

    function muteState(address muter, address subject) external view returns (MuteState memory) { return _muted[muter][subject]; }
    function isMuted(address muter, address subject, uint32 scope) public view returns (bool) {
        MuteState storage m = _muted[muter][subject];
        if (m.scopes == 0) return false;
        if (m.expiresAt != 0 && block.timestamp >= m.expiresAt) return false;
        return m.scopes == BongGogglesTypes420.MUTE_ALL || (m.scopes & scope) != 0;
    }

    function friendRequest(bytes32 requestId) external view returns (FriendRequest memory) { return _friendRequests[requestId]; }

    function requestFriend(address requester, address recipient) external returns (bytes32 requestId) {
        _validatePair(requester, recipient);
        if (!authorization.canActFor(msg.sender, requester, BongGogglesIds420.ACTION_FRIEND_REQUEST)) revert Unauthorized();
        if (areFriends(requester, recipient)) revert AlreadyFriends();
        if (isBlockedEither(requester, recipient)) revert Blocked();
        uint256 nonce = ++friendRequestNonce[requester];
        requestId = keccak256(abi.encode("420/BONG_GOGGLES/FRIEND_REQUEST/V1", block.chainid, requester, recipient, nonce));
        _friendRequests[requestId] = FriendRequest(requestId, requester, recipient, uint64(block.timestamp), 0, FriendRequestState.PENDING);
        emit FriendRequestCreated(requestId, requester, recipient, msg.sender);
    }

    function acceptFriend(address recipient, bytes32 requestId) external {
        if (!authorization.canActFor(msg.sender, recipient, BongGogglesIds420.ACTION_FRIEND_ACCEPT)) revert Unauthorized();
        FriendRequest storage r = _pending(requestId);
        if (r.recipient != recipient) revert WrongRecipient();
        if (isBlockedEither(r.requester, r.recipient)) revert Blocked();
        bytes32 fid = friendshipId(r.requester, r.recipient);
        if (_friends[fid]) revert AlreadyFriends();
        r.state = FriendRequestState.ACCEPTED;
        r.resolvedAt = uint64(block.timestamp);
        _friends[fid] = true;
        emit FriendRequestAccepted(requestId, fid, recipient, msg.sender);
    }

    function declineFriend(address recipient, bytes32 requestId) external {
        if (!authorization.canActFor(msg.sender, recipient, BongGogglesIds420.ACTION_FRIEND_DECLINE)) revert Unauthorized();
        FriendRequest storage r = _pending(requestId);
        if (r.recipient != recipient) revert WrongRecipient();
        r.state = FriendRequestState.DECLINED;
        r.resolvedAt = uint64(block.timestamp);
        emit FriendRequestDeclined(requestId, recipient, msg.sender);
    }

    function cancelFriendRequest(address requester, bytes32 requestId) external {
        if (!authorization.canActFor(msg.sender, requester, BongGogglesIds420.ACTION_FRIEND_CANCEL)) revert Unauthorized();
        FriendRequest storage r = _pending(requestId);
        if (r.requester != requester) revert WrongRequester();
        r.state = FriendRequestState.CANCELLED;
        r.resolvedAt = uint64(block.timestamp);
        emit FriendRequestCancelled(requestId, requester, msg.sender);
    }

    function removeFriend(address account, address other) external {
        _validatePair(account, other);
        if (!authorization.canActFor(msg.sender, account, BongGogglesIds420.ACTION_FRIEND_REMOVE)) revert Unauthorized();
        bytes32 fid = friendshipId(account, other);
        if (!_friends[fid]) revert NotFriends();
        delete _friends[fid];
        emit FriendshipRemoved(fid, account, other, msg.sender);
    }

    function follow(address follower, address subject) external {
        _validatePair(follower, subject);
        if (!authorization.canActFor(msg.sender, follower, BongGogglesIds420.ACTION_FOLLOW)) revert Unauthorized();
        if (isBlockedEither(follower, subject)) revert Blocked();
        if (_following[follower][subject]) revert AlreadyFollowing();
        BongGogglesProfileRegistry420.Preferences memory p = profiles.preferences(subject);
        if (p.followPolicy != BongGogglesTypes420.FollowPolicy.OPEN) revert FollowDisabled();
        _following[follower][subject] = true;
        emit Followed(follower, subject, msg.sender);
    }

    function unfollow(address follower, address subject) external {
        _validatePair(follower, subject);
        if (!authorization.canActFor(msg.sender, follower, BongGogglesIds420.ACTION_UNFOLLOW)) revert Unauthorized();
        if (!_following[follower][subject]) revert NotFollowing();
        delete _following[follower][subject];
        emit Unfollowed(follower, subject, msg.sender);
    }

    function blockUser(address blocker, address subject) external {
        _validatePair(blocker, subject);
        if (!authorization.canActFor(msg.sender, blocker, BongGogglesIds420.ACTION_BLOCK)) revert Unauthorized();
        if (_blocked[blocker][subject]) revert AlreadyBlocked();
        _blocked[blocker][subject] = true;
        bytes32 fid = friendshipId(blocker, subject);
        if (_friends[fid]) {
            delete _friends[fid];
            emit FriendshipRemoved(fid, blocker, subject, msg.sender);
        }
        if (_following[blocker][subject]) {
            delete _following[blocker][subject];
            emit Unfollowed(blocker, subject, msg.sender);
        }
        if (_following[subject][blocker]) {
            delete _following[subject][blocker];
            emit Unfollowed(subject, blocker, msg.sender);
        }
        emit Blocked(blocker, subject, msg.sender);
    }

    function unblockUser(address blocker, address subject) external {
        _validatePair(blocker, subject);
        if (!authorization.canActFor(msg.sender, blocker, BongGogglesIds420.ACTION_UNBLOCK)) revert Unauthorized();
        if (!_blocked[blocker][subject]) revert NotBlocked();
        delete _blocked[blocker][subject];
        emit Unblocked(blocker, subject, msg.sender);
    }

    function muteUser(address muter, address subject, uint32 scopes, uint64 expiresAt) external {
        _validatePair(muter, subject);
        if (!authorization.canActFor(msg.sender, muter, BongGogglesIds420.ACTION_MUTE)) revert Unauthorized();
        if (scopes == 0 || (expiresAt != 0 && expiresAt <= block.timestamp)) revert InvalidMute();
        _muted[muter][subject] = MuteState(scopes, uint64(block.timestamp), expiresAt);
        emit Muted(muter, subject, scopes, expiresAt, msg.sender);
    }

    function unmuteUser(address muter, address subject) external {
        _validatePair(muter, subject);
        if (!authorization.canActFor(msg.sender, muter, BongGogglesIds420.ACTION_UNMUTE)) revert Unauthorized();
        delete _muted[muter][subject];
        emit Unmuted(muter, subject, msg.sender);
    }

    function _pending(bytes32 requestId) internal view returns (FriendRequest storage r) {
        r = _friendRequests[requestId];
        if (r.requestId == bytes32(0)) revert RequestMissing();
        if (r.state != FriendRequestState.PENDING) revert RequestNotPending();
    }

    function _validatePair(address a, address b) internal view {
        if (a == address(0) || b == address(0)) revert ZeroAddress();
        if (a == b) revert SelfRelationship();
        if (!profiles.isActive(a) || !profiles.isActive(b)) revert ProfileInactive();
    }
}
