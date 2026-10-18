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
import "./KenoV1420.sol";
import "./PlinkoV1420.sol";
import "./ReferenceSlotV1420.sol";
import "./RouletteV1420.sol";
import "./BlackjackV1420.sol";
import "./MinesV1420.sol";
import "./CrashV1420.sol";
import "./VideoPokerResolverV1420.sol";

contract SettlementEngine420 is I420System {
    BetAuthorization420 public immutable authorization;
    BetRegistry420 public immutable registry;
    RiskManager420 public immutable riskManager;
    BankrollVault420 public immutable vault;
    BetEconomics420 public immutable economics;
    bytes32 public immutable vaultId;
    address public immutable asset;
    BetEmergencyState420 public emergencyState;
    bytes32 private constant KENO_GAME_ID = keccak256("420BET.GAME.KENO");
    mapping(bytes32 => address) public kenoResolver;
    bytes32 private constant PLINKO_GAME_ID = keccak256("420BET.GAME.PLINKO");
    mapping(bytes32 => address) public plinkoResolver;
    bytes32 private constant SLOT_GAME_ID = keccak256("420BET.GAME.SLOT");
    mapping(bytes32 => address) public slotResolver;
    bytes32 private constant ROULETTE_GAME_ID = keccak256("420BET.GAME.ROULETTE");
    mapping(bytes32 => address) public rouletteResolver;
    bytes32 private constant BLACKJACK_GAME_ID = keccak256("420BET.GAME.BLACKJACK");
    mapping(bytes32 => address) public blackjackResolver;
    bytes32 private constant MINES_GAME_ID = keccak256("420BET.GAME.MINES");
    mapping(bytes32 => address) public minesResolver;
    bytes32 private constant CRASH_GAME_ID = keccak256("420BET.GAME.CRASH");
    mapping(bytes32 => address) public crashResolver;
    bytes32 private constant VIDEO_POKER_GAME_ID = keccak256("420BET.GAME.VIDEO_POKER");
    mapping(bytes32 => address) public videoPokerResolver;

    uint256 private _entered;

    error ZeroAddress();
    error Unauthorized();
    error WrongVault();
    error WrongAsset();
    error InvalidStatus();
    error InvalidOutcome();
    error InvalidPayout();
    error SettlementConflict();
    error KenoCanonicalSettlementRequired();
    error KenoResolverAlreadyBound();
    error PlinkoCanonicalSettlementRequired();
    error PlinkoResolverAlreadyBound();
    error SlotCanonicalSettlementRequired();
    error SlotResolverAlreadyBound();
    error RouletteCanonicalSettlementRequired();
    error RouletteResolverAlreadyBound();
    error BlackjackCanonicalSettlementRequired();
    error BlackjackResolverAlreadyBound();
    error MinesCanonicalSettlementRequired();
    error MinesResolverAlreadyBound();
    error CrashCanonicalSettlementRequired();
    error CrashResolverAlreadyBound();
    error VideoPokerCanonicalSettlementRequired();
    error VideoPokerResolverAlreadyBound();
    error Reentrancy();
    error EmergencyAlreadyBound();
    error WagerExpired();
    error WagerNotExpired();
    error EmergencyHalted(BetTypes420.EmergencyDomain domain, bytes32 subject);

    event SettlementCompleted(
        bytes32 indexed wagerId,
        BetTypes420.TerminalOutcome outcome,
        uint256 grossPayout,
        uint256 releasedLiability
    );
    event ExpiredWagerVoided(bytes32 indexed wagerId, address indexed caller);
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

    function bindKenoResolver(bytes32 gameVersionId, address resolver) external {
        if (resolver == address(0) || gameVersionId == bytes32(0)) revert ZeroAddress();
        if (kenoResolver[gameVersionId] != address(0)) revert KenoResolverAlreadyBound();
        KenoV1420 k = KenoV1420(resolver);
        if (k.gameId() != KENO_GAME_ID || k.gameVersionId() != gameVersionId ||
            address(k.wagerRegistry()) != address(registry)) revert InvalidStatus();
        if (!authorization.isAuthorized(msg.sender, BetIds420.ACTION_GAME_REGISTER,
            authorization.scopeForGame(KENO_GAME_ID, gameVersionId), 0)) revert Unauthorized();
        kenoResolver[gameVersionId] = resolver;
    }

    function settleKeno(bytes32 wagerId, KenoV1420.Params calldata params)
        external nonReentrant returns (BetTypes420.Settlement memory settlement)
    {
        BetTypes420.Wager memory wager = registry.getWager(wagerId);
        if (wager.gameId != KENO_GAME_ID) revert InvalidStatus();
        address resolver = kenoResolver[wager.gameVersionId];
        if (resolver == address(0) ||
            KenoV1420(resolver).rulesetId() != wager.rulesetId) revert KenoCanonicalSettlementRequired();
        KenoV1420.Result memory result = KenoV1420(resolver).resolve(wagerId, params);
        settlement = _settle(wager, result.outcome, result.grossPayout, true);
    }

    function bindPlinkoResolver(bytes32 gameVersionId, address resolver) external {
        if (resolver == address(0) || gameVersionId == bytes32(0)) revert ZeroAddress();
        if (plinkoResolver[gameVersionId] != address(0)) revert PlinkoResolverAlreadyBound();
        PlinkoV1420 p = PlinkoV1420(resolver);
        if (p.gameId() != PLINKO_GAME_ID || p.gameVersionId() != gameVersionId ||
            address(p.wagerRegistry()) != address(registry)) revert InvalidStatus();
        if (!authorization.isAuthorized(msg.sender, BetIds420.ACTION_GAME_REGISTER,
            authorization.scopeForGame(PLINKO_GAME_ID, gameVersionId), 0)) revert Unauthorized();
        plinkoResolver[gameVersionId] = resolver;
    }

    function settlePlinko(bytes32 wagerId, PlinkoV1420.Params calldata params)
        external nonReentrant returns (BetTypes420.Settlement memory settlement)
    {
        BetTypes420.Wager memory wager = registry.getWager(wagerId);
        if (wager.gameId != PLINKO_GAME_ID) revert InvalidStatus();
        address resolver = plinkoResolver[wager.gameVersionId];
        if (resolver == address(0) ||
            PlinkoV1420(resolver).rulesetId() != wager.rulesetId)
            revert PlinkoCanonicalSettlementRequired();
        PlinkoV1420.Result memory result = PlinkoV1420(resolver).resolve(wagerId, params);
        settlement = _settle(wager, result.outcome, result.grossPayout, true);
    }

    function bindSlotResolver(bytes32 versionId, address resolver) external {
        if (resolver == address(0) || versionId == bytes32(0)) revert ZeroAddress();
        if (slotResolver[versionId] != address(0)) revert SlotResolverAlreadyBound();
        ReferenceSlotV1420 s = ReferenceSlotV1420(resolver);
        if (s.gameId() != SLOT_GAME_ID || s.gameVersionId() != versionId ||
            address(s.wagerRegistry()) != address(registry)) revert InvalidStatus();
        if (!authorization.isAuthorized(msg.sender, BetIds420.ACTION_GAME_REGISTER,
            authorization.scopeForGame(SLOT_GAME_ID, versionId), 0)) revert Unauthorized();
        slotResolver[versionId] = resolver;
    }

    function settleSlot(bytes32 wagerId, ReferenceSlotV1420.Params calldata params)
        external nonReentrant returns (BetTypes420.Settlement memory settlement)
    {
        BetTypes420.Wager memory wager = registry.getWager(wagerId);
        if (wager.gameId != SLOT_GAME_ID) revert InvalidStatus();
        address resolver = slotResolver[wager.gameVersionId];
        if (resolver == address(0) ||
            ReferenceSlotV1420(resolver).rulesetId() != wager.rulesetId)
            revert SlotCanonicalSettlementRequired();
        ReferenceSlotV1420.Result memory result = ReferenceSlotV1420(resolver).resolve(wagerId, params);
        settlement = _settle(wager, result.outcome, result.grossPayout, true);
    }

    function bindRouletteResolver(bytes32 versionId, address resolver) external {
        if (versionId == bytes32(0) || resolver == address(0)) revert ZeroAddress();
        if (rouletteResolver[versionId] != address(0)) revert RouletteResolverAlreadyBound();
        RouletteV1420 r = RouletteV1420(resolver);
        if (r.gameId() != ROULETTE_GAME_ID || r.gameVersionId() != versionId ||
            address(r.wagerRegistry()) != address(registry)) revert InvalidStatus();
        if (!authorization.isAuthorized(msg.sender, BetIds420.ACTION_GAME_REGISTER,
            authorization.scopeForGame(ROULETTE_GAME_ID, versionId), 0)) revert Unauthorized();
        rouletteResolver[versionId] = resolver;
    }

    function settleRoulette(bytes32 wagerId, RouletteV1420.Params calldata params)
        external nonReentrant returns (BetTypes420.Settlement memory settlement)
    {
        BetTypes420.Wager memory w = registry.getWager(wagerId);
        if (w.gameId != ROULETTE_GAME_ID) revert InvalidStatus();
        address resolver = rouletteResolver[w.gameVersionId];
        if (resolver == address(0) || RouletteV1420(resolver).rulesetId() != w.rulesetId)
            revert RouletteCanonicalSettlementRequired();
        RouletteV1420.Result memory result = RouletteV1420(resolver).resolve(wagerId, params);
        settlement = _settle(w, result.outcome, result.grossPayout, true);
    }

    function bindBlackjackResolver(bytes32 versionId, address resolver) external {
        if (versionId == bytes32(0) || resolver == address(0)) revert ZeroAddress();
        if (blackjackResolver[versionId] != address(0)) revert BlackjackResolverAlreadyBound();
        BlackjackV1420 b = BlackjackV1420(resolver);
        if (b.gameId() != BLACKJACK_GAME_ID || b.gameVersionId() != versionId ||
            address(b.wagerRegistry()) != address(registry)) revert InvalidStatus();
        if (!authorization.isAuthorized(msg.sender, BetIds420.ACTION_GAME_REGISTER,
            authorization.scopeForGame(BLACKJACK_GAME_ID, versionId), 0)) revert Unauthorized();
        blackjackResolver[versionId] = resolver;
    }

    function settleBlackjack(bytes32 wagerId)
        external nonReentrant returns (BetTypes420.Settlement memory settlement)
    {
        BetTypes420.Wager memory w = registry.getWager(wagerId);
        if (w.gameId != BLACKJACK_GAME_ID) revert InvalidStatus();
        address resolver = blackjackResolver[w.gameVersionId];
        if (resolver == address(0) || BlackjackV1420(resolver).rulesetId() != w.rulesetId)
            revert BlackjackCanonicalSettlementRequired();
        BlackjackV1420.HandState memory hand = BlackjackV1420(resolver).getHand(wagerId);
        if (hand.phase != BlackjackV1420.Phase.TERMINAL) revert BlackjackCanonicalSettlementRequired();
        settlement = _settle(w, hand.outcome, hand.grossPayout, true);
    }

    function bindMinesResolver(bytes32 versionId, address resolver) external {
        if (versionId == bytes32(0) || resolver == address(0)) revert ZeroAddress();
        if (minesResolver[versionId] != address(0)) revert MinesResolverAlreadyBound();
        MinesV1420 m = MinesV1420(resolver);
        if (m.gameId() != MINES_GAME_ID || m.gameVersionId() != versionId ||
            address(m.wagerRegistry()) != address(registry)) revert InvalidStatus();
        if (!authorization.isAuthorized(msg.sender, BetIds420.ACTION_GAME_REGISTER,
            authorization.scopeForGame(MINES_GAME_ID, versionId), 0)) revert Unauthorized();
        minesResolver[versionId] = resolver;
    }

    function settleMines(bytes32 wagerId)
        external nonReentrant returns (BetTypes420.Settlement memory settlement)
    {
        BetTypes420.Wager memory w = registry.getWager(wagerId);
        if (w.gameId != MINES_GAME_ID) revert InvalidStatus();
        address resolver = minesResolver[w.gameVersionId];
        if (resolver == address(0) || MinesV1420(resolver).rulesetId() != w.rulesetId)
            revert MinesCanonicalSettlementRequired();
        MinesV1420.SessionState memory session = MinesV1420(resolver).getSession(wagerId);
        if (session.phase != MinesV1420.Phase.TERMINAL) revert MinesCanonicalSettlementRequired();
        if (!MinesV1420(resolver).boardVerified(wagerId)) revert MinesCanonicalSettlementRequired();
        BetTypes420.TerminalOutcome outcome;
        uint256 gross;
        if (session.mineHit) {
            if (session.cashedOut || session.cashoutGrossPayout != 0 ||
                session.currentGrossPayout != 0) revert MinesCanonicalSettlementRequired();
            outcome = BetTypes420.TerminalOutcome.LOSS;
        } else {
            if (!session.cashedOut || session.cashoutGrossPayout < w.stake ||
                session.cashoutGrossPayout > w.maxGrossPayout) revert MinesCanonicalSettlementRequired();
            gross = session.cashoutGrossPayout;
            outcome = gross == w.stake ? BetTypes420.TerminalOutcome.PUSH : BetTypes420.TerminalOutcome.WIN;
        }
        settlement = _settle(w, outcome, gross, true);
    }

    function bindCrashResolver(bytes32 versionId, address resolver) external {
        if (versionId == bytes32(0) || resolver == address(0)) revert ZeroAddress();
        if (crashResolver[versionId] != address(0)) revert CrashResolverAlreadyBound();
        CrashV1420 r = CrashV1420(resolver);
        if (r.gameId() != CRASH_GAME_ID || r.gameVersionId() != versionId ||
            address(r.wagerRegistry()) != address(registry)) revert InvalidStatus();
        if (!authorization.isAuthorized(msg.sender, BetIds420.ACTION_GAME_REGISTER,
            authorization.scopeForGame(CRASH_GAME_ID, versionId), 0)) revert Unauthorized();
        crashResolver[versionId] = resolver;
    }

    function settleCrash(bytes32 wagerId)
        external nonReentrant returns (BetTypes420.Settlement memory settlement)
    {
        BetTypes420.Wager memory w = registry.getWager(wagerId);
        if (w.gameId != CRASH_GAME_ID) revert InvalidStatus();
        address resolver = crashResolver[w.gameVersionId];
        if (resolver == address(0) || CrashV1420(resolver).rulesetId() != w.rulesetId)
            revert CrashCanonicalSettlementRequired();
        CrashV1420 r = CrashV1420(resolver);
        CrashV1420.SessionState memory session = r.getSession(wagerId);
        if (session.phase != CrashV1420.Phase.TERMINAL) revert CrashCanonicalSettlementRequired();
        BetTypes420.TerminalOutcome outcome;
        uint256 gross;
        if (session.terminalReason == CrashV1420.TerminalReason.CRASHED) {
            if (session.cashoutMultiplierBps != 0) revert CrashCanonicalSettlementRequired();
            outcome = BetTypes420.TerminalOutcome.LOSS;
        } else if (session.terminalReason == CrashV1420.TerminalReason.AUTO_CASHOUT) {
            if (session.cashoutMultiplierBps <= r.BPS() ||
                session.cashoutMultiplierBps != session.autoCashoutBps ||
                session.cashoutMultiplierBps >= session.crashPointBps ||
                uint256(session.cashoutMultiplierBps) > type(uint256).max / w.stake)
                revert CrashCanonicalSettlementRequired();
            gross = (w.stake * uint256(session.cashoutMultiplierBps)) / uint256(r.BPS());
            if (gross <= w.stake || gross > w.maxGrossPayout) revert CrashCanonicalSettlementRequired();
            outcome = BetTypes420.TerminalOutcome.WIN;
        } else revert CrashCanonicalSettlementRequired();
        settlement = _settle(w, outcome, gross, true);
    }


    /// @notice Version-pinned Video Poker settlement adapter; cannot accept arbitrary claimed hand payouts.
    function bindVideoPokerResolver(bytes32 versionId, address resolver) external {
        if (versionId == bytes32(0) || resolver == address(0)) revert ZeroAddress();
        if (videoPokerResolver[versionId] != address(0)) revert VideoPokerResolverAlreadyBound();
        VideoPokerResolverV1420 r = VideoPokerResolverV1420(resolver);
        if (r.gameId() != VIDEO_POKER_GAME_ID || r.gameVersionId() != versionId ||
            address(r.wagerRegistry()) != address(registry)) revert InvalidStatus();
        if (!authorization.isAuthorized(msg.sender, BetIds420.ACTION_GAME_REGISTER,
            authorization.scopeForGame(VIDEO_POKER_GAME_ID, versionId), 0)) revert Unauthorized();
        videoPokerResolver[versionId] = resolver;
    }

    function settleVideoPoker(bytes32 wagerId, VideoPokerV1420.Params calldata params)
        external nonReentrant returns (BetTypes420.Settlement memory settlement)
    {
        BetTypes420.Wager memory wager = registry.getWager(wagerId);
        if (wager.gameId != VIDEO_POKER_GAME_ID) revert InvalidStatus();
        address resolver = videoPokerResolver[wager.gameVersionId];
        if (resolver == address(0) || VideoPokerResolverV1420(resolver).rulesetId() != wager.rulesetId)
            revert VideoPokerCanonicalSettlementRequired();
        (BetTypes420.TerminalOutcome outcome, uint256 gross) =
            VideoPokerResolverV1420(resolver).resolve(wagerId, params);
        // Require the exact committed maximum liability to remain actively reserved
        // before the canonical vault/risk/registry/fee settlement transition.
        RiskManager420.ExposureReservation memory reservation = riskManager.getReservation(wagerId);
        uint256 expectedGross = VideoPokerResolverV1420(resolver).requiredGrossReserve(wager.stake, params.credits);
        if (!reservation.active || reservation.wagerId != wagerId ||
            reservation.vaultId != wager.vaultId || reservation.gameVersionId != wager.gameVersionId ||
            reservation.riskProfileId != wager.riskProfileId || reservation.stake != wager.stake ||
            reservation.grossPayout != expectedGross || wager.maxGrossPayout != expectedGross ||
            reservation.reservedLiability != expectedGross - wager.stake)
            revert VideoPokerCanonicalSettlementRequired();
        settlement = _settle(wager, outcome, gross, true);
    }

    function settle(bytes32 wagerId, BetTypes420.TerminalOutcome outcome, uint256 grossPayout)
        external
        nonReentrant
        returns (BetTypes420.Settlement memory settlement)
    {
        BetTypes420.Wager memory wager = registry.getWager(wagerId);
        if (wager.gameId == KENO_GAME_ID) revert KenoCanonicalSettlementRequired();
        if (wager.gameId == PLINKO_GAME_ID) revert PlinkoCanonicalSettlementRequired();
        if (wager.gameId == SLOT_GAME_ID) revert SlotCanonicalSettlementRequired();
        if (wager.gameId == ROULETTE_GAME_ID) revert RouletteCanonicalSettlementRequired();
        if (wager.gameId == BLACKJACK_GAME_ID) revert BlackjackCanonicalSettlementRequired();
        if (wager.gameId == MINES_GAME_ID) revert MinesCanonicalSettlementRequired();
        if (wager.gameId == CRASH_GAME_ID) revert CrashCanonicalSettlementRequired();
        if (wager.gameId == VIDEO_POKER_GAME_ID) revert VideoPokerCanonicalSettlementRequired();
        settlement = _settle(wager, outcome, grossPayout, true);
    }

    /// @notice Permissionless terminal rescue after the wager deadline.
    /// @dev The caller cannot choose an economic result: expiry deterministically means VOID
    ///      with an exact stake refund. All custody, liability, registry, and fee transitions
    ///      remain atomic in this engine transaction.
    function voidExpired(bytes32 wagerId)
        external
        nonReentrant
        returns (BetTypes420.Settlement memory settlement)
    {
        BetTypes420.Wager memory wager = registry.getWager(wagerId);
        if (block.timestamp < wager.deadline) revert WagerNotExpired();
        settlement = _settle(wager, BetTypes420.TerminalOutcome.VOID, wager.stake, false);
        emit ExpiredWagerVoided(wagerId, msg.sender);
    }

    function _settle(
        BetTypes420.Wager memory wager,
        BetTypes420.TerminalOutcome outcome,
        uint256 grossPayout,
        bool requireSettlerAuthorization
    ) private returns (BetTypes420.Settlement memory settlement) {
        bytes32 wagerId = wager.wagerId;
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
        if (block.timestamp >= wager.deadline && outcome != BetTypes420.TerminalOutcome.VOID) revert WagerExpired();
        _requireSettlementOpenOrRefund(wager, outcome);
        if (
            requireSettlerAuthorization
                && !authorization.isAuthorized(
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
