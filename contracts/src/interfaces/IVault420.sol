// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

interface IVault420 {
    struct VaultRead {
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
        uint8 state;
        bool exists;
    }

    struct AssetAccountingRead {
        uint256 recordedBalance;
        uint256 reserved;
        uint256 claimable;
        uint256 released;
        uint256 freeBalance;
    }

    function readVault(bytes32 vaultId) external view returns (VaultRead memory);
    function readAccounting(bytes32 vaultId,address asset) external view returns (AssetAccountingRead memory);
    function isAuthorized(address principal,bytes32 vaultId,bytes32 actionId,uint256 amount) external view returns(bool);
}