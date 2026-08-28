// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../../interfaces/I420System.sol";
import "./BetSlotAuthorization420.sol";
import "./BetSlotIds420.sol";

contract SlotDefinitionRegistry420 is I420System {
    enum SlotStatus {
        NONE,
        DRAFT,
        REVIEW,
        APPROVED,
        ACTIVE,
        PAUSED,
        DEPRECATED
    }

    struct SlotDefinition {
        bytes32 slotId;
        uint32 version;
        uint32 engineVersion;
        bytes32 manifestHash;
        bytes32 codeHash;
        bytes32 reelSetHash;
        bytes32 paytableHash;
        bytes32 rtpArtifactHash;
        bytes32 liabilityArtifactHash;
        uint256 maxMultiplier;
        SlotStatus status;
        uint64 registeredAt;
    }

    BetSlotAuthorization420 public immutable authorization;

    mapping(bytes32 => SlotDefinition) private _definitions;
    mapping(bytes32 => bool) private _vaultAuthorizations;

    error ZeroAddress();
    error Unauthorized();
    error InvalidSlotId();
    error InvalidVersion();
    error InvalidEngineVersion();
    error InvalidCommitment();
    error InvalidMaxMultiplier();
    error SlotAlreadyRegistered();
    error SlotNotFound();
    error InvalidStateTransition();
    error VaultAlreadyAuthorized();
    error VaultNotAuthorized();

    event SlotRegistered(
        bytes32 indexed slotId,
        uint32 indexed version,
        uint32 engineVersion,
        bytes32 manifestHash,
        bytes32 codeHash,
        bytes32 reelSetHash,
        bytes32 paytableHash,
        bytes32 rtpArtifactHash,
        bytes32 liabilityArtifactHash,
        uint256 maxMultiplier
    );
    event SlotStatusChanged(bytes32 indexed slotId, uint32 indexed version, SlotStatus previousStatus, SlotStatus newStatus);
    event SlotVaultAuthorizationChanged(bytes32 indexed vaultId, bytes32 indexed slotId, uint32 indexed version, bool authorized);

    constructor(address authorization_) {
        if (authorization_ == address(0)) revert ZeroAddress();
        authorization = BetSlotAuthorization420(authorization_);
    }

    function systemName() external pure returns (string memory) { return "SlotDefinitionRegistry420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function definitionKey(bytes32 slotId, uint32 version) public pure returns (bytes32) {
        return keccak256(abi.encode(slotId, version));
    }

    function vaultAuthorizationKey(bytes32 vaultId, bytes32 slotId, uint32 version) public pure returns (bytes32) {
        return keccak256(abi.encode(vaultId, slotId, version));
    }

    function registerSlot(
        bytes32 slotId,
        uint32 version,
        uint32 engineVersion,
        bytes32 manifestHash,
        bytes32 codeHash,
        bytes32 reelSetHash,
        bytes32 paytableHash,
        bytes32 rtpArtifactHash,
        bytes32 liabilityArtifactHash,
        uint256 maxMultiplier
    ) external {
        _requireSlotAuthorization(slotId, version, BetSlotIds420.ACTION_REGISTER);
        if (slotId == bytes32(0)) revert InvalidSlotId();
        if (version == 0) revert InvalidVersion();
        if (engineVersion == 0) revert InvalidEngineVersion();
        if (
            manifestHash == bytes32(0) ||
            codeHash == bytes32(0) ||
            reelSetHash == bytes32(0) ||
            paytableHash == bytes32(0) ||
            rtpArtifactHash == bytes32(0) ||
            liabilityArtifactHash == bytes32(0)
        ) revert InvalidCommitment();
        if (maxMultiplier == 0) revert InvalidMaxMultiplier();

        bytes32 key = definitionKey(slotId, version);
        if (_definitions[key].status != SlotStatus.NONE) revert SlotAlreadyRegistered();

        _definitions[key] = SlotDefinition({
            slotId: slotId,
            version: version,
            engineVersion: engineVersion,
            manifestHash: manifestHash,
            codeHash: codeHash,
            reelSetHash: reelSetHash,
            paytableHash: paytableHash,
            rtpArtifactHash: rtpArtifactHash,
            liabilityArtifactHash: liabilityArtifactHash,
            maxMultiplier: maxMultiplier,
            status: SlotStatus.DRAFT,
            registeredAt: uint64(block.timestamp)
        });

        emit SlotRegistered(
            slotId,
            version,
            engineVersion,
            manifestHash,
            codeHash,
            reelSetHash,
            paytableHash,
            rtpArtifactHash,
            liabilityArtifactHash,
            maxMultiplier
        );
        emit SlotStatusChanged(slotId, version, SlotStatus.NONE, SlotStatus.DRAFT);
    }

    function submitForReview(bytes32 slotId, uint32 version) external {
        _requireSlotAuthorization(slotId, version, BetSlotIds420.ACTION_SUBMIT_REVIEW);
        _transition(slotId, version, SlotStatus.DRAFT, SlotStatus.REVIEW);
    }

    function approveSlot(bytes32 slotId, uint32 version) external {
        _requireSlotAuthorization(slotId, version, BetSlotIds420.ACTION_APPROVE);
        _transition(slotId, version, SlotStatus.REVIEW, SlotStatus.APPROVED);
    }

    function activateSlot(bytes32 slotId, uint32 version) external {
        _requireSlotAuthorization(slotId, version, BetSlotIds420.ACTION_ACTIVATE);
        SlotDefinition storage definition = _definition(slotId, version);
        SlotStatus previous = definition.status;
        if (previous != SlotStatus.APPROVED && previous != SlotStatus.PAUSED) revert InvalidStateTransition();
        definition.status = SlotStatus.ACTIVE;
        emit SlotStatusChanged(slotId, version, previous, SlotStatus.ACTIVE);
    }

    function pauseSlot(bytes32 slotId, uint32 version) external {
        _requireSlotAuthorization(slotId, version, BetSlotIds420.ACTION_PAUSE);
        _transition(slotId, version, SlotStatus.ACTIVE, SlotStatus.PAUSED);
    }

    function deprecateSlot(bytes32 slotId, uint32 version) external {
        _requireSlotAuthorization(slotId, version, BetSlotIds420.ACTION_DEPRECATE);
        SlotDefinition storage definition = _definition(slotId, version);
        SlotStatus previous = definition.status;
        if (previous == SlotStatus.DEPRECATED || previous == SlotStatus.NONE) revert InvalidStateTransition();
        definition.status = SlotStatus.DEPRECATED;
        emit SlotStatusChanged(slotId, version, previous, SlotStatus.DEPRECATED);
    }

    function authorizeSlotForVault(bytes32 vaultId, bytes32 slotId, uint32 version) external {
        _requireVaultAuthorization(vaultId, slotId, version, BetSlotIds420.ACTION_VAULT_AUTHORIZE);
        if (vaultId == bytes32(0)) revert InvalidSlotId();
        SlotDefinition storage definition = _definition(slotId, version);
        if (
            definition.status != SlotStatus.APPROVED &&
            definition.status != SlotStatus.ACTIVE &&
            definition.status != SlotStatus.PAUSED
        ) revert InvalidStateTransition();

        bytes32 key = vaultAuthorizationKey(vaultId, slotId, version);
        if (_vaultAuthorizations[key]) revert VaultAlreadyAuthorized();
        _vaultAuthorizations[key] = true;
        emit SlotVaultAuthorizationChanged(vaultId, slotId, version, true);
    }

    function revokeSlotForVault(bytes32 vaultId, bytes32 slotId, uint32 version) external {
        _requireVaultAuthorization(vaultId, slotId, version, BetSlotIds420.ACTION_VAULT_REVOKE);
        _definition(slotId, version);
        bytes32 key = vaultAuthorizationKey(vaultId, slotId, version);
        if (!_vaultAuthorizations[key]) revert VaultNotAuthorized();
        _vaultAuthorizations[key] = false;
        emit SlotVaultAuthorizationChanged(vaultId, slotId, version, false);
    }

    function getSlot(bytes32 slotId, uint32 version) external view returns (SlotDefinition memory) {
        SlotDefinition storage definition = _definition(slotId, version);
        return definition;
    }

    function isVaultAuthorized(bytes32 vaultId, bytes32 slotId, uint32 version) public view returns (bool) {
        return _vaultAuthorizations[vaultAuthorizationKey(vaultId, slotId, version)];
    }

    function isPlayable(bytes32 vaultId, bytes32 slotId, uint32 version) external view returns (bool) {
        SlotDefinition storage definition = _definitions[definitionKey(slotId, version)];
        return definition.status == SlotStatus.ACTIVE && isVaultAuthorized(vaultId, slotId, version);
    }

    function _transition(bytes32 slotId, uint32 version, SlotStatus expected, SlotStatus next) private {
        SlotDefinition storage definition = _definition(slotId, version);
        if (definition.status != expected) revert InvalidStateTransition();
        definition.status = next;
        emit SlotStatusChanged(slotId, version, expected, next);
    }

    function _definition(bytes32 slotId, uint32 version) private view returns (SlotDefinition storage definition) {
        definition = _definitions[definitionKey(slotId, version)];
        if (definition.status == SlotStatus.NONE) revert SlotNotFound();
    }

    function _requireSlotAuthorization(bytes32 slotId, uint32 version, bytes32 actionId) private view {
        if (!authorization.isSlotAuthorized(msg.sender, slotId, version, actionId)) revert Unauthorized();
    }

    function _requireVaultAuthorization(bytes32 vaultId, bytes32 slotId, uint32 version, bytes32 actionId) private view {
        if (!authorization.isSlotVaultAuthorized(msg.sender, vaultId, slotId, version, actionId)) revert Unauthorized();
    }
}