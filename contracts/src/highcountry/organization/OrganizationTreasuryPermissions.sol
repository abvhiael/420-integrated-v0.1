// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import { R04EmergencyConsumer } from "../security/R04EmergencyConsumer.sol";
import { EmergencyDomains } from "../constants/EmergencyDomains.sol";
import { OrganizationRegistry } from "./OrganizationRegistry.sol";

/// @notice R04.10 noncustodial treasury permission policy requiring independent approval.
/// @dev No wallet signing, ERC20 allowance, transfer, payment or treasury execution is performed here.
contract OrganizationTreasuryPermissions is R04EmergencyConsumer {
    error Invalid();
    error Unauthorized();

    struct Permission {
        bytes32 organization;
        address proposer;
        address beneficiary;
        bytes32 action;
        bytes32 scope;
        uint64 expires;
        uint256 remainingAmount;
        bool approved;
        bool revoked;
    }
    OrganizationRegistry public immutable registry;
    address public immutable treasury;
    address public immutable independentApprover;
    mapping(bytes32 => Permission) public permissions;
    mapping(bytes32 => uint256) public nonces;
    event Proposed(bytes32 indexed id, bytes32 indexed organization, address indexed beneficiary, uint256 maxAmount);
    event Approved(bytes32 indexed id, address indexed approver);
    event Debited(bytes32 indexed id, uint256 amount, uint256 remaining);
    event Cancelled(bytes32 indexed id);

    constructor(
        address r04Authorization_,
        address registry_,
        address treasury_,
        address approver_
    ) R04EmergencyConsumer(r04Authorization_) {
        if (
            registry_.code.length == 0 || treasury_.code.length == 0 || approver_ == address(0)
                || approver_ == treasury_
        ) {
            revert Invalid();
        }
        registry = OrganizationRegistry(registry_);
        treasury = treasury_;
        independentApprover = approver_;
    }

    function propose(
        bytes32 org,
        address beneficiary,
        bytes32 action,
        bytes32 scope,
        uint64 expires,
        uint256 limit
    ) external r04Unrestricted(EmergencyDomains.ORGANIZATION_GOVERNANCE) returns (bytes32 id) {
        (address admin, bool active,) = registry.organizations(org);
        if (
            !active || msg.sender != admin || beneficiary == address(0) || action == bytes32(0) || scope == bytes32(0)
                || limit == 0 || expires <= block.timestamp || !registry.isActiveMember(org, beneficiary)
        ) revert Unauthorized();
        id = keccak256(abi.encode(block.chainid, address(this), org, ++nonces[org], beneficiary, action, scope));
        permissions[id] = Permission(org, msg.sender, beneficiary, action, scope, expires, limit, false, false);
        emit Proposed(id, org, beneficiary, limit);
    }

    /// @dev Independent financial approver is not organization administrator.
    function approve(
        bytes32 id
    ) external r04Unrestricted(EmergencyDomains.ORGANIZATION_GOVERNANCE) {
        Permission storage p = permissions[id];
        (address admin, bool active,) = registry.organizations(p.organization);
        if (
            msg.sender != independentApprover || msg.sender == admin || !active || p.proposer != admin || p.revoked
                || p.approved || p.expires <= block.timestamp
        ) revert Unauthorized();
        p.approved = true;
        emit Approved(id, msg.sender);
    }

    function permitted(
        bytes32 id,
        address beneficiary,
        bytes32 action,
        bytes32 scope,
        uint256 amount
    ) public view returns (bool) {
        if (!r04DomainOpen(EmergencyDomains.ORGANIZATION_GOVERNANCE)) return false;
        Permission memory p = permissions[id];
        (address admin, bool active,) = registry.organizations(p.organization);
        return active && p.approved && !p.revoked && p.proposer == admin && p.beneficiary == beneficiary
            && p.action == action && p.scope == scope && registry.isActiveMember(p.organization, beneficiary)
            && block.timestamp < p.expires && amount != 0 && amount <= p.remainingAmount;
    }

    /// @notice A canonical treasury adapter consumes the precise authorized debit before settlement.
    /// @dev The treasury must independently verify its own asset balance, custody and transaction policy.
    function consume(
        bytes32 id,
        address beneficiary,
        bytes32 action,
        bytes32 scope,
        uint256 amount
    ) external r04Unrestricted(EmergencyDomains.ORGANIZATION_GOVERNANCE) {
        if (msg.sender != treasury || !permitted(id, beneficiary, action, scope, amount)) revert Unauthorized();
        Permission storage p = permissions[id];
        p.remainingAmount -= amount;
        emit Debited(id, amount, p.remainingAmount);
    }

    function revoke(
        bytes32 id
    ) external {
        Permission storage p = permissions[id];
        (address admin,,) = registry.organizations(p.organization);
        if (
            p.beneficiary == address(0) || p.revoked
                || (msg.sender != admin && msg.sender != independentApprover && msg.sender != p.beneficiary)
        ) revert Unauthorized();
        p.revoked = true;
        emit Cancelled(id);
    }
}
