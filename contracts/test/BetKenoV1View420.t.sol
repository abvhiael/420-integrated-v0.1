// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/bet/BetTypes420.sol";
import "../src/bet/RandomnessRouter420.sol";
import "../src/bet/KenoV1420.sol";
import "../src/bet/KenoV1View420.sol";

contract MockKenoV1ViewRegistry420 {
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

contract MockKenoV1ViewRandomness420 {
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

contract BetKenoV1View420Test {
    bytes32 constant WAGER = keccak256("wager/keno/client-view");
    bytes32 constant GAME = keccak256("420BET.GAME.KENO");
    bytes32 constant GAME_V1 = keccak256("420BET.GAME.KENO.V1");
    bytes32 constant RULESET = keccak256("420BET.RULESET.KENO.V1");
    bytes32 constant RANDOMNESS = keccak256("profile/randomness/v1");

    struct Suite {
        MockKenoV1ViewRegistry420 registry;
        MockKenoV1ViewRandomness420 randomness;
        KenoV1420 keno;
        KenoV1View420 view420;
        KenoV1420.Params params;
    }

    function _params() private pure returns (KenoV1420.Params memory params) {
        params.pickCount = 5;
        params.picks[0] = 3;
        params.picks[1] = 17;
        params.picks[2] = 29;
        params.picks[3] = 44;
        params.picks[4] = 80;
        params.grossPayoutByHits[2] = 100 ether;
        params.grossPayoutByHits[3] = 200 ether;
        params.grossPayoutByHits[4] = 1_000 ether;
        params.grossPayoutByHits[5] = 5_000 ether;
    }

    function _deploy() private returns (Suite memory s) {
        s.registry = new MockKenoV1ViewRegistry420();
        s.randomness = new MockKenoV1ViewRandomness420();
        s.keno = new KenoV1420(address(s.registry), address(s.randomness), GAME, GAME_V1, RULESET);
        s.view420 = new KenoV1View420(address(s.registry), address(s.randomness), address(s.keno));
        s.params = _params();

        s.registry.setWager(BetTypes420.Wager({
            wagerId: WAGER,
            player: address(0xC0FFEE),
            operatorId: keccak256("operator"),
            gameId: GAME,
            gameVersionId: GAME_V1,
            asset: address(0xCA),
            stake: 100 ether,
            maxGrossPayout: 5_000 ether,
            paramsHash: s.keno.hashParams(s.params),
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
        root = keccak256("canonical-root/keno-view");
        s.randomness.setRequest(RandomnessRouter420.RandomnessRequest({
            wagerId: WAGER,
            profileId: RANDOMNESS,
            gameVersionId: GAME_V1,
            paramsHash: s.keno.hashParams(s.params),
            contextHash: keccak256("draw-context/keno/v1"),
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
        KenoV1View420.Snapshot memory snap = s.view420.snapshot(WAGER, s.params);
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
        KenoV1420.Result memory result = s.keno.resolve(WAGER, s.params);
        s.registry.setSettlement(BetTypes420.Settlement({
            wagerId: WAGER,
            outcome: result.outcome,
            grossPayout: result.grossPayout,
            settledAt: 120
        }));

        KenoV1View420.Snapshot memory snap = s.view420.snapshot(WAGER, s.params);
        require(snap.randomnessRequested, "request missing");
        require(snap.randomness.fulfilled, "randomness not fulfilled");
        require(snap.randomness.root == root, "wrong root");
        require(snap.settlementExists, "settlement missing");
        require(snap.resultAvailable, "result unavailable after settlement");
        require(snap.result.hits == result.hits, "hits changed");
        require(snap.result.outcome == snap.settlement.outcome, "outcome mismatch");
        require(snap.result.grossPayout == snap.settlement.grossPayout, "payout mismatch");
        require(snap.result.randomnessRoot == root, "result root mismatch");
        for (uint8 i = 0; i < 20; ++i) require(snap.result.draw[i] == result.draw[i], "draw changed");
    }

    function testSnapshotFlagsTamperedParamsWithoutInventingResult() public {
        Suite memory s = _deploy();
        _fulfill(s);
        KenoV1420.Params memory altered = s.params;
        altered.picks[0] = 4;

        KenoV1View420.Snapshot memory snap = s.view420.snapshot(WAGER, altered);
        require(snap.randomnessRequested && snap.randomness.fulfilled, "canonical randomness hidden");
        require(!snap.paramsMatch, "tampered params accepted");
        require(!snap.resultAvailable, "tampered result exposed");
    }
}
