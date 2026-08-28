// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "../interfaces/IVault420.sol";
import "./VaultRegistry420.sol";
import "./VaultAccounting420.sol";
import "./VaultAuthorization420.sol";

contract VaultRouter420 is I420System, IVault420 {
    VaultRegistry420 public immutable registry;
    VaultAccounting420 public immutable accounting;
    VaultAuthorization420 public immutable authorization;

    error ZeroAddress();

    constructor(address registry_,address accounting_,address authorization_){ if(registry_==address(0)||accounting_==address(0)||authorization_==address(0)) revert ZeroAddress(); registry=VaultRegistry420(registry_); accounting=VaultAccounting420(accounting_); authorization=VaultAuthorization420(authorization_); }
    function systemName() external pure returns(string memory){return "VaultRouter420";} function protocolVersion() external pure returns(uint32){return 1;}

    function readVault(bytes32 vaultId) external view returns(VaultRead memory out){
        VaultRegistry420.Vault memory v=registry.getVault(vaultId);
        out=VaultRead(v.vaultAddress,v.creatorAccount,v.vaultType,v.authorizationPolicyId,v.assetPolicyId,v.releasePolicyId,v.accountingPolicyId,v.beneficiarySetId,v.metadataHash,v.manifestHash,v.createdAt,v.revision,uint8(v.state),v.exists);
    }
    function readAccounting(bytes32 vaultId,address asset) external view returns(AssetAccountingRead memory out){
        VaultAccounting420.AssetAccounting memory a=accounting.getAccounting(vaultId,asset);
        out=AssetAccountingRead(a.recordedBalance,a.reserved,a.claimable,a.released,accounting.freeBalance(vaultId,asset));
    }
    function isAuthorized(address principal,bytes32 vaultId,bytes32 actionId,uint256 amount) external view returns(bool){ return authorization.isAuthorized(principal,vaultId,actionId,amount); }
}