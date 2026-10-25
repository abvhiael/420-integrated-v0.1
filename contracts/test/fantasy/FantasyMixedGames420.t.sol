// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./FantasyContestEngine420.t.sol";

contract FantasyMixedGames420Test is FantasyEngineFixture420 {
    bytes32 constant MIXED = keccak256("mixed-final-and-suspended-slate");
    bytes32 constant SUSPENDED = keccak256("suspended-game");

    function _mixedProof(uint32 athlete) internal view returns (bytes32 root, bytes32[] memory proof) {
        bytes32[] memory level = new bytes32[](21);
        for (uint32 i = 1; i <= 21; i++) {
            level[i - 1] = scorer.leaf(MIXED, 1, i, i <= 7 ? SUSPENDED : GAME, stat[i]);
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

    function testExcludedGameContributesZeroWhileEligibleGameSettlesFundedPool() public {
        _grant(address(this), slates.PUBLISH(), auth.scopeForContest(MIXED));
        _grant(vm.addr(VALIDATOR_KEY), slates.VALIDATE_LINEUP(), auth.scopeForContest(MIXED));
        FantasyTypes420.Game[] memory schedule = new FantasyTypes420.Game[](2);
        schedule[0] = FantasyTypes420.Game(GAME, LOCK);
        schedule[1] = FantasyTypes420.Game(SUSPENDED, LOCK + 10);
        FantasyTypes420.Athlete[] memory roster = new FantasyTypes420.Athlete[](21);
        for (uint32 i = 1; i <= 21; i++) {
            roster[i - 1] = slates.athleteOf(SLATE, i);
            roster[i - 1].game = i <= 7 ? SUSPENDED : GAME;
        }
        slates.publish(
            MIXED,
            SLATE_FEED,
            FantasyEncryptedFixtures420.publicKeyHash(),
            keccak256("reserved-mixed-custodian"),
            vm.addr(VALIDATOR_KEY),
            CUTOFF,
            schedule,
            roster
        );
        slates.sealSlate(MIXED);
        FantasyContestEngine420.Config memory cfg =
            FantasyContestEngine420.Config(MIXED, CAND_FEED, ADMIN_ID, 100, 0, 0, true, false);
        vm.prank(ADMIN);
        engine.createPool(CONTEST, cfg, abi.encode(_bands(0)));
        _enter(1);
        _enter(2);
        _lockReveal(2);
        vm.warp(CUTOFF);
        FantasyTypes420.GameResult[] memory results = new FantasyTypes420.GameResult[](2);
        results[0] = FantasyTypes420.GameResult(GAME, LOCK, 10000, 10000, true, true, false);
        results[1] = FantasyTypes420.GameResult(SUSPENDED, LOCK + 10, 0, CUTOFF, false, true, false);
        bytes32 evidence = keccak256("one-final-one-suspended-through-cutoff");
        _report(SLATE_FEED, slates.resultDigest(MIXED, results, evidence));
        slates.resolve(MIXED, results, evidence);
        stat[8].goals = 1;
        stat[8].shots = 1;
        (bytes32 root,) = _mixedProof(8);
        FantasyTypes420.StatReport memory report =
            FantasyTypes420.StatReport(root, keccak256("mixed-eligible-statistics"), 1, CUTOFF);
        _report(SLATE_FEED, slates.statDigest(MIXED, report));
        engine.beginRevision(CONTEST, report);
        FantasyTypes420.Stats[7] memory statistics;
        bytes32[][7] memory proofs;
        for (uint32 i; i < 7; i++) {
            statistics[i] = stat[i + 8];
            (, proofs[i]) = _mixedProof(i + 8);
        }
        engine.scoreEntry(CONTEST, 2, abi.encode(statistics, proofs), 0, 0);
        // First entry's entire game was excluded: no fabricated zero-stat leaf is required.
        FantasyTypes420.Stats[7] memory excluded;
        bytes32[][7] memory empty;
        engine.scoreEntry(CONTEST, 1, abi.encode(excluded, empty), 2, 0);
        require(
            engine.rankings().nodeOf(CONTEST, 1, 1).score == 0 && engine.rankings().nodeOf(CONTEST, 1, 2).score == 100,
            "game-specific eligibility"
        );
        engine.rankings().walk(CONTEST, 1, 2);
        engine.rankings().allocate(CONTEST, 1, 2);
        _publish();
        _settle();
        engine.collect(CONTEST, 1);
        engine.collect(CONTEST, 2);
        require(
            engine.credit(USER) == 0 && engine.credit(USER2) == 194 && engine.credit(DEV) == 6,
            "full funded pool, no individual exclusion refund"
        );
    }
}
