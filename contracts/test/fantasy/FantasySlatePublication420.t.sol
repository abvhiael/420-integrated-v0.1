// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./FantasyContestEngine420.t.sol";

contract FantasySlatePublication420Test is FantasyEngineFixture420 {
    function _athletes(uint32 first, uint32 count) internal pure returns (FantasyTypes420.Athlete[] memory roster) {
        roster = new FantasyTypes420.Athlete[](count);
        for (uint32 i; i < count; i++) {
            uint32 pos = (first + i - 1) % 7;
            uint8 mask = pos == 0 ? 1 : pos == 1 ? 2 : pos == 2 ? 4 : pos < 5 ? 8 : pos == 5 ? 16 : 1;
            roster[i] = FantasyTypes420.Athlete(first + i, GAME, mask);
        }
    }

    function _draft(bytes32 id, uint32 count, uint64 cutoff) internal {
        _grant(address(this), slates.PUBLISH(), auth.scopeForContest(id));
        FantasyTypes420.Game[] memory schedule = new FantasyTypes420.Game[](1);
        schedule[0] = FantasyTypes420.Game(GAME, LOCK);
        slates.publish(
            id,
            SLATE_FEED,
            FantasyEncryptedFixtures420.publicKeyHash(),
            keccak256("reserved-custodian-key"),
            vm.addr(VALIDATOR_KEY),
            cutoff,
            schedule,
            _athletes(1, count)
        );
    }

    function testLargeSlatePublicationUsesBoundedBatchesAndImmutableSeal() public {
        bytes32 id = keccak256("large-slate");
        uint256 beforeGas = gasleft();
        _draft(id, 64, CUTOFF);
        require(
            beforeGas - gasleft() < 16_000_000 && slates.slateOf(id).manifest == 0, "draft fits budget and cannot open"
        );
        for (uint32 first = 65; first <= 129; first += 64) {
            beforeGas = gasleft();
            slates.appendRoster(id, _athletes(first, 64));
            require(beforeGas - gasleft() < 16_000_000, "bounded append gas");
        }
        slates.sealSlate(id);
        require(slates.athleteCount(id) == 192 && slates.slateOf(id).manifest != 0, "full snapshot sealed");
    }

    function testUnsealedSnapshotCannotOpenFundedPool() public {
        bytes32 id = keccak256("unsealed");
        _draft(id, 7, CUTOFF);
        FantasyContestEngine420.Config memory cfg =
            FantasyContestEngine420.Config(id, CAND_FEED, ADMIN_ID, 100, 0, 0, true, false);
        vm.prank(ADMIN);
        vm.expectRevert(FantasyContestEngine420.InvalidInput.selector);
        engine.createPool(CONTEST, cfg, abi.encode(_bands(0)));
    }

    function testSealedRosterCannotBeExtended() public {
        FantasyTypes420.Athlete[] memory roster = _athletes(100, 7);
        vm.expectRevert(FantasySlateBook420.InvalidInput.selector);
        slates.appendRoster(SLATE, roster);
    }

    function testDuplicateAcrossBatchesRollsBackSnapshotHash() public {
        bytes32 id = keccak256("duplicate-roster");
        _draft(id, 7, CUTOFF);
        bytes32 beforeHash = slates.rosterHash(id);
        FantasyTypes420.Athlete[] memory roster = _athletes(7, 7);
        vm.expectRevert(FantasySlateBook420.InvalidInput.selector);
        slates.appendRoster(id, roster);
        require(slates.athleteCount(id) == 7 && slates.rosterHash(id) == beforeHash, "atomic batch rollback");
    }

    function testDSTClockChangeElapsedBoundsAreAccepted() public {
        bytes32 spring = keccak256("spring-window");
        _draft(spring, 7, LOCK + 23 hours + 30 minutes);
        slates.sealSlate(spring);
        bytes32 fall = keccak256("fall-window");
        _draft(fall, 7, LOCK + 48 hours + 30 minutes);
        slates.sealSlate(fall);
        require(
            slates.slateOf(spring).manifest != 0 && slates.slateOf(fall).manifest != 0,
            "DST-compatible published windows"
        );
    }

    function testDraftScheduleCannotBeOverwritten() public {
        bytes32 id = keccak256("no-draft-replacement");
        _draft(id, 7, CUTOFF);
        FantasyTypes420.Game[] memory schedule = new FantasyTypes420.Game[](1);
        schedule[0] = FantasyTypes420.Game(GAME, LOCK);
        FantasyTypes420.Athlete[] memory roster = _athletes(1, 7);
        address validator = vm.addr(VALIDATOR_KEY);
        vm.expectRevert(FantasySlateBook420.InvalidInput.selector);
        slates.publish(
            id,
            SLATE_FEED,
            FantasyEncryptedFixtures420.publicKeyHash(),
            keccak256("reserved-custodian-key"),
            validator,
            CUTOFF,
            schedule,
            roster
        );
    }
}
