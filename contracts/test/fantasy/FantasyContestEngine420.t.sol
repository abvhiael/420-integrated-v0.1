// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./FantasyDisputeController420.t.sol";
import "./FantasyEncryptedFixtures420.sol";
import "../../src/bet/fantasy/FantasyContestEngine420.sol";

abstract contract FantasyEngineFixture420 is FantasyDisputeFixture420 {
    bytes32 constant CONTEST = keccak256("contest-engine-pool");
    bytes32 constant SLATE = keccak256("nhl-slate");
    bytes32 constant GAME = keccak256("nhl-game");
    bytes32 constant SLATE_FEED = keccak256("nhl-slate-feed");
    bytes32 constant CAND_FEED = keccak256("nhl-contest-candidate-feed");
    bytes32 constant USER_TYPE = keccak256("canonical-fantasy-user");
    bytes32 constant PLAYER3 = keccak256("third-player-identity");
    address constant USER3 = address(0x102);
    address constant DEV = address(0x420);
    uint256 constant VALIDATOR_KEY = 0xAABBCC;
    uint64 constant LOCK = 2000;
    uint64 constant CUTOFF = LOCK + 36 hours;
    FantasySlateBook420 slates;
    FantasyNHLScoring420 scorer;
    FantasyContestEngine420 engine;
    DevelopmentCompensationVault420 developmentVault;
    mapping(uint32 => FantasyTypes420.Stats) stat;

    function setUp() public virtual override {
        super.setUp();
        vm.prank(USER3);
        identity.createProfile(PLAYER3, keccak256("third"));
        for (uint8 who = 1; who <= 3; who++) {
            identity.issueCredential(_userCredential(who), ISSUER, _subject(who), USER_TYPE, _person(who), 0);
            vm.deal(_account(who), 1000 ether);
        }
        identity.issueCredential(keccak256("admin-user"), ISSUER, ADMIN_ID, USER_TYPE, keccak256("admin-person"), 0);
        identity.issueCredential(
            keccak256("delegate-user"), ISSUER, DELEGATE_ID, USER_TYPE, keccak256("delegate-person"), 0
        );
        vm.deal(ADMIN, 1000 ether);
        slates = new FantasySlateBook420(address(auth), address(router));
        scorer = new FantasyNHLScoring420();
        _feed(SLATE_FEED);
        _feed(CAND_FEED);
        _grant(address(this), slates.PUBLISH(), auth.scopeForContest(SLATE));
        FantasyTypes420.Game[] memory schedule = new FantasyTypes420.Game[](1);
        schedule[0] = FantasyTypes420.Game(GAME, LOCK);
        FantasyTypes420.Athlete[] memory roster = new FantasyTypes420.Athlete[](21);
        for (uint32 i = 1; i <= 21; i++) {
            uint32 pos = (i - 1) % 7;
            uint8 mask = pos == 0 ? 1 : pos == 1 ? 2 : pos == 2 ? 4 : pos < 5 ? 8 : pos == 5 ? 16 : 1;
            roster[i - 1] = FantasyTypes420.Athlete(i, GAME, mask);
            stat[i].played = true;
            stat[i].complete = true;
        }
        stat[1].goals = 1;
        stat[1].shots = 1;
        slates.publish(
            SLATE,
            SLATE_FEED,
            FantasyEncryptedFixtures420.publicKeyHash(),
            keccak256(abi.encode(ISSUER, keccak256("custodian-person"))),
            vm.addr(VALIDATOR_KEY),
            CUTOFF,
            schedule,
            roster
        );
        slates.sealSlate(SLATE);
        developmentVault = new DevelopmentCompensationVault420(address(cap), DEV);
        _makeEngine(address(0));
    }

    function _makeEngine(address token) internal {
        if (token != address(0)) {
            d = new FantasyDisputeController420(
                address(auth), address(identity), address(router), TYPE, token, COMMUNITY
            );
        }
        engine = new FantasyContestEngine420(
            address(d), address(slates), address(scorer), address(developmentVault), ISSUER, USER_TYPE
        );
        for (uint8 who = 1; who <= 3; who++) {
            _grant(_account(who), BetIds420.ACTION_FANTASY_ENTER, auth.scopeForContest(CONTEST));
        }
        _grant(ADMIN, engine.CREATE(), auth.scopeGlobal());
        _grant(address(engine), d.REGISTER(), auth.scopeForContest(CONTEST));
        _grant(vm.addr(VALIDATOR_KEY), slates.VALIDATE_LINEUP(), auth.scopeForContest(SLATE));
        engine.registerIdentity(ADMIN_ID, keccak256("admin-user"));
        engine.registerIdentity(DELEGATE_ID, keccak256("delegate-user"));
    }

    function _subject(uint8 who) internal pure returns (bytes32) {
        return who == 1 ? PLAYER : who == 2 ? PLAYER2 : PLAYER3;
    }

    function _account(uint8 who) internal pure returns (address) {
        return who == 1 ? USER : who == 2 ? USER2 : USER3;
    }

    function _person(uint8 who) internal pure returns (bytes32) {
        return keccak256(abi.encode("person", who));
    }

    function _userCredential(uint8 who) internal pure returns (bytes32) {
        return keccak256(abi.encode("user-credential", who));
    }

    function _lineup(uint8 who) internal pure returns (uint32[7] memory l) {
        for (uint32 i; i < 7; i++) {
            l[i] = (uint32(who) - 1) * 7 + i + 1;
        }
    }

    function _salt(uint8 who, uint64 nonce) internal pure returns (bytes32) {
        return keccak256(abi.encode("salt", who, nonce));
    }

    function _bands(uint64 cap) internal pure returns (FantasyTypes420.Band[] memory rows) {
        rows = new FantasyTypes420.Band[](cap == 2 ? 0 : 1);
        if (cap != 2) {
            uint16[] memory weights = new uint16[](3);
            weights[0] = 6000;
            weights[1] = 3000;
            weights[2] = 1000;
            rows[0] = FantasyTypes420.Band(3, cap == 0 ? type(uint64).max : cap, weights);
        }
    }

    function _create(uint256 entryFee, uint256 prize, uint64 cap, bool privatePool) internal {
        FantasyContestEngine420.Config memory cfg = FantasyContestEngine420.Config(
            SLATE, CAND_FEED, ADMIN_ID, entryFee, prize, cap, entryFee != 0, privatePool
        );
        FantasyTypes420.Band[] memory rows = _bands(cap);
        vm.prank(ADMIN);
        engine.createPool{value: entryFee == 0 ? prize : 0}(CONTEST, cfg, abi.encode(rows));
    }

    function _submission(uint8 who, uint64 nonce) internal returns (FantasyContestEngine420.Submission memory sub) {
        sub.commitment = engine.commitmentOf(CONTEST, _subject(who), nonce, _lineup(who), _salt(who, nonce));
        sub.nonce = nonce;
        sub.expiry = LOCK;
        sub.envelope = FantasyEncryptedFixtures420.envelope(who, nonce);
        bytes32 userKey = keccak256(abi.encode(ISSUER, _person(who)));
        (uint8 v, bytes32 r, bytes32 s) =
            vm.sign(VALIDATOR_KEY, engine.submissionDigest(CONTEST, _subject(who), userKey, sub));
        sub.signature = abi.encodePacked(r, s, v);
    }

    function _enter(uint8 who) internal {
        FantasyContestEngine420.Submission memory sub = _submission(who, 1);
        uint256 fee = engine.configOf(CONTEST).entryFee;
        bool nativeAsset = engine.asset() == address(0);
        vm.prank(_account(who));
        engine.enterPool{value: nativeAsset ? fee : 0}(CONTEST, _subject(who), _userCredential(who), sub);
    }

    function _reveal(uint8 who) internal {
        _revealExpected(who, bytes4(0));
    }

    function _revealExpected(uint8 who, bytes4 failure) internal {
        uint64 nonce = engine.entryOf(CONTEST, who).nonce;
        if (failure != bytes4(0)) vm.expectRevert(failure);
        engine.publishLineup(CONTEST, who, _lineup(who), _salt(who, nonce));
    }

    function _expectEnterFailure(uint8 who, bytes4 failure) internal {
        FantasyContestEngine420.Submission memory sub = _submission(who, 1);
        uint256 fee = engine.configOf(CONTEST).entryFee;
        bool nativeAsset = engine.asset() == address(0);
        vm.prank(_account(who));
        vm.expectRevert(failure);
        engine.enterPool{value: nativeAsset ? fee : 0}(CONTEST, _subject(who), _userCredential(who), sub);
    }

    function _lockReveal(uint8 count) internal {
        vm.warp(LOCK);
        engine.lockPool(CONTEST);
        for (uint8 i = 1; i <= count; i++) {
            _reveal(i);
        }
    }

    function _resolveGames(bool eligible, uint64 actualStart) internal {
        vm.warp(10000);
        FantasyTypes420.GameResult[] memory results = new FantasyTypes420.GameResult[](1);
        results[0] =
            FantasyTypes420.GameResult(GAME, actualStart, eligible ? 10000 : 0, 10000, eligible, true, !eligible);
        bytes32 evidence = keccak256("authenticated-game-disposition");
        _report(SLATE_FEED, slates.resultDigest(SLATE, results, evidence));
        slates.resolve(SLATE, results, evidence);
    }

    function _proof(uint32 athlete, uint64 revision) internal view returns (bytes32 root, bytes32[] memory proof) {
        bytes32[] memory level = new bytes32[](21);
        for (uint32 i = 1; i <= 21; i++) {
            level[i - 1] = scorer.leaf(SLATE, revision, i, GAME, stat[i]);
        }
        proof = new bytes32[](5);
        uint256 cursor = athlete - 1;
        for (uint256 depth; level.length > 1; depth++) {
            uint256 sibling = cursor ^ 1;
            proof[depth] = sibling < level.length ? level[sibling] : level[cursor];
            bytes32[] memory next = new bytes32[]((level.length + 1) / 2);
            for (uint256 i; i < next.length; i++) {
                bytes32 a = level[i * 2];
                bytes32 b = i * 2 + 1 < level.length ? level[i * 2 + 1] : a;
                next[i] = a < b ? keccak256(abi.encodePacked(a, b)) : keccak256(abi.encodePacked(b, a));
            }
            level = next;
            cursor /= 2;
        }
        root = level[0];
    }

    function _begin(uint64 revision) internal {
        (bytes32 root,) = _proof(1, revision);
        FantasyTypes420.StatReport memory report =
            FantasyTypes420.StatReport(root, keccak256(abi.encode("stat-evidence", revision)), revision, 10000);
        _report(SLATE_FEED, slates.statDigest(SLATE, report));
        engine.beginRevision(CONTEST, report);
    }

    function _scoreOne(uint64 index, uint64 previous, uint64 next) internal {
        _scoreExpected(index, previous, next, bytes4(0));
    }

    function _scoreExpected(uint64 index, uint64 previous, uint64 next, bytes4 failure) internal {
        FantasyTypes420.Stats[7] memory statistics;
        bytes32[][7] memory proofs;
        FantasyContestEngine420.Entry memory e = engine.entryOf(CONTEST, index);
        uint64 revision = engine.poolOf(CONTEST).revision;
        for (uint256 i; i < 7; i++) {
            statistics[i] = stat[e.lineup[i]];
            (, proofs[i]) = _proof(e.lineup[i], revision);
        }
        if (failure != bytes4(0)) vm.expectRevert(failure);
        engine.scoreEntry(CONTEST, index, abi.encode(statistics, proofs), previous, next);
    }

    function _calculate(uint8 count, uint8 batch) internal {
        uint64 revision = engine.poolOf(CONTEST).revision;
        for (uint64 i = 1; i <= count; i++) {
            _scoreOne(i, i - 1, 0);
        }
        FantasyRankingBook420 book = engine.rankings();
        while (!book.workOf(CONTEST, revision).walkedAll) book.walk(CONTEST, revision, batch);
        while (!book.workOf(CONTEST, revision).ready) book.allocate(CONTEST, revision, batch);
    }

    function _publish() internal {
        FantasyDisputeController420.Candidate memory candidate = engine.candidateOf(CONTEST);
        _report(CAND_FEED, d.candidateDigest(CONTEST, candidate));
        engine.publishCandidate(CONTEST);
    }

    function _ready(uint8 count, uint256 fee) internal {
        _create(fee, 0, 0, false);
        for (uint8 i = 1; i <= count; i++) {
            _enter(i);
        }
        _lockReveal(count);
        _resolveGames(true, LOCK);
        _begin(1);
        _calculate(count, 1);
        _publish();
    }

    function _settle() internal {
        vm.warp(d.poolOf(CONTEST).reviewUntil);
        d.finalize(CONTEST);
        engine.settle(CONTEST);
    }
}

