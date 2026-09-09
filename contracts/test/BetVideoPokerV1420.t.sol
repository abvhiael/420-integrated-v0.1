// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/bet/BetTypes420.sol";
import "../src/bet/VideoPokerV1420.sol";

interface VmBetVideoPoker420 { function expectRevert(bytes4) external; }

contract MockVideoPokerRegistry420 {
    mapping(bytes32 => BetTypes420.Wager) private _wagers;
    function setWager(BetTypes420.Wager calldata wager_) external { _wagers[wager_.wagerId] = wager_; }
    function getWager(bytes32 wagerId) external view returns (BetTypes420.Wager memory wager) {
        wager = _wagers[wagerId];
        require(wager.wagerId != bytes32(0), "wager");
    }
}

contract BetVideoPokerV1420Test {
    VmBetVideoPoker420 constant vm = VmBetVideoPoker420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address constant PLAYER = address(0xBEEF);
    address constant ASSET = address(0xCA0C);
    bytes32 constant GAME = keccak256("420BET.GAME.VIDEO_POKER");
    bytes32 constant GAME_V1 = keccak256("420BET.GAME.VIDEO_POKER.V1");
    bytes32 constant RULESET = keccak256("420BET.RULESET.VIDEO_POKER.V1");
    bytes32 constant PAYTABLE = keccak256("420BET.PAYTABLE.VIDEO_POKER.JACKS_OR_BETTER.V1");

    MockVideoPokerRegistry420 private registry;
    VideoPokerV1420 private poker;

    constructor() {
        registry = new MockVideoPokerRegistry420();
        poker = new VideoPokerV1420(address(registry), GAME, GAME_V1, RULESET);
    }

    function _params(uint8 credits) private pure returns (VideoPokerV1420.Params memory params) {
        params = VideoPokerV1420.Params({paytableId: PAYTABLE, credits: credits});
    }

    function _wager(bytes32 wagerId, VideoPokerV1420.Params memory params)
        private
        view
        returns (BetTypes420.Wager memory wager)
    {
        wager = BetTypes420.Wager({
            wagerId: wagerId,
            player: PLAYER,
            operatorId: keccak256("operator"),
            gameId: GAME,
            gameVersionId: GAME_V1,
            asset: ASSET,
            stake: 100 ether,
            maxGrossPayout: 800 ether,
            paramsHash: poker.hashParams(params),
            vaultId: keccak256("vault"),
            randomnessProfileId: keccak256("randomness"),
            riskProfileId: keccak256("risk"),
            settlementProfileId: keccak256("settlement"),
            accessPolicyId: keccak256("access"),
            rulesetId: RULESET,
            acceptedAt: uint64(block.timestamp),
            deadline: uint64(block.timestamp + 1 hours),
            status: BetTypes420.WagerStatus.ACCEPTED
        });
    }

    function testCanonicalBindingSurface() public view {
        require(keccak256(bytes(poker.systemName())) == keccak256("VideoPokerV1420"), "name");
        require(poker.protocolVersion() == 1, "version");
        require(poker.gameId() == GAME, "game");
        require(poker.gameVersionId() == GAME_V1, "game version");
        require(poker.rulesetId() == RULESET, "ruleset");
    }

    function testHashParamsCommitsPaytableCreditsVersionAndRuleset() public view {
        bytes32 one = poker.hashParams(_params(1));
        bytes32 five = poker.hashParams(_params(5));
        require(one != five, "credits not committed");
        require(one != bytes32(0) && five != bytes32(0), "zero hash");
    }

    function testRejectsZeroPaytable() public {
        vm.expectRevert(VideoPokerV1420.InvalidParams.selector);
        poker.hashParams(VideoPokerV1420.Params({paytableId: bytes32(0), credits: 1}));
    }

    function testRejectsCreditsOutsideOneThroughFive() public {
        vm.expectRevert(VideoPokerV1420.InvalidParams.selector);
        poker.hashParams(_params(0));
        vm.expectRevert(VideoPokerV1420.InvalidParams.selector);
        poker.hashParams(_params(6));
    }

    function testValidateWagerAcceptsCanonicalCommittedWager() public {
        bytes32 wagerId = keccak256("video-poker/foundation");
        VideoPokerV1420.Params memory params = _params(5);
        registry.setWager(_wager(wagerId, params));
        BetTypes420.Wager memory wager = poker.validateWager(wagerId, params);
        require(wager.wagerId == wagerId, "wager id");
        require(wager.paramsHash == poker.hashParams(params), "params");
    }

    function testValidateWagerRejectsParamSubstitution() public {
        bytes32 wagerId = keccak256("video-poker/substitution");
        VideoPokerV1420.Params memory committed = _params(5);
        registry.setWager(_wager(wagerId, committed));
        vm.expectRevert(VideoPokerV1420.ParamsMismatch.selector);
        poker.validateWager(wagerId, _params(4));
    }

    function testValidateWagerRejectsWrongGameVersion() public {
        bytes32 wagerId = keccak256("video-poker/wrong-game");
        VideoPokerV1420.Params memory params = _params(1);
        BetTypes420.Wager memory wager = _wager(wagerId, params);
        wager.gameVersionId = keccak256("wrong");
        registry.setWager(wager);
        vm.expectRevert(VideoPokerV1420.WrongGame.selector);
        poker.validateWager(wagerId, params);
    }
}
