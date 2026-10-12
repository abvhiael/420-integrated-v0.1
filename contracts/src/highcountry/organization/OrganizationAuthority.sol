// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import { OrganizationRegistry } from "./OrganizationRegistry.sol";

/// @notice R04.10 bounded organizational delegation, with no implicit custody or token approval.
/// @dev Treasury execution MUST be separately authorized by the canonical treasury module.
contract OrganizationAuthority {
    error Invalid();
    error Unauthorized();

    struct Delegation {
        bytes32 organization;
        address issuer;
        address delegate;
        bytes32 action;
        bytes32 scope;
        uint64 starts;
        uint64 expires;
        uint32 remainingUses;
        bool revoked;
    }
    OrganizationRegistry public immutable registry;
    mapping(bytes32 => Delegation) public delegations;
    mapping(bytes32 => uint256) public nonce;
    event Delegated(
        bytes32 indexed id, bytes32 indexed organization, address indexed delegate, bytes32 action, bytes32 scope
    );
    event Revoked(bytes32 indexed id);
    event Consumed(bytes32 indexed id, uint32 remainingUses);
    bytes32 public constant CULTIVATION_ACTION = keccak256("HC.ORG.NONCUSTODIAL.CULTIVATION");
    bytes32 public constant ROSTER_ACTION = keccak256("HC.ORG.NONCUSTODIAL.ROSTER");
    bytes32 public constant NOTICES_ACTION = keccak256("HC.ORG.NONCUSTODIAL.NOTICES");
    bytes32 public constant TREASURY_ACTION = keccak256("HC.ORG.TREASURY");
    bytes32 public constant WALLET_ACTION = keccak256("HC.ORG.WALLET");
    bytes32 public constant RIGHTS_ACTION = keccak256("HC.ORG.RIGHTS");

    constructor(
        address registry_
    ) {
        if (registry_.code.length == 0) revert Invalid();
        registry = OrganizationRegistry(registry_);
    }

    function delegate(
        bytes32 org,
        address who,
        bytes32 action,
        bytes32 scope,
        uint64 starts,
        uint64 expires,
        uint32 maxUses
    ) external returns (bytes32 id) {
        (address admin, bool active,) = registry.organizations(org);
        if (
            !active || msg.sender != admin || who == address(0) || who == admin || action == bytes32(0)
                || scope == bytes32(0) || action == TREASURY_ACTION || action == WALLET_ACTION
                || action == RIGHTS_ACTION || maxUses == 0 || expires <= starts || expires <= block.timestamp
                || !registry.isActiveMember(org, who)
        ) revert Unauthorized();
        id = keccak256(abi.encode(block.chainid, address(this), org, ++nonce[org], who, action, scope));
        delegations[id] = Delegation(org, msg.sender, who, action, scope, starts, expires, maxUses, false);
        emit Delegated(id, org, who, action, scope);
    }

    function valid(
        bytes32 id,
        address who,
        bytes32 action,
        bytes32 scope
    ) public view returns (bool) {
        Delegation memory d = delegations[id];
        (address admin, bool active,) = registry.organizations(d.organization);
        return active && !d.revoked && d.issuer == admin && d.delegate == who && d.action == action && d.scope == scope
            && d.remainingUses != 0 && block.timestamp >= d.starts && block.timestamp < d.expires
            && registry.isActiveMember(d.organization, who);
    }

    /// @notice A caller can consume only its own explicitly bounded, nonfinancial permission.
    function consume(
        bytes32 id,
        bytes32 action,
        bytes32 scope
    ) external {
        if (!valid(id, msg.sender, action, scope)) revert Unauthorized();
        Delegation storage d = delegations[id];
        unchecked {
            --d.remainingUses;
        }
        emit Consumed(id, d.remainingUses);
    }

    function revoke(
        bytes32 id
    ) external {
        Delegation storage d = delegations[id];
        (address admin,,) = registry.organizations(d.organization);
        if (
            d.delegate == address(0) || d.revoked
                || (msg.sender != d.issuer && msg.sender != admin && msg.sender != d.delegate)
        ) {
            revert Unauthorized();
        }
        d.revoked = true;
        emit Revoked(id);
    }
}
