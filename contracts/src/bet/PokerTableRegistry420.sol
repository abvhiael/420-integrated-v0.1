// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./BetAuthorization420.sol";
import "./BetOperatorRegistry420.sol";
import "./BetEmergencyState420.sol";

/// @notice Non-custodial cash-game table definitions and lifecycle authority.
/// @dev OPEN is a configuration state, NOT permission to seat, fund, deal, or play hands.
contract PokerTableRegistry420 {
    bytes32 public constant RULESET = keccak256("420.BET.POKER.NLHE.CASH.V1");
    bytes32 public constant ACTION_CREATE = keccak256("BET_POKER_TABLE_CREATE");
    bytes32 public constant ACTION_APPROVE = keccak256("BET_POKER_TABLE_APPROVE");
    bytes32 public constant ACTION_OPEN = keccak256("BET_POKER_TABLE_OPEN");
    bytes32 public constant ACTION_PAUSE = keccak256("BET_POKER_TABLE_PAUSE");
    bytes32 public constant ACTION_CLOSE = keccak256("BET_POKER_TABLE_CLOSE");
    enum Status { NONE, REGISTERED, APPROVED, OPEN, PAUSED, CLOSED }

    struct Configuration {
        bytes32 tableId;
        bytes32 gameVersionId;
        bytes32 rulesetId;
        bytes32 operatorId;
        bytes32 vaultId;
        bytes32 rakePolicyHash;
        bytes32 trustPolicyHash;
        address asset;
        uint8 seats;
        uint256 smallBlind;
        uint256 bigBlind;
        uint256 minBuyIn;
        uint256 maxBuyIn;
        uint16 maxRakeBps;
    }
    struct Table {
        Configuration config;
        bytes32 configHash;
        address controller;
        Status status;
        uint64 createdAt;
        bool exists;
    }

    BetAuthorization420 public immutable authorization;
    BetOperatorRegistry420 public immutable operators;
    BetEmergencyState420 public immutable emergency;
    mapping(bytes32 => Table) private _tables;

    error ZeroAddress();
    error InvalidConfiguration();
    error AlreadyExists();
    error NotFound();
    error Unauthorized();
    error InvalidTransition();
    error OperatorInactive();
    error EmergencyHalt();

    event TableRegistered(bytes32 indexed tableId, bytes32 indexed gameVersionId, bytes32 indexed configHash, address controller);
    event TableStatusChanged(bytes32 indexed tableId, Status fromStatus, Status toStatus);

    constructor(address authorization_, address operators_, address emergency_) {
        if (authorization_ == address(0) || operators_ == address(0) || emergency_ == address(0)) revert ZeroAddress();
        authorization = BetAuthorization420(authorization_);
        operators = BetOperatorRegistry420(operators_);
        emergency = BetEmergencyState420(emergency_);
    }

    function systemName() external pure returns (string memory) { return "PokerTableRegistry420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function hashConfiguration(Configuration memory c) public view returns (bytes32) {
        return keccak256(abi.encode("420.BET.POKER.TABLE.CONFIG.V1", block.chainid, address(this), c));
    }

    function register(Configuration calldata c, address controller) external {
        if (_tables[c.tableId].exists) revert AlreadyExists();
        if (controller == address(0) || c.tableId == bytes32(0) || c.gameVersionId == bytes32(0)
            || c.rulesetId != RULESET || c.operatorId == bytes32(0) || c.vaultId == bytes32(0)
            || c.rakePolicyHash == bytes32(0) || c.trustPolicyHash == bytes32(0)
            || c.asset == address(0) || c.seats < 2 || c.seats > 9
            || c.smallBlind == 0 || c.bigBlind != c.smallBlind * 2
            || c.minBuyIn < c.bigBlind || c.maxBuyIn < c.minBuyIn || c.maxRakeBps > 10000)
            revert InvalidConfiguration();
        _require(ACTION_CREATE, c.tableId);
        if (emergency.isHalted(BetTypes420.EmergencyDomain.POKER_NEW_TABLES, c.gameVersionId)) revert EmergencyHalt();
        if (!operators.isActive(c.operatorId)) revert OperatorInactive();
        bytes32 digest = hashConfiguration(c);
        _tables[c.tableId] = Table(c, digest, controller, Status.REGISTERED, uint64(block.timestamp), true);
        emit TableRegistered(c.tableId, c.gameVersionId, digest, controller);
    }

    function approve(bytes32 id) external { _transition(id, Status.REGISTERED, Status.APPROVED, ACTION_APPROVE); }
    function open(bytes32 id) external { _transition(id, Status.APPROVED, Status.OPEN, ACTION_OPEN); }
    function resume(bytes32 id) external { _transition(id, Status.PAUSED, Status.OPEN, ACTION_OPEN); }

    function pause(bytes32 id) external {
        Table storage t = _get(id);
        if (t.status != Status.OPEN && t.status != Status.APPROVED) revert InvalidTransition();
        _require(ACTION_PAUSE, id);
        Status previous = t.status;
        t.status = Status.PAUSED;
        emit TableStatusChanged(id, previous, Status.PAUSED);
    }
    function close(bytes32 id) external {
        Table storage t = _get(id);
        if (t.status == Status.CLOSED) revert InvalidTransition();
        _require(ACTION_CLOSE, id);
        Status previous = t.status;
        t.status = Status.CLOSED;
        emit TableStatusChanged(id, previous, Status.CLOSED);
    }
    function getTable(bytes32 id) external view returns (Table memory) { return _get(id); }

    function _transition(bytes32 id, Status expected, Status next, bytes32 action) private {
        Table storage t = _get(id);
        if (t.status != expected) revert InvalidTransition();
        _require(action, id);
        if (!operators.isActive(t.config.operatorId)) revert OperatorInactive();
        if (next == Status.OPEN && emergency.isHalted(BetTypes420.EmergencyDomain.POKER_NEW_TABLES, t.config.gameVersionId)) revert EmergencyHalt();
        t.status = next;
        emit TableStatusChanged(id, expected, next);
    }
    function _get(bytes32 id) private view returns (Table storage t) {
        t = _tables[id];
        if (!t.exists) revert NotFound();
    }
    function _require(bytes32 action, bytes32 id) private view {
        if (!authorization.isAuthorized(msg.sender, action, authorization.scopeForTable(id), 0))
            revert Unauthorized();
    }
}
