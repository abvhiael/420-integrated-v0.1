// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/interfaces/genesis/ICapabilityRegistry420.sol";
import "../src/bet/BankrollVault420.sol";
import "../src/bet/BetAuthorization420.sol";
import "../src/bet/BetGameRegistry420.sol";
import "../src/bet/BetIds420.sol";
import "../src/bet/BetModuleRegistry420.sol";
import "../src/bet/BetOperatorRegistry420.sol";
import "../src/bet/BetProfileRegistry420.sol";
import "../src/bet/BetRegistry420.sol";
import "../src/bet/BetTypes420.sol";
import "../src/bet/DiceV1420.sol";
import "../src/bet/RandomnessRouter420.sol";
import "../src/bet/RiskManager420.sol";
import "../src/bet/SettlementEngine420.sol";
import "../src/bet/VaultAccounting420.sol";
import "../src/bet/WagerRouter420.sol";
import "../src/bet/WithdrawalQueue420.sol";

interface VmBetDiceVerticalSlice420 {
    function prank(address) external;
}

contract MockCapabilityRegistryBetDiceVerticalSlice420 is ICapabilityRegistry420 {
    mapping(bytes32 => CapabilityGrant) private _grants;
    mapping(bytes32 => bool) private _allowed;

    function setAllowed(address principal, bytes32 componentId, bytes32 capabilityId, bytes32 scopeHash, bool value) external {
        _allowed[keccak256(abi.encode(principal, componentId, capabilityId, scopeHash))] = value;
    }

    function grant(bytes32 grantId) external view returns (CapabilityGrant memory) { return _grants[grantId]; }

    function isAuthorized(address principal, bytes32 componentId, bytes32 capabilityId, bytes32 scopeHash, uint256)
        external view returns (bool)
    {
        return _allowed[keccak256(abi.encode(principal, componentId, capabilityId, scopeHash))];
    }
}

