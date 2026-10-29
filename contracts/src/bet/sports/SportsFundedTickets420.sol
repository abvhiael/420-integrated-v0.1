// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./SportsBetAcceptance420.sol";
import "./SportsOutcomeCertification420.sol";

interface ISportsOracleGateBinding420 {
    function vault() external view returns (address);
    function oracle() external view returns (address);
    function certification() external view returns (address);
    function markets() external view returns (address);
}

interface ISportsToken420 {
    function balanceOf(address) external view returns (uint256);
    function transferFrom(address, address, uint256) external returns (bool);
    function transfer(address, uint256) external returns (bool);
}

/// @notice Funded sportsbook admission: direct payer, exact token transfers, conservative
/// per-market collateral reservation, immutable odds and at-most-once terminal tickets.
/// @dev Result certification and dispute adjudication are separate release prerequisites.
contract SportsFundedTickets420 is SportsAuthority420 {
    SportsBetAcceptance420 public immutable admission;
    SportsMarketRegistry420 public immutable markets;
    SportsOddsIngestion420 public immutable odds;
    SportsOutcomeCertification420 public immutable certification;
    bytes32 public constant RESOLVE = keccak256("BET_SPORT_TICKET_RESOLVE");
    // A market's Oracle gate is irreversible once installed. A legacy RESOLVE
    // capability alone cannot settle an Oracle-protected ticket.
    bytes32 public constant BIND_ORACLE = keccak256("BET_SPORT_TICKET_BIND_ORACLE");
    mapping(bytes32 => address) public marketOracleGate;
    bool public oracleOnlyFunding;
    uint256 public fundedCount;
    // Aggregate prospective payout profit risk across markets sharing one token.
    // Existing live exposure cannot be erased by changing the admission limit.
    bytes32 public constant SET_ASSET_RISK = keccak256("BET_SPORT_ASSET_RISK_CONFIGURE");
    mapping(address => uint256) public assetProfitExposure;
    mapping(address => uint256) public assetProfitCap;
    event AssetProfitCapSet(address indexed asset, uint256 cap, uint256 outstanding);

    function setAssetProfitCap(address asset, uint256 cap) external {
        _auth(SET_ASSET_RISK, bytes32(0));
        if (asset.code.length == 0 || cap < assetProfitExposure[asset]) revert State();
        // Zero cap is an emergency admission freeze; outstanding exposure remains intact.
        assetProfitCap[asset] = cap;
        emit AssetProfitCapSet(asset, cap, assetProfitExposure[asset]);
    }

    mapping(bytes32 => bytes32) public marketRiskGroup;
    mapping(bytes32 => address) public riskGroupAsset;
    mapping(bytes32 => uint256) public riskGroupLimit;
    mapping(bytes32 => uint256) public riskGroupOutstanding;
    event MarketOracleBound(bytes32 indexed marketId, address indexed gate);
    event OracleOnlyFundingEnabled();
    event RiskGroupBound(bytes32 indexed marketId, bytes32 indexed groupId, address asset, uint256 limit);

    uint256 private entered;

    enum TicketState { NONE, FUNDED, WON, LOST, REFUNDED, PUSH, NO_ACTION, DEAD_HEAT }
    struct Ticket {
        address player;
        bytes32 marketId;
        bytes32 selection;
        bytes32 oddsDigest;
        bytes32 termsHash;
        bytes32 nonce;
        uint256 stake;
        uint256 gross;
        uint256 profit;
        uint64 quoteEpoch;
        uint64 quoteSequence;
        TicketState state;
    }
    mapping(bytes32 => Ticket) private tickets;
    /// @notice Immutable terminal receipts for reproducible payout/refund reconciliation.
    struct SettlementReceipt {
        TicketState outcome;
        uint256 payout;
        bytes32 evidence;
        uint64 finalizedAt;
        address executor;
    }
    mapping(bytes32 => SettlementReceipt) private settlementReceipts;
    event TicketSettlementRecorded(
        bytes32 indexed ticketId, bytes32 indexed marketId, TicketState outcome,
        uint256 payout, bytes32 indexed evidence, address executor
    );
    function settlementReceipt(bytes32 id) external view returns (SettlementReceipt memory) {
        if (tickets[id].state == TicketState.NONE) revert Missing();
        return settlementReceipts[id];
    }

    mapping(bytes32 => bool) public consumedIntent;
    mapping(bytes32 => uint256) public collateral;
    mapping(bytes32 => uint256) public reserved;
    mapping(bytes32 => uint256) public pendingStake;
    mapping(bytes32 => uint256) public marketProfitExposure;
    mapping(bytes32 => mapping(bytes32 => uint256)) public selectionProfitExposure;
    mapping(bytes32 => mapping(address => uint256)) public playerExposure;
    mapping(address => mapping(address => uint256)) public credit;
    /// @dev Aggregate nominal obligations across every market and beneficiary per asset.
    mapping(address => uint256) public assetLiability;
    mapping(address => uint256) public assetCollateral;
    mapping(address => uint256) public assetPendingStake;
    mapping(address => uint256) public assetPlayerCredit;
    event CollateralAdded(bytes32 indexed marketId, address indexed operator, uint256 amount);
    event CollateralRemoved(bytes32 indexed marketId, address indexed operator, uint256 amount);
    event TicketFunded(bytes32 indexed id, bytes32 indexed marketId, address indexed player, bytes32 oddsDigest, uint256 stake, uint256 gross);
    event TicketFinalized(bytes32 indexed id, TicketState state, uint256 playerCredit);
    event Withdrawal(address indexed player, address indexed token, uint256 amount);
    error Transfer();

    modifier guarded() {
        if (entered != 0) revert State();
        entered = 1;
        _;
        entered = 0;
    }

    constructor(address auth, address acceptance_, address certification_) SportsAuthority420(auth) {
        if (acceptance_.code.length == 0 || certification_.code.length == 0) revert Invalid();
        certification = SportsOutcomeCertification420(certification_);
        admission = SportsBetAcceptance420(acceptance_);
        markets = admission.markets();
        odds = admission.odds();
        if (address(admission.authorization()) != auth) revert Invalid();
    }

    function scope(bytes32 marketId) public view override returns (bytes32) {
        return markets.scope(marketId);
    }

    function get(bytes32 id) external view returns (Ticket memory) {
        if (tickets[id].state == TicketState.NONE) revert Missing();
        return tickets[id];
    }

    function _operator(bytes32 marketId) private view returns (address) {
        SportsMarketRegistry420.Record memory m = markets.get(marketId);
        return markets.operators().getOperator(m.config.operatorId).operatorAccount;
    }

    function _asset(bytes32 marketId) private view returns (address) {
        return markets.get(marketId).config.asset;
    }

    function deposit(bytes32 marketId, uint256 amount) external guarded {
        if (_operator(marketId) != msg.sender || amount == 0) revert Unauthorized();
        address asset = _asset(marketId);
        assetLiability[asset] += amount;
        assetCollateral[asset] += amount;
        collateral[marketId] += amount;
        _receive(asset, msg.sender, amount);
        emit CollateralAdded(marketId, msg.sender, amount);
    }

    function withdrawCollateral(bytes32 marketId, uint256 amount) external guarded {
        if (_operator(marketId) != msg.sender || amount == 0 || amount > collateral[marketId] - reserved[marketId]) revert Unauthorized();
        address asset = _asset(marketId);
        collateral[marketId] -= amount;
        assetCollateral[asset] -= amount;
        assetLiability[asset] -= amount;
        _send(asset, msg.sender, amount);
        emit CollateralRemoved(marketId, msg.sender, amount);
    }

    /// @notice Direct player-only admission prevents unauthorized relaying.
    /// @dev offer.fundingReceipt is an intent discriminator; token balance delta
    /// (not that value) proves stake custody. The player must approve this vault.
    function fund(SportsBetAcceptance420.Offer calldata offer) external guarded returns (bytes32 id) {
        (uint256 gross, uint256 profit, bool ok) = admission.preview(offer, msg.sender);
        if (!ok || (oracleOnlyFunding &&
            (marketOracleGate[offer.marketId] == address(0) || marketRiskGroup[offer.marketId] == bytes32(0))))
            revert State();
        bytes32 intent = keccak256(abi.encode(msg.sender, offer.nonce));
        if (consumedIntent[intent]) revert Conflict();
        SportsBetAcceptance420.Risk memory r = admission.getRisk(offer.marketId);
        if (marketProfitExposure[offer.marketId] + profit > r.maxMarketLiability
            || selectionProfitExposure[offer.marketId][offer.selection] + profit > r.maxSelectionLiability
            || playerExposure[offer.marketId][msg.sender] + offer.stake > r.maxPlayerStake
            || reserved[offer.marketId] + profit > collateral[offer.marketId]) revert State();
        address riskAsset = markets.get(offer.marketId).config.asset;
        uint256 assetCap = assetProfitCap[riskAsset];
        if (assetCap == 0 || profit > assetCap || assetProfitExposure[riskAsset] > assetCap - profit) revert State();
        bytes32 group = marketRiskGroup[offer.marketId];
        if (group != bytes32(0) && riskGroupOutstanding[group] + profit > riskGroupLimit[group]) revert State();
        (SportsOddsIngestion420.Latest memory q, bool usable) = odds.current(offer.marketId);
        SportsMarketRegistry420.Record memory m = markets.get(offer.marketId);
        if (!usable || q.digest != offer.quoteDigest || q.quoteEpoch != m.quoteEpoch) revert State();
        id = keccak256(abi.encode("420.SPORT.FUNDED.TICKET.V1", block.chainid, address(this), msg.sender, offer));
        if (tickets[id].state != TicketState.NONE) revert Conflict();
        consumedIntent[intent] = true;
        ++fundedCount;
        assetProfitExposure[riskAsset] += profit;
        if (group != bytes32(0)) riskGroupOutstanding[group] += profit;
        reserved[offer.marketId] += profit;
        pendingStake[offer.marketId] += offer.stake;
        assetLiability[m.config.asset] += offer.stake;
        assetPendingStake[m.config.asset] += offer.stake;
        marketProfitExposure[offer.marketId] += profit;
        selectionProfitExposure[offer.marketId][offer.selection] += profit;
        playerExposure[offer.marketId][msg.sender] += offer.stake;
        tickets[id] = Ticket(msg.sender, offer.marketId, offer.selection, q.digest, m.termsHash,
            offer.nonce, offer.stake, gross, profit, q.quoteEpoch, q.sequence, TicketState.FUNDED);
        _receive(m.config.asset, msg.sender, offer.stake);
        emit TicketFunded(id, offer.marketId, msg.sender, q.digest, offer.stake, gross);
    }

    /// @notice The independently approved outcome resolver must hold market-scoped capability.
    /// No raw source reports are independently validated by this contract.
    /// @dev The gate must be wired to this exact vault; binding cannot be replaced.
    /// @notice Irreversible funding fuse; must be activated prior to launch.
    function enableOracleOnlyFunding() external {
        _auth(BIND_ORACLE, bytes32(0));
        if (oracleOnlyFunding || fundedCount != 0) revert State();
        oracleOnlyFunding = true;
        emit OracleOnlyFundingEnabled();
    }

    /// @notice Immutable per-market assignment, conservatively sums *all* open
    /// profit exposure in the group (independent of outcome correlation).
    /// @dev All propositions on the same event and asset share one risk ceiling;
    /// arbitrary subgroups cannot evade the same-event exposure bound.
    function correlationGroupFor(bytes32 marketId) public view returns (bytes32) {
        SportsMarketRegistry420.Record memory m = markets.get(marketId);
        return keccak256(abi.encode("420.BET.SPORT.EVENT.RISK.V1", m.config.eventId, m.config.asset));
    }

    function bindRiskGroup(bytes32 marketId, bytes32 group, uint256 limit) external {
        _auth(BIND_ORACLE, marketId);
        SportsMarketRegistry420.Record memory m = markets.get(marketId);
        if (group != correlationGroupFor(marketId) || limit == 0 || marketRiskGroup[marketId] != bytes32(0)
            || marketProfitExposure[marketId] != 0) revert State();
        if (riskGroupAsset[group] == address(0)) {
            riskGroupAsset[group] = m.config.asset;
            riskGroupLimit[group] = limit;
        } else if (riskGroupAsset[group] != m.config.asset || riskGroupLimit[group] != limit) {
            revert State();
        }
        marketRiskGroup[marketId] = group;
        emit RiskGroupBound(marketId, group, m.config.asset, limit);
    }

    function bindOracle(bytes32 marketId, address gate) external {
        _auth(BIND_ORACLE, marketId);
        if (gate.code.length == 0 || marketOracleGate[marketId] != address(0)) revert State();
        if (ISportsOracleGateBinding420(gate).vault() != address(this)
            || ISportsOracleGateBinding420(gate).markets() != address(markets)
            || ISportsOracleGateBinding420(gate).certification() != address(certification)
            || ISportsOracleGateBinding420(gate).oracle().code.length == 0) revert Invalid();
        markets.get(marketId);
        marketOracleGate[marketId] = gate;
        emit MarketOracleBound(marketId, gate);
    }

    function resolve(bytes32 id, bool won) external guarded {
        Ticket storage t = tickets[id];
        if (t.state != TicketState.FUNDED) revert State();
        _auth(RESOLVE, t.marketId);
        address gate = marketOracleGate[t.marketId];
        if (gate != address(0) && msg.sender != gate) revert Unauthorized();
        SportsMarketRegistry420.Record memory marketRecord = markets.get(t.marketId);
        if (block.timestamp < marketRecord.config.cutoff) revert State();
        SportsTypes420.EventStatus eventStatus =
            markets.eventsRegistry().get(marketRecord.config.eventId).status;
        if (eventStatus == SportsTypes420.EventStatus.CANCELLED
            || eventStatus == SportsTypes420.EventStatus.ABANDONED
            || eventStatus == SportsTypes420.EventStatus.POSTPONED) revert State();
        SportsOutcomeCertification420.Result memory r = certification.result(t.marketId);
        if (r.status != SportsOutcomeCertification420.Status.FINAL) revert State();
        // An unregistered result selection cannot be treated as a losing bet.
        bytes32[] memory eligibleSelections = markets.selections(t.marketId);
        bool knownSelection;
        for (uint256 i; i < eligibleSelections.length; ++i) {
            if (eligibleSelections[i] == r.selection) { knownSelection = true; break; }
        }
        if (!knownSelection || won != (r.selection == t.selection)) revert State();
        _close(id, won ? TicketState.WON : TicketState.LOST, won ? t.gross : 0, r.evidence);
    }

    /// @notice Certified special market resolution. The Oracle gate verifies the
    /// special marker and evidence before calling this function on gated markets.
    function resolveSpecial(bytes32 id) external guarded {
        Ticket storage t = tickets[id];
        if (t.state != TicketState.FUNDED) revert State();
        _auth(RESOLVE, t.marketId);
        address gate = marketOracleGate[t.marketId];
        if (gate != address(0) && msg.sender != gate) revert Unauthorized();
        SportsMarketRegistry420.Record memory m = markets.get(t.marketId);
        if (block.timestamp < m.config.cutoff) revert State();
        SportsOutcomeCertification420.Result memory r = certification.result(t.marketId);
        if (r.status != SportsOutcomeCertification420.Status.FINAL) revert State();
        SportsOutcomeCertification420.SpecialOutcome memory special = certification.specialOutcome(t.marketId);
        uint256 payout;
        TicketState terminal;
        if (special.kind == SportsOutcomeCertification420.SpecialKind.PUSH) {
            if (r.selection != certification.PUSH_RESULT()) revert State();
            terminal = TicketState.PUSH;
            payout = t.stake;
        } else if (special.kind == SportsOutcomeCertification420.SpecialKind.NO_ACTION) {
            if (r.selection != certification.NO_ACTION_RESULT()) revert State();
            terminal = TicketState.NO_ACTION;
            payout = t.stake;
        } else if (special.kind == SportsOutcomeCertification420.SpecialKind.DEAD_HEAT) {
            if (r.selection != certification.DEAD_HEAT_RESULT()) revert State();
            terminal = TicketState.DEAD_HEAT;
            if (t.selection == special.firstSelection || t.selection == special.secondSelection) {
                payout = t.gross / 2;
            }
        } else revert State();
        _close(id, terminal, payout, r.evidence);
    }

    /// @notice Permissionless refund after the immutable market policy timeout.
    function refund(bytes32 id) external guarded {
        Ticket storage t = tickets[id];
        if (t.state != TicketState.FUNDED) revert State();
        SportsMarketRegistry420.Record memory m = markets.get(t.marketId);
        uint256 delay = markets.getTemplate(m.config.templateId).config.refundSeconds;
        SportsOutcomeCertification420.Result memory outcome = certification.result(t.marketId);
        SportsTypes420.EventStatus eventStatus = markets.eventsRegistry().get(m.config.eventId).status;
        bool disrupted = eventStatus == SportsTypes420.EventStatus.CANCELLED
            || eventStatus == SportsTypes420.EventStatus.ABANDONED
            || eventStatus == SportsTypes420.EventStatus.POSTPONED;
        if (!disrupted && outcome.status != SportsOutcomeCertification420.Status.VOID
            && block.timestamp < uint256(m.config.cutoff) + delay) revert State();
        _close(id, TicketState.REFUNDED, t.stake, outcome.status == SportsOutcomeCertification420.Status.VOID ? outcome.evidence : bytes32(0));
    }

    function _close(bytes32 id, TicketState outcome, uint256 payout, bytes32 evidence) private {
        Ticket storage t = tickets[id];
        t.state = outcome;
        settlementReceipts[id] = SettlementReceipt(outcome, payout, evidence, uint64(block.timestamp), msg.sender);
        emit TicketSettlementRecorded(id, t.marketId, outcome, payout, evidence, msg.sender);
        bytes32 group = marketRiskGroup[t.marketId];
        if (group != bytes32(0)) riskGroupOutstanding[group] -= t.profit;
        assetProfitExposure[_asset(t.marketId)] -= t.profit;
        reserved[t.marketId] -= t.profit;
        pendingStake[t.marketId] -= t.stake;
        address asset = _asset(t.marketId);
        assetPendingStake[asset] -= t.stake;
        marketProfitExposure[t.marketId] -= t.profit;
        selectionProfitExposure[t.marketId][t.selection] -= t.profit;
        playerExposure[t.marketId][t.player] -= t.stake;
        // Every settlement conserves stake + collateral = credit + collateral.
        // Dead heats may return less than stake, unlike ordinary gross winners.
        if (outcome == TicketState.WON || outcome == TicketState.LOST || outcome == TicketState.DEAD_HEAT) {
            if (payout > t.stake) {
                uint256 delta = payout - t.stake;
                collateral[t.marketId] -= delta;
                assetCollateral[asset] -= delta;
            } else {
                uint256 delta = t.stake - payout;
                collateral[t.marketId] += delta;
                assetCollateral[asset] += delta;
            }
        }
        if (payout != 0) { credit[t.player][asset] += payout; assetPlayerCredit[asset] += payout; }
        emit TicketFinalized(id, outcome, payout);
    }

    function claim(address token) external guarded {
        uint256 amount = credit[msg.sender][token];
        if (amount == 0) revert Missing();
        credit[msg.sender][token] = 0;
        assetPlayerCredit[token] -= amount;
        assetLiability[token] -= amount;
        _send(token, msg.sender, amount);
        emit Withdrawal(msg.sender, token, amount);
    }

    function _receive(address token, address from, uint256 amount) private {
        uint256 balance = ISportsToken420(token).balanceOf(address(this));
        if (balance != assetLiability[token] - amount) revert Transfer();
        if (!ISportsToken420(token).transferFrom(from, address(this), amount)
            || ISportsToken420(token).balanceOf(address(this)) != balance + amount) revert Transfer();
    }

    function _send(address token, address to, uint256 amount) private {
        uint256 balance = ISportsToken420(token).balanceOf(address(this));
        if (balance != assetLiability[token] + amount) revert Transfer();
        if (!ISportsToken420(token).transfer(to, amount)
            || ISportsToken420(token).balanceOf(address(this)) + amount != balance) revert Transfer();
    }
}
