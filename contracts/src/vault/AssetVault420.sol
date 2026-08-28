// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./VaultRegistry420.sol";
import "./VaultAuthorization420.sol";
import "./VaultAccounting420.sol";
import "./VaultIds420.sol";

interface IERC20Vault420 { function transfer(address to,uint256 amount) external returns(bool); function transferFrom(address from,address to,uint256 amount) external returns(bool); }

contract AssetVault420 is I420System {
    bytes32 public immutable vaultId;
    VaultRegistry420 public immutable registry;
    VaultAuthorization420 public immutable authorization;
    VaultAccounting420 public immutable accounting;
    mapping(bytes32 => bool) public executedOperation;

    error ZeroAddress(); error Unauthorized(); error InvalidState(); error Replay(); error TransferFailed(); error InvalidAmount(); error WrongVaultRegistration();
    event NativeDeposited(address indexed from,uint256 amount); event TokenDeposited(address indexed token,address indexed from,uint256 amount); event Withdrawal(bytes32 indexed operationId,address indexed asset,address indexed recipient,uint256 amount); event ObligationOperation(bytes32 indexed operationId,bytes32 indexed obligationId,bytes32 actionId);

    constructor(bytes32 vaultId_,address registry_,address authorization_,address accounting_){ if(vaultId_==bytes32(0)||registry_==address(0)||authorization_==address(0)||accounting_==address(0)) revert ZeroAddress(); vaultId=vaultId_; registry=VaultRegistry420(registry_); authorization=VaultAuthorization420(authorization_); accounting=VaultAccounting420(accounting_); }
    function systemName() external pure returns(string memory){return "AssetVault420";} function protocolVersion() external pure returns(uint32){return 1;}
    receive() external payable { _recordNativeDeposit(); }
    function depositNative() external payable { _recordNativeDeposit(); }
    function depositToken(address token,uint256 amount) external { if(token==address(0)||amount==0) revert InvalidAmount(); _requireOperationalForDeposit(); if(!IERC20Vault420(token).transferFrom(msg.sender,address(this),amount)) revert TransferFailed(); accounting.recordDeposit(vaultId,token,amount); emit TokenDeposited(token,msg.sender,amount); }

    function withdraw(bytes32 operationId,address asset,address recipient,uint256 amount) external { _requireActive(); _consume(operationId); if(recipient==address(0)||amount==0) revert InvalidAmount(); if(!authorization.isRouteAuthorized(msg.sender,vaultId,VaultIds420.ACTION_WITHDRAW,asset,recipient,amount) && !authorization.isAuthorized(msg.sender,vaultId,VaultIds420.ACTION_WITHDRAW,amount)) revert Unauthorized(); accounting.recordWithdrawal(vaultId,asset,amount); _send(asset,recipient,amount); emit Withdrawal(operationId,asset,recipient,amount); }

    function createObligation(bytes32 operationId,bytes32 obligationId,address asset,address beneficiary,uint256 amount,bytes32 obligationType,bytes32 sourceRef) external { _requireActive(); _consume(operationId); if(!authorization.isAuthorized(msg.sender,vaultId,VaultIds420.ACTION_CREATE_OBLIGATION,amount)) revert Unauthorized(); accounting.createObligation(vaultId,obligationId,asset,beneficiary,amount,obligationType,sourceRef); emit ObligationOperation(operationId,obligationId,VaultIds420.ACTION_CREATE_OBLIGATION); }
    function releaseObligation(bytes32 operationId,bytes32 obligationId) external { _requireNotClosed(); _consume(operationId); if(!authorization.isAuthorized(msg.sender,vaultId,VaultIds420.ACTION_RELEASE_OBLIGATION,0)) revert Unauthorized(); accounting.releaseObligation(vaultId,obligationId); emit ObligationOperation(operationId,obligationId,VaultIds420.ACTION_RELEASE_OBLIGATION); }
    function claim(bytes32 operationId,bytes32 obligationId) external { _requireNotClosed(); _consume(operationId); (address asset,address beneficiary,uint256 amount)=accounting.recordClaim(vaultId,obligationId); if(msg.sender!=beneficiary && !authorization.isAuthorized(msg.sender,vaultId,VaultIds420.ACTION_CLAIM,amount)) revert Unauthorized(); _send(asset,beneficiary,amount); emit Withdrawal(operationId,asset,beneficiary,amount); }

    function _recordNativeDeposit() private { if(msg.value==0) revert InvalidAmount(); _requireOperationalForDeposit(); accounting.recordDeposit(vaultId,address(0),msg.value); emit NativeDeposited(msg.sender,msg.value); }
    function _consume(bytes32 operationId) private { if(operationId==bytes32(0)||executedOperation[operationId]) revert Replay(); executedOperation[operationId]=true; }
    function _requireRegistered() private view { VaultRegistry420.Vault memory v=registry.getVault(vaultId); if(v.vaultAddress!=address(this)) revert WrongVaultRegistration(); }
    function _requireActive() private view { _requireRegistered(); if(registry.vaultState(vaultId)!=VaultRegistry420.VaultState.ACTIVE) revert InvalidState(); }
    function _requireNotClosed() private view { _requireRegistered(); if(registry.vaultState(vaultId)==VaultRegistry420.VaultState.CLOSED) revert InvalidState(); }
    function _requireOperationalForDeposit() private view { _requireRegistered(); VaultRegistry420.VaultState s=registry.vaultState(vaultId); if(s==VaultRegistry420.VaultState.CLOSED||s==VaultRegistry420.VaultState.WINDING_DOWN) revert InvalidState(); }
    function _send(address asset,address recipient,uint256 amount) private { if(asset==address(0)){ (bool ok,)=payable(recipient).call{value:amount}(""); if(!ok) revert TransferFailed(); } else if(!IERC20Vault420(asset).transfer(recipient,amount)) revert TransferFailed(); }
}