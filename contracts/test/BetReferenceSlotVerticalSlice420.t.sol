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
import "../src/bet/RandomnessRouter420.sol";
import "../src/bet/ReferenceSlotV1420.sol";
import "../src/bet/RiskManager420.sol";
import "../src/bet/SettlementEngine420.sol";
import "../src/bet/SlotRandomStream420.sol";
import "../src/bet/VaultAccounting420.sol";
import "../src/bet/WagerRouter420.sol";
import "../src/bet/WithdrawalQueue420.sol";

interface VmBetReferenceSlotVerticalSlice420 { function prank(address) external; }

contract MockCapabilityRegistryBetReferenceSlotVerticalSlice420 is ICapabilityRegistry420 {
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

contract MockBetReferenceSlotVerticalSliceToken420 {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
    function approve(address spender, uint256 amount) external returns (bool) { allowance[msg.sender][spender] = amount; return true; }
    function transfer(address to, uint256 amount) external returns (bool) {
        if (balanceOf[msg.sender] < amount) return false;
        balanceOf[msg.sender] -= amount; balanceOf[to] += amount; return true;
    }
    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        if (balanceOf[from] < amount || allowance[from][msg.sender] < amount) return false;
        allowance[from][msg.sender] -= amount; balanceOf[from] -= amount; balanceOf[to] += amount; return true;
    }
}

