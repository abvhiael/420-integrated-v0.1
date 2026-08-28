// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./VaultRegistry420.sol";

contract VaultAccounting420 is I420System {
    struct AssetAccounting { uint256 recordedBalance; uint256 reserved; uint256 claimable; uint256 released; }
    struct Obligation { bytes32 vaultId; address asset; address beneficiary; uint256 amount; bytes32 obligationType; bytes32 sourceRef; uint8 state; bool exists; }

    VaultRegistry420 public immutable registry;
    mapping(bytes32 => mapping(address => AssetAccounting)) private _accounting;
    mapping(bytes32 => Obligation) private _obligations;

    error ZeroAddress(); error UnauthorizedVault(); error ObligationExists(); error ObligationNotFound(); error InvalidAmount(); error InsufficientFreeBalance(); error InvalidObligationState();
    event DepositRecorded(bytes32 indexed vaultId,address indexed asset,uint256 amount,uint256 balance);
    event WithdrawalRecorded(bytes32 indexed vaultId,address indexed asset,uint256 amount,uint256 balance);
    event ObligationCreated(bytes32 indexed obligationId,bytes32 indexed vaultId,address indexed beneficiary,address asset,uint256 amount);
    event ObligationReleased(bytes32 indexed obligationId);
    event ObligationClaimed(bytes32 indexed obligationId,uint256 amount);

    constructor(address registry_) { if (registry_==address(0)) revert ZeroAddress(); registry=VaultRegistry420(registry_); }
    function systemName() external pure returns(string memory){return "VaultAccounting420";} function protocolVersion() external pure returns(uint32){return 1;}

    modifier onlyVault(bytes32 vaultId){ VaultRegistry420.Vault memory v=registry.getVault(vaultId); if(msg.sender!=v.vaultAddress) revert UnauthorizedVault(); _; }

    function recordDeposit(bytes32 vaultId,address asset,uint256 amount) external onlyVault(vaultId){ if(amount==0) revert InvalidAmount(); AssetAccounting storage a=_accounting[vaultId][asset]; a.recordedBalance+=amount; emit DepositRecorded(vaultId,asset,amount,a.recordedBalance); }
    function recordWithdrawal(bytes32 vaultId,address asset,uint256 amount) external onlyVault(vaultId){ AssetAccounting storage a=_accounting[vaultId][asset]; if(amount==0||amount>freeBalance(vaultId,asset)) revert InsufficientFreeBalance(); a.recordedBalance-=amount; a.released+=amount; emit WithdrawalRecorded(vaultId,asset,amount,a.recordedBalance); }
    function createObligation(bytes32 vaultId,bytes32 obligationId,address asset,address beneficiary,uint256 amount,bytes32 obligationType,bytes32 sourceRef) external onlyVault(vaultId){ if(obligationId==bytes32(0)||beneficiary==address(0)||amount==0) revert InvalidAmount(); if(_obligations[obligationId].exists) revert ObligationExists(); AssetAccounting storage a=_accounting[vaultId][asset]; if(amount>freeBalance(vaultId,asset)) revert InsufficientFreeBalance(); a.reserved+=amount; _obligations[obligationId]=Obligation(vaultId,asset,beneficiary,amount,obligationType,sourceRef,1,true); emit ObligationCreated(obligationId,vaultId,beneficiary,asset,amount); }
    function releaseObligation(bytes32 vaultId,bytes32 obligationId) external onlyVault(vaultId){ Obligation storage o=_obligations[obligationId]; if(!o.exists) revert ObligationNotFound(); if(o.vaultId!=vaultId||o.state!=1) revert InvalidObligationState(); AssetAccounting storage a=_accounting[vaultId][o.asset]; a.reserved-=o.amount; a.claimable+=o.amount; o.state=2; emit ObligationReleased(obligationId); }
    function recordClaim(bytes32 vaultId,bytes32 obligationId) external onlyVault(vaultId) returns(address asset,address beneficiary,uint256 amount){ Obligation storage o=_obligations[obligationId]; if(!o.exists) revert ObligationNotFound(); if(o.vaultId!=vaultId||o.state!=2) revert InvalidObligationState(); AssetAccounting storage a=_accounting[vaultId][o.asset]; a.claimable-=o.amount; a.recordedBalance-=o.amount; a.released+=o.amount; o.state=3; emit ObligationClaimed(obligationId,o.amount); return(o.asset,o.beneficiary,o.amount); }
    function freeBalance(bytes32 vaultId,address asset) public view returns(uint256){ AssetAccounting storage a=_accounting[vaultId][asset]; uint256 enc=a.reserved+a.claimable; return a.recordedBalance>enc?a.recordedBalance-enc:0; }
    function getAccounting(bytes32 vaultId,address asset) external view returns(AssetAccounting memory){return _accounting[vaultId][asset];}
    function getObligation(bytes32 obligationId) external view returns(Obligation memory o){o=_obligations[obligationId]; if(!o.exists) revert ObligationNotFound();}
}