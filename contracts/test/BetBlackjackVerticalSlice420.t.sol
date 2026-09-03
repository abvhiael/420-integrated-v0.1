// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/interfaces/genesis/ICapabilityRegistry420.sol";
import "../src/bet/BankrollVault420.sol";
import "../src/bet/BetAccessPolicy420.sol";
import "../src/bet/BetAuthorization420.sol";
import "../src/bet/BetEconomics420.sol";
import "../src/bet/BetGameRegistry420.sol";
import "../src/bet/BetIds420.sol";
import "../src/bet/BetModuleRegistry420.sol";
import "../src/bet/BetOperatorRegistry420.sol";
import "../src/bet/BetProfileRegistry420.sol";
import "../src/bet/BetRegistry420.sol";
import "../src/bet/BetTypes420.sol";
import "../src/bet/BlackjackV1420.sol";
import "../src/bet/RandomnessRouter420.sol";
import "../src/bet/RiskManager420.sol";
import "../src/bet/SettlementEngine420.sol";
import "../src/bet/VaultAccounting420.sol";
import "../src/bet/WagerRouter420.sol";
import "../src/bet/WithdrawalQueue420.sol";

interface VmBetBlackjackVerticalSlice420 {
    function prank(address) external;
}

contract MockCapabilityRegistryBetBlackjackVerticalSlice420 is ICapabilityRegistry420 {
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

contract MockBetBlackjackVerticalSliceToken420 {
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

contract BetBlackjackVerticalSlice420Test {
    VmBetBlackjackVerticalSlice420 constant vm = VmBetBlackjackVerticalSlice420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address constant ADMIN = address(0xA11CE);
    address constant LP = address(0xB0B);
    address constant PLAYER = address(0xC0FFEE);
    address constant OPERATOR_ACCOUNT = address(0x0B0B);
    address constant RANDOMNESS_PROVIDER = address(0x1111);
    address constant REQUESTER = address(0x2222);
    address constant SETTLER = address(0x3333);

    bytes32 constant VAULT = keccak256("420BET.VAULT.CADC.BLACKJACK.1");
    bytes32 constant MODULE = keccak256("420BET.MODULE.BLACKJACK");
    bytes32 constant MODULE_V1 = keccak256("420BET.MODULE.BLACKJACK.V1");
    bytes32 constant GAME = keccak256("420BET.GAME.BLACKJACK");
    bytes32 constant GAME_V1 = keccak256("420BET.GAME.BLACKJACK.V1");
    bytes32 constant OPERATOR = keccak256("420BET.OPERATOR.BLACKJACK.1");
    bytes32 constant RANDOMNESS = keccak256("profile/blackjack/randomness/v1");
    bytes32 constant RISK = keccak256("profile/blackjack/risk/v1");
    bytes32 constant SETTLEMENT = keccak256("profile/blackjack/settlement/v1");
    bytes32 constant ACCESS = keccak256("profile/blackjack/access/v1");
    bytes32 constant RULESET = keccak256("ruleset/blackjack/enhc-s17-hit-stand/v1");
    bytes32 constant FEE_SCHEDULE = keccak256("fees/blackjack/v1");

    struct Suite {
        MockCapabilityRegistryBetBlackjackVerticalSlice420 caps;
        BetAuthorization420 auth;
        BetModuleRegistry420 modules;
        BetProfileRegistry420 profiles;
        BetAccessPolicy420 access;
        BetOperatorRegistry420 operators;
        BetGameRegistry420 games;
        VaultAccounting420 accounting;
        WithdrawalQueue420 queue;
        MockBetBlackjackVerticalSliceToken420 token;
        BankrollVault420 vault;
        BetEconomics420 economics;
        RiskManager420 risk;
        BetRegistry420 registry;
        WagerRouter420 wagerRouter;
        RandomnessRouter420 randomness;
        BlackjackV1420 blackjack;
        SettlementEngine420 settlement;
    }

    function _allow(Suite memory s, address principal, bytes32 action, bytes32 scope) private {
        s.caps.setAllowed(principal, BetIds420.COMPONENT_BET, action, scope, true);
    }

    function _deploy() private returns (Suite memory s) {
        s.caps = new MockCapabilityRegistryBetBlackjackVerticalSlice420();
        s.auth = new BetAuthorization420(address(s.caps));
        s.modules = new BetModuleRegistry420(address(s.auth));
        s.profiles = new BetProfileRegistry420(address(s.auth));
        s.access = new BetAccessPolicy420(address(s.auth), address(s.profiles));
        s.operators = new BetOperatorRegistry420(address(s.auth));
        s.games = new BetGameRegistry420(address(s.auth), address(s.modules), address(s.profiles));
        s.accounting = new VaultAccounting420(address(s.auth));
        s.queue = new WithdrawalQueue420(address(s.auth));
        s.token = new MockBetBlackjackVerticalSliceToken420();
        s.vault = new BankrollVault420(VAULT, address(s.token), address(s.auth), address(s.accounting), address(s.queue), 1 days);
        s.economics = new BetEconomics420(address(s.auth), address(s.operators), address(s.token));
        s.risk = new RiskManager420(address(s.auth), address(s.profiles), address(s.accounting));
        s.registry = new BetRegistry420(address(s.auth));
        s.wagerRouter = new WagerRouter420(
            address(s.auth), address(s.games), address(s.modules), address(s.operators), address(s.profiles),
            address(s.access), address(s.economics), address(s.risk), address(s.registry), address(s.vault)
        );
        s.randomness = new RandomnessRouter420(address(s.auth), address(s.profiles), address(s.registry));
        s.blackjack = new BlackjackV1420(address(s.registry), address(s.randomness), GAME, GAME_V1, RULESET);
        s.settlement = new SettlementEngine420(
            address(s.auth), address(s.registry), address(s.risk), address(s.vault), address(s.economics)
        );

        _allow(s, ADMIN, BetIds420.ACTION_VAULT_REGISTER, s.auth.scopeForVault(VAULT));
        vm.prank(ADMIN);
        s.accounting.registerVault(VAULT, address(s.token));
        _allow(s, address(s.vault), BetIds420.ACTION_VAULT_RECORD_DEPOSIT, s.auth.scopeForVault(VAULT));
        _allow(s, address(s.vault), BetIds420.ACTION_VAULT_SETTLE_WAGER, s.auth.scopeForVault(VAULT));
        _allow(s, address(s.risk), BetIds420.ACTION_VAULT_RESERVE_LIABILITY, s.auth.scopeForVault(VAULT));
        _allow(s, address(s.risk), BetIds420.ACTION_VAULT_RELEASE_LIABILITY, s.auth.scopeForVault(VAULT));

        _seedProfiles(s);
        _seedAccess(s);
        _seedModuleGameOperator(s);
        _seedEconomics(s);
        _seedRisk(s);
        _seedRandomness(s);
        _seedLiquidity(s, 1_000 ether);

        _allow(s, address(s.wagerRouter), BetIds420.ACTION_ACCESS_RECORD, s.auth.scopeForProfile(ACCESS));
        _allow(s, address(s.wagerRouter), BetIds420.ACTION_ECONOMICS_BIND, s.auth.scopeForGameVersion(GAME_V1));
        _allow(s, address(s.wagerRouter), BetIds420.ACTION_VAULT_ESCROW_STAKE, s.auth.scopeForVault(VAULT));
        _allow(s, address(s.wagerRouter), BetIds420.ACTION_RISK_RESERVE, s.auth.scopeForVault(VAULT));
        _allow(s, address(s.wagerRouter), BetIds420.ACTION_WAGER_RECORD, s.auth.scopeForVault(VAULT));
        _allow(s, address(s.settlement), BetIds420.ACTION_RISK_RELEASE, s.auth.scopeForVault(VAULT));
        _allow(s, address(s.settlement), BetIds420.ACTION_VAULT_SETTLE_WAGER, s.auth.scopeForVault(VAULT));
        _allow(s, address(s.settlement), BetIds420.ACTION_ECONOMICS_FINALIZE, s.auth.scopeForGameVersion(GAME_V1));
    }

    function _seedProfiles(Suite memory s) private {
        _registerProfile(s, RANDOMNESS, keccak256("RANDOMNESS"));
        _registerProfile(s, RISK, keccak256("RISK"));
        _registerProfile(s, SETTLEMENT, keccak256("SETTLEMENT"));
        _registerProfile(s, ACCESS, keccak256("ACCESS"));
    }

    function _seedAccess(Suite memory s) private {
        _allow(s, ADMIN, BetIds420.ACTION_ACCESS_CONFIGURE, s.auth.scopeForProfile(ACCESS));
        bytes32[] memory requirements = new bytes32[](0);
        vm.prank(ADMIN);
        s.access.configurePolicy(ACCESS, address(s.token), address(0), requirements, 0, 0, 0, keccak256("blackjack-access-policy"));
    }

    function _seedEconomics(Suite memory s) private {
        _allow(s, ADMIN, BetIds420.ACTION_ECONOMICS_CONFIGURE, s.auth.scopeForGameVersion(GAME_V1));
        vm.prank(ADMIN);
        s.economics.configureFeeSchedule(BetEconomics420.FeeSchedule({
            scheduleId: FEE_SCHEDULE,
            gameVersionId: GAME_V1,
            protocolFeeBps: 0,
            operatorFeeBps: 0,
            protocolRecipient: address(0),
            manifestHash: keccak256("fees/blackjack/v1"),
            exists: false
        }));
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
        s.modules.registerModule(MODULE, MODULE_V1, address(s.blackjack), keccak256("blackjack-module-manifest"), keccak256("blackjack-module-code"));
        vm.prank(ADMIN);
        s.modules.approve(MODULE_V1);

        bytes32 operatorScope = s.auth.scopeForOperator(OPERATOR);
        _allow(s, ADMIN, BetIds420.ACTION_OPERATOR_REGISTER, operatorScope);
        _allow(s, ADMIN, BetIds420.ACTION_OPERATOR_ACTIVATE, operatorScope);
        vm.prank(ADMIN);
        s.operators.registerOperator(OPERATOR, OPERATOR_ACCOUNT, keccak256("blackjack-operator-manifest"));
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
            manifestHash: keccak256("blackjack-game-manifest"),
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
            maxGrossPayoutPerWager: 500 ether,
            maxReservedLiabilityPerWager: 400 ether,
            maxReservedLiabilityPerGame: 800 ether,
            maxReservedLiabilityPerVault: 800 ether,
            maxReservedLiabilityPerCorrelationKey: 500 ether,
            manifestHash: keccak256("blackjack-risk-terms"),
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
            securityLevelHash: keccak256("blackjack-security"),
            domainSeparator: keccak256("blackjack-randomness-domain"),
            manifestHash: keccak256("blackjack-randomness-manifest"),
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

    function _chain(uint8 n, uint256 seed) private pure returns (bytes32 head, bytes32[24] memory secrets) {
        require(n > 0 && n <= 24, "n");
        secrets[n - 1] = bytes32(seed);
        for (uint8 i = n - 1; i > 0; --i) {
            secrets[i - 1] = keccak256(abi.encode(secrets[i]));
        }
        head = keccak256(abi.encode(secrets[0]));
    }

    function testBlackjackEndToEndVerticalSlice() public {
        uint256 stake = 100 ether;
        Suite memory s = _deploy();
        BlackjackV1420.Params memory params = BlackjackV1420.Params({rulesVersion: 1});
        uint256 maxGross = s.blackjack.requiredMaxGrossPayout(stake);

        _allow(s, PLAYER, BetIds420.ACTION_PLACE, s.auth.scopeForGame(GAME, GAME_V1));
        s.token.mint(PLAYER, stake);
        vm.prank(PLAYER);
        s.token.approve(address(s.vault), stake);

        WagerRouter420.AcceptanceRequest memory request = WagerRouter420.AcceptanceRequest({
            operatorId: OPERATOR,
            gameVersionId: GAME_V1,
            stake: stake,
            maxGrossPayout: maxGross,
            paramsHash: s.blackjack.hashParams(params),
            correlationKey: keccak256("blackjack/e2e/stand"),
            deadline: uint64(block.timestamp + 1 hours)
        });

        vm.prank(PLAYER);
        (bytes32 wagerId, uint256 reservedLiability) = s.wagerRouter.placeWager(request);
        require(wagerId != bytes32(0), "wager id");
        require(reservedLiability == 150 ether, "liability");
        require(s.vault.wagerStakeEscrow(wagerId) == stake, "stake not escrowed");
        require(s.accounting.getVault(VAULT).activeReservedLiability == reservedLiability, "reserve missing");

        _allow(s, REQUESTER, BetIds420.ACTION_RANDOMNESS_REQUEST, s.auth.scopeForWager(wagerId));
        vm.prank(REQUESTER);
        s.randomness.requestRandomness(wagerId, keccak256("blackjack/hand/0"));

        _allow(s, RANDOMNESS_PROVIDER, BetIds420.ACTION_RANDOMNESS_FULFILL, s.auth.scopeForWager(wagerId));
        (bytes32 head, bytes32[24] memory secrets) = _chain(24, 420424);
        vm.prank(RANDOMNESS_PROVIDER);
        s.blackjack.commitDrawStream(wagerId, RandomnessRouter420.Source.PRIMARY, head, 24);

        vm.prank(RANDOMNESS_PROVIDER);
        bytes32 root = s.randomness.fulfillPrimary(wagerId, keccak256("blackjack/e2e/entropy"), keccak256("blackjack/e2e/proof"));
        require(root != bytes32(0), "root missing");

        s.blackjack.startHand(wagerId, params);
        uint8 next;
        for (; next < 3; ++next) {
            vm.prank(RANDOMNESS_PROVIDER);
            s.blackjack.revealNext(wagerId, secrets[next]);
        }

        BlackjackV1420.HandState memory hand = s.blackjack.getHand(wagerId);
        if (hand.phase == BlackjackV1420.Phase.PLAYER_TURN) {
            vm.prank(PLAYER);
            s.blackjack.stand(wagerId);
        }

        while (next < 24) {
            hand = s.blackjack.getHand(wagerId);
            if (hand.phase == BlackjackV1420.Phase.TERMINAL) break;
            require(hand.pendingPurpose != BlackjackV1420.DrawPurpose.NONE, "non-terminal hand stalled");
            vm.prank(RANDOMNESS_PROVIDER);
            s.blackjack.revealNext(wagerId, secrets[next]);
            next += 1;
        }

        hand = s.blackjack.getHand(wagerId);
        require(hand.phase == BlackjackV1420.Phase.TERMINAL, "hand not terminal");
        require(
            hand.outcome == BetTypes420.TerminalOutcome.WIN ||
            hand.outcome == BetTypes420.TerminalOutcome.LOSS ||
            hand.outcome == BetTypes420.TerminalOutcome.PUSH,
            "invalid terminal outcome"
        );
        if (hand.outcome == BetTypes420.TerminalOutcome.LOSS) require(hand.grossPayout == 0, "loss payout");
        else if (hand.outcome == BetTypes420.TerminalOutcome.PUSH) require(hand.grossPayout == stake, "push payout");
        else require(hand.grossPayout == stake * 2 || hand.grossPayout == maxGross, "win payout");

        _allow(s, SETTLER, BetIds420.ACTION_SETTLE, s.auth.scopeForWager(wagerId));
        _allow(s, address(s.settlement), BetIds420.ACTION_WAGER_SETTLE_RECORD, s.auth.scopeForWager(wagerId));
        vm.prank(SETTLER);
        s.settlement.settle(wagerId, hand.outcome, hand.grossPayout);

        BetTypes420.Settlement memory terminal = s.registry.getSettlement(wagerId);
        require(terminal.outcome == hand.outcome, "terminal outcome mismatch");
        require(terminal.grossPayout == hand.grossPayout, "terminal payout mismatch");
        require(s.vault.wagerStakeEscrow(wagerId) == 0, "stake stranded");
        require(s.vault.activeWagerStakeEscrow() == 0, "aggregate escrow stranded");
        require(s.accounting.getVault(VAULT).activeReservedLiability == 0, "liability stranded");
        require(s.economics.getWagerFee(wagerId).finalized, "fees not finalized");
        require(s.token.balanceOf(PLAYER) == hand.grossPayout, "player payout mismatch");

        BlackjackV1420.HandState memory replay = s.blackjack.getHand(wagerId);
        require(replay.phase == BlackjackV1420.Phase.TERMINAL, "terminal state changed");
        require(replay.outcome == hand.outcome, "terminal outcome changed");
        require(replay.grossPayout == hand.grossPayout, "terminal payout changed");

        BlackjackV1420.StreamCommitment memory stream = s.blackjack.getStream(wagerId, RandomnessRouter420.Source.PRIMARY);
        require(stream.revealed <= stream.maxDraws, "stream bound");
    }
}
