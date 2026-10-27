// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../../src/bet/sports/SportsMarketRegistry420.sol";
import "../../src/system/CapabilityRegistry420.sol";
import "../../src/exchange/Wrapped420.sol";

interface SportsVm {
    function warp(uint256) external;
    function prank(address) external;
    function expectRevert() external;
    function chainId(uint256) external;
    function snapshotState() external returns (uint256);
    function revertToState(uint256) external returns (bool);
}

contract SportsRegistry420Test {
    SportsVm constant vm = SportsVm(address(uint160(uint256(keccak256("hevm cheat code")))));
    CapabilityRegistry420 cap;
    BetAuthorization420 auth;
    BetOperatorRegistry420 ops;
    BetEmergencyState420 halt;
    SportsCompetitionRegistry420 comps;
    SportsEventRegistry420 evts;
    SportsMarketRegistry420 markets;
    Wrapped420 token;
    address constant REG = address(0x100);
    address constant REVIEW = address(0x200);
    address constant SOURCE = address(0x300);
    address constant CONTROL = address(0x400);
    address constant OUT = address(0x500);
    bytes32 constant OP = keccak256("operator");
    bytes32 constant POLICY = keccak256("source-policy");
    bytes32 comp;
    bytes32 season;
    bytes32 stage;
    bytes32 home;
    bytes32 away;
    bytes32 eventId;
    bytes32 template;
    bytes32 market;
    uint256 nonce;
    event RegistryCheckpoint(
        uint8 indexed scenario, bool eligible, bytes32 termsHash, uint64 cutoff, uint64 quoteEpoch, uint64 revision
    );

    function _checkpoint(uint8 step) internal {
        SportsMarketRegistry420.Record memory r = markets.get(market);
        emit RegistryCheckpoint(
            step, markets.eligible(market), r.termsHash, r.config.cutoff, r.quoteEpoch, evts.get(eventId).revision
        );
    }

    function setUp() public {
        vm.warp(1_800_000_000);
        cap = new CapabilityRegistry420();
        cap.registerProtocolComponent(keccak256("420.BET.CORE"), address(this));
        auth = new BetAuthorization420(address(cap));
        ops = new BetOperatorRegistry420(address(auth));
        halt = new BetEmergencyState420(address(auth));
        token = new Wrapped420();
        comps = new SportsCompetitionRegistry420(address(auth));
        evts = new SportsEventRegistry420(address(auth), address(comps));
        markets = new SportsMarketRegistry420(address(auth), address(comps), address(evts), address(ops), address(halt));
        _grant(address(this), BetIds420.ACTION_OPERATOR_REGISTER, auth.scopeForOperator(OP));
        _grant(address(this), BetIds420.ACTION_OPERATOR_ACTIVATE, auth.scopeForOperator(OP));
        ops.registerOperator(OP, CONTROL, keccak256("operator-manifest"));
        ops.activate(OP);
        _fixture(SportsTypes420.Competition.NHL);
    }

    function _grant(address who, bytes32 action, bytes32 scope_) internal returns (bytes32 id) {
        id = bytes32(++nonce);
        cap.createGrant(
            id,
            who,
            keccak256("420.BET.CORE"),
            action,
            scope_,
            0,
            0,
            0,
            uint64(block.timestamp),
            uint64(block.timestamp + 365 days)
        );
    }

    function _call(address who, address target, bytes memory data) internal {
        vm.prank(who);
        (bool ok, bytes memory ret) = target.call(data);
        if (!ok) {
            assembly { revert(add(ret, 32), mload(ret)) }
        }
    }

    function _fails(address who, address target, bytes memory data) internal {
        vm.prank(who);
        (bool ok,) = target.call(data);
        require(!ok, "unexpected success");
    }

    function _competitionConfig(SportsTypes420.Competition c)
        internal
        pure
        returns (SportsTypes420.CompetitionConfig memory)
    {
        return SportsTypes420.CompetitionConfig(
            c, POLICY, keccak256("provider"), keccak256("feed"), 300, keccak256(abi.encode("manifest", c))
        );
    }

    function _eventConfig() internal view returns (SportsTypes420.EventConfig memory) {
        return SportsTypes420.EventConfig(
            season,
            stage,
            home,
            away,
            keccak256("fixture-1"),
            uint64(block.timestamp + 3600),
            keccak256("venue"),
            false,
            keccak256("event-evidence")
        );
    }

    function _templateConfig(SportsTypes420.Kind kind) internal view returns (SportsTypes420.Template memory t) {
        bool soccer = SportsTypes420.sport(comps.get(comp).config.catalog) == SportsTypes420.Sport.SOCCER;
        t = SportsTypes420.Template(
            comp,
            kind,
            soccer ? SportsTypes420.Coverage.REGULATION : SportsTypes420.Coverage.INCLUDING_OVERTIME,
            comps.get(comp).config.catalog == SportsTypes420.Competition.NHL
                || comps.get(comp).config.catalog == SportsTypes420.Competition.PWHL,
            keccak256(abi.encode("rules", comps.get(comp).config.catalog)),
            keccak256("completion"),
            keccak256("postponement"),
            keccak256("disputes"),
            POLICY,
            60,
            86400
        );
    }

    function _marketConfig(bytes32 tid, int32 line) internal view returns (SportsTypes420.MarketConfig memory) {
        return SportsTypes420.MarketConfig(
            eventId,
            tid,
            OP,
            keccak256("game-version"),
            keccak256("risk"),
            keccak256("vault"),
            address(token),
            line,
            uint64(block.timestamp + 3000)
        );
    }

    function _fixture(SportsTypes420.Competition catalog) internal {
        comp = comps.idFor(catalog);
        _grant(REG, comps.REGISTER(), comps.scope(comp));
        _grant(REVIEW, comps.APPROVE(), comps.scope(comp));
        _call(REG, address(comps), abi.encodeCall(comps.register, (_competitionConfig(catalog))));
        _call(REVIEW, address(comps), abi.encodeCall(comps.approve, (comp, comps.get(comp).digest)));
        _grant(REG, evts.SEASON(), evts.scope(comp));
        _grant(REG, evts.PARTICIPANT(), evts.scope(comp));
        _grant(REG, evts.REGISTER(), evts.scope(comp));
        _grant(REVIEW, evts.MAPPING(), evts.scope(comp));
        bytes32 label = keccak256("2026-27");
        season = evts.seasonId(comp, label);
        _call(
            REG,
            address(evts),
            abi.encodeCall(
                evts.registerSeason, (comp, label, uint64(block.timestamp - 1), uint64(block.timestamp + 365 days))
            )
        );
        stage = evts.stageId(season, keccak256("regular"));
        _call(REG, address(evts), abi.encodeCall(evts.registerStage, (season, keccak256("regular"))));
        bytes32 homeIdentity = keccak256(abi.encode("home-team", catalog));
        bytes32 awayIdentity = keccak256(abi.encode("away-team", catalog));
        home = evts.participantId(homeIdentity);
        away = evts.participantId(awayIdentity);
        _call(
            REG,
            address(evts),
            abi.encodeCall(evts.registerParticipant, (comp, homeIdentity, keccak256("home-metadata")))
        );
        _call(
            REG,
            address(evts),
            abi.encodeCall(evts.registerParticipant, (comp, awayIdentity, keccak256("away-metadata")))
        );
        SportsTypes420.EventConfig memory e = _eventConfig();
        eventId = evts.idFor(e);
        _call(REG, address(evts), abi.encodeCall(evts.register, (e)));
        _map(1, comp, keccak256("external-comp"));
        _map(2, season, keccak256("external-season"));
        _map(3, home, keccak256("external-home"));
        _map(3, away, keccak256("external-away"));
        _map(4, eventId, keccak256("external-fixture"));
        _grant(SOURCE, evts.SOURCE(), evts.scope(eventId));
        _observe(true);
        _grant(REG, markets.TEMPLATE_REGISTER(), markets.scope(comp));
        SportsTypes420.Kind kind = SportsTypes420.sport(catalog) == SportsTypes420.Sport.SOCCER
            ? SportsTypes420.Kind.MONEYLINE_THREE
            : SportsTypes420.Kind.MONEYLINE_TWO;
        template = _newTemplate(_templateConfig(kind));
        market = _newMarket(_marketConfig(template, 0));
    }

    function _observe(bool healthy) internal {
        _call(
            SOURCE,
            address(evts),
            abi.encodeCall(
                evts.observe,
                (eventId, evts.get(eventId).revision, uint64(block.timestamp), healthy, keccak256("source-evidence"))
            )
        );
    }

    function _map(uint8 kind, bytes32 canonical, bytes32 externalId) internal {
        _call(
            REVIEW,
            address(evts),
            abi.encodeCall(evts.bindAlias, (comp, kind, externalId, canonical, keccak256("mapping-evidence")))
        );
    }

    function _newTemplate(SportsTypes420.Template memory t) internal returns (bytes32 id) {
        id = markets.templateId(t);
        _call(REG, address(markets), abi.encodeCall(markets.registerTemplate, (t)));
        _grant(REVIEW, markets.TEMPLATE_APPROVE(), markets.scope(id));
        _call(REVIEW, address(markets), abi.encodeCall(markets.approveTemplate, (id)));
    }

    function _newMarket(SportsTypes420.MarketConfig memory c) internal returns (bytes32 id) {
        id = markets.idFor(c);
        _grant(REG, markets.REGISTER(), markets.scope(id));
        _call(REG, address(markets), abi.encodeCall(markets.register, (c)));
        _grant(REVIEW, markets.APPROVE(), markets.scope(id));
        _call(REVIEW, address(markets), abi.encodeCall(markets.approve, (id, markets.get(id).termsHash)));
        _grant(CONTROL, markets.OPEN(), markets.scope(id));
        _grant(CONTROL, markets.SUSPEND(), markets.scope(id));
        _grant(CONTROL, markets.RESUME(), markets.scope(id));
        _grant(CONTROL, markets.CLOSE(), markets.scope(id));
        _call(CONTROL, address(markets), abi.encodeCall(markets.open, (id)));
        require(markets.eligible(id), "not eligible");
    }

    function _halt(BetTypes420.EmergencyDomain domain, bytes32 id, bool stop) internal {
        _grant(address(this), BetIds420.ACTION_EMERGENCY_SET, auth.scopeForEmergency(domain, id));
        halt.setEmergency(domain, id, stop);
    }

    function _catalogCase(SportsTypes420.Competition c) internal {
        if (c != SportsTypes420.Competition.NHL) _fixture(c);
        require(comps.active(comp) && markets.eligible(market), "catalog lifecycle");
        SportsTypes420.Template memory spread = _templateConfig(SportsTypes420.Kind.SPREAD);
        bytes32 sp = _newTemplate(spread);
        bytes32 sm = _newMarket(_marketConfig(sp, -7));
        bytes32 total = _newTemplate(_templateConfig(SportsTypes420.Kind.TOTAL));
        bytes32 tm = _newMarket(_marketConfig(total, 11));
        require(markets.selections(sm).length == 2 && markets.selections(tm).length == 2, "selections");
        bytes32 key = evts.aliasKey(comp, keccak256("provider"), keccak256("feed"), 4, keccak256("external-event"));
        _call(
            REVIEW,
            address(evts),
            abi.encodeCall(evts.bindAlias, (comp, uint8(4), keccak256("external-event"), eventId, keccak256("mapping")))
        );
        require(evts.aliases(key) == eventId, "provider binding");
        bytes32 digest = markets.get(market).termsHash;
        _grant(CONTROL, evts.STATUS(), evts.scope(eventId));
        _call(
            CONTROL,
            address(evts),
            abi.encodeCall(evts.setStatus, (eventId, SportsTypes420.EventStatus.STARTED, keccak256("start")))
        );
        require(!markets.eligible(market), "start did not close eligibility");
        _call(
            CONTROL,
            address(evts),
            abi.encodeCall(evts.setStatus, (eventId, SportsTypes420.EventStatus.COMPLETED, keccak256("complete")))
        );
        require(
            markets.get(market).termsHash == digest && markets.get(market).status == SportsTypes420.MarketStatus.OPEN,
            "event fabricated settlement"
        );
        _call(CONTROL, address(markets), abi.encodeCall(markets.close, (market)));
        require(markets.get(market).termsHash == digest, "terms changed");
    }

    function testCatalogNHL() public {
        _catalogCase(SportsTypes420.Competition.NHL);
    }

    function testCatalogPWHL() public {
        _catalogCase(SportsTypes420.Competition.PWHL);
    }

    function testCatalogNFL() public {
        _catalogCase(SportsTypes420.Competition.NFL);
    }

    function testCatalogNCAAFBS() public {
        _catalogCase(SportsTypes420.Competition.NCAA_FBS);
    }

    function testCatalogMLB() public {
        _catalogCase(SportsTypes420.Competition.MLB);
    }

    function testCatalogNBA() public {
        _catalogCase(SportsTypes420.Competition.NBA);
    }

    function testCatalogWNBA() public {
        _catalogCase(SportsTypes420.Competition.WNBA);
    }

    function testCatalogNCAAMenD1() public {
        _catalogCase(SportsTypes420.Competition.NCAA_MEN_D1);
    }

    function testCatalogNCAAWomenD1() public {
        _catalogCase(SportsTypes420.Competition.NCAA_WOMEN_D1);
    }

    function testCatalogChampionsLeague() public {
        _catalogCase(SportsTypes420.Competition.UEFA_CHAMPIONS);
    }

    function testCatalogEuropaLeague() public {
        _catalogCase(SportsTypes420.Competition.UEFA_EUROPA);
    }

    function testCatalogMLS() public {
        _catalogCase(SportsTypes420.Competition.MLS);
    }

    function testCatalogCentralAmericanCup() public {
        _catalogCase(SportsTypes420.Competition.CENTRAL_AMERICAN_CUP);
    }

    function testCatalogBrazilSerieA() public {
        _catalogCase(SportsTypes420.Competition.BRAZIL_SERIE_A);
    }

    function testCatalogLibertadores() public {
        _catalogCase(SportsTypes420.Competition.LIBERTADORES);
    }

    function testUnauthorizedWritersAllRegistries() public {
        _fails(OUT, address(comps), abi.encodeCall(comps.suspend, (comp)));
        _fails(OUT, address(evts), abi.encodeCall(evts.register, (_eventConfig())));
        _fails(
            OUT,
            address(evts),
            abi.encodeCall(evts.observe, (eventId, uint64(1), uint64(block.timestamp), true, bytes32(uint256(1))))
        );
        _fails(OUT, address(markets), abi.encodeCall(markets.close, (market)));
        _fails(OUT, address(markets), abi.encodeCall(markets.approveTemplate, (template)));
    }

    function testCompetitionAndTemplateSelfApprovalDenied() public {
        bytes32 id = comps.idFor(SportsTypes420.Competition.NBA);
        _grant(REG, comps.REGISTER(), comps.scope(id));
        _grant(REG, comps.APPROVE(), comps.scope(id));
        _call(REG, address(comps), abi.encodeCall(comps.register, (_competitionConfig(SportsTypes420.Competition.NBA))));
        _fails(REG, address(comps), abi.encodeCall(comps.approve, (id, comps.get(id).digest)));
        SportsTypes420.Template memory t = _templateConfig(SportsTypes420.Kind.TOTAL);
        bytes32 tid = markets.templateId(t);
        _call(REG, address(markets), abi.encodeCall(markets.registerTemplate, (t)));
        _grant(REG, markets.TEMPLATE_APPROVE(), markets.scope(tid));
        _fails(REG, address(markets), abi.encodeCall(markets.approveTemplate, (tid)));
    }

    function testCompetitionSuspendResumeInvalidatesExistingOpening() public {
        _grant(CONTROL, comps.SUSPEND(), comps.scope(comp));
        _grant(REVIEW, comps.RESUME(), comps.scope(comp));
        _call(CONTROL, address(comps), abi.encodeCall(comps.suspend, (comp)));
        require(!markets.eligible(market), "suspended comp");
        _call(REVIEW, address(comps), abi.encodeCall(comps.resume, (comp)));
        require(!markets.eligible(market), "implicit reopen");
        _call(CONTROL, address(markets), abi.encodeCall(markets.suspend, (market)));
        _call(CONTROL, address(markets), abi.encodeCall(markets.resume, (market)));
        require(markets.eligible(market), "explicit resume");
    }

    function testCompetitionRetirementTerminalPreservesRecords() public {
        bytes32 digest = markets.get(market).termsHash;
        _grant(CONTROL, comps.RETIRE(), comps.scope(comp));
        _grant(CONTROL, comps.RESUME(), comps.scope(comp));
        _call(CONTROL, address(comps), abi.encodeCall(comps.retire, (comp)));
        require(!markets.eligible(market), "retired comp");
        _fails(CONTROL, address(comps), abi.encodeCall(comps.resume, (comp)));
        require(markets.get(market).termsHash == digest, "lost obligation");
        _call(CONTROL, address(markets), abi.encodeCall(markets.close, (market)));
    }

    function testRevisedStartInvalidatesReadinessWithoutExtendingCutoff() public {
        SportsMarketRegistry420.Record memory old = markets.get(market);
        bytes32 original = evts.get(eventId).digest;
        _grant(CONTROL, evts.SCHEDULE(), evts.scope(eventId));
        _call(
            CONTROL,
            address(evts),
            abi.encodeCall(
                evts.reviseSchedule,
                (eventId, uint64(block.timestamp + 7200), keccak256("new venue"), true, keccak256("revision"))
            )
        );
        require(!markets.eligible(market) && evts.get(eventId).revision == 2, "revision gate");
        vm.warp(block.timestamp + 1);
        _observe(true);
        require(!markets.eligible(market), "implicit revision accept");
        _call(CONTROL, address(markets), abi.encodeCall(markets.suspend, (market)));
        _call(CONTROL, address(markets), abi.encodeCall(markets.resume, (market)));
        require(
            markets.eligible(market) && markets.get(market).config.cutoff == old.config.cutoff
                && markets.get(market).termsHash == old.termsHash,
            "rewritten cutoff"
        );
        require(evts.get(eventId).digest == original, "original config lost");
        (uint64 first,,,,,) = evts.revisions(eventId, 1);
        require(first == 1_800_003_600, "history overwritten");
    }

    function testEarlierStartAndExactCutoffFailClosed() public {
        uint64 start = uint64(block.timestamp + 100);
        _grant(CONTROL, evts.SCHEDULE(), evts.scope(eventId));
        _call(
            CONTROL,
            address(evts),
            abi.encodeCall(evts.reviseSchedule, (eventId, start, keccak256("venue"), false, keccak256("early")))
        );
        vm.warp(block.timestamp + 1);
        _observe(true);
        _call(CONTROL, address(markets), abi.encodeCall(markets.suspend, (market)));
        _call(CONTROL, address(markets), abi.encodeCall(markets.resume, (market)));
        vm.warp(start);
        require(!markets.eligible(market), "exact start");
    }

    function testExactCutoff() public {
        vm.warp(markets.get(market).config.cutoff);
        require(!markets.eligible(market), "cutoff accepted");
    }

    function testStaleFutureDuplicateWrongRevisionSourceRejected() public {
        _fails(
            SOURCE,
            address(evts),
            abi.encodeCall(evts.observe, (eventId, uint64(1), uint64(block.timestamp), true, keccak256("dup")))
        );
        _fails(
            SOURCE,
            address(evts),
            abi.encodeCall(evts.observe, (eventId, uint64(1), uint64(block.timestamp + 1), true, keccak256("future")))
        );
        vm.warp(block.timestamp + 301);
        require(!markets.eligible(market), "stale");
        _fails(
            SOURCE,
            address(evts),
            abi.encodeCall(evts.observe, (eventId, uint64(1), uint64(block.timestamp - 301), true, keccak256("old")))
        );
        _fails(
            SOURCE,
            address(evts),
            abi.encodeCall(
                evts.observe, (eventId, uint64(2), uint64(block.timestamp), true, keccak256("wrong revision"))
            )
        );
        _observe(true);
        require(markets.eligible(market), "fresh report");
    }

    function testUnhealthySourceRequiresExplicitMarketResumeAfterRecovery() public {
        vm.warp(block.timestamp + 1);
        _observe(false);
        require(!markets.eligible(market), "outage");
        vm.warp(block.timestamp + 1);
        _observe(true);
        require(!markets.eligible(market), "outage implicitly resumed");
        _call(CONTROL, address(markets), abi.encodeCall(markets.suspend, (market)));
        _call(CONTROL, address(markets), abi.encodeCall(markets.resume, (market)));
        require(markets.eligible(market), "resume failed");
    }

    function testRevokedAndExpiredCapabilitiesFailClosed() public {
        bytes32 grant = cap.activeGrantId(SOURCE, keccak256("420.BET.CORE"), evts.SOURCE(), evts.scope(eventId));
        cap.revokeGrant(grant);
        require(!markets.eligible(market), "revoked reporter");
        vm.warp(block.timestamp + 1);
        _fails(
            SOURCE,
            address(evts),
            abi.encodeCall(evts.observe, (eventId, uint64(1), uint64(block.timestamp), true, keccak256("report")))
        );
        _grant(SOURCE, evts.SOURCE(), evts.scope(eventId));
        _observe(true);
        require(markets.eligible(market), "regranted");
        bytes32 short = bytes32(++nonce);
        cap.createGrant(
            short,
            CONTROL,
            keccak256("420.BET.CORE"),
            markets.CLOSE(),
            markets.scope(market),
            0,
            0,
            0,
            uint64(block.timestamp),
            uint64(block.timestamp + 1)
        );
        vm.warp(block.timestamp + 2);
        _fails(CONTROL, address(markets), abi.encodeCall(markets.close, (market)));
    }

    function testRevokedCompetitionTemplateMarketApprovalsFailClosed() public {
        bytes32 id = cap.activeGrantId(REVIEW, keccak256("420.BET.CORE"), comps.APPROVE(), comps.scope(comp));
        cap.revokeGrant(id);
        require(!markets.eligible(market), "comp approval revoked");
        _grant(REVIEW, comps.APPROVE(), comps.scope(comp));
        id = cap.activeGrantId(REVIEW, keccak256("420.BET.CORE"), markets.TEMPLATE_APPROVE(), markets.scope(template));
        cap.revokeGrant(id);
        require(!markets.eligible(market), "template approval revoked");
        _grant(REVIEW, markets.TEMPLATE_APPROVE(), markets.scope(template));
        id = cap.activeGrantId(REVIEW, keccak256("420.BET.CORE"), markets.APPROVE(), markets.scope(market));
        cap.revokeGrant(id);
        require(!markets.eligible(market), "market approval revoked");
    }

    function testEmergencyAllDomainsAndHistoricalReads() public {
        bytes32 digest = markets.get(market).termsHash;
        _halt(BetTypes420.EmergencyDomain.NEW_WAGERS, 0, true);
        require(!markets.eligible(market), "global halt");
        _halt(BetTypes420.EmergencyDomain.NEW_WAGERS, 0, false);
        _halt(BetTypes420.EmergencyDomain.SPORTS_MARKET, market, true);
        require(!markets.eligible(market), "market halt");
        _halt(BetTypes420.EmergencyDomain.SPORTS_MARKET, market, false);
        _halt(BetTypes420.EmergencyDomain.GAME_VERSION, keccak256("game-version"), true);
        require(!markets.eligible(market), "game halt");
        _halt(BetTypes420.EmergencyDomain.GAME_VERSION, keccak256("game-version"), false);
        _halt(BetTypes420.EmergencyDomain.VAULT_NEW_RISK, keccak256("vault"), true);
        require(!markets.eligible(market), "vault halt");
        _halt(BetTypes420.EmergencyDomain.VAULT_NEW_RISK, keccak256("vault"), false);
        _halt(BetTypes420.EmergencyDomain.ORACLE_PROFILE, POLICY, true);
        require(!markets.eligible(market), "source halt");
        _call(CONTROL, address(markets), abi.encodeCall(markets.close, (market)));
        require(markets.get(market).termsHash == digest, "history unavailable");
    }

    function testOperatorPauseDoesNotEraseMarkets() public {
        _grant(address(this), BetIds420.ACTION_OPERATOR_PAUSE, auth.scopeForOperator(OP));
        ops.pause(OP);
        require(!markets.eligible(market), "paused operator");
        require(markets.get(market).config.operatorId == OP, "operator removed");
    }

    function testClosedMarketNeverReopens() public {
        _call(CONTROL, address(markets), abi.encodeCall(markets.close, (market)));
        _fails(CONTROL, address(markets), abi.encodeCall(markets.open, (market)));
        _fails(CONTROL, address(markets), abi.encodeCall(markets.resume, (market)));
    }

    function testAliasesIdempotentConflictsAndNamespaceIsolation() public {
        bytes memory data =
            abi.encodeCall(evts.bindAlias, (comp, uint8(4), keccak256("ext"), eventId, keccak256("evidence")));
        _call(REVIEW, address(evts), data);
        _call(REVIEW, address(evts), data);
        _fails(
            REVIEW,
            address(evts),
            abi.encodeCall(evts.bindAlias, (comp, uint8(4), keccak256("ext"), eventId, keccak256("changed evidence")))
        );
        bytes32 k1 = evts.aliasKey(comp, keccak256("provider"), keccak256("feed"), 4, keccak256("ext"));
        bytes32 k2 = evts.aliasKey(comp, keccak256("provider-2"), keccak256("feed"), 4, keccak256("ext"));
        require(k1 != k2 && evts.aliases(k2) == 0, "provider collision");
        _fails(
            REVIEW,
            address(evts),
            abi.encodeCall(evts.bindAlias, (comp, uint8(3), keccak256("bad"), eventId, keccak256("ev")))
        );
    }

    function testDuplicateFixtureRejectedButDoubleheaderDistinct() public {
        _fails(REG, address(evts), abi.encodeCall(evts.register, (_eventConfig())));
        SportsTypes420.EventConfig memory c = _eventConfig();
        c.start += 100;
        require(evts.idFor(c) == eventId, "schedule-derived identity");
        _fails(REG, address(evts), abi.encodeCall(evts.register, (c)));
        c.fixture = keccak256("fixture-2");
        _call(REG, address(evts), abi.encodeCall(evts.register, (c)));
        require(evts.idFor(c) != eventId, "doubleheader collision");
    }

    function testInvalidParticipantsStageSeasonAndBoundsRejected() public {
        SportsTypes420.EventConfig memory c = _eventConfig();
        c.home = c.away;
        _fails(REG, address(evts), abi.encodeCall(evts.register, (c)));
        c = _eventConfig();
        c.home = keccak256("unknown");
        _fails(REG, address(evts), abi.encodeCall(evts.register, (c)));
        c = _eventConfig();
        c.stage = keccak256("other-stage");
        _fails(REG, address(evts), abi.encodeCall(evts.register, (c)));
        c = _eventConfig();
        c.start = uint64(block.timestamp);
        _fails(REG, address(evts), abi.encodeCall(evts.register, (c)));
        c = _eventConfig();
        c.start = uint64(block.timestamp + 366 days);
        _fails(REG, address(evts), abi.encodeCall(evts.register, (c)));
    }

    function testPostponementRecoveryAndTerminalEventStates() public {
        _grant(CONTROL, evts.STATUS(), evts.scope(eventId));
        _call(
            CONTROL,
            address(evts),
            abi.encodeCall(evts.setStatus, (eventId, SportsTypes420.EventStatus.POSTPONED, keccak256("delay")))
        );
        require(!markets.eligible(market), "postponed");
        _call(
            CONTROL,
            address(evts),
            abi.encodeCall(evts.setStatus, (eventId, SportsTypes420.EventStatus.SCHEDULED, keccak256("restored")))
        );
        vm.warp(block.timestamp + 1);
        _observe(true);
        require(!markets.eligible(market), "implicit postpone recovery");
        _call(
            CONTROL,
            address(evts),
            abi.encodeCall(evts.setStatus, (eventId, SportsTypes420.EventStatus.CANCELLED, keccak256("cancel")))
        );
        _fails(
            CONTROL,
            address(evts),
            abi.encodeCall(evts.setStatus, (eventId, SportsTypes420.EventStatus.SCHEDULED, keccak256("bad")))
        );
    }

    function testCannotCompleteScheduledFixtureOrRestartAbandoned() public {
        _grant(CONTROL, evts.STATUS(), evts.scope(eventId));
        _fails(
            CONTROL,
            address(evts),
            abi.encodeCall(evts.setStatus, (eventId, SportsTypes420.EventStatus.COMPLETED, keccak256("bad")))
        );
        _call(
            CONTROL,
            address(evts),
            abi.encodeCall(evts.setStatus, (eventId, SportsTypes420.EventStatus.STARTED, keccak256("start")))
        );
        _call(
            CONTROL,
            address(evts),
            abi.encodeCall(evts.setStatus, (eventId, SportsTypes420.EventStatus.ABANDONED, keccak256("abandon")))
        );
        _fails(
            CONTROL,
            address(evts),
            abi.encodeCall(evts.setStatus, (eventId, SportsTypes420.EventStatus.STARTED, keccak256("bad")))
        );
    }

    function testUnsupportedTemplatesAndPoliciesRejected() public {
        SportsTypes420.Template memory t = _templateConfig(SportsTypes420.Kind.TOTAL);
        t.rules = 0;
        _fails(REG, address(markets), abi.encodeCall(markets.registerTemplate, (t)));
        t = _templateConfig(SportsTypes420.Kind.TOTAL);
        t.refundSeconds = t.challengeSeconds;
        _fails(REG, address(markets), abi.encodeCall(markets.registerTemplate, (t)));
        t = _templateConfig(SportsTypes420.Kind.TOTAL);
        t.sourcePolicy = keccak256("other");
        _fails(REG, address(markets), abi.encodeCall(markets.registerTemplate, (t)));
        t = _templateConfig(SportsTypes420.Kind.MONEYLINE_THREE);
        _fails(REG, address(markets), abi.encodeCall(markets.registerTemplate, (t)));
        _fixture(SportsTypes420.Competition.MLS);
        t = _templateConfig(SportsTypes420.Kind.MONEYLINE_TWO);
        _fails(REG, address(markets), abi.encodeCall(markets.registerTemplate, (t)));
        t = _templateConfig(SportsTypes420.Kind.SPREAD);
        t.coverage = SportsTypes420.Coverage.INCLUDING_OVERTIME;
        _fails(REG, address(markets), abi.encodeCall(markets.registerTemplate, (t)));
    }

    function testChangingRulesCannotHideDuplicateEconomicProposition() public {
        SportsTypes420.Template memory t = _templateConfig(SportsTypes420.Kind.MONEYLINE_TWO);
        t.rules = keccak256("new rules");
        bytes32 tid = _newTemplate(t);
        SportsTypes420.MarketConfig memory c = _marketConfig(tid, 0);
        bytes32 id = markets.idFor(c);
        _grant(REG, markets.REGISTER(), markets.scope(id));
        _fails(REG, address(markets), abi.encodeCall(markets.register, (c)));
    }

    function testChainDeploymentAndScopeReplayIsolation() public {
        bytes32 old = evts.idFor(_eventConfig());
        bytes32 oldScope = comps.scope(comp);
        vm.chainId(block.chainid + 1);
        require(evts.idFor(_eventConfig()) != old && comps.scope(comp) != oldScope, "chain replay");
        require(!markets.eligible(market), "cross-chain capability");
    }

    function testSiblingDeploymentCapabilitiesDoNotReplay() public {
        SportsCompetitionRegistry420 other = new SportsCompetitionRegistry420(address(auth));
        bytes32 id = other.idFor(SportsTypes420.Competition.NHL);
        require(id != comp, "deployment id");
        _fails(
            REG, address(other), abi.encodeCall(other.register, (_competitionConfig(SportsTypes420.Competition.NHL)))
        );
    }

    function testNoFundsAccepted() public {
        (bool a,) = address(comps).call("");
        (bool b,) = address(evts).call("");
        (bool c,) = address(markets).call("");
        require(!a && !b && !c, "fallback accepts funds");
    }

    function testNativeReplayExport() public {
        _checkpoint(0);
        _grant(CONTROL, evts.SCHEDULE(), evts.scope(eventId));
        _call(
            CONTROL,
            address(evts),
            abi.encodeCall(
                evts.reviseSchedule,
                (eventId, uint64(block.timestamp + 7200), keccak256("revised venue"), true, keccak256("revision"))
            )
        );
        _checkpoint(1);
        vm.warp(block.timestamp + 1);
        _observe(true);
        _checkpoint(2);
        _call(CONTROL, address(markets), abi.encodeCall(markets.suspend, (market)));
        _checkpoint(3);
        _call(CONTROL, address(markets), abi.encodeCall(markets.resume, (market)));
        _checkpoint(4);
        _grant(CONTROL, comps.SUSPEND(), comps.scope(comp));
        _grant(REVIEW, comps.RESUME(), comps.scope(comp));
        _call(CONTROL, address(comps), abi.encodeCall(comps.suspend, (comp)));
        _checkpoint(5);
        _call(REVIEW, address(comps), abi.encodeCall(comps.resume, (comp)));
        _checkpoint(6);
        _call(CONTROL, address(markets), abi.encodeCall(markets.suspend, (market)));
        _call(CONTROL, address(markets), abi.encodeCall(markets.resume, (market)));
        _checkpoint(7);
        _call(CONTROL, address(markets), abi.encodeCall(markets.close, (market)));
        _checkpoint(8);
    }

    function testReorgRollbackRestoresCanonicalProjection() public {
        bytes32 original = evts.get(eventId).revisionHash;
        bytes32 terms = markets.get(market).termsHash;
        uint256 snap = vm.snapshotState();
        _grant(CONTROL, evts.SCHEDULE(), evts.scope(eventId));
        _call(
            CONTROL,
            address(evts),
            abi.encodeCall(
                evts.reviseSchedule,
                (eventId, uint64(block.timestamp + 2000), keccak256("orphan venue"), true, keccak256("orphan evidence"))
            )
        );
        require(!markets.eligible(market), "orphan revision eligible");
        require(vm.revertToState(snap), "rollback");
        require(
            evts.get(eventId).revision == 1 && evts.get(eventId).revisionHash == original
                && markets.get(market).termsHash == terms && markets.eligible(market),
            "canonical rollback"
        );
    }

    function testUnmappedFixtureCannotOpen() public {
        SportsTypes420.EventConfig memory c = _eventConfig();
        c.fixture = keccak256("unmapped");
        bytes32 id = evts.idFor(c);
        _call(REG, address(evts), abi.encodeCall(evts.register, (c)));
        _grant(SOURCE, evts.SOURCE(), evts.scope(id));
        _call(
            SOURCE,
            address(evts),
            abi.encodeCall(evts.observe, (id, uint64(1), uint64(block.timestamp), true, keccak256("observed")))
        );
        require(!evts.ready(id), "unmapped source ready");
        _map(4, id, keccak256("external-unmapped"));
        require(evts.ready(id), "mapped source not ready");
    }

    function testProviderAliasCannotBeReassigned() public {
        SportsTypes420.EventConfig memory c = _eventConfig();
        c.fixture = keccak256("second");
        bytes32 id = evts.idFor(c);
        _call(REG, address(evts), abi.encodeCall(evts.register, (c)));
        _fails(
            REVIEW,
            address(evts),
            abi.encodeCall(
                evts.bindAlias, (comp, uint8(4), keccak256("external-fixture"), id, keccak256("mapping-evidence"))
            )
        );
    }

    function testHistoricObservationAfterScheduleInvalidationRejected() public {
        uint64 old = 1_800_000_000;
        vm.warp(1_800_000_010);
        _grant(CONTROL, evts.SCHEDULE(), evts.scope(eventId));
        _call(
            CONTROL,
            address(evts),
            abi.encodeCall(
                evts.reviseSchedule,
                (eventId, uint64(block.timestamp + 2000), keccak256("new"), true, keccak256("revision"))
            )
        );
        _fails(
            SOURCE,
            address(evts),
            abi.encodeCall(evts.observe, (eventId, uint64(2), old, true, keccak256("old observation")))
        );
    }

    function testNewVersionAfterClosurePreservesOldTerms() public {
        bytes32 previous = market;
        bytes32 terms = markets.get(previous).termsHash;
        _call(CONTROL, address(markets), abi.encodeCall(markets.close, (previous)));
        SportsTypes420.Template memory t = _templateConfig(SportsTypes420.Kind.MONEYLINE_TWO);
        t.rules = keccak256("new reviewed version");
        bytes32 tid = _newTemplate(t);
        bytes32 next = _newMarket(_marketConfig(tid, 0));
        require(
            next != previous && markets.get(previous).termsHash == terms && !markets.eligible(previous),
            "historical mutation"
        );
    }

    function testMarketSelfApprovalAndWrongDigestDenied() public {
        bytes32 tid = _newTemplate(_templateConfig(SportsTypes420.Kind.TOTAL));
        SportsTypes420.MarketConfig memory c = _marketConfig(tid, 13);
        bytes32 id = markets.idFor(c);
        _grant(REG, markets.REGISTER(), markets.scope(id));
        _call(REG, address(markets), abi.encodeCall(markets.register, (c)));
        _grant(REG, markets.APPROVE(), markets.scope(id));
        _fails(REG, address(markets), abi.encodeCall(markets.approve, (id, markets.get(id).termsHash)));
        _grant(CONTROL, markets.APPROVE(), markets.scope(id));
        _fails(CONTROL, address(markets), abi.encodeCall(markets.approve, (id, markets.get(id).termsHash)));
        _grant(REVIEW, markets.APPROVE(), markets.scope(id));
        _fails(REVIEW, address(markets), abi.encodeCall(markets.approve, (id, keccak256("wrong digest"))));
    }

    function testCrossCompetitionTemplateCannotBeUsed() public {
        bytes32 oldTemplate = template;
        _fixture(SportsTypes420.Competition.PWHL);
        SportsTypes420.MarketConfig memory c = _marketConfig(oldTemplate, 0);
        bytes32 id = markets.idFor(c);
        _grant(REG, markets.REGISTER(), markets.scope(id));
        _fails(REG, address(markets), abi.encodeCall(markets.register, (c)));
    }

    function testAssetAndLineValidation() public {
        bytes32 tid = _newTemplate(_templateConfig(SportsTypes420.Kind.TOTAL));
        SportsTypes420.MarketConfig memory c = _marketConfig(tid, 0);
        bytes32 id = markets.idFor(c);
        _grant(REG, markets.REGISTER(), markets.scope(id));
        _fails(REG, address(markets), abi.encodeCall(markets.register, (c)));
        c.lineTwice = 11;
        c.asset = OUT;
        id = markets.idFor(c);
        _grant(REG, markets.REGISTER(), markets.scope(id));
        _fails(REG, address(markets), abi.encodeCall(markets.register, (c)));
        c = _marketConfig(template, 1);
        id = markets.idFor(c);
        _grant(REG, markets.REGISTER(), markets.scope(id));
        _fails(REG, address(markets), abi.encodeCall(markets.register, (c)));
    }

    function testFutureSeasonInvalidRangeAndDuplicateCatalogRejected() public {
        _fails(
            REG, address(comps), abi.encodeCall(comps.register, (_competitionConfig(SportsTypes420.Competition.NHL)))
        );
        _fails(REG, address(evts), abi.encodeCall(evts.registerSeason, (comp, keccak256("bad"), uint64(5), uint64(4))));
        _fails(
            REG, address(evts), abi.encodeCall(evts.registerStage, (keccak256("missing season"), keccak256("stage")))
        );
    }

    function testZeroConstructorsAndDependencyMixingRejected() public {
        vm.expectRevert();
        new SportsCompetitionRegistry420(address(0));
        vm.expectRevert();
        new SportsEventRegistry420(address(auth), OUT);
        SportsCompetitionRegistry420 other = new SportsCompetitionRegistry420(address(auth));
        vm.expectRevert();
        new SportsMarketRegistry420(address(auth), address(other), address(evts), address(ops), address(halt));
    }

    function testParticipantCannotCrossSportOrGenderCategory() public {
        bytes32 identity = keccak256(abi.encode("home-team", SportsTypes420.Competition.NHL));
        _fixture(SportsTypes420.Competition.PWHL);
        _fails(
            REG, address(evts), abi.encodeCall(evts.registerParticipant, (comp, identity, keccak256("home-metadata")))
        );
        _fixture(SportsTypes420.Competition.NBA);
        _fails(
            REG, address(evts), abi.encodeCall(evts.registerParticipant, (comp, identity, keccak256("home-metadata")))
        );
    }

    function testTwoWayAndThreeWayRegulationHockeyRemainDistinct() public {
        SportsTypes420.Template memory t = _templateConfig(SportsTypes420.Kind.MONEYLINE_THREE);
        t.coverage = SportsTypes420.Coverage.REGULATION;
        t.shootout = false;
        bytes32 tid = _newTemplate(t);
        bytes32 mid = _newMarket(_marketConfig(tid, 0));
        require(markets.selections(mid).length == 3 && markets.selections(market).length == 2, "selection semantics");
        require(markets.get(mid).termsHash != markets.get(market).termsHash, "coverage conflated");
    }

    function testFuzzLifecyclePreservesTermsAndTerminalSafety(uint256 seed) public {
        bytes32 digest = markets.get(market).termsHash;
        uint64 cutoff = markets.get(market).config.cutoff;
        _grant(CONTROL, evts.STATUS(), evts.scope(eventId));
        for (uint256 i; i < 16; ++i) {
            seed = uint256(keccak256(abi.encode(seed, i)));
            uint256 op = seed % 5;
            if (op == 0) {
                vm.prank(CONTROL);
                address(markets).call(abi.encodeCall(markets.suspend, (market)));
            } else if (op == 1) {
                vm.prank(CONTROL);
                address(markets).call(abi.encodeCall(markets.resume, (market)));
            } else if (op == 2) {
                vm.prank(CONTROL);
                address(markets).call(abi.encodeCall(markets.close, (market)));
            } else if (op == 3) {
                vm.prank(CONTROL);
                address(evts)
                    .call(
                        abi.encodeCall(
                            evts.setStatus, (eventId, SportsTypes420.EventStatus.STARTED, keccak256("start"))
                        )
                    );
            } else {
                vm.prank(CONTROL);
                address(evts)
                    .call(
                        abi.encodeCall(
                            evts.setStatus, (eventId, SportsTypes420.EventStatus.COMPLETED, keccak256("complete"))
                        )
                    );
            }
            SportsMarketRegistry420.Record memory r = markets.get(market);
            require(r.termsHash == digest && r.config.cutoff == cutoff, "immutable promise changed");
            if (
                r.status == SportsTypes420.MarketStatus.CLOSED
                    || evts.get(eventId).status != SportsTypes420.EventStatus.SCHEDULED
            ) {
                require(!markets.eligible(market), "terminal state accepted new risk");
            }
        }
    }

    function testFuzzFixtureIdentityIndependentOfTime(uint64 start) public view {
        SportsTypes420.EventConfig memory c = _eventConfig();
        c.start = start;
        require(evts.idFor(c) == eventId, "identity shifted");
    }

    function testFuzzDistinctFixtureDiscriminator(bytes32 discriminator) public view {
        SportsTypes420.EventConfig memory c = _eventConfig();
        c.fixture = discriminator;
        require((evts.idFor(c) == eventId) == (discriminator == keccak256("fixture-1")), "fixture collision");
    }

    function testFuzzLineVersionIdentity(int32 line) public view {
        SportsTypes420.MarketConfig memory c = markets.get(market).config;
        c.lineTwice = line;
        require((markets.idFor(c) == market) == (line == 0), "market line collision");
    }

    function testFuzzFreshnessBoundary(uint16 age) public {
        uint256 bounded = uint256(age) % 3000;
        vm.warp(block.timestamp + bounded);
        require(markets.eligible(market) == (bounded <= 300), "freshness boundary mismatch");
    }
}
