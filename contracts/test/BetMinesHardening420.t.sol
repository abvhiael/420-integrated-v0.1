// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/bet/BetTypes420.sol";
import "../src/bet/MinesV1420.sol";
import "../src/bet/RandomnessRouter420.sol";

interface VmMinesHardening420 {
    function prank(address) external;
    function expectRevert(bytes4) external;
}

contract MockMinesHardeningRegistry420 {
    BetTypes420.Wager private _wager;
    function setWager(BetTypes420.Wager calldata wager_) external { _wager = wager_; }
    function getWager(bytes32 wagerId) external view returns (BetTypes420.Wager memory wager) {
        require(_wager.wagerId == wagerId, "wager");
        return _wager;
    }
}

contract MockMinesHardeningRandomness420 {
    RandomnessRouter420.RandomnessProfile private _profile;
    RandomnessRouter420.RandomnessRequest private _request;
    function setProfile(RandomnessRouter420.RandomnessProfile calldata profile_) external { _profile = profile_; }
    function setRequest(RandomnessRouter420.RandomnessRequest calldata request_) external { _request = request_; }
    function getProfile(bytes32 profileId) external view returns (RandomnessRouter420.RandomnessProfile memory profile) {
        require(_profile.profileId == profileId, "profile");
        return _profile;
    }
    function getRequest(bytes32 wagerId) external view returns (RandomnessRouter420.RandomnessRequest memory request) {
        require(_request.wagerId == wagerId, "request");
        return _request;
    }
}

