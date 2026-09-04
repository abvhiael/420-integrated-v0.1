// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/bet/BetTypes420.sol";
import "../src/bet/CasinoResultAdapter420.sol";
import "../src/bet/RandomnessRouter420.sol";

contract MockCasinoResultRegistry420 {
    mapping(bytes32 => BetTypes420.Wager) private _wagers;
    mapping(bytes32 => BetTypes420.Settlement) private _settlements;

    function setWager(BetTypes420.Wager calldata wager_) external { _wagers[wager_.wagerId] = wager_; }
    function setSettlement(BetTypes420.Settlement calldata settlement_) external { _settlements[settlement_.wagerId] = settlement_; }

    function getWager(bytes32 wagerId) external view returns (BetTypes420.Wager memory wager) {
        wager = _wagers[wagerId];
        require(wager.wagerId != bytes32(0), "wager");
    }

    function settlementExists(bytes32 wagerId) external view returns (bool) {
        return _settlements[wagerId].wagerId != bytes32(0);
    }

    function getSettlement(bytes32 wagerId) external view returns (BetTypes420.Settlement memory settlement) {
        settlement = _settlements[wagerId];
        require(settlement.wagerId != bytes32(0), "settlement");
    }
}

contract MockCasinoResultRandomness420 {
    mapping(bytes32 => RandomnessRouter420.RandomnessRequest) private _requests;

    function setRequest(RandomnessRouter420.RandomnessRequest calldata request_) external {
        _requests[request_.wagerId] = request_;
    }

    function getRequest(bytes32 wagerId) external view returns (RandomnessRouter420.RandomnessRequest memory request) {
        request = _requests[wagerId];
        require(request.wagerId != bytes32(0), "request");
    }
}

