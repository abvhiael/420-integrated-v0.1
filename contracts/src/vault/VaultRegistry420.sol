// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./VaultAuthorization420.sol";
import "./VaultPolicyRegistry420.sol";
import "./VaultIds420.sol";

interface IVaultRegistration420 {
    function vaultId() external view returns (bytes32);
    function registry() external view returns (address);
    function registrationCreator() external view returns (address);
    function canClose() external view returns (bool);
}

contract VaultRegistry420 is I420System {
    enum VaultState { NONE, ACTIVE, FROZEN, WINDING_DOWN, CLOSED }

    struct Vault {
        address vaultAddress;
        address creatorAccount;
        bytes32 vaultType;
        bytes32 authorizationPolicyId;
        bytes32 assetPolicyId;
        bytes32 releasePolicyId;
        bytes32 accountingPolicyId;
        bytes32 beneficiarySetId;
        bytes32 metadataHash;
        bytes32 manifestHash;
        uint64 createdAt;
        uint32 revision;
        VaultState state;
        bool exists;
    }

    VaultAuthorization420 public immutable authorization;
    VaultPolicyRegistry420 public immutable policies;
    mapping(bytes32 => Vault) private _vaults;
    mapping(address => bytes32) public vaultIdForAddress;

    error ZeroAddress();
    error InvalidVaultId();
    error InvalidVaultType();
    error VaultAlreadyExists();
    error VaultNotFound();
    error AddressAlreadyRegistered();
    error Unauthorized();
    error InvalidPolicy();
    error InvalidStateTransition();
    error InvalidVaultRegistration();
    error OutstandingAssetsOrObligations();
    error NoChange();

    event VaultRegistered(bytes32 indexed vaultId, address indexed vaultAddress, address indexed creatorAccount, bytes32 vaultType);
    event VaultMetadataUpdated(bytes32 indexed vaultId, bytes32 metadataHash, bytes32 manifestHash, uint32 revision);
    event VaultStateChanged(bytes32 indexed vaultId, VaultState previousState, VaultState newState, uint32 revision);

    constructor(address authorization_, address policies_) {
        if (authorization_ == address(0) || policies_ == address(0)) revert ZeroAddress();
        authorization = VaultAuthorization420(authorization_);
        policies = VaultPolicyRegistry420(policies_);
    }

    function systemName() external pure returns (string memory) { return "VaultRegistry420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function registerVault(
        bytes32 vaultId,
        address vaultAddress,
        bytes32 vaultType,
        bytes32 authorizationPolicyId,
        bytes32 assetPolicyId,
        bytes32 releasePolicyId,
        bytes32 accountingPolicyId,
        bytes32 beneficiarySetId,
        bytes32 metadataHash,
        bytes32 manifestHash
    ) external {
        if (vaultId == bytes32(0)) revert InvalidVaultId();
        if (vaultAddress == address(0)) revert ZeroAddress();
        if (_vaults[vaultId].exists) revert VaultAlreadyExists();
        if (vaultIdForAddress[vaultAddress] != bytes32(0)) revert AddressAlreadyRegistered();
        if (!_validVaultType(vaultType)) revert InvalidVaultType();
        _requirePolicyType(authorizationPolicyId, VaultIds420.POLICY_AUTHORIZATION);
        _requirePolicyType(assetPolicyId, VaultIds420.POLICY_ASSET);
        _requirePolicyType(releasePolicyId, VaultIds420.POLICY_RELEASE);
        _requirePolicyType(accountingPolicyId, VaultIds420.POLICY_ACCOUNTING);

        IVaultRegistration420 candidate = IVaultRegistration420(vaultAddress);
        if (candidate.vaultId() != vaultId || candidate.registry() != address(this) || candidate.registrationCreator() != msg.sender) {
            revert InvalidVaultRegistration();
        }

        _vaults[vaultId] = Vault({
            vaultAddress: vaultAddress,
            creatorAccount: msg.sender,
            vaultType: vaultType,
            authorizationPolicyId: authorizationPolicyId,
            assetPolicyId: assetPolicyId,
            releasePolicyId: releasePolicyId,
            accountingPolicyId: accountingPolicyId,
            beneficiarySetId: beneficiarySetId,
            metadataHash: metadataHash,
            manifestHash: manifestHash,
            createdAt: uint64(block.timestamp),
            revision: 1,
            state: VaultState.ACTIVE,
            exists: true
        });
        vaultIdForAddress[vaultAddress] = vaultId;
        emit VaultRegistered(vaultId, vaultAddress, msg.sender, vaultType);
    }

    function updateMetadata(bytes32 vaultId, bytes32 metadataHash, bytes32 manifestHash) external {
        Vault storage vault = _get(vaultId);
        _requireAuth(vaultId, VaultIds420.ACTION_UPDATE_METADATA, 0);
        if (vault.state == VaultState.CLOSED) revert InvalidStateTransition();
        vault.metadataHash = metadataHash;
        vault.manifestHash = manifestHash;
        vault.revision += 1;
        emit VaultMetadataUpdated(vaultId, metadataHash, manifestHash, vault.revision);
    }

    function setState(bytes32 vaultId, VaultState newState) external {
        Vault storage vault = _get(vaultId);
        VaultState oldState = vault.state;
        if (newState == oldState) revert NoChange();

        bytes32 actionId;
        if (oldState == VaultState.ACTIVE && newState == VaultState.FROZEN) {
            actionId = VaultIds420.ACTION_FREEZE;
        } else if (oldState == VaultState.FROZEN && newState == VaultState.ACTIVE) {
            actionId = VaultIds420.ACTION_UNFREEZE;
        } else if ((oldState == VaultState.ACTIVE || oldState == VaultState.FROZEN) && newState == VaultState.WINDING_DOWN) {
            actionId = VaultIds420.ACTION_BEGIN_WIND_DOWN;
        } else if (oldState == VaultState.WINDING_DOWN && newState == VaultState.CLOSED) {
            actionId = VaultIds420.ACTION_CLOSE;
            if (!IVaultRegistration420(vault.vaultAddress).canClose()) revert OutstandingAssetsOrObligations();
        } else {
            revert InvalidStateTransition();
        }

        _requireAuth(vaultId, actionId, 0);
        vault.state = newState;
        vault.revision += 1;
        emit VaultStateChanged(vaultId, oldState, newState, vault.revision);
    }

    function getVault(bytes32 vaultId) external view returns (Vault memory vault) {
        vault = _vaults[vaultId];
        if (!vault.exists) revert VaultNotFound();
    }

    function vaultState(bytes32 vaultId) external view returns (VaultState) { return _get(vaultId).state; }

    function _get(bytes32 vaultId) private view returns (Vault storage vault) {
        vault = _vaults[vaultId];
        if (!vault.exists) revert VaultNotFound();
    }

    function _requireAuth(bytes32 vaultId, bytes32 actionId, uint256 amount) private view {
        if (!authorization.isAuthorized(msg.sender, vaultId, actionId, amount)) revert Unauthorized();
    }

    function _requirePolicyType(bytes32 policyId, bytes32 policyType) private view {
        if (policyId == bytes32(0) || !policies.isActiveOfType(policyId, policyType)) revert InvalidPolicy();
    }

    function _validVaultType(bytes32 x) private pure returns (bool) {
        return x == VaultIds420.VAULT_PERSONAL || x == VaultIds420.VAULT_ESCROW || x == VaultIds420.VAULT_TREASURY
            || x == VaultIds420.VAULT_RESERVE || x == VaultIds420.VAULT_COLLATERAL || x == VaultIds420.VAULT_ROYALTY
            || x == VaultIds420.VAULT_BENEFICIARY || x == VaultIds420.VAULT_PROJECT || x == VaultIds420.VAULT_COMMUNITY
            || x == VaultIds420.VAULT_APPLICATION;
    }
}
