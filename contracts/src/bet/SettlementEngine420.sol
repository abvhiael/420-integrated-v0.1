// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./BankrollVault420.sol";
import "./BetAuthorization420.sol";
import "./BetEconomics420.sol";
import "./BetEmergencyState420.sol";
import "./BetIds420.sol";
import "./BetRegistry420.sol";
import "./BetTypes420.sol";
import "./RiskManager420.sol";

contract SettlementEngine420 is I420System {
    BetAuthorization420 public immutable authorization;
    BetRegistry420 public immutable registry;
    RiskManager420 public immutable riskManager;
    BankrollVault420 public immutable vault;
    BetEconomics420 public immutable economics;
    bytes32 public immutable vaultId;
    address public immutable asset;
    BetEmergencyState420 public emergencyState;

    uint256 private _entered;

    error ZeroAddress();
    error Unauthorized();
    error WrongVault();
    error WrongAsset();
    error InvalidStatus();
    error InvalidOutcome();
    error InvalidPayout();
    error SettlementConflict();
    error Reentrancy();
    error EmergencyAlreadyBound();
    error EmergencyHalted(BetTypes420.EmergencyDomain domain, bytes32 subject);

    event SettlementCompleted(
        bytes32 indexed wagerId,
        BetTypes420.TerminalOutcome outcome,
        uint256 grossPayout,
        uint256 releasedLiability
    );
    event EmergencyStateBound(address indexed emergencyState);

    constructor(address authorization_, address registry_, address riskManager_, address vault_, address economics_) {
        if (
            authorization_ == address(0) || registry_ == address(0) || riskManager_ == address(0)
                || vault_ == address(0) || economics_ == address(0)
        ) revert ZeroAddress();
        authorization = BetAuthorization420(authorization_);
        registry = BetRegistry420(registry_);
        riskManager = RiskManager420(riskManager_);
        vault = BankrollVault420(vault_);
        economics = BetEconomics420(payable(economics_));
        vaultId = vault.vaultId();
        asset = vault.asset();
    }

    modifier nonReentrant() {
        if (_entered != 0) revert Reentrancy();
        _entered = 1;
        _;
        _entered = 0;
    }

    function systemName() external pure returns (string memory) { return "SettlementEngine420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function bindEmergencyState(address emergencyState_) external {
        if (emergencyState_ == address(0)) revert ZeroAddress();
        if (address(emergencyState) != address(0)) revert EmergencyAlreadyBound();
        if (!authorization.isAuthorized(msg.sender, BetIds420.ACTION_EMERGENCY_SET, authorization.scopeGlobal(), 0)) {
            revert Unauthorized();
        }
        emergencyState = BetEmergencyState420(emergencyState_);
        emit EmergencyStateBound(emergencyState_);
    }

    function settle(bytes32 wagerId, BetTypes420.TerminalOutcome outcome, uint256 grossPayout)
        external
        nonReentrant
        returns (BetTypes420.Settlement memory settlement)
    {
        BetTypes420.Wager memory wager = registry.getWager(wagerId);
        if (wager.vaultId != vaultId) revert WrongVault();
        if (wager.asset != asset) revert WrongAsset();

        if (registry.settlementExists(wagerId)) {
            settlement = registry.getSettlement(wagerId);
            if (settlement.outcome != outcome || settlement.grossPayout != grossPayout) revert SettlementConflict();
            return settlement;
        }

        if (wager.status != BetTypes420.WagerStatus.ACCEPTED && wager.status != BetTypes420.WagerStatus.OUTCOME_READY) {
            revert InvalidStatus();
        }
        _validateTerminalEconomics(wager, outcome, grossPayout);
        _requireSettlementOpenOrRefund(wager, outcome);
        if (
            !authorization.isAuthorized(
                msg.sender,
                BetIds420.ACTION_SETTLE,
                authorization.scopeForWager(wagerId),
                grossPayout
            )
        ) revert Unauthorized();

        uint256 releasedLiability = riskManager.releaseExposure(wagerId);
        vault.resolveWager(wagerId, grossPayout);
        registry.recordSettlement(wagerId, outcome, grossPayout);
        economics.finalizeWagerFees(wagerId, outcome);
        settlement = registry.getSettlement(wagerId);

        emit SettlementCompleted(wagerId, outcome, grossPayout, releasedLiability);
    }

    function _requireSettlementOpenOrRefund(
        BetTypes420.Wager memory wager,
        BetTypes420.TerminalOutcome outcome
    ) private view {
        BetEmergencyState420 e = emergencyState;
        if (address(e) == address(0)) return;
        if (!e.isHalted(BetTypes420.EmergencyDomain.SETTLEMENT_HOLD, wager.settlementProfileId)) return;
        if (outcome != BetTypes420.TerminalOutcome.VOID) {
            revert EmergencyHalted(BetTypes420.EmergencyDomain.SETTLEMENT_HOLD, wager.settlementProfileId);
        }
    }

    function _validateTerminalEconomics(
        BetTypes420.Wager memory wager,
        BetTypes420.TerminalOutcome outcome,
        uint256 grossPayout
    ) private pure {
        if (outcome == BetTypes420.TerminalOutcome.NONE) revert InvalidOutcome();
        if (grossPayout > wager.maxGrossPayout) revert InvalidPayout();

        if (outcome == BetTypes420.TerminalOutcome.LOSS) {
            if (grossPayout >= wager.stake) revert InvalidPayout();
            return;
        }
        if (outcome == BetTypes420.TerminalOutcome.PUSH) {
            if (grossPayout != wager.stake) revert InvalidPayout();
            return;
        }
        if (outcome == BetTypes420.TerminalOutcome.WIN) {
            if (grossPayout <= wager.stake) revert InvalidPayout();
            return;
        }
        if (outcome == BetTypes420.TerminalOutcome.VOID) {
            if (grossPayout != wager.stake) revert InvalidPayout();
            return;
        }
        revert InvalidOutcome();
    }
}
