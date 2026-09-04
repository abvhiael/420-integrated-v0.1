// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/interfaces/genesis/ICapabilityRegistry420.sol";
import "../src/bonggoggles/BongGogglesAuthorization420.sol";
import "../src/bonggoggles/BongGogglesIds420.sol";
import "../src/bonggoggles/BongGogglesProfileRegistry420.sol";
import "../src/bonggoggles/BongGogglesRelationshipGraph420.sol";
import "../src/bonggoggles/BongGogglesSocialPolicy420.sol";
import "../src/bonggoggles/BongGogglesGameSessionRegistry420.sol";

interface VmBGCasualGames420 {
    function prank(address) external;
    function expectRevert(bytes4) external;
}

contract MockBGCasualGameCaps420 is ICapabilityRegistry420 {
    function grant(bytes32) external pure override returns (CapabilityGrant memory g) { return g; }
    function isAuthorized(address, bytes32, bytes32, bytes32, uint256) external pure override returns (bool) { return false; }
}

contract BongGogglesCasualGames420Test {
    VmBGCasualGames420 constant vm = VmBGCasualGames420(address(uint160(uint256(keccak256("hevm cheat code")))));
    address constant ALICE = address(0xA11CE);
    address constant BOB = address(0xB0B);
    address constant CAROL = address(0xCA401);

    MockBGCasualGameCaps420 caps;
    BongGogglesAuthorization420 auth;
    BongGogglesProfileRegistry420 profiles;
    BongGogglesRelationshipGraph420 relationships;
    BongGogglesSocialPolicy420 policy;
    BongGogglesGameSessionRegistry420 games;

    function setUp() public {
        caps = new MockBGCasualGameCaps420();
        auth = new BongGogglesAuthorization420(address(caps));
        profiles = new BongGogglesProfileRegistry420(address(auth));
        relationships = new BongGogglesRelationshipGraph420(address(auth), address(profiles));
        policy = new BongGogglesSocialPolicy420(address(profiles), address(relationships));
        games = new BongGogglesGameSessionRegistry420(address(auth), address(profiles), address(relationships), address(policy));

        _createProfile(ALICE);
        _createProfile(BOB);
        _createProfile(CAROL);
        _allowGameInvitesFromEveryone(BOB);
        _allowGameInvitesFromEveryone(CAROL);
    }

    function testInviteAcceptLocksRulesetAndStartsSession() public {
        bytes32 ruleset = keccak256("chess/rules/v1");
        vm.prank(ALICE);
        bytes32 sessionId = games.invite(ALICE, BOB, BongGogglesGameSessionRegistry420.GameType.CHESS, ruleset, bytes32(0), 0);

        BongGogglesGameSessionRegistry420.Session memory beforeAccept = games.session(sessionId);
        require(beforeAccept.rulesetHash == ruleset, "ruleset locked");
        require(beforeAccept.state == BongGogglesGameSessionRegistry420.SessionState.INVITED, "invited");

        vm.prank(BOB);
        games.accept(BOB, sessionId);
        BongGogglesGameSessionRegistry420.Session memory active = games.session(sessionId);
        require(active.state == BongGogglesGameSessionRegistry420.SessionState.ACTIVE, "active");
        require(active.startedAt != 0, "started");
        require(active.nextMoveNumber == 1, "first move");
    }

    function testWageringFailsClosedTo420BetBoundary() public {
        vm.prank(ALICE);
        vm.expectRevert(BongGogglesGameSessionRegistry420.WageringUnsupported.selector);
        games.invite(ALICE, BOB, BongGogglesGameSessionRegistry420.GameType.CRIBBAGE, keccak256("crib/v1"), bytes32(0), 1);
    }

    function testMoveCommitmentsAreReplaySafeAndSequential() public {
        bytes32 id = _activeChess();
        bytes32 first = keccak256("e2e4");
        vm.prank(ALICE);
        games.commitMove(ALICE, id, 1, first);
        require(games.moveCommitment(id, 1) == first, "move committed");

        vm.prank(BOB);
        vm.expectRevert(BongGogglesGameSessionRegistry420.InvalidMoveNumber.selector);
        games.commitMove(BOB, id, 1, keccak256("replay"));

        vm.prank(BOB);
        games.commitMove(BOB, id, 2, keccak256("e7e5"));
        require(games.session(id).nextMoveNumber == 3, "sequence advanced");
    }

    function testBlockPrecedenceStopsAcceptanceAndMoves() public {
        vm.prank(ALICE);
        bytes32 invited = games.invite(ALICE, BOB, BongGogglesGameSessionRegistry420.GameType.CHECKERS, keccak256("checkers/v1"), bytes32(0), 0);
        vm.prank(BOB);
        relationships.blockUser(BOB, ALICE);
        vm.prank(BOB);
        vm.expectRevert(BongGogglesGameSessionRegistry420.RelationshipBlocked.selector);
        games.accept(BOB, invited);

        vm.prank(BOB);
        relationships.unblockUser(BOB, ALICE);
        bytes32 active = _activeChess();
        vm.prank(ALICE);
        relationships.blockUser(ALICE, BOB);
        vm.prank(ALICE);
        vm.expectRevert(BongGogglesGameSessionRegistry420.RelationshipBlocked.selector);
        games.commitMove(ALICE, active, 1, keccak256("blocked"));
    }

    function testOnlyPlayersCanFinishAndWinnerMustBeParticipant() public {
        bytes32 id = _activeChess();
        vm.prank(CAROL);
        vm.expectRevert(BongGogglesGameSessionRegistry420.WrongPlayer.selector);
        games.finish(CAROL, id, CAROL);

        vm.prank(ALICE);
        vm.expectRevert(BongGogglesGameSessionRegistry420.InvalidWinner.selector);
        games.finish(ALICE, id, CAROL);

        vm.prank(ALICE);
        games.finish(ALICE, id, BOB);
        BongGogglesGameSessionRegistry420.Session memory finished = games.session(id);
        require(finished.state == BongGogglesGameSessionRegistry420.SessionState.FINISHED, "finished");
        require(finished.winner == BOB, "winner");
    }

    function _activeChess() internal returns (bytes32 id) {
        vm.prank(ALICE);
        id = games.invite(ALICE, BOB, BongGogglesGameSessionRegistry420.GameType.CHESS, keccak256("chess/rules/v1"), bytes32(0), 0);
        vm.prank(BOB);
        games.accept(BOB, id);
    }

    function _createProfile(address account) internal {
        vm.prank(account);
        profiles.createProfile(account, BongGogglesTypes420.ProfileType.PERSONAL, keccak256("name"), bytes32(0), bytes32(0), bytes32(0), bytes32(0));
    }

    function _allowGameInvitesFromEveryone(address account) internal {
        BongGogglesProfileRegistry420.Preferences memory p = profiles.preferences(account);
        p.gameInvitePolicy = BongGogglesTypes420.AccessPolicy.EVERYONE;
        vm.prank(account);
        profiles.updatePreferences(account, p);
    }
}
