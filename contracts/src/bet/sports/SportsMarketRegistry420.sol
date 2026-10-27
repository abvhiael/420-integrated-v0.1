// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./SportsEventRegistry420.sol";
import "../BetOperatorRegistry420.sol";
import "../BetEmergencyState420.sol";

/// @notice Non-custodial registry only. OPEN is necessary, never sufficient, for future wager acceptance.
contract SportsMarketRegistry420 is SportsAuthority420 {
    bytes32 public constant TEMPLATE_REGISTER = keccak256("BET_SPORT_TEMPLATE_REGISTER");
    bytes32 public constant TEMPLATE_APPROVE = keccak256("BET_SPORT_TEMPLATE_APPROVE");
    bytes32 public constant REGISTER = keccak256("BET_SPORT_MARKET_REGISTER");
    bytes32 public constant APPROVE = keccak256("BET_SPORT_MARKET_APPROVE");
    bytes32 public constant OPEN = keccak256("BET_SPORT_MARKET_OPEN");
    bytes32 public constant SUSPEND = keccak256("BET_SPORT_MARKET_SUSPEND");
    bytes32 public constant RESUME = keccak256("BET_SPORT_MARKET_RESUME");
    bytes32 public constant CLOSE = keccak256("BET_SPORT_MARKET_CLOSE");
    SportsCompetitionRegistry420 public immutable competitions;
    SportsEventRegistry420 public immutable eventsRegistry;
    BetOperatorRegistry420 public immutable operators;
    BetEmergencyState420 public immutable emergency;

    struct TemplateRecord {
        SportsTypes420.Template config;
        address registrar;
        address approver;
        bool approved;
    }

    struct Record {
        SportsTypes420.MarketConfig config;
        bytes32 termsHash;
        address registrar;
        address approver;
        SportsTypes420.MarketStatus status;
        uint64 quoteEpoch;
        uint64 scheduleRevision;
        uint64 competitionEpoch;
        uint64 eventEpoch;
    }
    mapping(bytes32 => TemplateRecord) private templates;
    mapping(bytes32 => Record) private records;
    mapping(bytes32 => bytes32) public proposition;
    event TemplateRegistered(bytes32 indexed id, bytes32 indexed competition);
    event TemplateApproved(bytes32 indexed id, address approver);
    event MarketRegistered(bytes32 indexed id, bytes32 indexed eventId, bytes32 termsHash);
    event MarketState(bytes32 indexed id, SportsTypes420.MarketStatus status, uint64 quoteEpoch);

    constructor(address auth, address comps, address evts, address ops, address halt) SportsAuthority420(auth) {
        if (comps.code.length == 0 || evts.code.length == 0 || ops.code.length == 0 || halt.code.length == 0) {
            revert Invalid();
        }
        competitions = SportsCompetitionRegistry420(comps);
        eventsRegistry = SportsEventRegistry420(evts);
        operators = BetOperatorRegistry420(ops);
        emergency = BetEmergencyState420(halt);
        if (
            address(competitions.authorization()) != auth || address(eventsRegistry.authorization()) != auth
                || address(eventsRegistry.competitions()) != comps || address(operators.authorization()) != auth
                || address(emergency.authorization()) != auth
        ) revert Invalid();
    }

    function scope(bytes32 id) public view override returns (bytes32) {
        return authorization.scopeForMarket(id);
    }

    function templateId(SportsTypes420.Template memory c) public view returns (bytes32) {
        return keccak256(abi.encode("420.SPORT.TEMPLATE.V1", block.chainid, address(this), c));
    }

    function registerTemplate(SportsTypes420.Template calldata c) external returns (bytes32 id) {
        _auth(TEMPLATE_REGISTER, c.competition);
        SportsCompetitionRegistry420.Record memory comp = competitions.get(c.competition);
        if (
            comp.status == SportsTypes420.CompetitionStatus.RETIRED || c.kind == SportsTypes420.Kind.NONE
                || c.coverage == SportsTypes420.Coverage.NONE || c.rules == 0 || c.completionPolicy == 0
                || c.postponementPolicy == 0 || c.disputePolicy == 0 || c.sourcePolicy != comp.config.sourcePolicy
                || c.challengeSeconds == 0 || c.refundSeconds <= c.challengeSeconds || c.refundSeconds > 30 days
        ) revert Invalid();
        SportsTypes420.Sport sport = SportsTypes420.sport(comp.config.catalog);
        if (sport == SportsTypes420.Sport.SOCCER) {
            if (
                c.coverage != SportsTypes420.Coverage.REGULATION || c.shootout
                    || c.kind == SportsTypes420.Kind.MONEYLINE_TWO
            ) revert Invalid();
        } else {
            if (
                c.kind == SportsTypes420.Kind.MONEYLINE_THREE
                    && (sport != SportsTypes420.Sport.HOCKEY || c.coverage != SportsTypes420.Coverage.REGULATION)
            ) revert Invalid();
            if (
                c.shootout
                    && (sport != SportsTypes420.Sport.HOCKEY
                        || c.coverage != SportsTypes420.Coverage.INCLUDING_OVERTIME)
            ) revert Invalid();
        }
        id = templateId(c);
        if (templates[id].registrar != address(0)) revert Conflict();
        templates[id] = TemplateRecord(c, msg.sender, address(0), false);
        emit TemplateRegistered(id, c.competition);
    }

    function approveTemplate(bytes32 id) external {
        TemplateRecord storage t = _template(id);
        _auth(TEMPLATE_APPROVE, id);
        if (t.approved) revert State();
        if (t.registrar == msg.sender) revert Separation();
        t.approved = true;
        t.approver = msg.sender;
        emit TemplateApproved(id, msg.sender);
    }

    function propositionKey(SportsTypes420.MarketConfig memory c) public view returns (bytes32) {
        SportsTypes420.Template memory t = _template(c.templateId).config;
        // Source/risk/rules changes cannot disguise a duplicate economic proposition.
        return keccak256(abi.encode(c.eventId, c.operatorId, t.kind, t.coverage, t.shootout, c.lineTwice));
    }

    function idFor(SportsTypes420.MarketConfig memory c) public view returns (bytes32) {
        return keccak256(abi.encode("420.SPORT.MARKET.V1", block.chainid, address(this), c));
    }

    function register(SportsTypes420.MarketConfig calldata c) external returns (bytes32 id) {
        id = idFor(c);
        _auth(REGISTER, id);
        TemplateRecord storage t = _template(c.templateId);
        SportsEventRegistry420.Record memory e = eventsRegistry.get(c.eventId);
        bytes32 comp = eventsRegistry.competitionOf(c.eventId);
        uint64 start = eventsRegistry.currentStart(c.eventId);
        if (
            t.config.competition != comp || !_templateActive(c.templateId) || !competitions.active(comp)
                || e.status != SportsTypes420.EventStatus.SCHEDULED || c.operatorId == 0 || c.gameVersion == 0
                || c.riskProfile == 0 || c.vaultId == 0 || c.asset == address(0) || c.asset.code.length == 0
                || c.cutoff <= block.timestamp || c.cutoff > start || !operators.isActive(c.operatorId)
        ) revert Invalid();
        bool moneyline =
            t.config.kind == SportsTypes420.Kind.MONEYLINE_TWO || t.config.kind == SportsTypes420.Kind.MONEYLINE_THREE;
        if (
            (moneyline && c.lineTwice != 0) || (t.config.kind == SportsTypes420.Kind.TOTAL && c.lineTwice <= 0)
                || c.lineTwice < -2_000_000 || c.lineTwice > 2_000_000
        ) revert Invalid();
        bytes32 p = propositionKey(c);
        if (
            (proposition[p] != 0 && records[proposition[p]].status != SportsTypes420.MarketStatus.CLOSED)
                || records[id].registrar != address(0)
        ) revert Conflict();
        proposition[p] = id;
        Record storage r = records[id];
        r.config = c;
        r.termsHash = keccak256(abi.encode("420.SPORT.TERMS.V1", id, c, t.config));
        r.registrar = msg.sender;
        r.status = SportsTypes420.MarketStatus.DRAFT;
        r.quoteEpoch = 1;
        emit MarketRegistered(id, c.eventId, r.termsHash);
    }

    function approve(bytes32 id, bytes32 termsHash) external {
        Record storage r = _get(id);
        _auth(APPROVE, id);
        if (r.status != SportsTypes420.MarketStatus.DRAFT || r.termsHash != termsHash) revert State();
        if (r.registrar == msg.sender || operators.getOperator(r.config.operatorId).operatorAccount == msg.sender) {
            revert Separation();
        }
        r.approver = msg.sender;
        r.status = SportsTypes420.MarketStatus.APPROVED;
        emit MarketState(id, r.status, r.quoteEpoch);
    }

    function open(bytes32 id) external {
        _open(id, false);
    }

    function resume(bytes32 id) external {
        _open(id, true);
    }

    function suspend(bytes32 id) external {
        Record storage r = _get(id);
        _auth(SUSPEND, id);
        if (r.status != SportsTypes420.MarketStatus.OPEN && r.status != SportsTypes420.MarketStatus.APPROVED) {
            revert State();
        }
        r.status = SportsTypes420.MarketStatus.SUSPENDED;
        ++r.quoteEpoch;
        emit MarketState(id, r.status, r.quoteEpoch);
    }

    function close(bytes32 id) external {
        Record storage r = _get(id);
        _auth(CLOSE, id);
        if (r.status == SportsTypes420.MarketStatus.CLOSED) revert State();
        r.status = SportsTypes420.MarketStatus.CLOSED;
        ++r.quoteEpoch;
        emit MarketState(id, r.status, r.quoteEpoch);
    }

    function get(bytes32 id) external view returns (Record memory) {
        return _get(id);
    }

    function getTemplate(bytes32 id) external view returns (TemplateRecord memory) {
        return _template(id);
    }

    function selections(bytes32 id) external view returns (bytes32[] memory s) {
        Record storage r = _get(id);
        SportsTypes420.Kind k = _template(r.config.templateId).config.kind;
        uint256 count = k == SportsTypes420.Kind.MONEYLINE_THREE ? 3 : 2;
        s = new bytes32[](count);
        for (uint256 i; i < count; ++i) {
            s[i] = keccak256(abi.encode("420.SPORT.SELECTION.V1", id, i));
        }
        // Moneyline/spread indices: home, away, draw (three-way only). Total: over, under.
    }

    /// @dev Must be rechecked by future acceptance adapter. Does not check player, quote, capital or source entitlement.
    function eligible(bytes32 id) external view returns (bool) {
        Record storage r = _get(id);
        if (r.status != SportsTypes420.MarketStatus.OPEN || !_ready(r)) return false;
        SportsEventRegistry420.Record memory e = eventsRegistry.get(r.config.eventId);
        SportsCompetitionRegistry420.Record memory c = competitions.get(eventsRegistry.competitionOf(r.config.eventId));
        return r.scheduleRevision == e.revision && r.competitionEpoch == c.epoch && r.eventEpoch == e.sourceEpoch;
    }

    function _open(bytes32 id, bool resume_) private {
        Record storage r = _get(id);
        _auth(resume_ ? RESUME : OPEN, id);
        if (
            r.status != (resume_ ? SportsTypes420.MarketStatus.SUSPENDED : SportsTypes420.MarketStatus.APPROVED)
                || !_ready(r)
        ) revert State();
        SportsEventRegistry420.Record memory e = eventsRegistry.get(r.config.eventId);
        r.scheduleRevision = e.revision;
        r.eventEpoch = e.sourceEpoch;
        r.competitionEpoch = competitions.get(eventsRegistry.competitionOf(r.config.eventId)).epoch;
        r.status = SportsTypes420.MarketStatus.OPEN;
        ++r.quoteEpoch;
        emit MarketState(id, r.status, r.quoteEpoch);
    }

    function _ready(Record storage r) private view returns (bool) {
        bytes32 id = idFor(r.config);
        return block.timestamp < r.config.cutoff && eventsRegistry.ready(r.config.eventId)
            && operators.isActive(r.config.operatorId) && _templateActive(r.config.templateId)
            && authorization.isAuthorized(r.approver, APPROVE, scope(id), 0)
            && !emergency.isHalted(BetTypes420.EmergencyDomain.NEW_WAGERS, bytes32(0))
            && !emergency.isHalted(BetTypes420.EmergencyDomain.SPORTS_MARKET, id)
            && !emergency.isHalted(BetTypes420.EmergencyDomain.GAME_VERSION, r.config.gameVersion)
            && !emergency.isHalted(BetTypes420.EmergencyDomain.VAULT_NEW_RISK, r.config.vaultId)
            && !emergency.isHalted(
            BetTypes420.EmergencyDomain.ORACLE_PROFILE, _template(r.config.templateId).config.sourcePolicy
        );
    }

    function _templateActive(bytes32 id) private view returns (bool) {
        TemplateRecord storage t = _template(id);
        return t.approved && authorization.isAuthorized(t.approver, TEMPLATE_APPROVE, scope(id), 0);
    }

    function _get(bytes32 id) private view returns (Record storage r) {
        r = records[id];
        if (r.registrar == address(0)) revert Missing();
    }

    function _template(bytes32 id) private view returns (TemplateRecord storage t) {
        t = templates[id];
        if (t.registrar == address(0)) revert Missing();
    }
}
