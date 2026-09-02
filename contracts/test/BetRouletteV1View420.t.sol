// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/bet/BetTypes420.sol";
import "../src/bet/RandomnessRouter420.sol";
import "../src/bet/RouletteV1420.sol";
import "../src/bet/RouletteV1View420.sol";

contract MockRouletteV1ViewRegistry420 {
    BetTypes420.Wager private _wager;
    BetTypes420.Settlement private _settlement;
    bool private _settled;

    function setWager(BetTypes420.Wager memory wager) external { _wager = wager; }
    function setSettlement(BetTypes420.Settlement memory settlement) external {
        _settlement = settlement;
        _settled = true;
        _wager.status = settlement.outcome == BetTypes420.TerminalOutcome.VOID
            ? BetTypes420.WagerStatus.VOID
            : BetTypes420.WagerStatus.SETTLED;
    }
    function getWager(bytes32 wagerId) external view returns (BetTypes420.Wager memory) {
        require(_wager.wagerId == wagerId, "not found");
        return _wager;
    }
    function settlementExists(bytes32 wagerId) external view returns (bool) {
        return _settled && _settlement.wagerId == wagerId;
    }
    function getSettlement(bytes32 wagerId) external view returns (BetTypes420.Settlement memory) {
        require(_settled && _settlement.wagerId == wagerId, "not settled");
        return _settlement;
    }
}

contract MockRouletteV1ViewRandomness420 {
    RandomnessRouter420.RandomnessRequest private _request;
    bool private _exists;

    function setRequest(RandomnessRouter420.RandomnessRequest memory request_) external {
        _request = request_;
        _exists = true;
    }
    function getRequest(bytes32 wagerId) external view returns (RandomnessRouter420.RandomnessRequest memory) {
        require(_exists && _request.wagerId == wagerId, "not requested");
        return _request;
    }
    function rootOf(bytes32 wagerId) external view returns (bytes32) {
        require(_exists && _request.wagerId == wagerId && _request.fulfilled, "not fulfilled");
        return _request.root;
    }
}

contract BetRouletteV1View420Test {
    bytes32 constant WAGER = keccak256("wager/roulette/client-view");
    bytes32 constant GAME = keccak256("420BET.GAME.ROULETTE");
    bytes32 constant GAME_V1 = keccak256("420BET.GAME.ROULETTE.V1");
    bytes32 constant RULESET = keccak256("420BET.RULESET.ROULETTE.V1");
    bytes32 constant RANDOMNESS = keccak256("profile/randomness/v1");

    struct Suite {
        MockRouletteV1ViewRegistry420 registry;
        MockRouletteV1ViewRandomness420 randomness;
        RouletteV1420 roulette;
        RouletteV1View420 view420;
        RouletteV1420.Params params;
    }

    function _deploy() private returns (Suite memory s) {
        s.registry = new MockRouletteV1ViewRegistry420();
        s.randomness = new MockRouletteV1ViewRandomness420();
        s.roulette = new RouletteV1420(address(s.registry), address(s.randomness), GAME, GAME_V1, RULESET);
        s.view420 = new RouletteV1View420(address(s.registry), address(s.randomness), address(s.roulette));
        s.params = RouletteV1420.Params({kind: RouletteV1420.BetKind.RED, selection: 0});

        s.registry.setWager(BetTypes420.Wager({
            wagerId: WAGER,
            player: address(0xC0FFEE),
            operatorId: keccak256("operator"),
            gameId: GAME,
            gameVersionId: GAME_V1,
            asset: address(0xCA),
            stake: 100 ether,
            maxGrossPayout: 200 ether,
            paramsHash: s.roulette.hashParams(s.params),
            vaultId: keccak256("vault"),
            randomnessProfileId: RANDOMNESS,
            riskProfileId: keccak256("risk"),
            settlementProfileId: keccak256("settlement"),
            accessPolicyId: keccak256("access"),
            rulesetId: RULESET,
            acceptedAt: 100,
            deadline: 1000,
            status: BetTypes420.WagerStatus.ACCEPTED
        }));
    }

    function _fulfill(Suite memory s) private returns (bytes32 root) {
        root = keccak256("canonical-root/roulette-view");
        s.randomness.setRequest(RandomnessRouter420.RandomnessRequest({
            wagerId: WAGER,
            profileId: RANDOMNESS,
            gameVersionId: GAME_V1,
            paramsHash: s.roulette.hashParams(s.params),
            contextHash: keccak256("draw-context/roulette/v1"),
            requestedAt: 110,
            fallbackAt: 210,
            root: root,
            proofHash: keccak256("proof"),
            entropyHash: keccak256("entropy"),
            source: RandomnessRouter420.Source.PRIMARY,
            fulfilled: true
        }));
    }

    function testSnapshotShowsAcceptedWagerBeforeRandomness() public {
        Suite memory s = _deploy();
        RouletteV1View420.Snapshot memory snap = s.view420.snapshot(WAGER, s.params);
        require(snap.wager.wagerId == WAGER, "missing wager");
        require(snap.wager.status == BetTypes420.WagerStatus.ACCEPTED, "wrong status");
        require(snap.paramsMatch, "params should match");
        require(!snap.randomnessRequested, "unexpected randomness");
        require(!snap.settlementExists, "unexpected settlement");
        require(!snap.resultAvailable, "unexpected result");
    }

    function testSnapshotShowsFulfilledRandomnessAndReproducibleSettlement() public {
        Suite memory s = _deploy();
        bytes32 root = _fulfill(s);
        RouletteV1420.Result memory result = s.roulette.resolve(WAGER, s.params);
        s.registry.setSettlement(BetTypes420.Settlement({
            wagerId: WAGER,
            outcome: result.outcome,
            grossPayout: result.grossPayout,
            settledAt: 120
        }));

        RouletteV1View420.Snapshot memory snap = s.view420.snapshot(WAGER, s.params);
        require(snap.randomnessRequested, "request missing");
        require(snap.randomness.fulfilled, "randomness not fulfilled");
        require(snap.randomness.root == root, "wrong root");
        require(snap.settlementExists, "settlement missing");
        require(snap.resultAvailable, "result unavailable after settlement");
        require(snap.result.pocket == result.pocket, "pocket changed");
        require(snap.result.outcome == snap.settlement.outcome, "outcome mismatch");
        require(snap.result.grossPayout == snap.settlement.grossPayout, "payout mismatch");
        require(snap.result.randomnessRoot == root, "result root mismatch");
    }

    function testSnapshotFlagsTamperedParamsWithoutInventingResult() public {
        Suite memory s = _deploy();
        _fulfill(s);
        RouletteV1420.Params memory altered = RouletteV1420.Params({kind: RouletteV1420.BetKind.BLACK, selection: 0});

        RouletteV1View420.Snapshot memory snap = s.view420.snapshot(WAGER, altered);
        require(snap.randomnessRequested && snap.randomness.fulfilled, "canonical randomness hidden");
        require(!snap.paramsMatch, "tampered params accepted");
        require(!snap.resultAvailable, "tampered result exposed");
    }
}