contract BetMinesHardening420Test {
    VmMinesHardening420 constant vm = VmMinesHardening420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address constant PLAYER = address(0xC0FFEE);
    address constant OTHER = address(0xBAD);
    address constant PRIMARY = address(0xA11CE);
    address constant FALLBACK = address(0xFA11);
    bytes32 constant WAGER = keccak256("mines/hardening/wager");
    bytes32 constant GAME = keccak256("420BET.GAME.MINES");
    bytes32 constant VERSION = keccak256("420BET.GAME.MINES.V1");
    bytes32 constant RULESET = keccak256("420BET.RULESET.MINES.V1");
    bytes32 constant PROFILE = keccak256("mines/hardening/randomness");
    bytes32 constant ROOT = keccak256("mines/hardening/root");
    bytes32 constant SEED = keccak256("mines/hardening/seed");
    uint256 constant STAKE = 1 ether;

    struct Suite {
        MockMinesHardeningRegistry420 registry;
        MockMinesHardeningRandomness420 randomness;
        MinesV1420 mines;
        MinesV1420.Params params;
    }

    function _deploy(uint8 mineCount) private returns (Suite memory s) {
        s.registry = new MockMinesHardeningRegistry420();
        s.randomness = new MockMinesHardeningRandomness420();
        s.mines = new MinesV1420(address(s.registry), address(s.randomness), GAME, VERSION, RULESET);
        s.params = MinesV1420.Params({mineCount: mineCount});
        s.registry.setWager(BetTypes420.Wager({
            wagerId: WAGER,
            player: PLAYER,
            operatorId: keccak256("operator"),
            gameId: GAME,
            gameVersionId: VERSION,
            asset: address(0),
            stake: STAKE,
            maxGrossPayout: s.mines.requiredMaxGrossPayout(STAKE, mineCount),
            paramsHash: s.mines.hashParams(s.params),
            vaultId: keccak256("vault"),
            randomnessProfileId: PROFILE,
            riskProfileId: keccak256("risk"),
            settlementProfileId: keccak256("settlement"),
            accessPolicyId: keccak256("access"),
            rulesetId: RULESET,
            acceptedAt: uint64(block.timestamp),
            deadline: uint64(block.timestamp + 1 hours),
            status: BetTypes420.WagerStatus.ACCEPTED
        }));
        s.randomness.setProfile(RandomnessRouter420.RandomnessProfile({
            profileId: PROFILE,
            method: RandomnessRouter420.Method.EXTERNAL_VRF,
            primaryProvider: PRIMARY,
            fallbackProvider: FALLBACK,
            fallbackDelay: 60,
            securityLevelHash: keccak256("security"),
            domainSeparator: keccak256("domain"),
            manifestHash: keccak256("manifest"),
            exists: true
        }));
        _setRequest(s, false, RandomnessRouter420.Source.NONE, bytes32(0));
    }

    function _setRequest(Suite memory s, bool fulfilled, RandomnessRouter420.Source source, bytes32 root) private {
        s.randomness.setRequest(RandomnessRouter420.RandomnessRequest({
            wagerId: WAGER,
            profileId: PROFILE,
            gameVersionId: VERSION,
            paramsHash: s.mines.hashParams(s.params),
            contextHash: keccak256("context"),
            requestedAt: uint64(block.timestamp),
            fallbackAt: uint64(block.timestamp + 60),
            root: root,
            proofHash: fulfilled ? keccak256("proof") : bytes32(0),
            entropyHash: fulfilled ? keccak256("entropy") : bytes32(0),
            source: source,
            fulfilled: fulfilled
        }));
    }

    function _salt(uint8 cell) private pure returns (bytes32) {
        return keccak256(abi.encode("420.MINES.HARDENING.SALT", cell));
    }
    function _mine(uint8 cell) private pure returns (bool) { return cell < 5; }
    function _pair(bytes32 a, bytes32 b) private pure returns (bytes32) {
        return a <= b ? keccak256(abi.encodePacked(a, b)) : keccak256(abi.encodePacked(b, a));
    }
    function _leaves(MinesV1420 mines) private view returns (bytes32[32] memory leaves) {
        for (uint8 i = 0; i < 25; ++i) leaves[i] = mines.cellLeaf(WAGER, ROOT, i, _mine(i), _salt(i));
        for (uint8 i = 25; i < 32; ++i) leaves[i] = keccak256(abi.encode("420.MINES.HARDENING.PAD", i));
    }
    function _root(bytes32[32] memory leaves) private pure returns (bytes32) {
        bytes32[32] memory nodes = leaves;
        uint256 width = 32;
        while (width > 1) {
            for (uint256 i = 0; i < width; i += 2) nodes[i / 2] = _pair(nodes[i], nodes[i + 1]);
            width /= 2;
        }
        return nodes[0];
    }
    function _proof(bytes32[32] memory leaves, uint8 index) private pure returns (bytes32[] memory proof) {
        proof = new bytes32[](5);
        bytes32[32] memory nodes = leaves;
        uint256 width = 32;
        uint256 idx = index;
        for (uint256 level = 0; level < 5; ++level) {
            proof[level] = nodes[idx ^ 1];
            for (uint256 i = 0; i < width; i += 2) nodes[i / 2] = _pair(nodes[i], nodes[i + 1]);
            idx /= 2;
            width /= 2;
        }
    }

    function _prepare(Suite memory s) private returns (bytes32[32] memory leaves) {
        bytes32 commitment = s.mines.seedCommitmentFor(WAGER, RandomnessRouter420.Source.PRIMARY, SEED);
        vm.prank(PRIMARY);
        s.mines.commitSeed(WAGER, RandomnessRouter420.Source.PRIMARY, commitment);
        _setRequest(s, true, RandomnessRouter420.Source.PRIMARY, ROOT);
        leaves = _leaves(s.mines);
        vm.prank(PRIMARY);
        s.mines.bindBoard(WAGER, _root(leaves));
        vm.prank(PLAYER);
        s.mines.startSession(WAGER, s.params);
    }

    function testPayoutBoundsAcrossExtremeMineCounts() public {
        Suite memory oneMine = _deploy(1);
        uint256 q1 = oneMine.mines.quoteGrossPayout(STAKE, 1, 1);
        uint256 max1 = oneMine.mines.requiredMaxGrossPayout(STAKE, 1);
        require(q1 >= STAKE && max1 >= q1, "one-mine bounds");

        Suite memory twentyFour = _deploy(24);
        uint256 max24 = twentyFour.mines.requiredMaxGrossPayout(STAKE, 24);
        require(max24 == twentyFour.mines.quoteGrossPayout(STAKE, 24, 1), "24-mine maximum");
        require(max24 > STAKE, "24-mine payout");
    }

    function testMalformedRevealProofDoesNotMutateSession() public {
        Suite memory s = _deploy(5);
        bytes32[32] memory leaves = _prepare(s);
        bytes32[] memory badProof = _proof(leaves, 7);
        badProof[0] = keccak256("tampered");
        vm.prank(PLAYER);
        vm.expectRevert(MinesV1420.InvalidProof.selector);
        s.mines.revealCell(WAGER, 7, false, _salt(7), badProof);
        MinesV1420.SessionState memory session = s.mines.getSession(WAGER);
        require(session.safeReveals == 0 && session.revealedMask == 0 && session.currentGrossPayout == 0, "mutated");
    }

    function testProofCannotBeReplayedForDifferentCell() public {
        Suite memory s = _deploy(5);
        bytes32[32] memory leaves = _prepare(s);
        bytes32[] memory proof7 = _proof(leaves, 7);
        vm.prank(PLAYER);
        vm.expectRevert(MinesV1420.InvalidProof.selector);
        s.mines.revealCell(WAGER, 8, false, _salt(8), proof7);
    }

    function testTerminalCashoutBlocksFurtherReveal() public {
        Suite memory s = _deploy(5);
        bytes32[32] memory leaves = _prepare(s);
        vm.prank(PLAYER);
        s.mines.revealCell(WAGER, 7, false, _salt(7), _proof(leaves, 7));
        vm.prank(PLAYER);
        s.mines.cashOut(WAGER);
        vm.prank(PLAYER);
        vm.expectRevert(MinesV1420.InvalidPhase.selector);
        s.mines.revealCell(WAGER, 8, false, _salt(8), _proof(leaves, 8));
    }

    function testMineTerminalBlocksCashoutReplay() public {
        Suite memory s = _deploy(5);
        bytes32[32] memory leaves = _prepare(s);
        vm.prank(PLAYER);
        s.mines.revealCell(WAGER, 2, true, _salt(2), _proof(leaves, 2));
        vm.prank(PLAYER);
        vm.expectRevert(MinesV1420.InvalidPhase.selector);
        s.mines.cashOut(WAGER);
    }

    function testOnlyPlayerCanRevealOrCashOut() public {
        Suite memory s = _deploy(5);
        bytes32[32] memory leaves = _prepare(s);
        vm.prank(OTHER);
        vm.expectRevert(MinesV1420.NotPlayer.selector);
        s.mines.revealCell(WAGER, 7, false, _salt(7), _proof(leaves, 7));
        vm.prank(PLAYER);
        s.mines.revealCell(WAGER, 7, false, _salt(7), _proof(leaves, 7));
        vm.prank(OTHER);
        vm.expectRevert(MinesV1420.NotPlayer.selector);
        s.mines.cashOut(WAGER);
    }

    function testRandomnessSourceSubstitutionCannotReuseBoundBoard() public {
        Suite memory s = _deploy(5);
        bytes32 commitment = s.mines.seedCommitmentFor(WAGER, RandomnessRouter420.Source.PRIMARY, SEED);
        vm.prank(PRIMARY);
        s.mines.commitSeed(WAGER, RandomnessRouter420.Source.PRIMARY, commitment);
        _setRequest(s, true, RandomnessRouter420.Source.PRIMARY, ROOT);
        bytes32[32] memory leaves = _leaves(s.mines);
        vm.prank(PRIMARY);
        s.mines.bindBoard(WAGER, _root(leaves));

        _setRequest(s, true, RandomnessRouter420.Source.FALLBACK, ROOT);
        vm.prank(PLAYER);
        vm.expectRevert(MinesV1420.BoardNotReady.selector);
        s.mines.startSession(WAGER, s.params);
    }

    function testDuplicateSeedAndBoardBindingsFailClosed() public {
        Suite memory s = _deploy(5);
        bytes32 commitment = s.mines.seedCommitmentFor(WAGER, RandomnessRouter420.Source.PRIMARY, SEED);
        vm.prank(PRIMARY);
        s.mines.commitSeed(WAGER, RandomnessRouter420.Source.PRIMARY, commitment);
        vm.prank(PRIMARY);
        vm.expectRevert(MinesV1420.SeedAlreadyCommitted.selector);
        s.mines.commitSeed(WAGER, RandomnessRouter420.Source.PRIMARY, commitment);

        _setRequest(s, true, RandomnessRouter420.Source.PRIMARY, ROOT);
        bytes32[32] memory leaves = _leaves(s.mines);
        bytes32 root = _root(leaves);
        vm.prank(PRIMARY);
        s.mines.bindBoard(WAGER, root);
        vm.prank(PRIMARY);
        vm.expectRevert(MinesV1420.BoardAlreadyBound.selector);
        s.mines.bindBoard(WAGER, root);
    }
}