contract MockBetDiceVerticalSliceToken420 {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }
    function transfer(address to, uint256 amount) external returns (bool) {
        if (balanceOf[msg.sender] < amount) return false;
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }
    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        if (balanceOf[from] < amount || allowance[from][msg.sender] < amount) return false;
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract BetDiceVerticalSlice420Test {
    VmBetDiceVerticalSlice420 constant vm = VmBetDiceVerticalSlice420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address constant ADMIN = address(0xA11CE);
    address constant LP = address(0xB0B);
    address constant PLAYER = address(0xC0FFEE);
    address constant OPERATOR_ACCOUNT = address(0x0B0B);
    address constant RANDOMNESS_PROVIDER = address(0x1111);
    address constant REQUESTER = address(0x2222);
    address constant SETTLER = address(0x3333);

    bytes32 constant VAULT = keccak256("420BET.VAULT.CADC.1");
    bytes32 constant MODULE = keccak256("420BET.MODULE.DICE");
    bytes32 constant MODULE_V1 = keccak256("420BET.MODULE.DICE.V1");
    bytes32 constant GAME = keccak256("420BET.GAME.DICE");
    bytes32 constant GAME_V1 = keccak256("420BET.GAME.DICE.V1");
    bytes32 constant OPERATOR = keccak256("420BET.OPERATOR.1");
    bytes32 constant RANDOMNESS = keccak256("profile/randomness/v1");
    bytes32 constant RISK = keccak256("profile/risk/v1");
    bytes32 constant SETTLEMENT = keccak256("profile/settlement/v1");
    bytes32 constant ACCESS = keccak256("profile/access/v1");
    bytes32 constant RULESET = keccak256("ruleset/dice/v1");

    struct Suite {
        MockCapabilityRegistryBetDiceVerticalSlice420 caps;
        BetAuthorization420 auth;
        BetModuleRegistry420 modules;
        BetProfileRegistry420 profiles;
        BetOperatorRegistry420 operators;
        BetGameRegistry420 games;
        VaultAccounting420 accounting;
        WithdrawalQueue420 queue;
        MockBetDiceVerticalSliceToken420 token;
        BankrollVault420 vault;
        RiskManager420 risk;
        BetRegistry420 registry;
        WagerRouter420 wagerRouter;
        RandomnessRouter420 randomness;
        DiceV1420 dice;
        SettlementEngine420 settlement;
    }

    function _allow(Suite memory s, address principal, bytes32 action, bytes32 scope) private {
        s.caps.setAllowed(principal, BetIds420.COMPONENT_BET, action, scope, true);
    }

    function _deploy() private returns (Suite memory s) {
        s.caps = new MockCapabilityRegistryBetDiceVerticalSlice420();
        s.auth = new BetAuthorization420(address(s.caps));
        s.modules = new BetModuleRegistry420(address(s.auth));
        s.profiles = new BetProfileRegistry420(address(s.auth));
        s.operators = new BetOperatorRegistry420(address(s.auth));
        s.games = new BetGameRegistry420(address(s.auth), address(s.modules), address(s.profiles));
        s.accounting = new VaultAccounting420(address(s.auth));
        s.queue = new WithdrawalQueue420(address(s.auth));
        s.token = new MockBetDiceVerticalSliceToken420();
        s.vault = new BankrollVault420(VAULT, address(s.token), address(s.auth), address(s.accounting), address(s.queue), 1 days);
        s.risk = new RiskManager420(address(s.auth), address(s.profiles), address(s.accounting));
        s.registry = new BetRegistry420(address(s.auth));
        s.wagerRouter = new WagerRouter420(
            address(s.auth), address(s.games), address(s.modules), address(s.operators), address(s.profiles),
            address(s.risk), address(s.registry), address(s.vault)
        );
        s.randomness = new RandomnessRouter420(address(s.auth), address(s.profiles), address(s.registry));
        s.dice = new DiceV1420(address(s.registry), address(s.randomness), GAME, GAME_V1, RULESET);
        s.settlement = new SettlementEngine420(address(s.auth), address(s.registry), address(s.risk), address(s.vault));

        _allow(s, ADMIN, BetIds420.ACTION_VAULT_REGISTER, s.auth.scopeForVault(VAULT));
        vm.prank(ADMIN);
        s.accounting.registerVault(VAULT, address(s.token));
        _allow(s, address(s.vault), BetIds420.ACTION_VAULT_RECORD_DEPOSIT, s.auth.scopeForVault(VAULT));
        _allow(s, address(s.vault), BetIds420.ACTION_VAULT_SETTLE_WAGER, s.auth.scopeForVault(VAULT));
        _allow(s, address(s.risk), BetIds420.ACTION_VAULT_RESERVE_LIABILITY, s.auth.scopeForVault(VAULT));
        _allow(s, address(s.risk), BetIds420.ACTION_VAULT_RELEASE_LIABILITY, s.auth.scopeForVault(VAULT));

        _seedProfiles(s);
        _seedModuleGameOperator(s);
        _seedRisk(s);
        _seedRandomness(s);
        _seedLiquidity(s, 1_000 ether);

        _allow(s, address(s.wagerRouter), BetIds420.ACTION_VAULT_ESCROW_STAKE, s.auth.scopeForVault(VAULT));
        _allow(s, address(s.wagerRouter), BetIds420.ACTION_RISK_RESERVE, s.auth.scopeForVault(VAULT));
        _allow(s, address(s.wagerRouter), BetIds420.ACTION_WAGER_RECORD, s.auth.scopeForVault(VAULT));
        _allow(s, address(s.settlement), BetIds420.ACTION_RISK_RELEASE, s.auth.scopeForVault(VAULT));
        _allow(s, address(s.settlement), BetIds420.ACTION_VAULT_SETTLE_WAGER, s.auth.scopeForVault(VAULT));
    }

    function _seedProfiles(Suite memory s) private {
        _registerProfile(s, RANDOMNESS, keccak256("RANDOMNESS"));
        _registerProfile(s, RISK, keccak256("RISK"));
        _registerProfile(s, SETTLEMENT, keccak256("SETTLEMENT"));
        _registerProfile(s, ACCESS, keccak256("ACCESS"));
    }

    function _registerProfile(Suite memory s, bytes32 id, bytes32 profileType) private {
        _allow(s, ADMIN, BetIds420.ACTION_PROFILE_REGISTER, s.auth.scopeForProfile(id));
        vm.prank(ADMIN);
        s.profiles.registerProfile(id, profileType, keccak256(abi.encode("manifest", id)), keccak256(abi.encode("artifact", id)));
    }

    function _seedModuleGameOperator(Suite memory s) private {
        bytes32 moduleScope = s.auth.scopeForModule(MODULE, MODULE_V1);
        _allow(s, ADMIN, BetIds420.ACTION_MODULE_REGISTER, moduleScope);
        _allow(s, ADMIN, BetIds420.ACTION_MODULE_APPROVE, moduleScope);
        vm.prank(ADMIN);
        s.modules.registerModule(MODULE, MODULE_V1, address(s.dice), keccak256("module-manifest"), keccak256("module-code"));
        vm.prank(ADMIN);
        s.modules.approve(MODULE_V1);

        bytes32 operatorScope = s.auth.scopeForOperator(OPERATOR);
        _allow(s, ADMIN, BetIds420.ACTION_OPERATOR_REGISTER, operatorScope);
        _allow(s, ADMIN, BetIds420.ACTION_OPERATOR_ACTIVATE, operatorScope);
        vm.prank(ADMIN);
        s.operators.registerOperator(OPERATOR, OPERATOR_ACCOUNT, keccak256("operator-manifest"));
        vm.prank(ADMIN);
        s.operators.activate(OPERATOR);

        bytes32 gameScope = s.auth.scopeForGame(GAME, GAME_V1);
        _allow(s, ADMIN, BetIds420.ACTION_GAME_REGISTER, gameScope);
        _allow(s, ADMIN, BetIds420.ACTION_GAME_ACTIVATE, gameScope);
        BetGameRegistry420.GameVersion memory game = BetGameRegistry420.GameVersion({
            gameId: GAME,
            gameVersionId: GAME_V1,
            moduleVersionId: MODULE_V1,
            rulesetId: RULESET,
            randomnessProfileId: RANDOMNESS,
            riskProfileId: RISK,
            settlementProfileId: SETTLEMENT,
            accessPolicyId: ACCESS,
            manifestHash: keccak256("game-manifest"),
            productClass: BetTypes420.ProductClass.CASINO,
            gameMode: BetTypes420.GameMode.INSTANT,
            registeredAt: 0,
            status: BetGameRegistry420.GameStatus.NONE,
            exists: false
        });
        vm.prank(ADMIN);
        s.games.registerGame(game);
        vm.prank(ADMIN);
        s.games.activate(GAME_V1);
    }

    function _seedRisk(Suite memory s) private {
        _allow(s, ADMIN, BetIds420.ACTION_RISK_CONFIGURE, s.auth.scopeForProfile(RISK));
        RiskManager420.RiskProfile memory p = RiskManager420.RiskProfile({
            profileId: RISK,
            maxStakePerWager: 200 ether,
            maxGrossPayoutPerWager: 600 ether,
            maxReservedLiabilityPerWager: 500 ether,
            maxReservedLiabilityPerGame: 800 ether,
            maxReservedLiabilityPerVault: 800 ether,
            maxReservedLiabilityPerCorrelationKey: 600 ether,
            manifestHash: keccak256("risk-terms"),
            exists: false
        });
        vm.prank(ADMIN);
        s.risk.configureProfile(p);
    }

    function _seedRandomness(Suite memory s) private {
        _allow(s, ADMIN, BetIds420.ACTION_RANDOMNESS_CONFIGURE, s.auth.scopeForProfile(RANDOMNESS));
        RandomnessRouter420.RandomnessProfile memory p = RandomnessRouter420.RandomnessProfile({
            profileId: RANDOMNESS,
            method: RandomnessRouter420.Method.THRESHOLD_VRF,
            primaryProvider: RANDOMNESS_PROVIDER,
            fallbackProvider: address(0),
            fallbackDelay: 100,
            securityLevelHash: keccak256("security"),
            domainSeparator: keccak256("dice-randomness-domain"),
            manifestHash: keccak256("randomness-manifest"),
            exists: false
        });
        vm.prank(ADMIN);
        s.randomness.configureProfile(p);
    }

    function _seedLiquidity(Suite memory s, uint256 amount) private {
        _allow(s, LP, BetIds420.ACTION_LP_DEPOSIT, s.auth.scopeForVault(VAULT));
        s.token.mint(LP, amount);
        vm.prank(LP);
        s.token.approve(address(s.vault), amount);
        vm.prank(LP);
        s.vault.depositToken(amount);
    }

    function testDiceEndToEndVerticalSlice() public {
        uint256 stake = 100 ether;
        uint256 winGross = 190 ether;
        Suite memory s = _deploy();
        DiceV1420.Params memory params = DiceV1420.Params({rollUnder: true, threshold: 5000, winGrossPayout: winGross});

        _allow(s, PLAYER, BetIds420.ACTION_PLACE, s.auth.scopeForGame(GAME, GAME_V1));
        s.token.mint(PLAYER, stake);
        vm.prank(PLAYER);
        s.token.approve(address(s.vault), stake);

        WagerRouter420.AcceptanceRequest memory request = WagerRouter420.AcceptanceRequest({
            operatorId: OPERATOR,
            gameVersionId: GAME_V1,
            stake: stake,
            maxGrossPayout: winGross,
            paramsHash: s.dice.hashParams(params),
            correlationKey: keccak256("dice/e2e"),
            deadline: uint64(block.timestamp + 1 hours)
        });

        vm.prank(PLAYER);
        (bytes32 wagerId, uint256 reservedLiability) = s.wagerRouter.placeWager(request);
        require(reservedLiability == winGross - stake, "wrong reserved liability");
        require(s.vault.wagerStakeEscrow(wagerId) == stake, "stake not escrowed");
        require(s.accounting.getVault(VAULT).activeReservedLiability == reservedLiability, "liability not reserved");
        require(s.registry.getWager(wagerId).status == BetTypes420.WagerStatus.ACCEPTED, "wager not accepted");

        _allow(s, REQUESTER, BetIds420.ACTION_RANDOMNESS_REQUEST, s.auth.scopeForWager(wagerId));
        vm.prank(REQUESTER);
        s.randomness.requestRandomness(wagerId, keccak256("draw-context/dice/v1"));

        _allow(s, RANDOMNESS_PROVIDER, BetIds420.ACTION_RANDOMNESS_FULFILL, s.auth.scopeForWager(wagerId));
        vm.prank(RANDOMNESS_PROVIDER);
        bytes32 root = s.randomness.fulfillPrimary(wagerId, keccak256("dice-e2e-entropy"), keccak256("dice-e2e-proof"));
        require(root == s.randomness.rootOf(wagerId), "canonical root mismatch");

        DiceV1420.Result memory result = s.dice.resolve(wagerId, params);
        require(result.randomnessRoot == root, "dice used wrong root");
        require(result.paramsHash == request.paramsHash, "dice params mismatch");
        require(result.roll >= 1 && result.roll <= 10_000, "roll out of range");

        _allow(s, SETTLER, BetIds420.ACTION_SETTLE, s.auth.scopeForWager(wagerId));
        _allow(s, address(s.settlement), BetIds420.ACTION_WAGER_SETTLE_RECORD, s.auth.scopeForWager(wagerId));
        vm.prank(SETTLER);
        BetTypes420.Settlement memory finalSettlement = s.settlement.settle(wagerId, result.outcome, result.grossPayout);

        require(finalSettlement.wagerId == wagerId, "wrong settlement wager");
        require(finalSettlement.outcome == result.outcome, "outcome changed at settlement");
        require(finalSettlement.grossPayout == result.grossPayout, "payout changed at settlement");
        require(s.accounting.getVault(VAULT).activeReservedLiability == 0, "liability not released");
        require(s.vault.wagerStakeEscrow(wagerId) == 0, "stake escrow not cleared");
        require(s.vault.activeWagerStakeEscrow() == 0, "aggregate escrow not cleared");
        require(s.registry.settlementExists(wagerId), "settlement transcript missing");
        require(s.registry.getWager(wagerId).status == BetTypes420.WagerStatus.SETTLED, "wager not terminal");

        VaultAccounting420.VaultState memory vaultState = s.accounting.getVault(VAULT);
        if (result.outcome == BetTypes420.TerminalOutcome.WIN) {
            require(result.roll <= params.threshold, "win predicate mismatch");
            require(result.grossPayout == winGross, "wrong win payout");
            require(s.token.balanceOf(PLAYER) == winGross, "winner not paid");
            require(s.token.balanceOf(address(s.vault)) == 1_000 ether + stake - winGross, "win custody mismatch");
            require(vaultState.totalAssets == 1_000 ether - (winGross - stake), "win assets mismatch");
            require(vaultState.realizedPnl == -int256(winGross - stake), "win pnl mismatch");
        } else {
            require(result.outcome == BetTypes420.TerminalOutcome.LOSS, "unexpected outcome");
            require(result.roll > params.threshold, "loss predicate mismatch");
            require(result.grossPayout == 0, "loss payout nonzero");
            require(s.token.balanceOf(PLAYER) == 0, "loser retained stake");
            require(s.token.balanceOf(address(s.vault)) == 1_000 ether + stake, "loss custody mismatch");
            require(vaultState.totalAssets == 1_000 ether + stake, "loss assets mismatch");
            require(vaultState.realizedPnl == int256(stake), "loss pnl mismatch");
        }
    }
}
