// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import { CooperativeRegistry } from "./CooperativeRegistry.sol";
import { OrganizationRegistry } from "../organization/OrganizationRegistry.sol";

/// @notice Fixed snapshot voting, one vote per enrolled member, no token delegation.
contract CooperativeGovernance {
    error Unauthorized();
    error Invalid();

    struct Proposal {
        bytes32 cooperative;
        address proposer;
        bytes32 action;
        bytes32 scope;
        bytes32 value;
        uint64 end;
        uint64 executableAfter;
        uint32 eligible;
        uint32 quorum;
        uint32 yesVotes;
        uint32 noVotes;
        bool executed;
        bool cancelled;
    }
    CooperativeRegistry public immutable registry;
    uint64 public constant VOTING_PERIOD = 3 days;
    uint64 public constant TIMELOCK = 2 days;
    mapping(bytes32 => Proposal) public proposals;
    mapping(bytes32 => mapping(address => bool)) public voterSnapshot;
    mapping(bytes32 => mapping(address => bool)) public voted;
    mapping(bytes32 => uint256) public nonces;
    bytes32 public constant ACTION_SET_POLICY = keccak256("HC.COOP.POLICY.SET");
    event Proposed(bytes32 indexed id, bytes32 indexed cooperative, uint32 electorate, uint32 quorum);
    event Voted(bytes32 indexed id, address indexed member, bool support);
    event Cancelled(bytes32 indexed id);
    event MarkedExecuted(bytes32 indexed id);
    address public executor;

    constructor(
        address registry_
    ) {
        if (registry_.code.length == 0) revert Invalid();
        registry = CooperativeRegistry(registry_);
    }
    /// @notice Bind a single verified executor once, only by the cooperative contract deployer.
    /// @dev Immutable bootstrap caller tracked separately; no arbitrary override.
    address public immutable deployer = msg.sender;

    function bindExecutor(
        address executor_
    ) external {
        if (msg.sender != deployer || executor != address(0) || executor_.code.length == 0) revert Unauthorized();
        executor = executor_;
    }

    function propose(
        bytes32 cooperative,
        bytes32 action,
        bytes32 scope,
        bytes32 value
    ) external returns (bytes32 id) {
        (bytes32 org,, uint32 version,, bool active) = registry.cooperatives(cooperative);
        if (
            !active || version != 1 || action != ACTION_SET_POLICY || scope == bytes32(0)
                || !registry.enrolled(cooperative, msg.sender)
                || !OrganizationRegistry(address(registry.organizations())).isActiveMember(org, msg.sender)
        ) revert Unauthorized();
        uint256 len = registry.voterCount(cooperative);
        if (len == 0 || len > 64) revert Invalid();
        id = keccak256(
            abi.encode(block.chainid, address(this), cooperative, ++nonces[cooperative], action, scope, value)
        );
        uint32 eligible;
        for (uint256 i; i < len; i++) {
            address m = registry.voterAt(cooperative, i);
            if (OrganizationRegistry(address(registry.organizations())).isActiveMember(org, m)) {
                voterSnapshot[id][m] = true;
                eligible++;
            }
        }
        if (eligible < 2) revert Invalid();
        proposals[id] = Proposal(
            cooperative,
            msg.sender,
            action,
            scope,
            value,
            uint64(block.timestamp + VOTING_PERIOD),
            uint64(block.timestamp + VOTING_PERIOD + TIMELOCK),
            eligible,
            eligible / 2 + 1,
            0,
            0,
            false,
            false
        );
        emit Proposed(id, cooperative, eligible, eligible / 2 + 1);
    }

    function vote(
        bytes32 id,
        bool support
    ) external {
        Proposal storage p = proposals[id];
        if (
            p.end == 0 || block.timestamp >= p.end || p.cancelled || p.executed || voted[id][msg.sender]
                || !voterSnapshot[id][msg.sender]
        ) revert Unauthorized();
        (bytes32 org,,,,) = registry.cooperatives(p.cooperative);
        if (!OrganizationRegistry(address(registry.organizations())).isActiveMember(org, msg.sender)) {
            revert Unauthorized();
        }
        voted[id][msg.sender] = true;
        if (support) p.yesVotes++;
        else p.noVotes++;
        emit Voted(id, msg.sender, support);
    }

    function cancel(
        bytes32 id
    ) external {
        Proposal storage p = proposals[id];
        if (p.end == 0 || p.executed || p.cancelled || msg.sender != p.proposer || block.timestamp >= p.end) {
            revert Unauthorized();
        }
        p.cancelled = true;
        emit Cancelled(id);
    }

    function executable(
        bytes32 id
    ) public view returns (bool) {
        Proposal memory p = proposals[id];
        if (
            p.end == 0 || p.cancelled || p.executed || block.timestamp < p.executableAfter || p.yesVotes < p.quorum
                || p.yesVotes <= p.noVotes
        ) return false;
        (bytes32 org,, uint32 version,, bool active) = registry.cooperatives(p.cooperative);
        return active && version == 1
            && OrganizationRegistry(address(registry.organizations())).isActiveMember(org, p.proposer);
    }

    function executionPayload(
        bytes32 id
    ) external view returns (bytes32 coop, bytes32 action, bytes32 scope, bytes32 value) {
        Proposal storage p = proposals[id];
        return (p.cooperative, p.action, p.scope, p.value);
    }

    function markExecuted(
        bytes32 id
    ) external {
        if (msg.sender != executor || !executable(id)) revert Unauthorized();
        proposals[id].executed = true;
        emit MarkedExecuted(id);
    }
}
