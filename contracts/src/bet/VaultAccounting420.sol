// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./BetAuthorization420.sol";
import "./BetIds420.sol";

contract VaultAccounting420 is I420System {
    struct VaultState {
        address asset;
        uint256 totalAssets;
        uint256 activeReservedLiability;
        uint256 safetyReserve;
        uint256 pendingWithdrawals;
        int256 realizedPnl;
        bool exists;
    }

    BetAuthorization420 public immutable authorization;
    mapping(bytes32 => VaultState) private _vaults;
    mapping(bytes32 => mapping(bytes32 => uint256)) public reservedByWager;

    error ZeroAddress();
    error InvalidId();
    error AlreadyExists();
    error NotFound();
    error Unauthorized();
    error InvalidAmount();
    error Insolvent();
    error AlreadyReserved();
    error NotReserved();

    event VaultRegistered(bytes32 indexed vaultId, address indexed asset);
    event AssetsRecorded(bytes32 indexed vaultId, uint256 amount, uint256 totalAssets);
    event SafetyReserveSet(bytes32 indexed vaultId, uint256 amount);
    event LiabilityReserved(bytes32 indexed vaultId, bytes32 indexed wagerId, uint256 amount);
    event LiabilityReleased(bytes32 indexed vaultId, bytes32 indexed wagerId, uint256 amount);
    event WithdrawalQueued(bytes32 indexed vaultId, uint256 amount, uint256 pendingWithdrawals);
    event WithdrawalCompleted(bytes32 indexed vaultId, uint256 amount, uint256 totalAssets);
    event RealizedPnlRecorded(bytes32 indexed vaultId, int256 delta, int256 cumulative);

    constructor(address authorization_) {
        if (authorization_ == address(0)) revert ZeroAddress();
        authorization = BetAuthorization420(authorization_);
    }

    function systemName() external pure returns (string memory) { return "VaultAccounting420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function registerVault(bytes32 vaultId, address asset) external {
        if (vaultId == bytes32(0)) revert InvalidId();
        if (_vaults[vaultId].exists) revert AlreadyExists();
        _requireAuth(vaultId, BetIds420.ACTION_VAULT_REGISTER, 0);
        _vaults[vaultId] = VaultState(asset, 0, 0, 0, 0, 0, true);
        emit VaultRegistered(vaultId, asset);
    }

    function recordDeposit(bytes32 vaultId, uint256 amount) external {
        if (amount == 0) revert InvalidAmount();
        VaultState storage v = _get(vaultId);
        _requireAuth(vaultId, BetIds420.ACTION_VAULT_RECORD_DEPOSIT, amount);
        v.totalAssets += amount;
        emit AssetsRecorded(vaultId, amount, v.totalAssets);
    }

    function setSafetyReserve(bytes32 vaultId, uint256 amount) external {
        VaultState storage v = _get(vaultId);
        _requireAuth(vaultId, BetIds420.ACTION_VAULT_SET_SAFETY_RESERVE, amount);
        if (amount + v.pendingWithdrawals + v.activeReservedLiability > v.totalAssets) revert Insolvent();
        v.safetyReserve = amount;
        emit SafetyReserveSet(vaultId, amount);
    }

    function reserveLiability(bytes32 vaultId, bytes32 wagerId, uint256 amount) external {
        if (wagerId == bytes32(0)) revert InvalidId();
        VaultState storage v = _get(vaultId);
        _requireAuth(vaultId, BetIds420.ACTION_VAULT_RESERVE_LIABILITY, amount);
        if (reservedByWager[vaultId][wagerId] != 0) revert AlreadyReserved();
        if (amount > availableForNewRisk(vaultId)) revert Insolvent();
        if (amount != 0) {
            reservedByWager[vaultId][wagerId] = amount;
            v.activeReservedLiability += amount;
        }
        emit LiabilityReserved(vaultId, wagerId, amount);
    }

    function releaseLiability(bytes32 vaultId, bytes32 wagerId) external returns (uint256 amount) {
        VaultState storage v = _get(vaultId);
        _requireAuth(vaultId, BetIds420.ACTION_VAULT_RELEASE_LIABILITY, 0);
        amount = reservedByWager[vaultId][wagerId];
        if (amount == 0) revert NotReserved();
        reservedByWager[vaultId][wagerId] = 0;
        v.activeReservedLiability -= amount;
        emit LiabilityReleased(vaultId, wagerId, amount);
    }

    function queueWithdrawal(bytes32 vaultId, uint256 amount) external {
        if (amount == 0) revert InvalidAmount();
        VaultState storage v = _get(vaultId);
        _requireAuth(vaultId, BetIds420.ACTION_VAULT_QUEUE_WITHDRAWAL, amount);
        if (amount > availableForWithdrawal(vaultId)) revert Insolvent();
        v.pendingWithdrawals += amount;
        emit WithdrawalQueued(vaultId, amount, v.pendingWithdrawals);
    }

    function completeWithdrawal(bytes32 vaultId, uint256 amount) external {
        if (amount == 0) revert InvalidAmount();
        VaultState storage v = _get(vaultId);
        _requireAuth(vaultId, BetIds420.ACTION_VAULT_CLAIM_WITHDRAWAL, amount);
        if (amount > v.pendingWithdrawals || amount > v.totalAssets) revert Insolvent();
        v.pendingWithdrawals -= amount;
        v.totalAssets -= amount;
        emit WithdrawalCompleted(vaultId, amount, v.totalAssets);
    }

    function recordRealizedPnl(bytes32 vaultId, int256 delta) external {
        VaultState storage v = _get(vaultId);
        uint256 magnitude = _abs(delta);
        _requireAuth(vaultId, BetIds420.ACTION_VAULT_RECORD_PNL, magnitude);
        if (delta < 0 && magnitude > v.totalAssets) revert Insolvent();
        if (delta >= 0) v.totalAssets += magnitude;
        else v.totalAssets -= magnitude;
        if (v.safetyReserve + v.pendingWithdrawals + v.activeReservedLiability > v.totalAssets) revert Insolvent();
        v.realizedPnl += delta;
        emit RealizedPnlRecorded(vaultId, delta, v.realizedPnl);
    }

    function getVault(bytes32 vaultId) external view returns (VaultState memory) { return _get(vaultId); }

    function availableForNewRisk(bytes32 vaultId) public view returns (uint256) {
        VaultState storage v = _get(vaultId);
        uint256 protected = v.safetyReserve + v.pendingWithdrawals + v.activeReservedLiability;
        return protected >= v.totalAssets ? 0 : v.totalAssets - protected;
    }

    function availableForWithdrawal(bytes32 vaultId) public view returns (uint256) {
        return availableForNewRisk(vaultId);
    }

    function lpEquity(bytes32 vaultId) external view returns (uint256) {
        VaultState storage v = _get(vaultId);
        return v.pendingWithdrawals >= v.totalAssets ? 0 : v.totalAssets - v.pendingWithdrawals;
    }

    function assetOf(bytes32 vaultId) external view returns (address) { return _get(vaultId).asset; }

    function _get(bytes32 vaultId) private view returns (VaultState storage v) {
        v = _vaults[vaultId];
        if (!v.exists) revert NotFound();
    }

    function _requireAuth(bytes32 vaultId, bytes32 action, uint256 amount) private view {
        if (!authorization.isAuthorized(msg.sender, action, authorization.scopeForVault(vaultId), amount)) revert Unauthorized();
    }

    function _abs(int256 value) private pure returns (uint256) {
        if (value >= 0) return uint256(value);
        return uint256(-(value + 1)) + 1;
    }
}
