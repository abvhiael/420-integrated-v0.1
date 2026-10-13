// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import {OrganizationTreasuryPermissions} from "./OrganizationTreasuryPermissions.sol";
import {TreasuryRouter420} from "../../treasury/TreasuryRouter420.sol";
import {TreasuryDisbursementRegistry420} from "../../treasury/TreasuryDisbursementRegistry420.sol";
import {GameIdentity420} from "../../gaming/GameIdentity420.sol";
import {HighCountryGamingIds} from "../player/HighCountryGamingIds.sol";
import {R04EmergencyConsumer} from "../security/R04EmergencyConsumer.sol";
import {EmergencyDomains} from "../constants/EmergencyDomains.sol";

/// @notice Bounded HC permission AND canonical Treasury execution authority; no funds or token allowance are held here.
/// @dev Canonical Treasury owns budget, policy, capability and independently authorized vault-release provenance.
contract CanonicalOrganizationTreasuryGateway is R04EmergencyConsumer {
    error InvalidIntegration();
    TreasuryRouter420 public immutable router;
    GameIdentity420 public immutable identity;
    address public immutable executor;
    OrganizationTreasuryPermissions public permissions;
    mapping(bytes32 => bool) public executed;
    event Reconciled(bytes32 indexed disbursement, bytes32 indexed permission, bytes32 releaseReceipt);
    constructor(address router_, address identity_, address executor_) {
        if (router_.code.length == 0 || identity_.code.length == 0 || executor_ == address(0)) revert InvalidIntegration();
        router = TreasuryRouter420(router_);
        identity = GameIdentity420(identity_);
        executor = executor_;
    }
    function bindPermissions(address candidate) external {
        if (msg.sender != emergencyBinder || address(permissions) != address(0) || candidate.code.length == 0)
            revert InvalidIntegration();
        OrganizationTreasuryPermissions p = OrganizationTreasuryPermissions(candidate);
        if (p.treasury() != address(this)) revert InvalidIntegration();
        permissions = p;
    }
    function execute(bytes32 disbursement, bytes32 permission, bytes32 releaseReceipt)
        external r04Unrestricted(EmergencyDomains.ORGANIZATION_GOVERNANCE) {
        if (msg.sender != executor || executed[disbursement] || address(permissions) == address(0)
            || releaseReceipt == bytes32(0) || !router.isExecutable(disbursement)) revert InvalidIntegration();
        TreasuryDisbursementRegistry420 d = router.disbursements();
        TreasuryDisbursementRegistry420.Disbursement memory record = d.disbursement(disbursement);
        bytes32 profileId = identity.profileIdOf(HighCountryGamingIds.GAME_ID, record.recipient);
        if (profileId == bytes32(0) || !identity.gameRegistry().isActive(HighCountryGamingIds.GAME_ID))
            revert InvalidIntegration();
        GameIdentity420.GameProfile memory profile = identity.profile(profileId);
        if (profile.account != record.recipient || profile.gameId != HighCountryGamingIds.GAME_ID)
            revert InvalidIntegration();
        permissions.consume(permission, record.recipient, keccak256("HC.ORG.TREASURY"), disbursement, record.amount);
        // Independent TreasuryAuthorization420 must separately grant this gateway the exact disbursement and amount.
        d.markExecuted(disbursement, releaseReceipt);
        executed[disbursement] = true;
        emit Reconciled(disbursement, permission, releaseReceipt);
    }
}
