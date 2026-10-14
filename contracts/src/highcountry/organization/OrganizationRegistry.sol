// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import { R04EmergencyConsumer } from "../security/R04EmergencyConsumer.sol";
import { EmergencyDomains } from "../constants/EmergencyDomains.sol";

/// @notice R04.10 organization identity and explicit, consented membership.
/// @dev Organization admin powers have no implicit Wallet, RightsRegistry or treasury permissions.
contract OrganizationRegistry is R04EmergencyConsumer {
    constructor(
        address r04Authorization_
    ) R04EmergencyConsumer(r04Authorization_) { }
    error Invalid();
    error Unauthorized();
    enum Status {
        None,
        Active,
        Leaving,
        Removed
    }

    struct Organization {
        address administrator;
        bool active;
        bytes32 metadataHash;
    }

    struct Membership {
        Status status;
        uint64 joinedAt;
        uint64 exitRequestedAt;
        uint32 pendingObligations;
    }
    mapping(bytes32 => Organization) public organizations;
    mapping(bytes32 => mapping(address => Membership)) public members;
    mapping(bytes32 => mapping(address => bool)) public invitations;
    mapping(bytes32 => mapping(address => uint32)) public requestedObligationBalance;
    mapping(bytes32 => mapping(address => bool)) public dischargeRequested;
    event OrganizationCreated(bytes32 indexed id, address indexed administrator, bytes32 metadataHash);
    event Invitation(bytes32 indexed id, address indexed account, bool invited);
    event MemberStatus(bytes32 indexed id, address indexed account, Status status, uint32 obligations);
    event ObligationCount(bytes32 indexed id, address indexed account, uint32 count);
    event AdministratorChanged(bytes32 indexed id, address indexed oldAdmin, address indexed newAdmin);

    function create(
        bytes32 id,
        bytes32 metadataHash
    ) external r04Unrestricted(EmergencyDomains.ORGANIZATION_GOVERNANCE) {
        if (id == bytes32(0) || organizations[id].administrator != address(0)) revert Invalid();
        organizations[id] = Organization(msg.sender, true, metadataHash);
        members[id][msg.sender] = Membership(Status.Active, uint64(block.timestamp), 0, 0);
        emit OrganizationCreated(id, msg.sender, metadataHash);
        emit MemberStatus(id, msg.sender, Status.Active, 0);
    }

    function invite(
        bytes32 id,
        address account,
        bool invited
    ) external r04Unrestricted(EmergencyDomains.ORGANIZATION_GOVERNANCE) {
        Organization memory org = organizations[id];
        if (!org.active || msg.sender != org.administrator || account == address(0) || account == org.administrator) {
            revert Unauthorized();
        }
        invitations[id][account] = invited;
        emit Invitation(id, account, invited);
    }

    function join(
        bytes32 id
    ) external r04Unrestricted(EmergencyDomains.ORGANIZATION_GOVERNANCE) {
        if (
            !organizations[id].active || !invitations[id][msg.sender] || members[id][msg.sender].status == Status.Active
                || members[id][msg.sender].pendingObligations != 0
        ) revert Invalid();
        invitations[id][msg.sender] = false;
        members[id][msg.sender] = Membership(Status.Active, uint64(block.timestamp), 0, 0);
        emit MemberStatus(id, msg.sender, Status.Active, 0);
    }

    function requestLeave(
        bytes32 id
    ) external {
        Membership storage m = members[id][msg.sender];
        if (m.status != Status.Active || organizations[id].administrator == msg.sender) revert Unauthorized();
        m.status = Status.Leaving;
        m.exitRequestedAt = uint64(block.timestamp);
        emit MemberStatus(id, msg.sender, m.status, m.pendingObligations);
    }

    function remove(
        bytes32 id,
        address account
    ) external {
        if (msg.sender != organizations[id].administrator || account == msg.sender) revert Unauthorized();
        Membership storage m = members[id][account];
        if (m.status != Status.Active && m.status != Status.Leaving) revert Invalid();
        if (m.pendingObligations != 0) {
            m.status = Status.Leaving;
            m.exitRequestedAt = uint64(block.timestamp);
        } else {
            m.status = Status.Removed;
        }
        emit MemberStatus(id, account, m.status, m.pendingObligations);
    }

    /// @notice The member proposes a lower obligation count. This cannot release funds.
    function requestObligationDischarge(
        bytes32 id,
        uint32 remaining
    ) external {
        Membership storage m = members[id][msg.sender];
        if ((m.status != Status.Active && m.status != Status.Leaving) || remaining >= m.pendingObligations) {
            revert Unauthorized();
        }
        requestedObligationBalance[id][msg.sender] = remaining;
        dischargeRequested[id][msg.sender] = true;
    }

    /// @notice Two-party administrative confirmation of a noncustodial obligation record.
    /// @dev Canonical treasury settlement/dispute proofs remain independently required.
    function confirmObligationDischarge(
        bytes32 id,
        address member
    ) external {
        if (msg.sender != organizations[id].administrator || !dischargeRequested[id][member]) revert Unauthorized();
        Membership storage m = members[id][member];
        uint32 remaining = requestedObligationBalance[id][member];
        if (remaining >= m.pendingObligations) revert Invalid();
        delete dischargeRequested[id][member];
        delete requestedObligationBalance[id][member];
        m.pendingObligations = remaining;
        emit ObligationCount(id, member, remaining);
    }

    /// @dev Member opt-in reservation, not asset custody or external settlement.
    function reserveObligation(
        bytes32 id,
        uint32 amount
    ) external r04Unrestricted(EmergencyDomains.ORGANIZATION_GOVERNANCE) {
        Membership storage m = members[id][msg.sender];
        if (m.status != Status.Active || amount == 0) revert Unauthorized();
        m.pendingObligations += amount;
        delete dischargeRequested[id][msg.sender];
        delete requestedObligationBalance[id][msg.sender];
        emit ObligationCount(id, msg.sender, m.pendingObligations);
    }

    function finalizeExit(
        bytes32 id,
        address account
    ) external {
        Membership storage m = members[id][account];
        if (m.status != Status.Leaving || m.pendingObligations != 0) revert Invalid();
        if (msg.sender != account && msg.sender != organizations[id].administrator) revert Unauthorized();
        m.status = Status.Removed;
        emit MemberStatus(id, account, m.status, 0);
    }

    function transferAdmin(
        bytes32 id,
        address next
    ) external r04Unrestricted(EmergencyDomains.ORGANIZATION_GOVERNANCE) {
        Organization storage org = organizations[id];
        if (
            msg.sender != org.administrator || next == address(0) || next == msg.sender
                || members[id][next].status != Status.Active
        ) revert Unauthorized();
        Membership storage prior = members[id][msg.sender];
        if (prior.pendingObligations != 0) revert Invalid();
        org.administrator = next;
        emit AdministratorChanged(id, msg.sender, next);
    }

    function isActiveMember(
        bytes32 id,
        address who
    ) external view returns (bool) {
        return organizations[id].active && members[id][who].status == Status.Active;
    }
}