contract FantasyContestEngine420Test is FantasyEngineFixture420 {
    event QualificationContext(
        bytes32 pool, address engine, address controller, uint256 chainId, bytes32 slate, bytes32 game
    );
    event ModuleIdentity(bytes32 module, address deployment, bytes32 runtimeCodeHash, uint256 runtimeBytes);
    event QualificationFund(address canonicalVault, address beneficiary);

    function _moduleIdentity(bytes32 module, address deployment) internal {
        emit ModuleIdentity(module, deployment, deployment.codehash, deployment.code.length);
    }

    function testAllProductionModulesFitEVMRuntimeLimit() public view {
        require(
            address(engine).code.length <= 24576 && address(scorer).code.length <= 24576
                && address(slates).code.length <= 24576,
            "deployable engine graph"
        );
        require(
            address(engine.rankings()).code.length <= 24576 && address(engine.admission()).code.length <= 24576
                && address(engine.payoutPolicy()).code.length <= 24576,
            "deployable submodules"
        );
    }

    function testWrongScoringImplementationCannotBind() public {
        vm.expectRevert(FantasyContestEngine420.InvalidInput.selector);
        new FantasyContestEngine420(
            address(d), address(slates), address(slates), address(developmentVault), ISSUER, USER_TYPE
        );
    }

    function testPaidTwoEntrantsWinnerTakeAllAndThreePercentFund() public {
        _ready(2, 100 ether);
        _settle();
        engine.collect(CONTEST, 1);
        engine.collect(CONTEST, 2);
        require(
            engine.credit(USER) == 194 ether && engine.credit(USER2) == 0 && engine.credit(DEV) == 6 ether,
            "97/3 and WTA"
        );
        vm.prank(USER);
        engine.withdrawCredit();
        vm.prank(DEV);
        engine.withdrawCredit();
        require(engine.totalLiability() == 0 && address(engine).balance == 0, "all units paid");
    }

    function testThreeEntrantsTiedSecondShareOccupiedRankPrizes() public {
        emit QualificationContext(CONTEST, address(engine), address(d), block.chainid, SLATE, GAME);
        _moduleIdentity(keccak256("FantasyContestEngine420"), address(engine));
        _moduleIdentity(keccak256("FantasyDisputeController420"), address(d));
        _moduleIdentity(keccak256("FantasySlateBook420"), address(slates));
        _moduleIdentity(keccak256("FantasyNHLScoring420"), address(scorer));
        _moduleIdentity(keccak256("FantasyAdmission420"), address(engine.admission()));
        _moduleIdentity(keccak256("FantasyRankingBook420"), address(engine.rankings()));
        _moduleIdentity(keccak256("FantasyPayoutPolicy420"), address(engine.payoutPolicy()));
        _moduleIdentity(keccak256("DevelopmentCompensationVault420"), address(developmentVault));
        emit QualificationFund(address(developmentVault), developmentVault.beneficiary());
        require(engine.devFund() == developmentVault.beneficiary(), "canonical fund binding");
        _ready(3, 100);
        _settle();
        for (uint64 i = 1; i <= 3; i++) {
            engine.collect(CONTEST, i);
        }
        require(
            engine.credit(DEV) == 9 && engine.credit(USER) == 175 && engine.credit(USER2) == 58
                && engine.credit(USER3) == 58,
            "exact ties and residual"
        );
        engine.forwardDevelopment();
        require(DEV.balance == 9 && engine.totalLiability() == 291, "actual canonical development payment");
    }

    function testTieAtFirstTwoEntrantsSplitNetPrize() public {
        stat[1].goals = 0;
        stat[1].shots = 0;
        _ready(2, 101);
        _settle();
        engine.collect(CONTEST, 1);
        engine.collect(CONTEST, 2);
        require(engine.credit(USER) == 98 && engine.credit(USER2) == 98 && engine.credit(DEV) == 6, "WTA tie");
    }

    function testFreeLauncherPrizeEscrowNoDevelopmentDeduction() public {
        _create(0, 101, 0, false);
        _enter(1);
        _enter(2);
        _lockReveal(2);
        _resolveGames(true, LOCK);
        _begin(1);
        _calculate(2, 1);
        _publish();
        _settle();
        engine.collect(CONTEST, 1);
        require(
            engine.credit(USER) == 101 && engine.credit(DEV) == 0 && engine.totalLiability() == 101, "funded free prize"
        );
    }

    function testPrizeLessFreePoolStillProducesStandings() public {
        _create(0, 0, 0, false);
        _enter(1);
        _enter(2);
        _lockReveal(2);
        _resolveGames(true, LOCK);
        _begin(1);
        _calculate(2, 1);
        _publish();
        _settle();
        engine.collect(CONTEST, 1);
        require(engine.totalLiability() == 0 && engine.credit(USER) == 0, "standings without unfunded prize");
    }

    function testSingleEntrantCancelsAndRefundsFullPayment() public {
        _create(101, 0, 0, false);
        _enter(1);
        vm.warp(LOCK);
        engine.lockPool(CONTEST);
        engine.collect(CONTEST, 1);
        require(
            engine.credit(USER) == 101 && engine.credit(DEV) == 0
                && d.poolOf(CONTEST).state == FantasyDisputeController420.PoolState.CANCELED,
            "full refund"
        );
    }

    function testFreeCancellationReturnsLauncherEscrow() public {
        _create(0, 501, 0, false);
        vm.warp(LOCK);
        engine.lockPool(CONTEST);
        require(engine.credit(ADMIN) == 501 && engine.credit(DEV) == 0, "launcher refund");
    }

    function testMissingCustodianPublicationCancelsEveryEntry() public {
        _create(100, 0, 0, false);
        _enter(1);
        _enter(2);
        vm.warp(LOCK);
        engine.lockPool(CONTEST);
        _reveal(1);
        vm.warp(LOCK + engine.PUBLICATION_WINDOW() + 1);
        engine.recover(CONTEST);
        engine.collect(CONTEST, 1);
        engine.collect(CONTEST, 2);
        require(engine.credit(USER) == 100 && engine.credit(USER2) == 100, "no selective non-reveal payout");
    }

    function testAllGamesExcludedCancelsWholePool() public {
        _create(100, 0, 0, false);
        _enter(1);
        _enter(2);
        _lockReveal(2);
        _resolveGames(false, 0);
        engine.recover(CONTEST);
        engine.collect(CONTEST, 1);
        require(engine.credit(USER) == 100, "excluded refund");
    }

    function testEarlyPuckDropWithLateEntryCancelsPool() public {
        _create(100, 0, 0, false);
        vm.warp(LOCK - 20);
        _enter(1);
        vm.warp(LOCK - 5);
        _enter(2);
        bytes32 evidence = keccak256("early-evidence");
        _report(SLATE_FEED, slates.earlyDigest(SLATE, GAME, LOCK - 10, evidence));
        slates.reportEarlyStart(SLATE, GAME, LOCK - 10, evidence);
        engine.lockPool(CONTEST);
        require(engine.poolOf(CONTEST).state == FantasyContestEngine420.State.CANCELED, "late entry invalidates pool");
    }

    function testEarlyStartDiscoveredInFinalReportBlocksScoring() public {
        _create(100, 0, 0, false);
        vm.warp(LOCK - 5);
        _enter(1);
        _enter(2);
        _lockReveal(2);
        _resolveGames(true, LOCK - 10);
        engine.recover(CONTEST);
        require(engine.poolOf(CONTEST).state == FantasyContestEngine420.State.CANCELED, "late timing evidence");
    }

    function testExactlyScheduledLockRejectsEntry() public {
        _create(100, 0, 0, false);
        FantasyContestEngine420.Submission memory sub = _submission(1, 1);
        vm.warp(LOCK);
        vm.prank(USER);
        vm.expectRevert(FantasyContestEngine420.InvalidTime.selector);
        engine.enterPool{value: 100}(CONTEST, PLAYER, _userCredential(1), sub);
    }

    function testHiddenEntryStoresNoPlaintextLineupUntilPublication() public {
        _create(100, 0, 0, false);
        _enter(1);
        FantasyContestEngine420.Entry memory e = engine.entryOf(CONTEST, 1);
        for (uint256 i; i < 7; i++) {
            require(e.lineup[i] == 0, "no pre-lock plaintext");
        }
        require(e.commitment != 0 && !e.revealed, "encrypted admission");
    }

    function testPreLockPublicationRejected() public {
        _create(100, 0, 0, false);
        _enter(1);
        _enter(2);
        _revealExpected(1, FantasyContestEngine420.InvalidTime.selector);
    }

    function testEditReplacesCommitmentWithoutSecondEntryOrPayment() public {
        _create(100, 0, 0, false);
        _enter(1);
        FantasyContestEngine420.Submission memory sub = _submission(1, 2);
        vm.prank(USER);
        engine.editLineup(CONTEST, 1, sub);
        require(
            engine.poolOf(CONTEST).count == 1 && engine.poolOf(CONTEST).gross == 100
                && engine.entryOf(CONTEST, 1).nonce == 2,
            "one funded entry"
        );
    }

    function testStaleEditSignatureCannotReplay() public {
        _create(100, 0, 0, false);
        _enter(1);
        FantasyContestEngine420.Submission memory sub = _submission(1, 2);
        vm.prank(USER);
        engine.editLineup(CONTEST, 1, sub);
        vm.prank(USER);
        vm.expectRevert(FantasyContestEngine420.InvalidInput.selector);
        engine.editLineup(CONTEST, 1, sub);
    }

    function testDuplicateEntryRejectedWithoutSecondPayment() public {
        _create(100, 0, 0, false);
        _enter(1);
        _expectEnterFailure(1, FantasyContestEngine420.Unauthorized.selector);
        require(engine.totalLiability() == 100, "single escrow");
    }

    function testUninvitedUserRejectedAndAcceptedEntrySurvivesRevocation() public {
        _create(100, 0, 0, true);
        _expectEnterFailure(1, FantasyContestEngine420.Unauthorized.selector);
        _grant(ADMIN, engine.INVITE(), auth.scopeForContest(CONTEST));
        vm.prank(ADMIN);
        engine.setInvitation(CONTEST, PLAYER, true);
        _enter(1);
        vm.prank(ADMIN);
        engine.setInvitation(CONTEST, PLAYER, false);
        require(engine.entryForSubject(CONTEST, PLAYER) == 1, "accepted entry retained");
    }

    function testConfiguredEntrantCapRejectsExcess() public {
        _create(100, 0, 2, false);
        _enter(1);
        _enter(2);
        _expectEnterFailure(3, FantasyContestEngine420.Unauthorized.selector);
        require(engine.totalLiability() == 200, "cap atomic");
    }

    function testWrongSaltCannotRevealOrChangeLineup() public {
        _create(100, 0, 0, false);
        _enter(1);
        _enter(2);
        vm.warp(LOCK);
        engine.lockPool(CONTEST);
        vm.expectRevert(FantasyContestEngine420.InvalidLineup.selector);
        engine.publishLineup(CONTEST, 1, _lineup(1), keccak256("wrong"));
    }

    function testAlteredEnvelopeInvalidatesSignedReceipt() public {
        _create(100, 0, 0, false);
        FantasyContestEngine420.Submission memory sub = _submission(1, 1);
        sub.envelope[70] ^= bytes1(uint8(1));
        vm.prank(USER);
        vm.expectRevert(FantasyContestEngine420.InvalidSignature.selector);
        engine.enterPool{value: 100}(CONTEST, PLAYER, _userCredential(1), sub);
    }

    function testUnfundedPaidEntryRollsBackMembership() public {
        _create(100, 0, 0, false);
        FantasyContestEngine420.Submission memory sub = _submission(1, 1);
        vm.prank(USER);
        vm.expectRevert(FantasyContestEngine420.InvalidInput.selector);
        engine.enterPool{value: 99}(CONTEST, PLAYER, _userCredential(1), sub);
        require(engine.poolOf(CONTEST).count == 0 && engine.totalLiability() == 0, "atomic funding");
    }

    function testSettlementBeforeDisputeFinalityRejected() public {
        _ready(2, 100);
        vm.expectRevert(FantasyContestEngine420.InvalidState.selector);
        engine.settle(CONTEST);
    }

    function testDuplicatePrizeCollectionAndSettlementRejected() public {
        _ready(2, 100);
        _settle();
        engine.collect(CONTEST, 1);
        vm.expectRevert(FantasyContestEngine420.InvalidState.selector);
        engine.collect(CONTEST, 1);
        vm.expectRevert(FantasyContestEngine420.InvalidState.selector);
        engine.settle(CONTEST);
    }

    function testForgedStatProofCannotCreateScore() public {
        _create(100, 0, 0, false);
        _enter(1);
        _enter(2);
        _lockReveal(2);
        _resolveGames(true, LOCK);
        _begin(1);
        FantasyTypes420.Stats[7] memory statistics;
        bytes32[][7] memory proofs;
        for (uint32 i; i < 7; i++) {
            statistics[i] = stat[i + 1];
            (, proofs[i]) = _proof(i + 1, 1);
        }
        statistics[0].goals = 30;
        statistics[0].shots = 30;
        vm.expectRevert(FantasyNHLScoring420.InvalidProof.selector);
        engine.scoreEntry(CONTEST, 1, abi.encode(statistics, proofs), 0, 0);
    }

    function testWrongRankInsertionHintRejected() public {
        _create(100, 0, 0, false);
        _enter(1);
        _enter(2);
        _lockReveal(2);
        _resolveGames(true, LOCK);
        _begin(1);
        _scoreOne(1, 0, 0);
        _scoreExpected(2, 0, 1, FantasyRankingBook420.InvalidInput.selector);
    }

    function testMissingSourceOrCandidateHasBoundedRefundPath() public {
        _create(100, 0, 0, false);
        _enter(1);
        _enter(2);
        _lockReveal(2);
        vm.warp(CUTOFF + 1 days);
        engine.recover(CONTEST);
        engine.collect(CONTEST, 1);
        require(engine.credit(USER) == 100, "outage refund");
    }

    function testNewerAuthenticatedRevisionBlocksOldFinalityAndTimesOut() public {
        _ready(2, 100);
        _begin(2);
        vm.warp(d.poolOf(CONTEST).challengeEnd);
        vm.expectRevert(FantasyDisputeController420.InvalidState.selector);
        d.finalize(CONTEST);
        vm.warp(d.poolOf(CONTEST).deadline);
        engine.recover(CONTEST);
        engine.collect(CONTEST, 1);
        require(engine.credit(USER) == 100, "unfinished correction refunds");
    }

    function testActualDisputeDenialRoutesBondAndReleasesPrizes() public {
        _ready(2, 100);
        vm.warp(d.poolOf(CONTEST).correctionEnd);
        vm.prank(USER);
        bytes32 claimId = d.challenge{value: 50}(CONTEST, PLAYER, keccak256("challenger-evidence"));
        _grant(DELEGATE_USER, d.RESOLVE(), d.claimScope(claimId));
        vm.warp(d.poolOf(CONTEST).reviewUntil);
        bytes32 candidate = engine.poolOf(CONTEST).publishedCandidate;
        vm.prank(DELEGATE_USER);
        d.resolve(claimId, false, keccak256("independently-replayed"), candidate, DELEGATE_ID, DELEGATE_CRED, 0);
        d.collectBond(claimId);
        d.finalize(CONTEST);
        engine.settle(CONTEST);
        engine.collect(CONTEST, 1);
        require(
            engine.credit(USER) == 194 && d.credit(COMMUNITY) == 50 && engine.credit(DEV) == 6, "segregated custody"
        );
    }

    function testActualDisputeTimeoutRefundsEntriesAndBonds() public {
        _ready(2, 100);
        vm.warp(d.poolOf(CONTEST).correctionEnd);
        vm.prank(USER);
        bytes32 claimId = d.challenge{value: 50}(CONTEST, PLAYER, keccak256("unresolved"));
        vm.warp(d.poolOf(CONTEST).deadline);
        engine.recover(CONTEST);
        engine.collect(CONTEST, 1);
        engine.collect(CONTEST, 2);
        d.collectBond(claimId);
        require(
            engine.credit(USER) == 100 && engine.credit(USER2) == 100 && d.credit(USER) == 50
                && engine.credit(DEV) == 0,
            "full cancellation"
        );
    }

    function testLauncherCannotResolveOwnPool() public {
        _ready(2, 100);
        vm.warp(d.poolOf(CONTEST).correctionEnd);
        vm.prank(USER);
        bytes32 claimId = d.challenge{value: 50}(CONTEST, PLAYER, keccak256("claim"));
        _grant(ADMIN, d.RESOLVE(), d.claimScope(claimId));
        vm.warp(d.poolOf(CONTEST).reviewUntil);
        bytes32 candidate = engine.poolOf(CONTEST).publishedCandidate;
        vm.prank(ADMIN);
        vm.expectRevert(FantasyDisputeController420.Unauthorized.selector);
        d.resolve(claimId, false, keccak256("reason"), candidate, ADMIN_ID, ADMIN_CRED, 0);
    }

    function testGoalieAndMilestoneArithmeticMatchesApprovedExamples() public view {
        FantasyTypes420.Stats memory s;
        s.complete = true;
        s.played = true;
        s.goals = 3;
        s.assists = 1;
        s.shots = 5;
        s.blocks = 3;
        s.shorthanded = 1;
        require(scorer.score(s, false) == 559, "all four bonuses stack once");
        s.goals = 0;
        s.assists = 0;
        s.shots = 0;
        s.blocks = 0;
        s.shorthanded = 0;
        s.win = true;
        s.saves = 36;
        s.goalsAgainst = 2;
        require(scorer.score(s, true) == 272, "goalie win save threshold GA");
        s.goalsAgainst = 0;
        s.shutout = true;
        s.entireGame = true;
        s.soleGoalie = true;
        require(scorer.score(s, true) == 382, "shutout example");
    }

    function testNegativeGoalieScoresAndDNP() public view {
        FantasyTypes420.Stats memory s;
        s.complete = true;
        require(scorer.score(s, true) == 0, "verified DNP");
        s.played = true;
        s.goalsAgainst = 6;
        require(scorer.score(s, true) == -210, "signed negative");
    }

    function testIncompleteStatsCannotBeZeroFilled() public {
        FantasyTypes420.Stats memory s;
        vm.expectRevert(FantasyNHLScoring420.InvalidStats.selector);
        scorer.score(s, false);
    }

    function testFuzzRankingPayoutConservesEveryUnit(uint96 grossFee) public {
        stat[1].goals = 0;
        stat[1].shots = 0;
        uint256 fee = uint256(grossFee) + 1;
        for (uint8 who = 1; who <= 3; who++) {
            vm.deal(_account(who), fee + 1);
        }
        _ready(3, fee);
        _settle();
        for (uint64 i = 1; i <= 3; i++) {
            engine.collect(CONTEST, i);
        }
        uint256 gross = fee * 3;
        require(
            engine.credit(USER) + engine.credit(USER2) + engine.credit(USER3) + engine.credit(DEV) == gross,
            "exact conservation across tie"
        );
        require(engine.credit(DEV) == gross * 3 / 100, "fee rounded once");
    }

    function testTokenPoolUsesExactSameAssetForEntryPrizesAndDevelopment() public {
        ERC20Template420 token = new ERC20Template420(
            "Test 420 denomination",
            "T420",
            address(this),
            1000,
            1000,
            false,
            false,
            false,
            false,
            keccak256("canonical-test")
        );
        _makeEngine(address(token));
        for (uint8 who = 1; who <= 2; who++) {
            token.transfer(_account(who), 100);
            vm.prank(_account(who));
            token.approve(address(engine), 100);
        }
        _ready(2, 100);
        _settle();
        engine.collect(CONTEST, 1);
        engine.collect(CONTEST, 2);
        vm.prank(USER);
        engine.withdrawCredit();
        vm.prank(DEV);
        engine.withdrawCredit();
        require(
            token.balanceOf(USER) == 194 && token.balanceOf(DEV) == 6 && token.balanceOf(address(engine)) == 0
                && engine.totalLiability() == 0,
            "exact token denomination"
        );
    }

    function testEntryCredentialRevocationFailsClosed() public {
        _create(100, 0, 0, false);
        identity.revokeCredential(_userCredential(1));
        _expectEnterFailure(1, FantasyAdmission420.Unauthorized.selector);
    }

    function testCanonicalPersonCannotEnterUsingAnotherProfileOrWallet() public {
        _create(100, 0, 0, false);
        _enter(1);
        bytes32 aliasSubject = keccak256("same-person-alias");
        bytes32 aliasCredential = keccak256("same-person-credential");
        vm.prank(USER2);
        identity.createProfile(aliasSubject, keccak256("alias"));
        identity.issueCredential(aliasCredential, ISSUER, aliasSubject, USER_TYPE, _person(1), 0);
        FantasyContestEngine420.Submission memory sub = _submission(2, 1);
        vm.prank(USER2);
        vm.expectRevert(FantasyContestEngine420.Unauthorized.selector);
        engine.enterPool{value: 100}(CONTEST, aliasSubject, aliasCredential, sub);
        require(engine.totalLiability() == 100, "one canonical person");
    }

    function testEntrantAliasCannotResolvePoolEvenWithResolverCapability() public {
        _ready(2, 100);
        vm.warp(d.poolOf(CONTEST).correctionEnd);
        vm.prank(USER);
        bytes32 claimId = d.challenge{value: 50}(CONTEST, PLAYER, keccak256("claim"));
        bytes32 aliasSubject = keccak256("resolver-alias");
        bytes32 aliasUser = keccak256("alias-user");
        bytes32 aliasResolver = keccak256("alias-resolver");
        vm.prank(USER3);
        identity.createProfile(aliasSubject, keccak256("alias"));
        identity.issueCredential(aliasUser, ISSUER, aliasSubject, USER_TYPE, _person(1), 0);
        identity.issueCredential(aliasResolver, ISSUER, aliasSubject, TYPE, keccak256("verified-resolver"), 0);
        engine.registerIdentity(aliasSubject, aliasUser);
        _grant(USER3, d.RESOLVE(), d.claimScope(claimId));
        vm.warp(d.poolOf(CONTEST).reviewUntil);
        bytes32 candidate = engine.poolOf(CONTEST).publishedCandidate;
        vm.prank(USER3);
        vm.expectRevert(FantasyDisputeController420.Unauthorized.selector);
        d.resolve(claimId, false, keccak256("self"), candidate, aliasSubject, aliasResolver, 0);
    }

    function testLineupCanBePublishedByCustodianWithoutEntrantAction() public {
        _create(100, 0, 0, false);
        _enter(1);
        _enter(2);
        vm.warp(LOCK);
        engine.lockPool(CONTEST);
        _reveal(1);
        _reveal(2);
        require(engine.poolOf(CONTEST).revealed == 2, "permissionless post-lock publication");
    }

    function testMalformedSignedLineupTriggersFullRefundNotAnInvalidWinner() public {
        _create(100, 0, 0, false);
        FantasyContestEngine420.Submission memory sub = _submission(1, 1);
        uint32[7] memory lineup = _lineup(1);
        lineup[6] = lineup[5];
        sub.commitment = engine.commitmentOf(CONTEST, PLAYER, 1, lineup, _salt(1, 1));
        bytes32 key = keccak256(abi.encode(ISSUER, _person(1)));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(VALIDATOR_KEY, engine.submissionDigest(CONTEST, PLAYER, key, sub));
        sub.signature = abi.encodePacked(r, s, v);
        vm.prank(USER);
        engine.enterPool{value: 100}(CONTEST, PLAYER, _userCredential(1), sub);
        _enter(2);
        vm.warp(LOCK);
        engine.lockPool(CONTEST);
        engine.publishLineup(CONTEST, 1, lineup, _salt(1, 1));
        engine.collect(CONTEST, 1);
        require(engine.credit(USER) == 100 && engine.credit(DEV) == 0, "malicious custodian cannot create payout");
    }

    function testUpheldDisputeCorrectsScoresAndRequiresReReview() public {
        _ready(2, 100);
        vm.warp(d.poolOf(CONTEST).correctionEnd);
        vm.prank(USER2);
        bytes32 claimId = d.challenge{value: 50}(CONTEST, PLAYER2, keccak256("wrong-goal-credit"));
        _grant(DELEGATE_USER, d.RESOLVE(), d.claimScope(claimId));
        vm.warp(d.poolOf(CONTEST).reviewUntil);
        bytes32 candidate = engine.poolOf(CONTEST).publishedCandidate;
        vm.prank(DELEGATE_USER);
        d.resolve(
            claimId,
            true,
            keccak256("official-correction-available-by-cutoff"),
            candidate,
            DELEGATE_ID,
            DELEGATE_CRED,
            0
        );
        stat[1].goals = 0;
        stat[1].shots = 0;
        stat[8].goals = 1;
        stat[8].shots = 1;
        _begin(2);
        _scoreOne(2, 0, 0);
        _scoreOne(1, 2, 0);
        engine.rankings().walk(CONTEST, 2, 1);
        engine.rankings().walk(CONTEST, 2, 1);
        engine.rankings().allocate(CONTEST, 2, 2);
        _publish();
        vm.expectRevert(FantasyDisputeController420.InvalidState.selector);
        d.finalize(CONTEST);
        _settle();
        engine.collect(CONTEST, 1);
        engine.collect(CONTEST, 2);
        d.collectBond(claimId);
        require(
            engine.credit(USER) == 0 && engine.credit(USER2) == 194 && d.credit(USER2) == 50,
            "corrected winner and bond refund"
        );
    }

    function testUnprivilegedUserCannotCreatePool() public {
        FantasyContestEngine420.Config memory cfg =
            FantasyContestEngine420.Config(SLATE, CAND_FEED, PLAYER, 100, 0, 0, true, false);
        vm.prank(USER);
        vm.expectRevert(FantasyContestEngine420.Unauthorized.selector);
        engine.createPool(CONTEST, cfg, abi.encode(_bands(0)));
    }

    function testPayoutTableGapCannotLaunchPool() public {
        FantasyTypes420.Band[] memory rows = _bands(0);
        rows[0].minimum = 4;
        FantasyContestEngine420.Config memory cfg =
            FantasyContestEngine420.Config(SLATE, CAND_FEED, ADMIN_ID, 100, 0, 0, true, false);
        vm.prank(ADMIN);
        vm.expectRevert(FantasyPayoutPolicy420.InvalidInput.selector);
        engine.createPool(CONTEST, cfg, abi.encode(rows));
    }

    function testPayoutWeightsMustAllocateEntirePrize() public {
        FantasyTypes420.Band[] memory rows = _bands(0);
        rows[0].weights[0] = 5000;
        FantasyContestEngine420.Config memory cfg =
            FantasyContestEngine420.Config(SLATE, CAND_FEED, ADMIN_ID, 100, 0, 0, true, false);
        vm.prank(ADMIN);
        vm.expectRevert(FantasyPayoutPolicy420.InvalidInput.selector);
        engine.createPool(CONTEST, cfg, abi.encode(rows));
    }

    function testIncompleteRankingCannotPublishCandidate() public {
        _create(100, 0, 0, false);
        _enter(1);
        _enter(2);
        _lockReveal(2);
        _resolveGames(true, LOCK);
        _begin(1);
        _scoreOne(1, 0, 0);
        vm.expectRevert(FantasyRankingBook420.InvalidState.selector);
        engine.publishCandidate(CONTEST);
    }

    function testPostLockEditRejectedEvenWithValidReceipt() public {
        _create(100, 0, 0, false);
        _enter(1);
        _enter(2);
        FantasyContestEngine420.Submission memory sub = _submission(1, 2);
        vm.warp(LOCK);
        vm.prank(USER);
        vm.expectRevert(FantasyContestEngine420.InvalidTime.selector);
        engine.editLineup(CONTEST, 1, sub);
    }

    function testPostponementCannotBeExcludedBeforeCutoffWithoutDefinitiveCancellation() public {
        vm.warp(10000);
        FantasyTypes420.GameResult[] memory results = new FantasyTypes420.GameResult[](1);
        results[0] = FantasyTypes420.GameResult(GAME, 0, 0, 10000, false, true, false);
        vm.expectRevert(FantasySlateBook420.InvalidEvidence.selector);
        slates.resolve(SLATE, results, keccak256("postponed-not-canceled"));
    }

    function testFinalAtExactCutoffIsExcludedRatherThanScored() public {
        vm.warp(CUTOFF);
        FantasyTypes420.GameResult[] memory results = new FantasyTypes420.GameResult[](1);
        results[0] = FantasyTypes420.GameResult(GAME, LOCK, CUTOFF, CUTOFF, true, true, false);
        vm.expectRevert(FantasySlateBook420.InvalidEvidence.selector);
        slates.resolve(SLATE, results, keccak256("too-late-final"));
    }

    function testSuspendedUnfinishedGameCanBeExcludedAtCutoff() public {
        _create(100, 0, 0, false);
        _enter(1);
        _enter(2);
        _lockReveal(2);
        vm.warp(CUTOFF);
        FantasyTypes420.GameResult[] memory results = new FantasyTypes420.GameResult[](1);
        results[0] = FantasyTypes420.GameResult(GAME, LOCK, 0, CUTOFF, false, true, false);
        bytes32 evidence = keccak256("suspended-through-cutoff");
        _report(SLATE_FEED, slates.resultDigest(SLATE, results, evidence));
        slates.resolve(SLATE, results, evidence);
        engine.recover(CONTEST);
        engine.collect(CONTEST, 1);
        require(engine.credit(USER) == 100, "excluded suspension refunds all-excluded pool");
    }

    function testGameDispositionCannotChangeAfterResolution() public {
        _resolveGames(true, LOCK);
        FantasyTypes420.GameResult[] memory results = new FantasyTypes420.GameResult[](1);
        results[0] = FantasyTypes420.GameResult(GAME, LOCK, 10000, 10000, true, true, false);
        vm.expectRevert(FantasySlateBook420.InvalidInput.selector);
        slates.resolve(SLATE, results, keccak256("replacement"));
    }

    function testFutureStartCannotBeReportedAsAnEarlyStart() public {
        vm.expectRevert(FantasySlateBook420.InvalidInput.selector);
        slates.reportEarlyStart(SLATE, GAME, 1500, keccak256("future"));
    }

    function testReliefGoalieCannotReceiveShutoutBonus() public {
        FantasyTypes420.Stats memory s;
        s.complete = true;
        s.played = true;
        s.shutout = true;
        s.soleGoalie = true;
        vm.expectRevert(FantasyNHLScoring420.InvalidStats.selector);
        scorer.score(s, true);
    }

    function testFullyEligibleShutoutCannotOmitItsBonus() public {
        FantasyTypes420.Stats memory s;
        s.complete = true;
        s.played = true;
        s.soleGoalie = true;
        s.entireGame = true;
        vm.expectRevert(FantasyNHLScoring420.InvalidStats.selector);
        scorer.score(s, true);
    }

    function testCanonicalOracleCannotBeBypassedToPublishRanks() public {
        _create(100, 0, 0, false);
        _enter(1);
        _enter(2);
        _lockReveal(2);
        _resolveGames(true, LOCK);
        _begin(1);
        _calculate(2, 1);
        _report(CAND_FEED, keccak256("foreign-candidate"));
        vm.expectRevert(FantasyDisputeController420.InvalidEvidence.selector);
        engine.publishCandidate(CONTEST);
    }

    function testValidEarlyClosureWithNoLateEntriesDoesNotCancel() public {
        _create(100, 0, 0, false);
        _enter(1);
        _enter(2);
        vm.warp(LOCK - 10);
        bytes32 evidence = keccak256("early-with-clean-entries");
        _report(SLATE_FEED, slates.earlyDigest(SLATE, GAME, LOCK - 10, evidence));
        slates.reportEarlyStart(SLATE, GAME, LOCK - 10, evidence);
        engine.lockPool(CONTEST);
        require(engine.poolOf(CONTEST).state == FantasyContestEngine420.State.LOCKED, "early lock preserves fair pool");
    }

    function testMoreThanOneEntrantCountBandSelectsPrepublishedRow() public {
        FantasyTypes420.Band[] memory rows = new FantasyTypes420.Band[](2);
        uint16[] memory small = new uint16[](1);
        small[0] = 10000;
        uint16[] memory large = new uint16[](3);
        large[0] = 6000;
        large[1] = 3000;
        large[2] = 1000;
        rows[0] = FantasyTypes420.Band(3, 3, small);
        rows[1] = FantasyTypes420.Band(4, type(uint64).max, large);
        FantasyContestEngine420.Config memory cfg =
            FantasyContestEngine420.Config(SLATE, CAND_FEED, ADMIN_ID, 100, 0, 0, true, false);
        vm.prank(ADMIN);
        engine.createPool(CONTEST, cfg, abi.encode(rows));
        for (uint8 i = 1; i <= 3; i++) {
            _enter(i);
        }
        _lockReveal(3);
        _resolveGames(true, LOCK);
        _begin(1);
        _calculate(3, 2);
        _publish();
        _settle();
        engine.collect(CONTEST, 1);
        require(engine.credit(USER) == 291 && engine.credit(DEV) == 9, "row selected by final count");
    }

    function testEngineConstructorFitsSixteenMillionGas() public {
        uint256 beforeGas = gasleft();
        FantasyContestEngine420 deployed = new FantasyContestEngine420(
            address(d), address(slates), address(scorer), address(developmentVault), ISSUER, USER_TYPE
        );
        require(
            beforeGas - gasleft() <= 16_000_000 && address(deployed.rankings()).code.length != 0,
            "bounded constructor with real modules"
        );
    }

    function testReentrantDevelopmentRecipientCannotWithdrawTwice() public {
        FantasyReentrantRecipient420 recipient = new FantasyReentrantRecipient420();
        engine = new FantasyContestEngine420(
            address(d),
            address(slates),
            address(scorer),
            address(new DevelopmentCompensationVault420(address(cap), address(recipient))),
            ISSUER,
            USER_TYPE
        );
        _grant(address(engine), d.REGISTER(), auth.scopeForContest(CONTEST));
        _ready(2, 100);
        _settle();
        recipient.withdraw(FantasyDisputeController420(address(engine)));
        require(
            recipient.blocked() && address(recipient).balance == 6 && engine.credit(address(recipient)) == 0,
            "one development payout"
        );
        engine.collect(CONTEST, 1);
        require(engine.credit(USER) == 194, "entrant escrow preserved");
    }

    function testRejectingDevelopmentRecipientCannotBlockEntrantPayout() public {
        FantasyRejectingRecipient420 recipient = new FantasyRejectingRecipient420();
        engine = new FantasyContestEngine420(
            address(d),
            address(slates),
            address(scorer),
            address(new DevelopmentCompensationVault420(address(cap), address(recipient))),
            ISSUER,
            USER_TYPE
        );
        _grant(address(engine), d.REGISTER(), auth.scopeForContest(CONTEST));
        _ready(2, 100);
        _settle();
        engine.collect(CONTEST, 1);
        vm.expectRevert(FantasyContestEngine420.TransferFailed.selector);
        recipient.withdraw(FantasyDisputeController420(address(engine)));
        vm.prank(USER);
        engine.withdrawCredit();
        require(engine.credit(address(recipient)) == 6 && engine.totalLiability() == 6, "failed fund delivery isolated");
    }

    function testCustodianCanonicalControlGroupCannotEnterPool() public {
        _create(100, 0, 0, false);
        bytes32 credential = keccak256("custodian-user-credential");
        identity.issueCredential(credential, ISSUER, PLAYER, USER_TYPE, keccak256("custodian-person"), 0);
        FantasyContestEngine420.Submission memory sub = _submission(1, 1);
        vm.prank(USER);
        vm.expectRevert(FantasyContestEngine420.Unauthorized.selector);
        engine.enterPool{value: 100}(CONTEST, PLAYER, credential, sub);
    }

    function testNewlyGrantedSignerCannotReplaceFrozenSlateValidator() public {
        _create(100, 0, 0, false);
        FantasyContestEngine420.Submission memory sub = _submission(1, 1);
        _grant(vm.addr(0xCCDD), slates.VALIDATE_LINEUP(), auth.scopeForContest(SLATE));
        bytes32 key = keccak256(abi.encode(ISSUER, _person(1)));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(0xCCDD, engine.submissionDigest(CONTEST, PLAYER, key, sub));
        sub.signature = abi.encodePacked(r, s, v);
        vm.prank(USER);
        vm.expectRevert(FantasyAdmission420.InvalidSignature.selector);
        engine.enterPool{value: 100}(CONTEST, PLAYER, _userCredential(1), sub);
    }

    function testValidatorCapabilityRevocationStopsNewAdmission() public {
        _create(100, 0, 0, false);
        FantasyContestEngine420.Submission memory sub = _submission(1, 1);
        cap.revokeGrant(keccak256(abi.encode("grant", grantNonce)));
        vm.prank(USER);
        vm.expectRevert(FantasyAdmission420.InvalidSignature.selector);
        engine.enterPool{value: 100}(CONTEST, PLAYER, _userCredential(1), sub);
    }

    function testMissingHostRegistrationAuthorityRollsBackFreePrizeAndManifest() public {
        cap.revokeGrant(keccak256(abi.encode("grant", grantNonce - 1)));
        uint256 beforeBalance = ADMIN.balance;
        vm.expectRevert(FantasyDisputeController420.Unauthorized.selector);
        _create(0, 501, 0, false);
        require(
            ADMIN.balance == beforeBalance && engine.totalLiability() == 0
                && engine.poolOf(CONTEST).state == FantasyContestEngine420.State.NONE,
            "atomic launch rollback"
        );
        require(engine.payoutPolicy().policyHash(CONTEST) == 0, "no orphaned payout policy");
    }

    function testUnderfundedFreePrizeCannotLaunch() public {
        FantasyContestEngine420.Config memory cfg =
            FantasyContestEngine420.Config(SLATE, CAND_FEED, ADMIN_ID, 0, 501, 0, false, false);
        vm.prank(ADMIN);
        vm.expectRevert(FantasyContestEngine420.InvalidInput.selector);
        engine.createPool{value: 500}(CONTEST, cfg, abi.encode(_bands(0)));
        require(
            engine.totalLiability() == 0 && engine.poolOf(CONTEST).state == FantasyContestEngine420.State.NONE,
            "no unfunded advertised prize"
        );
    }

    function testSeparatePoolsCannotSpendEachOthersEscrow() public {
        _create(100, 0, 0, false);
        bytes32 second = keccak256("separate-free-pool");
        _grant(address(engine), d.REGISTER(), auth.scopeForContest(second));
        FantasyContestEngine420.Config memory cfg =
            FantasyContestEngine420.Config(SLATE, CAND_FEED, ADMIN_ID, 0, 301, 0, false, false);
        vm.prank(ADMIN);
        engine.createPool{value: 301}(second, cfg, abi.encode(_bands(0)));
        _enter(1);
        _enter(2);
        _lockReveal(2);
        engine.lockPool(second);
        _resolveGames(true, LOCK);
        _begin(1);
        _calculate(2, 1);
        _publish();
        _settle();
        engine.collect(CONTEST, 1);
        require(
            engine.credit(ADMIN) == 301 && engine.credit(USER) == 194 && engine.credit(DEV) == 6
                && engine.totalLiability() == 501,
            "isolated complete liabilities"
        );
    }

    function testPermissionlessDevelopmentForwardingUsesCanonicalBeneficiary() public {
        _ready(2, 100);
        _settle();
        engine.forwardDevelopment();
        require(
            DEV.balance == 6 && engine.credit(DEV) == 0 && engine.totalLiability() == 194, "actual fixed fund delivery"
        );
        vm.expectRevert(FantasyContestEngine420.InvalidState.selector);
        engine.forwardDevelopment();
        engine.collect(CONTEST, 1);
        require(engine.credit(USER) == 194, "entrant amount unchanged");
    }

    function testDifferentDevelopmentCapabilityRegistryCannotBind() public {
        CapabilityRegistry420 other = new CapabilityRegistry420();
        DevelopmentCompensationVault420 wrong = new DevelopmentCompensationVault420(address(other), DEV);
        vm.expectRevert(FantasyContestEngine420.InvalidInput.selector);
        new FantasyContestEngine420(address(d), address(slates), address(scorer), address(wrong), ISSUER, USER_TYPE);
    }

    function testVerifiedCredentialAndCustodianReceiptDoNotReplaceEntryCapability() public {
        _create(100, 0, 0, false);
        FantasyContestEngine420.Submission memory sub = _submission(1, 1);
        cap.revokeGrant(
            cap.activeGrantId(
                USER, BetIds420.COMPONENT_BET, BetIds420.ACTION_FANTASY_ENTER, auth.scopeForContest(CONTEST)
            )
        );
        vm.prank(USER);
        vm.expectRevert(FantasyAdmission420.Unauthorized.selector);
        engine.enterPool{value: 100}(CONTEST, PLAYER, _userCredential(1), sub);
        require(engine.totalLiability() == 0 && engine.poolOf(CONTEST).count == 0, "default-deny entry authority");
    }

    function testRevokedEntryCapabilityBlocksEditsButCannotConfiscateRefund() public {
        _create(100, 0, 0, false);
        _enter(1);
        FantasyContestEngine420.Submission memory sub = _submission(1, 2);
        cap.revokeGrant(
            cap.activeGrantId(
                USER, BetIds420.COMPONENT_BET, BetIds420.ACTION_FANTASY_ENTER, auth.scopeForContest(CONTEST)
            )
        );
        vm.prank(USER);
        vm.expectRevert(FantasyAdmission420.Unauthorized.selector);
        engine.editLineup(CONTEST, 1, sub);
        vm.warp(LOCK);
        engine.lockPool(CONTEST);
        engine.collect(CONTEST, 1);
        require(engine.credit(USER) == 100, "refund survives authority revocation");
    }
}
