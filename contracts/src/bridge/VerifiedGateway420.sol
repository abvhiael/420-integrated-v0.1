// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../libraries/AppDependencyIds420.sol";

import "../system/GenesisResidentAccess420.sol";
import "../interfaces/genesis/Types420.sol";
import "../interfaces/genesis/ISystemSafety420.sol";
import "../interfaces/genesis/IReplayProtection420.sol";
import "../interfaces/genesis/Errors420.sol";
import "../libraries/GenesisInterfaceIds420.sol";
import "./BridgeIds420.sol";

interface IVerifiedGatewayVerifier420 {
    function verifyDeposit(bytes calldata proof) external view returns (
        bytes32 depositId,
        address recipient,
        address asset,
        uint256 amount
    );
    function verifyWithdrawal(bytes calldata proof) external view returns (
        bytes32 withdrawalId,
        address recipient,
        address asset,
        uint256 amount
    );
}

/// @notice Restricted verified gateway retained for proof-oriented bridge routes.
/// @dev Shared pause/safety/replay and canonical settlement eligibility are authoritative.
contract VerifiedGateway420 is GenesisResidentAccess420 {
    address public verifier;
    mapping(bytes32 => bool) public consumedDeposits;
    mapping(bytes32 => bool) public consumedWithdrawals;
    mapping(address => bool) public approvedAssets;

    event VerifierSet(address indexed verifier);
    event AssetApproval(address indexed asset, bool approved);
    event DepositVerified(bytes32 indexed depositId, address indexed recipient, address indexed asset, uint256 amount);
    event WithdrawalVerified(bytes32 indexed withdrawalId, address indexed recipient, address indexed asset, uint256 amount);

    constructor(address timelock_, address registry_, bytes32 genesisConfigHash_, address verifier_)
        GenesisResidentAccess420(timelock_, registry_, genesisConfigHash_)
    {
        require(verifier_ != address(0) && verifier_.code.length != 0, "verifier");
        verifier = verifier_;
    }

    function componentId() public pure override returns (bytes32) { return BridgeIds420.VERIFIED_GATEWAY; }

    function setVerifier(address verifier_) external {
        _requireGenesisGovernance(BridgeIds420.ACTION_CONFIGURE);
        require(verifier_ != address(0) && verifier_.code.length != 0, "verifier");
        verifier = verifier_;
        emit VerifierSet(verifier_);
    }

    function setAsset(address asset, bool approved) external {
        _requireGenesisGovernance(BridgeIds420.ACTION_CONFIGURE);
        if (approved) _canonicalSettlementAsset(asset);
        approvedAssets[asset] = approved;
        emit AssetApproval(asset, approved);
    }

    function _checkReplay(bytes32 id) internal view {
        if (id == bytes32(0)) revert Errors420.InvalidIdentifier();
        IReplayProtection420 replay = IReplayProtection420(_resolveRequired(AppDependencyIds420.REPLAY_PROTECTION));
        if (replay.isConsumed(id)) revert Errors420.Replay(id);
    }

    function verifyDeposit(bytes calldata proof)
        external
        returns (bytes32 depositId, address recipient, address asset, uint256 amount)
    {
        _requireOperational(
            BridgeIds420.ACTION_INBOUND,
            ISystemSafety420.ActionClass.NORMAL_ONLY,
            Types420.Direction.INBOUND
        );
        (depositId, recipient, asset, amount) = IVerifiedGatewayVerifier420(verifier).verifyDeposit(proof);
        _checkReplay(depositId);
        require(!consumedDeposits[depositId], "replay");
        require(recipient != address(0) && amount > 0 && approvedAssets[asset], "transfer");
        _canonicalSettlementAsset(asset);
        consumedDeposits[depositId] = true;
        emit DepositVerified(depositId, recipient, asset, amount);
    }

    function verifyWithdrawal(bytes calldata proof)
        external
        returns (bytes32 withdrawalId, address recipient, address asset, uint256 amount)
    {
        _requireOperational(
            BridgeIds420.ACTION_OUTBOUND,
            ISystemSafety420.ActionClass.NORMAL_ONLY,
            Types420.Direction.OUTBOUND
        );
        (withdrawalId, recipient, asset, amount) = IVerifiedGatewayVerifier420(verifier).verifyWithdrawal(proof);
        _checkReplay(withdrawalId);
        require(!consumedWithdrawals[withdrawalId], "replay");
        require(recipient != address(0) && amount > 0 && approvedAssets[asset], "transfer");
        _canonicalSettlementAsset(asset);
        consumedWithdrawals[withdrawalId] = true;
        emit WithdrawalVerified(withdrawalId, recipient, asset, amount);
    }
}