contract BetReferenceSlotVerticalSlice420Test {
    VmBetReferenceSlotVerticalSlice420 constant vm = VmBetReferenceSlotVerticalSlice420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address constant ADMIN = address(0xA11CE);
    address constant LP = address(0xB0B);
    address constant PLAYER = address(0xC0FFEE);
    address constant OPERATOR_ACCOUNT = address(0x0B0B);
    address constant RANDOMNESS_PROVIDER = address(0x1111);
    address constant REQUESTER = address(0x2222);
    address constant SETTLER = address(0x3333);

    bytes32 constant VAULT = keccak256("420BET.VAULT.CADC.SLOT.1");
    bytes32 constant MODULE = keccak256("420BET.MODULE.SLOT");
    bytes32 constant MODULE_V1 = keccak256("420BET.MODULE.SLOT.REFERENCE.V1");
    bytes32 constant GAME = keccak256("420BET.GAME.SLOT");
    bytes32 constant GAME_V1 = keccak256("420BET.GAME.SLOT.V1");
    bytes32 constant OPERATOR = keccak256("420BET.OPERATOR.SLOT.1");
    bytes32 constant RANDOMNESS = keccak256("profile/slot/randomness/v1");
    bytes32 constant RISK = keccak256("profile/slot/risk/v1");
    bytes32 constant SETTLEMENT = keccak256("profile/slot/settlement/v1");
    bytes32 constant ACCESS = keccak256("profile/slot/access/v1");
    bytes32 constant RULESET = keccak256("420BET.RULESET.SLOT.REFERENCE.V1");
    bytes32 constant FEE_SCHEDULE = keccak256("fees/slot/v1");

    struct Suite {
        MockCapabilityRegistryBetReferenceSlotVerticalSlice420 caps;
        BetAuthorization420 auth;
        BetModuleRegistry420 modules;
        BetProfileRegistry420 profiles;
        BetAccessPolicy420 access;
        BetOperatorRegistry420 operators;
        BetGameRegistry420 games;
        VaultAccounting420 accounting;
        WithdrawalQueue420 queue;
        MockBetReferenceSlotVerticalSliceToken420 token;
        BankrollVault420 vault;
        BetEconomics420 economics;
        RiskManager420 risk;
        BetRegistry420 registry;
        WagerRouter420 wagerRouter;
        RandomnessRouter420 randomness;
        SlotRandomStream420 stream;
        ReferenceSlotV1420 slot;
        SettlementEngine420 settlement;
    }

    function _allow(Suite memory s, address principal, bytes32 action, bytes32 scope) private {
        s.caps.setAllowed(principal, BetIds420.COMPONENT_BET, action, scope, true);
    }

    function _params() private pure returns (ReferenceSlotV1420.Params memory p) {
        for (uint16 pos = 0; pos < 32; ++pos) {
            for (uint8 reel = 0; reel < 5; ++reel) {
                p.baseReels[pos][reel] = uint8((uint256(pos) + reel) % 7);
                p.featureReels[pos][reel] = uint8((uint256(pos) + reel + 2) % 7);
            }
        }
        p.payoutPerWay[0] = 10 ether;
        p.payoutPerWay[1] = 15 ether;
        p.payoutPerWay[2] = 20 ether;
        p.payoutPerWay[3] = 30 ether;
        p.payoutPerWay[4] = 50 ether;
        p.scatter3 = 100 ether;
        p.scatter4 = 250 ether;
        p.scatter5 = 500 ether;
        p.maxGrossPayout = 5_000 ether;
    }

    function _deploy() private returns (Suite memory s) {
        s.caps = new MockCapabilityRegistryBetReferenceSlotVerticalSlice420();
        s.auth = new BetAuthorization420(address(s.caps));
        s.modules = new BetModuleRegistry420(address(s.auth));
        s.profiles = new BetProfileRegistry420(address(s.auth));
        s.access = new BetAccessPolicy420(address(s.auth), address(s.profiles));
        s.operators = new BetOperatorRegistry420(address(s.auth));
        s.games = new BetGameRegistry420(address(s.auth), address(s.modules), address(s.profiles));
        s.accounting = new VaultAccounting420(address(s.auth));
        s.queue = new WithdrawalQueue420(address(s.auth));
        s.token = new MockBetReferenceSlotVerticalSliceToken420();
        s.vault = new BankrollVault420(VAULT, address(s.token), address(s.auth), address(s.accounting), address(s.queue), 1 days);
        s.economics = new BetEconomics420(address(s.auth), address(s.operators), address(s.token));
        s.risk = new RiskManager420(address(s.auth), address(s.profiles), address(s.accounting));
        s.registry = new BetRegistry420(address(s.auth));
        s.wagerRouter = new WagerRouter420(address(s.auth), address(s.games), address(s.modules), address(s.operators), address(s.profiles), address(s.access), address(s.economics), address(s.risk), address(s.registry), address(s.vault));
        s.randomness = new RandomnessRouter420(address(s.auth), address(s.profiles), address(s.registry));
        s.stream = new SlotRandomStream420();
        s.slot = new ReferenceSlotV1420(address(s.registry), address(s.randomness), address(s.stream), GAME, GAME_V1, RULESET);
        s.settlement = new SettlementEngine420(address(s.auth), address(s.registry), address(s.risk), address(s.vault), address(s.economics));

        _allow(s, ADMIN, BetIds420.ACTION_VAULT_REGISTER, s.auth.scopeForVault(VAULT));
        vm.prank(ADMIN); s.accounting.registerVault(VAULT, address(s.token));
        _allow(s, address(s.vault), BetIds420.ACTION_VAULT_RECORD_DEPOSIT, s.auth.scopeForVault(VAULT));
        _allow(s, address(s.vault), BetIds420.ACTION_VAULT_SETTLE_WAGER, s.auth.scopeForVault(VAULT));
        _allow(s, address(s.risk), BetIds420.ACTION_VAULT_RESERVE_LIABILITY, s.auth.scopeForVault(VAULT));
        _allow(s, address(s.risk), BetIds420.ACTION_VAULT_RELEASE_LIABILITY, s.auth.scopeForVault(VAULT));

        _seedProfiles(s); _seedAccess(s); _seedModuleGameOperator(s); _seedEconomics(s); _seedRisk(s); _seedRandomness(s); _seedLiquidity(s, 20_000 ether);

        _allow(s, address(s.wagerRouter), BetIds420.ACTION_ACCESS_RECORD, s.auth.scopeForProfile(ACCESS));
        _allow(s, address(s.wagerRouter), BetIds420.ACTION_ECONOMICS_BIND, s.auth.scopeForGameVersion(GAME_V1));
        _allow(s, address(s.wagerRouter), BetIds420.ACTION_VAULT_ESCROW_STAKE, s.auth.scopeForVault(VAULT));
        _allow(s, address(s.wagerRouter), BetIds420.ACTION_RISK_RESERVE, s.auth.scopeForVault(VAULT));
        _allow(s, address(s.wagerRouter), BetIds420.ACTION_WAGER_RECORD, s.auth.scopeForVault(VAULT));
        _allow(s, address(s.settlement), BetIds420.ACTION_RISK_RELEASE, s.auth.scopeForVault(VAULT));
        _allow(s, address(s.settlement), BetIds420.ACTION_VAULT_SETTLE_WAGER, s.auth.scopeForVault(VAULT));
        _allow(s, address(s.settlement), BetIds420.ACTION_ECONOMICS_FINALIZE, s.auth.scopeForGameVersion(GAME_V1));
    }

    function _registerProfile(Suite memory s, bytes32 id, bytes32 profileType) private {
        _allow(s, ADMIN, BetIds420.ACTION_PROFILE_REGISTER, s.auth.scopeForProfile(id));
        vm.prank(ADMIN); s.profiles.registerProfile(id, profileType, keccak256(abi.encode("manifest", id)), keccak256(abi.encode("artifact", id)));
    }

    function _seedProfiles(Suite memory s) private {
        _registerProfile(s, RANDOMNESS, keccak256("RANDOMNESS")); _registerProfile(s, RISK, keccak256("RISK")); _registerProfile(s, SETTLEMENT, keccak256("SETTLEMENT")); _registerProfile(s, ACCESS, keccak256("ACCESS"));
    }

    function _seedAccess(Suite memory s) private {
        _allow(s, ADMIN, BetIds420.ACTION_ACCESS_CONFIGURE, s.auth.scopeForProfile(ACCESS));
        bytes32[] memory requirements = new bytes32[](0);
        vm.prank(ADMIN); s.access.configurePolicy(ACCESS, address(s.token), address(0), requirements, 0, 0, 0, keccak256("slot-access-policy"));
    }

    function _seedEconomics(Suite memory s) private {
        _allow(s, ADMIN, BetIds420.ACTION_ECONOMICS_CONFIGURE, s.auth.scopeForGameVersion(GAME_V1));
        vm.prank(ADMIN); s.economics.configureFeeSchedule(BetEconomics420.FeeSchedule({scheduleId:FEE_SCHEDULE,gameVersionId:GAME_V1,protocolFeeBps:0,operatorFeeBps:0,protocolRecipient:address(0),manifestHash:keccak256("fees/slot/v1"),exists:false}));
    }

    function _seedModuleGameOperator(Suite memory s) private {
        bytes32 moduleScope = s.auth.scopeForModule(MODULE, MODULE_V1);
        _allow(s, ADMIN, BetIds420.ACTION_MODULE_REGISTER, moduleScope); _allow(s, ADMIN, BetIds420.ACTION_MODULE_APPROVE, moduleScope);
        vm.prank(ADMIN); s.modules.registerModule(MODULE, MODULE_V1, address(s.slot), keccak256("slot-module-manifest"), keccak256("slot-module-code"));
        vm.prank(ADMIN); s.modules.approve(MODULE_V1);

        bytes32 operatorScope = s.auth.scopeForOperator(OPERATOR);
        _allow(s, ADMIN, BetIds420.ACTION_OPERATOR_REGISTER, operatorScope); _allow(s, ADMIN, BetIds420.ACTION_OPERATOR_ACTIVATE, operatorScope);
        vm.prank(ADMIN); s.operators.registerOperator(OPERATOR, OPERATOR_ACCOUNT, keccak256("slot-operator-manifest"));
        vm.prank(ADMIN); s.operators.activate(OPERATOR);

        bytes32 gameScope = s.auth.scopeForGame(GAME, GAME_V1);
        _allow(s, ADMIN, BetIds420.ACTION_GAME_REGISTER, gameScope); _allow(s, ADMIN, BetIds420.ACTION_GAME_ACTIVATE, gameScope);
        BetGameRegistry420.GameVersion memory game = BetGameRegistry420.GameVersion({gameId:GAME,gameVersionId:GAME_V1,moduleVersionId:MODULE_V1,rulesetId:RULESET,randomnessProfileId:RANDOMNESS,riskProfileId:RISK,settlementProfileId:SETTLEMENT,accessPolicyId:ACCESS,manifestHash:keccak256("slot-game-manifest"),productClass:BetTypes420.ProductClass.CASINO,gameMode:BetTypes420.GameMode.INSTANT,registeredAt:0,status:BetGameRegistry420.GameStatus.NONE,exists:false});
        vm.prank(ADMIN); s.games.registerGame(game); vm.prank(ADMIN); s.games.activate(GAME_V1);
    }

    function _seedRisk(Suite memory s) private {
        _allow(s, ADMIN, BetIds420.ACTION_RISK_CONFIGURE, s.auth.scopeForProfile(RISK));
        RiskManager420.RiskProfile memory p = RiskManager420.RiskProfile({profileId:RISK,maxStakePerWager:200 ether,maxGrossPayoutPerWager:5_000 ether,maxReservedLiabilityPerWager:4_900 ether,maxReservedLiabilityPerGame:15_000 ether,maxReservedLiabilityPerVault:15_000 ether,maxReservedLiabilityPerCorrelationKey:4_900 ether,manifestHash:keccak256("slot-risk-terms"),exists:false});
        vm.prank(ADMIN); s.risk.configureProfile(p);
    }

    function _seedRandomness(Suite memory s) private {
        _allow(s, ADMIN, BetIds420.ACTION_RANDOMNESS_CONFIGURE, s.auth.scopeForProfile(RANDOMNESS));
        RandomnessRouter420.RandomnessProfile memory p = RandomnessRouter420.RandomnessProfile({profileId:RANDOMNESS,method:RandomnessRouter420.Method.THRESHOLD_VRF,primaryProvider:RANDOMNESS_PROVIDER,fallbackProvider:address(0),fallbackDelay:100,securityLevelHash:keccak256("slot-security"),domainSeparator:keccak256("slot-randomness-domain"),manifestHash:keccak256("slot-randomness-manifest"),exists:false});
        vm.prank(ADMIN); s.randomness.configureProfile(p);
    }

    function _seedLiquidity(Suite memory s, uint256 amount) private {
        _allow(s, LP, BetIds420.ACTION_LP_DEPOSIT, s.auth.scopeForVault(VAULT)); s.token.mint(LP, amount);
        vm.prank(LP); s.token.approve(address(s.vault), amount); vm.prank(LP); s.vault.depositToken(amount);
    }

    function testReferenceSlotEndToEndVerticalSlice() public {
        uint256 stake = 100 ether;
        Suite memory s = _deploy();
        ReferenceSlotV1420.Params memory params = _params();
        uint256 maxGross = s.slot.requiredMaxGrossPayout(stake, params);
        require(maxGross == 5_000 ether, "unexpected max gross");

        _allow(s, PLAYER, BetIds420.ACTION_PLACE, s.auth.scopeForGame(GAME, GAME_V1));
        s.token.mint(PLAYER, stake); vm.prank(PLAYER); s.token.approve(address(s.vault), stake);

        WagerRouter420.AcceptanceRequest memory request = WagerRouter420.AcceptanceRequest({operatorId:OPERATOR,gameVersionId:GAME_V1,stake:stake,maxGrossPayout:maxGross,paramsHash:s.slot.hashParams(params),correlationKey:keccak256("slot/e2e/reference-v1"),deadline:uint64(block.timestamp + 1 hours)});
        vm.prank(PLAYER); (bytes32 wagerId, uint256 reservedLiability) = s.wagerRouter.placeWager(request);
        require(wagerId != bytes32(0), "wager id");
        require(reservedLiability == 4_900 ether, "full liability not reserved");
        require(s.vault.wagerStakeEscrow(wagerId) == stake, "stake not escrowed");
        require(s.accounting.getVault(VAULT).activeReservedLiability == reservedLiability, "reserve missing");

        _allow(s, REQUESTER, BetIds420.ACTION_RANDOMNESS_REQUEST, s.auth.scopeForWager(wagerId)); vm.prank(REQUESTER); s.randomness.requestRandomness(wagerId, keccak256("slot/spin/0"));
        _allow(s, RANDOMNESS_PROVIDER, BetIds420.ACTION_RANDOMNESS_FULFILL, s.auth.scopeForWager(wagerId)); vm.prank(RANDOMNESS_PROVIDER);
        bytes32 root = s.randomness.fulfillPrimary(wagerId, keccak256("slot/e2e/entropy"), keccak256("slot/e2e/proof"));
        require(root != bytes32(0), "root missing");

        ReferenceSlotV1420.Result memory result = s.slot.resolve(wagerId, params);
        require(result.randomnessRoot == root, "root mismatch");
        require(result.paramsHash == request.paramsHash, "params mismatch");
        require(result.grossPayout <= maxGross, "cap escaped");
        require(result.freeSpinsPlayed <= 12, "feature unbounded");
        require(result.retriggers <= 2, "retrigger unbounded");
        for (uint8 i = 0; i < 5; ++i) require(result.baseStops[i] < 32, "stop out of range");
        for (uint8 i = 0; i < 20; ++i) require(result.baseGrid[i] < 7, "symbol out of range");

        if (result.grossPayout == 0) require(result.outcome == BetTypes420.TerminalOutcome.LOSS, "loss mismatch");
        else if (result.grossPayout == stake) require(result.outcome == BetTypes420.TerminalOutcome.PUSH, "push mismatch");
        else require(result.outcome == BetTypes420.TerminalOutcome.WIN, "win mismatch");

        _allow(s, SETTLER, BetIds420.ACTION_SETTLE, s.auth.scopeForWager(wagerId));
        _allow(s, address(s.settlement), BetIds420.ACTION_WAGER_SETTLE_RECORD, s.auth.scopeForWager(wagerId));
        vm.prank(SETTLER); s.settlement.settle(wagerId, result.outcome, result.grossPayout);

        BetTypes420.Settlement memory terminal = s.registry.getSettlement(wagerId);
        require(terminal.outcome == result.outcome, "terminal outcome mismatch");
        require(terminal.grossPayout == result.grossPayout, "terminal payout mismatch");
        require(s.vault.wagerStakeEscrow(wagerId) == 0, "stake stranded");
        require(s.vault.activeWagerStakeEscrow() == 0, "aggregate escrow stranded");
        require(s.accounting.getVault(VAULT).activeReservedLiability == 0, "liability stranded");
        require(s.economics.getWagerFee(wagerId).finalized, "fees not finalized");
        require(s.token.balanceOf(PLAYER) == result.grossPayout, "player payout mismatch");

        ReferenceSlotV1420.Result memory replay = s.slot.resolve(wagerId, params);
        require(replay.basePayout == result.basePayout, "replay base payout changed");
        require(replay.featurePayout == result.featurePayout, "replay feature payout changed");
        require(replay.grossPayout == result.grossPayout, "replay gross changed");
        require(replay.freeSpinsPlayed == result.freeSpinsPlayed, "replay free spins changed");
        require(replay.retriggers == result.retriggers, "replay retriggers changed");
        require(replay.capped == result.capped, "replay cap changed");
        require(replay.outcome == result.outcome, "replay outcome changed");
        require(replay.randomnessRoot == result.randomnessRoot, "replay root changed");
        for (uint8 i = 0; i < 5; ++i) require(replay.baseStops[i] == result.baseStops[i], "replay stop changed");
        for (uint8 i = 0; i < 20; ++i) require(replay.baseGrid[i] == result.baseGrid[i], "replay grid changed");
    }
}
