// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./BongGogglesAuthorization420.sol";
import "./BongGogglesProfileRegistry420.sol";
import "./BongGogglesRelationshipGraph420.sol";
import "./BongGogglesSocialPolicy420.sol";

/// @notice Canonical social-game session and move-commitment surface for Bong Goggles V1.
/// @dev This contract never escrows wagers or determines game rules. Wagered play belongs in 420Bet.
contract BongGogglesGameSessionRegistry420 {
    enum GameType { CRIBBAGE, RUSSIAN_CRIBBAGE, CHESS, WORD_GAME, CHECKERS, BACKGAMMON, DOMINOES }
    enum SessionState { NONE, INVITED, ACTIVE, FINISHED, DECLINED, CANCELLED }

    struct Session {
        bytes32 sessionId;
        address playerA;
        address playerB;
        GameType gameType;
        bytes32 rulesetHash;
        bytes32 randomnessRef;
        uint64 createdAt;
        uint64 startedAt;
        uint64 finishedAt;
        uint64 nextMoveNumber;
        SessionState state;
        address winner;
        bool exists;
    }

    BongGogglesAuthorization420 public immutable authorization;
    BongGogglesProfileRegistry420 public immutable profiles;
    BongGogglesRelationshipGraph420 public immutable relationships;
    BongGogglesSocialPolicy420 public immutable policy;

    bytes32 public constant ACTION_GAME_INVITE = keccak256("BG/ACTION/GAME_INVITE/V1");
    bytes32 public constant ACTION_GAME_ACCEPT = keccak256("BG/ACTION/GAME_ACCEPT/V1");
    bytes32 public constant ACTION_GAME_DECLINE = keccak256("BG/ACTION/GAME_DECLINE/V1");
    bytes32 public constant ACTION_GAME_MOVE = keccak256("BG/ACTION/GAME_MOVE/V1");
    bytes32 public constant ACTION_GAME_FINISH = keccak256("BG/ACTION/GAME_FINISH/V1");
    bytes32 public constant ACTION_GAME_CANCEL = keccak256("BG/ACTION/GAME_CANCEL/V1");

    mapping(bytes32 => Session) private _sessions;
    mapping(bytes32 => mapping(uint64 => bytes32)) public moveCommitment;
    mapping(address => uint256) public inviteNonce;

    error ZeroAddress();
    error Unauthorized();
    error InvalidPlayers();
    error ProfileInactive();
    error InviteDenied();
    error InvalidRuleset();
    error SessionMissing();
    error InvalidState();
    error WrongPlayer();
    error RelationshipBlocked();
    error InvalidMoveNumber();
    error EmptyCommitment();
    error InvalidWinner();
    error WageringUnsupported();

    event GameInvited(bytes32 indexed sessionId, address indexed inviter, address indexed recipient, GameType gameType, bytes32 rulesetHash);
    event GameAccepted(bytes32 indexed sessionId, address indexed accepter, uint64 startedAt);
    event GameDeclined(bytes32 indexed sessionId, address indexed recipient);
    event GameCancelled(bytes32 indexed sessionId, address indexed actor);
    event GameMoveCommitted(bytes32 indexed sessionId, uint64 indexed moveNumber, address indexed player, bytes32 moveHash);
    event GameFinished(bytes32 indexed sessionId, address indexed winner, address indexed actor, uint64 finishedAt);

    constructor(address authorization_, address profiles_, address relationships_, address policy_) {
        if (authorization_ == address(0) || profiles_ == address(0) || relationships_ == address(0) || policy_ == address(0)) revert ZeroAddress();
        authorization = BongGogglesAuthorization420(authorization_);
        profiles = BongGogglesProfileRegistry420(profiles_);
        relationships = BongGogglesRelationshipGraph420(relationships_);
        policy = BongGogglesSocialPolicy420(policy_);
    }

    function session(bytes32 sessionId) external view returns (Session memory) { return _sessions[sessionId]; }

    function invite(
        address inviter,
        address recipient,
        GameType gameType,
        bytes32 rulesetHash,
        bytes32 randomnessRef,
        uint256 wagerAmount
    ) external returns (bytes32 sessionId) {
        if (inviter == address(0) || recipient == address(0)) revert ZeroAddress();
        if (inviter == recipient) revert InvalidPlayers();
        if (wagerAmount != 0) revert WageringUnsupported();
        if (rulesetHash == bytes32(0)) revert InvalidRuleset();
        if (!authorization.canActFor(msg.sender, inviter, ACTION_GAME_INVITE)) revert Unauthorized();
        if (!profiles.isActive(inviter) || !profiles.isActive(recipient)) revert ProfileInactive();
        if (!policy.canInviteToGame(inviter, recipient)) revert InviteDenied();

        uint256 nonce = ++inviteNonce[inviter];
        sessionId = keccak256(abi.encode("420/BONG_GOGGLES/GAME_SESSION/V1", block.chainid, inviter, recipient, gameType, rulesetHash, nonce));
        uint64 now_ = uint64(block.timestamp);
        _sessions[sessionId] = Session(sessionId, inviter, recipient, gameType, rulesetHash, randomnessRef, now_, 0, 0, 1, SessionState.INVITED, address(0), true);
        emit GameInvited(sessionId, inviter, recipient, gameType, rulesetHash);
    }

    function accept(address recipient, bytes32 sessionId) external {
        Session storage s = _get(sessionId);
        if (s.state != SessionState.INVITED) revert InvalidState();
        if (recipient != s.playerB) revert WrongPlayer();
        if (!authorization.canActFor(msg.sender, recipient, ACTION_GAME_ACCEPT)) revert Unauthorized();
        _requirePlayablePair(s.playerA, s.playerB);
        if (!policy.canInviteToGame(s.playerA, s.playerB)) revert InviteDenied();
        s.state = SessionState.ACTIVE;
        s.startedAt = uint64(block.timestamp);
        emit GameAccepted(sessionId, recipient, s.startedAt);
    }

    function decline(address recipient, bytes32 sessionId) external {
        Session storage s = _get(sessionId);
        if (s.state != SessionState.INVITED) revert InvalidState();
        if (recipient != s.playerB) revert WrongPlayer();
        if (!authorization.canActFor(msg.sender, recipient, ACTION_GAME_DECLINE)) revert Unauthorized();
        s.state = SessionState.DECLINED;
        s.finishedAt = uint64(block.timestamp);
        emit GameDeclined(sessionId, recipient);
    }

    function commitMove(address player, bytes32 sessionId, uint64 moveNumber, bytes32 moveHash) external {
        Session storage s = _get(sessionId);
        if (s.state != SessionState.ACTIVE) revert InvalidState();
        if (!_isPlayer(s, player)) revert WrongPlayer();
        if (!authorization.canActFor(msg.sender, player, ACTION_GAME_MOVE)) revert Unauthorized();
        _requirePlayablePair(s.playerA, s.playerB);
        if (moveNumber != s.nextMoveNumber) revert InvalidMoveNumber();
        if (moveHash == bytes32(0)) revert EmptyCommitment();
        moveCommitment[sessionId][moveNumber] = moveHash;
        s.nextMoveNumber = moveNumber + 1;
        emit GameMoveCommitted(sessionId, moveNumber, player, moveHash);
    }

    function finish(address actor, bytes32 sessionId, address winner) external {
        Session storage s = _get(sessionId);
        if (s.state != SessionState.ACTIVE) revert InvalidState();
        if (!_isPlayer(s, actor)) revert WrongPlayer();
        if (!authorization.canActFor(msg.sender, actor, ACTION_GAME_FINISH)) revert Unauthorized();
        if (winner != address(0) && !_isPlayer(s, winner)) revert InvalidWinner();
        s.state = SessionState.FINISHED;
        s.winner = winner;
        s.finishedAt = uint64(block.timestamp);
        emit GameFinished(sessionId, winner, actor, s.finishedAt);
    }

    function cancel(address actor, bytes32 sessionId) external {
        Session storage s = _get(sessionId);
        if (s.state != SessionState.INVITED) revert InvalidState();
        if (!_isPlayer(s, actor)) revert WrongPlayer();
        if (!authorization.canActFor(msg.sender, actor, ACTION_GAME_CANCEL)) revert Unauthorized();
        s.state = SessionState.CANCELLED;
        s.finishedAt = uint64(block.timestamp);
        emit GameCancelled(sessionId, actor);
    }

    function _requirePlayablePair(address a, address b) internal view {
        if (!profiles.isActive(a) || !profiles.isActive(b)) revert ProfileInactive();
        if (relationships.isBlockedEither(a, b)) revert RelationshipBlocked();
    }

    function _isPlayer(Session storage s, address account) internal view returns (bool) {
        return account == s.playerA || account == s.playerB;
    }

    function _get(bytes32 sessionId) internal view returns (Session storage s) {
        s = _sessions[sessionId];
        if (!s.exists) revert SessionMissing();
    }
}
