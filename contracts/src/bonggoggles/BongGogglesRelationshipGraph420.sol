// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./BongGogglesAuthorization420.sol";
import "./BongGogglesProfileRegistry420.sol";
import "./BongGogglesIds420.sol";

contract BongGogglesRelationshipGraph420 {
    enum FriendRequestState { NONE, PENDING, ACCEPTED, DECLINED, CANCELLED, EXPIRED }
    enum FollowRequestState { NONE, PENDING, ACCEPTED, DECLINED, CANCELLED }

    struct FriendRequest {
        bytes32 requestId;
        address requester;
        address recipient;
        uint64 createdAt;
        uint64 resolvedAt;
        FriendRequestState state;
    }

    struct FollowRequest {
        bytes32 requestId;
        address follower;
        address subject;
        uint64 createdAt;
        uint64 resolvedAt;
        FollowRequestState state;
    }

    struct MuteState {
        uint32 scopes;
        uint64 createdAt;
        uint64 expiresAt;
    }

    BongGogglesAuthorization420 public immutable authorization;
    BongGogglesProfileRegistry420 public immutable profiles;

    mapping(bytes32 => FriendRequest) private _friendRequests;
    mapping(bytes32 => bytes32) public activeFriendRequestId;
    mapping(bytes32 => bool) private _friends;

    mapping(bytes32 => FollowRequest) private _followRequests;
    mapping(address => mapping(address => bytes32)) public activeFollowRequestId;
    mapping(address => mapping(address => bool)) private _following;

    mapping(address => mapping(address => bool)) private _blocked;
    mapping(address => mapping(address => MuteState)) private _muted;
    mapping(address => uint256) public friendRequestNonce;
    mapping(address => uint256) public followRequestNonce;

    error Unauthorized();
    error ZeroAddress();
    error SelfRelationship();
    error ProfileInactive();
    error ProfileMissing();
    error RelationshipBlocked();
    error AlreadyFriends();
    error NotFriends();
    error RequestPending();
    error RequestMissing();
    error RequestNotPending();
    error WrongRecipient();
    error WrongRequester();
    error FriendRequestDisabled();
    error FollowDisabled();
    error AlreadyFollowing();
    error NotFollowing();
    error FollowRequestPending();
    error FollowRequestMissing();
    error FollowRequestNotPending();
    error WrongFollower();
    error WrongSubject();
    error AlreadyBlocked();
    error NotBlocked();
    error InvalidMute();

    event FriendRequestCreated(bytes32 indexed requestId, address indexed requester, address indexed recipient, address operator);
    event FriendRequestAccepted(bytes32 indexed requestId, bytes32 indexed friendshipId, address indexed recipient, address operator);
    event FriendRequestDeclined(bytes32 indexed requestId, address indexed recipient, address indexed operator);
    event FriendRequestCancelled(bytes32 indexed requestId, address indexed requester, address indexed operator);
    event FriendshipRemoved(bytes32 indexed friendshipId, address indexed accountA, address indexed accountB, address operator);
    event FollowRequestCreated(bytes32 indexed requestId, address indexed follower, address indexed subject, address operator);
    event FollowRequestAccepted(bytes32 indexed requestId, address indexed follower, address indexed subject, address operator);
    event FollowRequestDeclined(bytes32 indexed requestId, address indexed follower, address indexed subject, address operator);
    event FollowRequestCancelled(bytes32 indexed requestId, address indexed follower, address indexed subject, address operator);
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
    function followRequest(bytes32 requestId) external view returns (FollowRequest memory) { return _followRequests[requestId]; }

    function requestFriend(address requester, address recipient) external returns (bytes32 requestId) {
        _validateActivePair(requester, recipient);
        if (!authorization.canActFor(msg.sender, requester, BongGogglesIds420.ACTION_FRIEND_REQUEST)) revert Unauthorized();
        if (areFriends(requester, recipient)) revert AlreadyFriends();
        if (isBlockedEither(requester, recipient)) revert RelationshipBlocked();

        bytes32 fid = friendshipId(requester, recipient);
        if (activeFriendRequestId[fid] != bytes32(0)) revert RequestPending();
        if (!_friendRequestAllowed(requester, recipient)) revert FriendRequestDisabled();

        uint256 nonce = ++friendRequestNonce[requester];
        requestId = keccak256(abi.encode("420/BONG_GOGGLES/FRIEND_REQUEST/V1", block.chainid, requester, recipient, nonce));
        _friendRequests[requestId] = FriendRequest(requestId, requester, recipient, uint64(block.timestamp), 0, FriendRequestState.PENDING);
        activeFriendRequestId[fid] = requestId;
        emit FriendRequestCreated(requestId, requester, recipient, msg.sender);
    }

    function acceptFriend(address recipient, bytes32 requestId) external {
        if (!authorization.canActFor(msg.sender, recipient, BongGogglesIds420.ACTION_FRIEND_ACCEPT)) revert Unauthorized();
        FriendRequest storage r = _pending(requestId);
        if (r.recipient != recipient) revert WrongRecipient();
        _validateActivePair(r.requester, r.recipient);
        if (isBlockedEither(r.requester, r.recipient)) revert RelationshipBlocked();
        bytes32 fid = friendshipId(r.requester, r.recipient);
        if (_friends[fid]) revert AlreadyFriends();
        r.state = FriendRequestState.ACCEPTED;
        r.resolvedAt = uint64(block.timestamp);
        delete activeFriendRequestId[fid];
        _friends[fid] = true;
        emit FriendRequestAccepted(requestId, fid, recipient, msg.sender);
    }

    function declineFriend(address recipient, bytes32 requestId) external {
        if (!authorization.canActFor(msg.sender, recipient, BongGogglesIds420.ACTION_FRIEND_DECLINE)) revert Unauthorized();
        FriendRequest storage r = _pending(requestId);
        if (r.recipient != recipient) revert WrongRecipient();
        r.state = FriendRequestState.DECLINED;
        r.resolvedAt = uint64(block.timestamp);
        delete activeFriendRequestId[friendshipId(r.requester, r.recipient)];
        emit FriendRequestDeclined(requestId, recipient, msg.sender);
    }

    function cancelFriendRequest(address requester, bytes32 requestId) external {
        if (!authorization.canActFor(msg.sender, requester, BongGogglesIds420.ACTION_FRIEND_CANCEL)) revert Unauthorized();
        FriendRequest storage r = _pending(requestId);
        if (r.requester != requester) revert WrongRequester();
        _cancelFriendRequest(r, msg.sender);
    }

    function removeFriend(address account, address other) external {
        _validateActivePair(account, other);
        if (!authorization.canActFor(msg.sender, account, BongGogglesIds420.ACTION_FRIEND_REMOVE)) revert Unauthorized();
        bytes32 fid = friendshipId(account, other);
        if (!_friends[fid]) revert NotFriends();
        delete _friends[fid];
        emit FriendshipRemoved(fid, account, other, msg.sender);
    }

    function follow(address follower, address subject) external returns (bytes32 requestId) {
        _validateActivePair(follower, subject);
        if (!authorization.canActFor(msg.sender, follower, BongGogglesIds420.ACTION_FOLLOW)) revert Unauthorized();
        if (isBlockedEither(follower, subject)) revert RelationshipBlocked();
        if (_following[follower][subject]) revert AlreadyFollowing();
        if (activeFollowRequestId[follower][subject] != bytes32(0)) revert FollowRequestPending();

        BongGogglesProfileRegistry420.Preferences memory p = profiles.preferences(subject);
        if (p.followPolicy == BongGogglesTypes420.FollowPolicy.DISABLED) revert FollowDisabled();
        if (p.followPolicy == BongGogglesTypes420.FollowPolicy.OPEN) {
            _following[follower][subject] = true;
            emit Followed(follower, subject, msg.sender);
            return bytes32(0);
        }

        uint256 nonce = ++followRequestNonce[follower];
        requestId = keccak256(abi.encode("420/BONG_GOGGLES/FOLLOW_REQUEST/V1", block.chainid, follower, subject, nonce));
        _followRequests[requestId] = FollowRequest(requestId, follower, subject, uint64(block.timestamp), 0, FollowRequestState.PENDING);
        activeFollowRequestId[follower][subject] = requestId;
        emit FollowRequestCreated(requestId, follower, subject, msg.sender);
    }

    function acceptFollow(address subject, bytes32 requestId) external {
        if (!authorization.canActFor(msg.sender, subject, BongGogglesIds420.ACTION_FOLLOW_ACCEPT)) revert Unauthorized();
        FollowRequest storage r = _pendingFollow(requestId);
        if (r.subject != subject) revert WrongSubject();
        _validateActivePair(r.follower, r.subject);
        if (isBlockedEither(r.follower, r.subject)) revert RelationshipBlocked();
        if (_following[r.follower][r.subject]) revert AlreadyFollowing();
        r.state = FollowRequestState.ACCEPTED;
        r.resolvedAt = uint64(block.timestamp);
        delete activeFollowRequestId[r.follower][r.subject];
        _following[r.follower][r.subject] = true;
        emit FollowRequestAccepted(requestId, r.follower, r.subject, msg.sender);
        emit Followed(r.follower, r.subject, msg.sender);
    }

    function declineFollow(address subject, bytes32 requestId) external {
        if (!authorization.canActFor(msg.sender, subject, BongGogglesIds420.ACTION_FOLLOW_DECLINE)) revert Unauthorized();
        FollowRequest storage r = _pendingFollow(requestId);
        if (r.subject != subject) revert WrongSubject();
        r.state = FollowRequestState.DECLINED;
        r.resolvedAt = uint64(block.timestamp);
        delete activeFollowRequestId[r.follower][r.subject];
        emit FollowRequestDeclined(requestId, r.follower, r.subject, msg.sender);
    }

    function cancelFollowRequest(address follower, bytes32 requestId) external {
        if (!authorization.canActFor(msg.sender, follower, BongGogglesIds420.ACTION_FOLLOW_CANCEL)) revert Unauthorized();
        FollowRequest storage r = _pendingFollow(requestId);
        if (r.follower != follower) revert WrongFollower();
        _cancelFollowRequest(r, msg.sender);
    }

    function unfollow(address follower, address subject) external {
        _validateActivePair(follower, subject);
        if (!authorization.canActFor(msg.sender, follower, BongGogglesIds420.ACTION_UNFOLLOW)) revert Unauthorized();
        if (!_following[follower][subject]) revert NotFollowing();
        delete _following[follower][subject];
        emit Unfollowed(follower, subject, msg.sender);
    }

    function blockUser(address blocker, address subject) external {
        _validateSafetyPair(blocker, subject);
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
        _cancelActiveRequests(blocker, subject, msg.sender);
        emit Blocked(blocker, subject, msg.sender);
    }

    function unblockUser(address blocker, address subject) external {
        _validateSafetyPair(blocker, subject);
        if (!authorization.canActFor(msg.sender, blocker, BongGogglesIds420.ACTION_UNBLOCK)) revert Unauthorized();
        if (!_blocked[blocker][subject]) revert NotBlocked();
        delete _blocked[blocker][subject];
        emit Unblocked(blocker, subject, msg.sender);
    }

    function muteUser(address muter, address subject, uint32 scopes, uint64 expiresAt) external {
        _validateSafetyPair(muter, subject);
        if (!authorization.canActFor(msg.sender, muter, BongGogglesIds420.ACTION_MUTE)) revert Unauthorized();
        if (scopes == 0 || (expiresAt != 0 && expiresAt <= block.timestamp)) revert InvalidMute();
        _muted[muter][subject] = MuteState(scopes, uint64(block.timestamp), expiresAt);
        emit Muted(muter, subject, scopes, expiresAt, msg.sender);
    }

    function unmuteUser(address muter, address subject) external {
        _validateSafetyPair(muter, subject);
        if (!authorization.canActFor(msg.sender, muter, BongGogglesIds420.ACTION_UNMUTE)) revert Unauthorized();
        delete _muted[muter][subject];
        emit Unmuted(muter, subject, msg.sender);
    }

    function _friendRequestAllowed(address requester, address recipient) internal view returns (bool) {
        BongGogglesProfileRegistry420.Preferences memory p = profiles.preferences(recipient);
        if (p.friendRequestPolicy == BongGogglesTypes420.AccessPolicy.EVERYONE) return true;
        if (p.friendRequestPolicy == BongGogglesTypes420.AccessPolicy.FOLLOWERS) return isFollowing(requester, recipient);
        // FRIENDS is nonsensical for creating a friendship, FRIENDS_OF_FRIENDS has no canonical mutual lookup yet,
        // and NOBODY is explicit deny. All three therefore fail closed.
        return false;
    }

    function _pending(bytes32 requestId) internal view returns (FriendRequest storage r) {
        r = _friendRequests[requestId];
        if (r.requestId == bytes32(0)) revert RequestMissing();
        if (r.state != FriendRequestState.PENDING) revert RequestNotPending();
    }

    function _pendingFollow(bytes32 requestId) internal view returns (FollowRequest storage r) {
        r = _followRequests[requestId];
        if (r.requestId == bytes32(0)) revert FollowRequestMissing();
        if (r.state != FollowRequestState.PENDING) revert FollowRequestNotPending();
    }

    function _cancelFriendRequest(FriendRequest storage r, address operator) internal {
        r.state = FriendRequestState.CANCELLED;
        r.resolvedAt = uint64(block.timestamp);
        delete activeFriendRequestId[friendshipId(r.requester, r.recipient)];
        emit FriendRequestCancelled(r.requestId, r.requester, operator);
    }

    function _cancelFollowRequest(FollowRequest storage r, address operator) internal {
        r.state = FollowRequestState.CANCELLED;
        r.resolvedAt = uint64(block.timestamp);
        delete activeFollowRequestId[r.follower][r.subject];
        emit FollowRequestCancelled(r.requestId, r.follower, r.subject, operator);
    }

    function _cancelActiveRequests(address a, address b, address operator) internal {
        bytes32 fid = friendshipId(a, b);
        bytes32 friendRequestId_ = activeFriendRequestId[fid];
        if (friendRequestId_ != bytes32(0)) _cancelFriendRequest(_friendRequests[friendRequestId_], operator);

        bytes32 ab = activeFollowRequestId[a][b];
        if (ab != bytes32(0)) _cancelFollowRequest(_followRequests[ab], operator);
        bytes32 ba = activeFollowRequestId[b][a];
        if (ba != bytes32(0)) _cancelFollowRequest(_followRequests[ba], operator);
    }

    function _validateActivePair(address a, address b) internal view {
        if (a == address(0) || b == address(0)) revert ZeroAddress();
        if (a == b) revert SelfRelationship();
        if (!profiles.isActive(a) || !profiles.isActive(b)) revert ProfileInactive();
    }

    function _validateSafetyPair(address a, address b) internal view {
        if (a == address(0) || b == address(0)) revert ZeroAddress();
        if (a == b) revert SelfRelationship();
        if (!profiles.exists(a) || !profiles.exists(b)) revert ProfileMissing();
    }
}