contract BetCasinoResultAdapter420Test {
    address constant PLAYER = address(0xBEEF);
    address constant ASSET = address(0xCA0C);

    bytes32 constant DICE_V1 = keccak256("420BET.GAME.DICE.V1");
    bytes32 constant KENO_V1 = keccak256("420BET.GAME.KENO.V1");
    bytes32 constant PLINKO_V1 = keccak256("420BET.GAME.PLINKO.V1");
    bytes32 constant SLOT_V1 = keccak256("420BET.GAME.SLOT.REFERENCE.V1");
    bytes32 constant ROULETTE_V1 = keccak256("420BET.GAME.ROULETTE.V1");
    bytes32 constant BLACKJACK_V1 = keccak256("420BET.GAME.BLACKJACK.V1");

    function _versions() private pure returns (bytes32[6] memory versions) {
        versions = [DICE_V1, KENO_V1, PLINKO_V1, SLOT_V1, ROULETTE_V1, BLACKJACK_V1];
    }

    function _wager(bytes32 version, uint256 nonce, BetTypes420.WagerStatus status)
        private pure returns (BetTypes420.Wager memory wager)
    {
        bytes32 wagerId = keccak256(abi.encode("adapter/wager", version, nonce));
        wager = BetTypes420.Wager({
            wagerId: wagerId,
            player: PLAYER,
            operatorId: keccak256("operator"),
            gameId: keccak256(abi.encode("game", version)),
            gameVersionId: version,
            asset: ASSET,
            stake: 100 ether,
            maxGrossPayout: 500 ether,
            paramsHash: keccak256(abi.encode("params", version, nonce)),
            vaultId: keccak256("vault"),
            randomnessProfileId: keccak256("randomness"),
            riskProfileId: keccak256("risk"),
            settlementProfileId: keccak256("settlement"),
            accessPolicyId: keccak256("access"),
            rulesetId: keccak256(abi.encode("ruleset", version)),
            acceptedAt: 100,
            deadline: 1000,
            status: status
        });
    }

    function testPendingEnvelopeIsUniformAcrossCasinoGames() public {
        bytes32[6] memory versions = _versions();
        for (uint256 i = 0; i < versions.length; ++i) {
            MockCasinoResultRegistry420 registry = new MockCasinoResultRegistry420();
            MockCasinoResultRandomness420 randomness = new MockCasinoResultRandomness420();
            CasinoResultAdapter420 adapter = new CasinoResultAdapter420(address(registry), address(randomness));
            BetTypes420.Wager memory wager = _wager(versions[i], i, BetTypes420.WagerStatus.ACCEPTED);
            registry.setWager(wager);

            CasinoResultAdapter420.Envelope memory out = adapter.envelope(wager.wagerId);
            require(out.wagerId == wager.wagerId, "wager id");
            require(out.player == PLAYER, "player");
            require(out.gameId == wager.gameId, "game");
            require(out.gameVersionId == versions[i], "version");
            require(out.rulesetId == wager.rulesetId, "ruleset");
            require(out.paramsHash == wager.paramsHash, "params");
            require(out.stake == 100 ether && out.maxGrossPayout == 500 ether, "economics");
            require(out.wagerStatus == BetTypes420.WagerStatus.ACCEPTED, "status");
            require(!out.randomnessRequested && !out.randomnessFulfilled, "randomness");
            require(!out.settlementAvailable, "settlement");
            require(out.outcome == BetTypes420.TerminalOutcome.NONE && out.grossPayout == 0, "terminal defaults");
        }
    }

    function testFulfilledSettledEnvelopeIsUniformAcrossCasinoGames() public {
        bytes32[6] memory versions = _versions();
        for (uint256 i = 0; i < versions.length; ++i) {
            MockCasinoResultRegistry420 registry = new MockCasinoResultRegistry420();
            MockCasinoResultRandomness420 randomness = new MockCasinoResultRandomness420();
            CasinoResultAdapter420 adapter = new CasinoResultAdapter420(address(registry), address(randomness));
            BetTypes420.Wager memory wager = _wager(versions[i], i + 100, BetTypes420.WagerStatus.SETTLED);
            registry.setWager(wager);

            bytes32 root = keccak256(abi.encode("root", versions[i]));
            randomness.setRequest(RandomnessRouter420.RandomnessRequest({
                wagerId: wager.wagerId,
                profileId: wager.randomnessProfileId,
                gameVersionId: wager.gameVersionId,
                paramsHash: wager.paramsHash,
                contextHash: keccak256(abi.encode("context", versions[i])),
                requestedAt: 110,
                fallbackAt: 120,
                root: root,
                proofHash: keccak256("proof"),
                entropyHash: keccak256("entropy"),
                source: RandomnessRouter420.Source.PRIMARY,
                fulfilled: true
            }));
            registry.setSettlement(BetTypes420.Settlement({
                wagerId: wager.wagerId,
                outcome: BetTypes420.TerminalOutcome.WIN,
                grossPayout: 500 ether,
                settledAt: 200
            }));

            CasinoResultAdapter420.Envelope memory out = adapter.envelope(wager.wagerId);
            require(out.randomnessRequested && out.randomnessFulfilled, "randomness flags");
            require(out.randomnessRoot == root, "root");
            require(out.settlementAvailable, "settlement flag");
            require(out.outcome == BetTypes420.TerminalOutcome.WIN, "outcome");
            require(out.grossPayout == 500 ether, "payout");
            require(out.settledAt == 200, "settled at");
        }
    }

    function testRequestedButUnfulfilledRandomnessDoesNotInventRoot() public {
        MockCasinoResultRegistry420 registry = new MockCasinoResultRegistry420();
        MockCasinoResultRandomness420 randomness = new MockCasinoResultRandomness420();
        CasinoResultAdapter420 adapter = new CasinoResultAdapter420(address(registry), address(randomness));
        BetTypes420.Wager memory wager = _wager(DICE_V1, 999, BetTypes420.WagerStatus.ACCEPTED);
        registry.setWager(wager);
        randomness.setRequest(RandomnessRouter420.RandomnessRequest({
            wagerId: wager.wagerId,
            profileId: wager.randomnessProfileId,
            gameVersionId: wager.gameVersionId,
            paramsHash: wager.paramsHash,
            contextHash: keccak256("context"),
            requestedAt: 110,
            fallbackAt: 120,
            root: bytes32(0),
            proofHash: bytes32(0),
            entropyHash: bytes32(0),
            source: RandomnessRouter420.Source.NONE,
            fulfilled: false
        }));

        CasinoResultAdapter420.Envelope memory out = adapter.envelope(wager.wagerId);
        require(out.randomnessRequested, "request missing");
        require(!out.randomnessFulfilled, "fulfilled invented");
        require(out.randomnessRoot == bytes32(0), "root invented");
        require(!out.settlementAvailable, "settlement invented");
    }
}
