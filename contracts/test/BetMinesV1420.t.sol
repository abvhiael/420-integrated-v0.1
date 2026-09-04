// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/bet/BetTypes420.sol";
import "../src/bet/MinesV1420.sol";
import "../src/bet/RandomnessRouter420.sol";

interface VmBetMinesV1420 {
    function prank(address) external;
    function expectRevert(bytes4) external;
}

contract MockMinesRegistry420 {
    BetTypes420.Wager private _wager;
    function setWager(BetTypes420.Wager calldata wager_) external { _wager = wager_; }
    function getWager(bytes32 wagerId) external view returns (BetTypes420.Wager memory wager) {
        require(_wager.wagerId == wagerId, "wager");
        return _wager;
    }
}

contract MockMinesRandomness420 {
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

contract BetMinesV1420Test {
    VmBetMinesV1420 constant vm = VmBetMinesV1420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address constant PLAYER = address(0xC0FFEE);
    address constant OTHER = address(0xBAD);
    address constant PROVIDER = address(0xA11CE);
    bytes32 constant WAGER = keccak256("mines/wager");
    bytes32 constant GAME = keccak256("420BET.GAME.MINES");
    bytes32 constant GAME_V1 = keccak256("420BET.GAME.MINES.V1");
    bytes32 constant RULESET = keccak256("420BET.RULESET.MINES.V1");
    bytes32 constant RANDOMNESS_PROFILE = keccak256("randomness");
    bytes32 constant RANDOMNESS_ROOT = keccak256("mines/root");
    bytes32 constant SEED = keccak256("mines/provider/seed");

    struct Suite {
        MockMinesRegistry420 registry;
        MockMinesRandomness420 randomness;
        MinesV1420 mines;
        MinesV1420.Params params;
    }

    function _deploy(uint8 mineCount) private returns (Suite memory s) {
        s.registry = new MockMinesRegistry420();
        s.randomness = new MockMinesRandomness420();
        s.mines = new MinesV1420(address(s.registry), address(s.randomness), GAME, GAME_V1, RULESET);
        s.params = MinesV1420.Params({mineCount: mineCount});

        s.registry.setWager(BetTypes420.Wager({
            wagerId: WAGER,
            player: PLAYER,
            operatorId: keccak256("operator"),
            gameId: GAME,
            gameVersionId: GAME_V1,
            asset: address(0),
            stake: 100 ether,
            maxGrossPayout: 1000 ether,
            paramsHash: s.mines.hashParams(s.params),
            vaultId: keccak256("vault"),
            randomnessProfileId: RANDOMNESS_PROFILE,
            riskProfileId: keccak256("risk"),
            settlementProfileId: keccak256("settlement"),
            accessPolicyId: keccak256("access"),
            rulesetId: RULESET,
            acceptedAt: uint64(block.timestamp),
            deadline: uint64(block.timestamp + 1 hours),
            status: BetTypes420.WagerStatus.ACCEPTED
        }));

        s.randomness.setProfile(RandomnessRouter420.RandomnessProfile({
            profileId: RANDOMNESS_PROFILE,
            method: RandomnessRouter420.Method.EXTERNAL_VRF,
            primaryProvider: PROVIDER,
            fallbackProvider: address(0xFA11),
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
            profileId: RANDOMNESS_PROFILE,
            gameVersionId: GAME_V1,
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
        return keccak256(abi.encode("420.MINES.TEST.SALT", cell));
    }

    function _isMine(uint8 cell) private pure returns (bool) { return cell < 5; }

    function _leaves(MinesV1420 mines) private view returns (bytes32[32] memory leaves) {
        for (uint8 i = 0; i < 25; ++i) {
            leaves[i] = mines.cellLeaf(WAGER, RANDOMNESS_ROOT, i, _isMine(i), _salt(i));
        }
        for (uint8 i = 25; i < 32; ++i) leaves[i] = keccak256(abi.encode("420.MINES.TEST.PAD", i));
    }

    function _pair(bytes32 a, bytes32 b) private pure returns (bytes32) {
        return a <= b ? keccak256(abi.encodePacked(a, b)) : keccak256(abi.encodePacked(b, a));
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

    function _prepareBoard(Suite memory s) private returns (bytes32[32] memory leaves) {
        bytes32 commitment = s.mines.seedCommitmentFor(WAGER, RandomnessRouter420.Source.PRIMARY, SEED);
        vm.prank(PROVIDER);
        s.mines.commitSeed(WAGER, RandomnessRouter420.Source.PRIMARY, commitment);
        _setRequest(s, true, RandomnessRouter420.Source.PRIMARY, RANDOMNESS_ROOT);
        leaves = _leaves(s.mines);
        vm.prank(PROVIDER);
        s.mines.bindBoard(WAGER, _root(leaves));
    }

    function _startPrepared(Suite memory s) private returns (bytes32[32] memory leaves) {
        leaves = _prepareBoard(s);
        vm.prank(PLAYER);
        s.mines.startSession(WAGER, s.params);
    }

    function testCanonicalBindingSurface() public {
        Suite memory s = _deploy(5);
        require(keccak256(bytes(s.mines.systemName())) == keccak256(bytes("MinesV1420")), "system");
        require(s.mines.protocolVersion() == 1, "protocol");
        require(s.mines.gameId() == GAME, "game");
        require(s.mines.gameVersionId() == GAME_V1, "version");
        require(s.mines.rulesetId() == RULESET, "ruleset");
        require(s.mines.BOARD_CELLS() == 25, "board");
        require(s.mines.MERKLE_DEPTH() == 5, "depth");
    }

    function testProviderMustCommitSeedBeforeRandomnessFulfillment() public {
        Suite memory s = _deploy(5);
        bytes32 commitment = s.mines.seedCommitmentFor(WAGER, RandomnessRouter420.Source.PRIMARY, SEED);
        vm.prank(PROVIDER);
        s.mines.commitSeed(WAGER, RandomnessRouter420.Source.PRIMARY, commitment);
        MinesV1420.BoardCommitment memory board = s.mines.getBoard(WAGER, RandomnessRouter420.Source.PRIMARY);
        require(board.seedCommitted && !board.boardBound, "commit state");

        _setRequest(s, true, RandomnessRouter420.Source.PRIMARY, RANDOMNESS_ROOT);
        vm.prank(PROVIDER);
        vm.expectRevert(MinesV1420.RandomnessAlreadyReady.selector);
        s.mines.commitSeed(WAGER, RandomnessRouter420.Source.PRIMARY, commitment);
    }

    function testOnlyConfiguredProviderCanCommitSeed() public {
        Suite memory s = _deploy(5);
        bytes32 commitment = s.mines.seedCommitmentFor(WAGER, RandomnessRouter420.Source.PRIMARY, SEED);
        vm.prank(OTHER);
        vm.expectRevert(MinesV1420.WrongProvider.selector);
        s.mines.commitSeed(WAGER, RandomnessRouter420.Source.PRIMARY, commitment);
    }

    function testBoardCannotBindWithoutPrecommittedSeed() public {
        Suite memory s = _deploy(5);
        _setRequest(s, true, RandomnessRouter420.Source.PRIMARY, RANDOMNESS_ROOT);
        vm.prank(PROVIDER);
        vm.expectRevert(MinesV1420.SeedCommitmentMissing.selector);
        s.mines.bindBoard(WAGER, keccak256("root"));
    }

    function testSessionRequiresFulfilledBoundBoard() public {
        Suite memory s = _deploy(5);
        vm.prank(PLAYER);
        vm.expectRevert(MinesV1420.RandomnessNotReady.selector);
        s.mines.startSession(WAGER, s.params);
    }

    function testSafeRevealUsesFixedDepthMerkleProof() public {
        Suite memory s = _deploy(5);
        bytes32[32] memory leaves = _startPrepared(s);
        uint8 cell = 7;
        vm.prank(PLAYER);
        s.mines.revealCell(WAGER, cell, false, _salt(cell), _proof(leaves, cell));
        MinesV1420.SessionState memory session = s.mines.getSession(WAGER);
        require(session.phase == MinesV1420.Phase.ACTIVE, "phase");
        require(session.safeReveals == 1, "safe count");
        require(s.mines.isCellRevealed(WAGER, cell), "revealed");
    }

    function testMineRevealTerminatesSessionDeterministically() public {
        Suite memory s = _deploy(5);
        bytes32[32] memory leaves = _startPrepared(s);
        uint8 cell = 2;
        vm.prank(PLAYER);
        s.mines.revealCell(WAGER, cell, true, _salt(cell), _proof(leaves, cell));
        MinesV1420.SessionState memory session = s.mines.getSession(WAGER);
        require(session.phase == MinesV1420.Phase.TERMINAL, "terminal");
        require(session.mineHit && !session.cashedOut, "mine flags");
    }

    function testPlayerCannotRewriteCommittedCellOutcome() public {
        Suite memory s = _deploy(5);
        bytes32[32] memory leaves = _startPrepared(s);
        uint8 cell = 7;
        vm.prank(PLAYER);
        vm.expectRevert(MinesV1420.InvalidProof.selector);
        s.mines.revealCell(WAGER, cell, true, _salt(cell), _proof(leaves, cell));
    }

    function testWrongSaltFailsProofWithoutMutatingSession() public {
        Suite memory s = _deploy(5);
        bytes32[32] memory leaves = _startPrepared(s);
        uint8 cell = 9;
        vm.prank(PLAYER);
        vm.expectRevert(MinesV1420.InvalidProof.selector);
        s.mines.revealCell(WAGER, cell, false, keccak256("wrong"), _proof(leaves, cell));
        MinesV1420.SessionState memory session = s.mines.getSession(WAGER);
        require(session.revealedMask == 0 && session.safeReveals == 0, "mutated");
    }

    function testDuplicateRevealAndOutOfRangeFailClosed() public {
        Suite memory s = _deploy(5);
        bytes32[32] memory leaves = _startPrepared(s);
        uint8 cell = 8;
        bytes32[] memory proof = _proof(leaves, cell);
        vm.prank(PLAYER);
        s.mines.revealCell(WAGER, cell, false, _salt(cell), proof);
        vm.prank(PLAYER);
        vm.expectRevert(MinesV1420.CellAlreadyRevealed.selector);
        s.mines.revealCell(WAGER, cell, false, _salt(cell), proof);
        vm.prank(PLAYER);
        vm.expectRevert(MinesV1420.InvalidCell.selector);
        s.mines.revealCell(WAGER, 25, false, _salt(24), proof);
    }

    function testParamsAreDomainBoundToAcceptedWager() public {
        Suite memory s = _deploy(5);
        MinesV1420.Params memory wrong = MinesV1420.Params({mineCount: 6});
        vm.prank(PLAYER);
        vm.expectRevert(MinesV1420.ParamsMismatch.selector);
        s.mines.startSession(WAGER, wrong);
    }

    function testOnlyPlayerCanStartPreparedSession() public {
        Suite memory s = _deploy(5);
        _prepareBoard(s);
        vm.prank(OTHER);
        vm.expectRevert(MinesV1420.NotPlayer.selector);
        s.mines.startSession(WAGER, s.params);
    }

    function testSessionCannotBeStartedTwice() public {
        Suite memory s = _deploy(5);
        _startPrepared(s);
        vm.prank(PLAYER);
        vm.expectRevert(MinesV1420.SessionAlreadyStarted.selector);
        s.mines.startSession(WAGER, s.params);
    }

    function testMineCountBoundsFailClosed() public {
        MockMinesRegistry420 registry = new MockMinesRegistry420();
        MockMinesRandomness420 randomness = new MockMinesRandomness420();
        MinesV1420 mines = new MinesV1420(address(registry), address(randomness), GAME, GAME_V1, RULESET);
        vm.expectRevert(MinesV1420.InvalidParams.selector);
        mines.hashParams(MinesV1420.Params({mineCount: 0}));
        vm.expectRevert(MinesV1420.InvalidParams.selector);
        mines.hashParams(MinesV1420.Params({mineCount: 25}));
    }
}
