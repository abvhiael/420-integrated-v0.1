// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/interfaces/genesis/ICapabilityRegistry420.sol";
import "../src/bet/BankrollVault420.sol";
import "../src/bet/BetAuthorization420.sol";
import "../src/bet/BetEconomics420.sol";
import "../src/bet/BetIds420.sol";
import "../src/bet/BetOperatorRegistry420.sol";
import "../src/bet/BetProfileRegistry420.sol";
import "../src/bet/BetRegistry420.sol";
import "../src/bet/BetTypes420.sol";
import "../src/bet/RiskManager420.sol";
import "../src/bet/SettlementEngine420.sol";
import "../src/bet/VaultAccounting420.sol";
import "../src/bet/WithdrawalQueue420.sol";
import "./BetVideoPokerSecureDraw.t.sol";

interface VmBetSettlement420 {
    function prank(address) external;
    function expectRevert(bytes4) external;
    function warp(uint256) external;
}

contract MockCapabilityRegistryBetSettlement420 is ICapabilityRegistry420 {
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

contract MockBetSettlementToken420 {
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

contract BetSettlementEngine420Test {
    VmBetSettlement420 constant vm = VmBetSettlement420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address constant ADMIN = address(0xA11CE);
    address constant LP = address(0xB0B);
    address constant PLAYER = address(0xC0FFEE);
    address constant SETTLER = address(0x5151);
    address constant OPERATOR_ACCOUNT = address(0x0B0B);

    bytes32 constant VAULT = keccak256("420BET.VAULT.CADC.1");
    bytes32 constant GAME = keccak256("420BET.GAME.DICE");
    bytes32 constant GAME_V1 = keccak256("420BET.GAME.DICE.V1");
    bytes32 constant OPERATOR = keccak256("420BET.OPERATOR.1");
    bytes32 constant RANDOMNESS = keccak256("profile/randomness/v1");
    bytes32 constant RISK = keccak256("profile/risk/v1");
    bytes32 constant SETTLEMENT = keccak256("profile/settlement/v1");
    bytes32 constant ACCESS = keccak256("profile/access/v1");
    bytes32 constant RULESET = keccak256("ruleset/dice/v1");
    bytes32 constant FEE_SCHEDULE = keccak256("fees/dice/v1");

    struct Suite {
        MockCapabilityRegistryBetSettlement420 caps;
        BetAuthorization420 auth;
        BetProfileRegistry420 profiles;
        BetOperatorRegistry420 operators;
        VaultAccounting420 accounting;
        WithdrawalQueue420 queue;
        MockBetSettlementToken420 token;
        BankrollVault420 vault;
        BetEconomics420 economics;
        RiskManager420 risk;
        BetRegistry420 registry;
        SettlementEngine420 engine;
    }

    function _allow(Suite memory s, address principal, bytes32 action, bytes32 scope) private {
        s.caps.setAllowed(principal, BetIds420.COMPONENT_BET, action, scope, true);
    }

    function _deploy() private returns (Suite memory s) {
        s.caps = new MockCapabilityRegistryBetSettlement420();
        s.auth = new BetAuthorization420(address(s.caps));
        s.profiles = new BetProfileRegistry420(address(s.auth));
        s.operators = new BetOperatorRegistry420(address(s.auth));
        s.accounting = new VaultAccounting420(address(s.auth));
        s.queue = new WithdrawalQueue420(address(s.auth));
        s.token = new MockBetSettlementToken420();
        s.vault = new BankrollVault420(VAULT, address(s.token), address(s.auth), address(s.accounting), address(s.queue), 1 days);
        s.economics = new BetEconomics420(address(s.auth), address(s.operators), address(s.token));
        s.risk = new RiskManager420(address(s.auth), address(s.profiles), address(s.accounting));
        s.registry = new BetRegistry420(address(s.auth));
        s.engine = new SettlementEngine420(
            address(s.auth), address(s.registry), address(s.risk), address(s.vault), address(s.economics)
        );

        _allow(s, ADMIN, BetIds420.ACTION_VAULT_REGISTER, s.auth.scopeForVault(VAULT));
        vm.prank(ADMIN);
        s.accounting.registerVault(VAULT, address(s.token));

        _allow(s, address(s.vault), BetIds420.ACTION_VAULT_RECORD_DEPOSIT, s.auth.scopeForVault(VAULT));
        _allow(s, address(s.vault), BetIds420.ACTION_VAULT_SETTLE_WAGER, s.auth.scopeForVault(VAULT));
        _allow(s, address(s.risk), BetIds420.ACTION_VAULT_RESERVE_LIABILITY, s.auth.scopeForVault(VAULT));
        _allow(s, address(s.risk), BetIds420.ACTION_VAULT_RELEASE_LIABILITY, s.auth.scopeForVault(VAULT));

        _allow(s, ADMIN, BetIds420.ACTION_PROFILE_REGISTER, s.auth.scopeForProfile(RISK));
        vm.prank(ADMIN);
        s.profiles.registerProfile(RISK, keccak256("RISK"), keccak256("risk-manifest"), keccak256("risk-artifact"));
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

        bytes32 operatorScope = s.auth.scopeForOperator(OPERATOR);
        _allow(s, ADMIN, BetIds420.ACTION_OPERATOR_REGISTER, operatorScope);
        _allow(s, ADMIN, BetIds420.ACTION_OPERATOR_ACTIVATE, operatorScope);
        vm.prank(ADMIN);
        s.operators.registerOperator(OPERATOR, OPERATOR_ACCOUNT, keccak256("operator-manifest"));
        vm.prank(ADMIN);
        s.operators.activate(OPERATOR);

        _allow(s, ADMIN, BetIds420.ACTION_ECONOMICS_CONFIGURE, s.auth.scopeForGameVersion(GAME_V1));
        vm.prank(ADMIN);
        s.economics.configureFeeSchedule(BetEconomics420.FeeSchedule({
            scheduleId: FEE_SCHEDULE,
            gameVersionId: GAME_V1,
            protocolFeeBps: 0,
            operatorFeeBps: 0,
            protocolRecipient: address(0),
            manifestHash: keccak256("fees/dice/v1"),
            exists: false
        }));

        _allow(s, LP, BetIds420.ACTION_LP_DEPOSIT, s.auth.scopeForVault(VAULT));
        s.token.mint(LP, 1_000 ether);
        vm.prank(LP);
        s.token.approve(address(s.vault), 1_000 ether);
        vm.prank(LP);
        s.vault.depositToken(1_000 ether);

        _allow(s, address(this), BetIds420.ACTION_VAULT_ESCROW_STAKE, s.auth.scopeForVault(VAULT));
        _allow(s, address(this), BetIds420.ACTION_RISK_RESERVE, s.auth.scopeForVault(VAULT));
        _allow(s, address(this), BetIds420.ACTION_WAGER_RECORD, s.auth.scopeForVault(VAULT));
        _allow(s, address(this), BetIds420.ACTION_ECONOMICS_BIND, s.auth.scopeForGameVersion(GAME_V1));
        _allow(s, address(s.engine), BetIds420.ACTION_RISK_RELEASE, s.auth.scopeForVault(VAULT));
        _allow(s, address(s.engine), BetIds420.ACTION_VAULT_SETTLE_WAGER, s.auth.scopeForVault(VAULT));
        _allow(s, address(s.engine), BetIds420.ACTION_ECONOMICS_FINALIZE, s.auth.scopeForGameVersion(GAME_V1));
    }

    function _accept(Suite memory s, bytes32 wagerId, uint256 stake, uint256 maxGross) private {
        s.token.mint(PLAYER, stake);
        vm.prank(PLAYER);
        s.token.approve(address(s.vault), stake);
        s.economics.bindWager(wagerId, GAME_V1, OPERATOR, stake);
        s.vault.escrowWagerStakeToken(wagerId, PLAYER, stake);
        s.risk.reserveExposure(wagerId, VAULT, GAME_V1, RISK, stake, maxGross, keccak256("dice"));

        BetTypes420.Wager memory wager = BetTypes420.Wager({
            wagerId: wagerId,
            player: PLAYER,
            operatorId: OPERATOR,
            gameId: GAME,
            gameVersionId: GAME_V1,
            asset: address(s.token),
            stake: stake,
            maxGrossPayout: maxGross,
            paramsHash: keccak256("dice-under-50"),
            vaultId: VAULT,
            randomnessProfileId: RANDOMNESS,
            riskProfileId: RISK,
            settlementProfileId: SETTLEMENT,
            accessPolicyId: ACCESS,
            rulesetId: RULESET,
            acceptedAt: 0,
            deadline: uint64(block.timestamp + 1 hours),
            status: BetTypes420.WagerStatus.NONE
        });
        s.registry.recordAccepted(wager);
        _allow(s, SETTLER, BetIds420.ACTION_SETTLE, s.auth.scopeForWager(wagerId));
        _allow(s, address(s.engine), BetIds420.ACTION_WAGER_SETTLE_RECORD, s.auth.scopeForWager(wagerId));
    }

    // Funded Video Poker expiry path: real vault, registry, risk and fee adapters.
    function testVideoPokerFundedExpiryRefundAndConservation() public {
        Suite memory s = _deploy();
        bytes32 wagerId = keccak256("video-poker/funded-expiry");
        uint256 stake = 0.1 ether;
        uint256 maxGross = 80 ether;
        bytes32 game = keccak256("420BET.GAME.VIDEO_POKER");
        bytes32 version = keccak256("420BET.GAME.VIDEO_POKER.V1");
        bytes32 rules = keccak256("420BET.RULESET.VIDEO_POKER.V1");
        bytes32 paytable = keccak256("420BET.PAYTABLE.VIDEO_POKER.JACKS_OR_BETTER.V1");
        bytes32 paramsHash = keccak256(abi.encode(keccak256("420.BET.VIDEO_POKER.V1.PARAMS"), version, rules, paytable, uint8(5)));
        _allow(s, address(this), BetIds420.ACTION_ECONOMICS_BIND, s.auth.scopeForGameVersion(version));
        _allow(s, address(s.engine), BetIds420.ACTION_ECONOMICS_FINALIZE, s.auth.scopeForGameVersion(version));
        _allow(s, ADMIN, BetIds420.ACTION_ECONOMICS_CONFIGURE, s.auth.scopeForGameVersion(version));
        vm.prank(ADMIN);
        s.economics.configureFeeSchedule(BetEconomics420.FeeSchedule({
            scheduleId: keccak256("video-poker/fees"), gameVersionId: version,
            protocolFeeBps: 0, operatorFeeBps: 0, protocolRecipient: address(0),
            manifestHash: keccak256("video-poker/fees-manifest"), exists: false
        }));
        s.token.mint(PLAYER, stake);
        vm.prank(PLAYER);
        s.token.approve(address(s.vault), stake);
        s.economics.bindWager(wagerId, version, OPERATOR, stake);
        s.vault.escrowWagerStakeToken(wagerId, PLAYER, stake);
        s.risk.reserveExposure(wagerId, VAULT, GAME_V1, RISK, stake, maxGross, keccak256("video-poker"));
        uint64 deadline = uint64(block.timestamp + 1 hours);
        s.registry.recordAccepted(BetTypes420.Wager({
            wagerId: wagerId, player: PLAYER, operatorId: OPERATOR, gameId: game,
            gameVersionId: version, asset: address(s.token), stake: stake,
            maxGrossPayout: maxGross, paramsHash: paramsHash, vaultId: VAULT,
            randomnessProfileId: RANDOMNESS, riskProfileId: RISK,
            settlementProfileId: SETTLEMENT, accessPolicyId: ACCESS, rulesetId: rules,
            acceptedAt: uint64(block.timestamp), deadline: deadline, status: BetTypes420.WagerStatus.NONE
        }));
        _allow(s, address(s.engine), BetIds420.ACTION_WAGER_SETTLE_RECORD, s.auth.scopeForWager(wagerId));
        // Exercise the genuine draw contract lifecycle against the funded canonical wager:
        // commitment -> primary entropy -> deal -> hold -> withholding -> atomic refund.
        VideoPokerV1420.Params memory vp = VideoPokerV1420.Params({paytableId: paytable, credits: 5});
        VideoPokerV1420 poker = new VideoPokerV1420(address(s.registry), game, version, rules);
        MockVideoPokerSecureRandomness randomness = new MockVideoPokerSecureRandomness();
        VideoPokerDealV1420 dealer = new VideoPokerDealV1420(address(poker), address(randomness));
        address provider = address(0xBABA);
        VideoPokerDrawV1420 draw = new VideoPokerDrawV1420(address(dealer), provider);
        bytes32 seed = keccak256("withheld entropy");
        bytes32 commitment = draw.seedCommitmentFor(wagerId, seed);
        vm.prank(provider);
        draw.commitReplacement(wagerId, commitment, vp);
        randomness.setRequest(wagerId, RandomnessRouter420.RandomnessRequest({
            wagerId: wagerId, profileId: RANDOMNESS, gameVersionId: version, paramsHash: poker.hashParams(vp),
            contextHash: keccak256("expiry-context"), requestedAt: uint64(block.timestamp),
            fallbackAt: uint64(block.timestamp+120), root: keccak256("expiry-initial-root"),
            proofHash: keccak256("expiry-proof"), entropyHash: keccak256("expiry-entropy"),
            source: RandomnessRouter420.Source.PRIMARY, fulfilled: true
        }));
        vm.prank(PLAYER);
        dealer.startInitialDeal(wagerId,vp);
        vm.prank(PLAYER);
        draw.commitHold(wagerId,7);
        require(s.vault.wagerStakeEscrow(wagerId) == stake, "escrow not funded");
        require(s.accounting.getVault(VAULT).activeReservedLiability == maxGross - stake, "reserve absent");
        vm.expectRevert(SettlementEngine420.WagerNotExpired.selector);
        s.engine.voidExpired(wagerId);
        vm.warp(deadline);
        draw.recordWithheldEntropy(wagerId);
        require(draw.getSession(wagerId).timedOut, "withheld entropy not recorded");
        s.engine.voidExpired(wagerId);
        require(s.token.balanceOf(PLAYER) == stake, "stake not refunded");
        require(s.token.balanceOf(address(s.vault)) == 1_000 ether, "vault custody changed");
        require(s.accounting.getVault(VAULT).totalAssets == 1_000 ether, "bankroll equity changed");
        require(s.accounting.getVault(VAULT).activeReservedLiability == 0, "reserve not released");
        require(s.vault.wagerStakeEscrow(wagerId) == 0, "escrow remains");
        require(s.registry.getWager(wagerId).status == BetTypes420.WagerStatus.VOID, "not void");
        require(s.economics.getWagerFee(wagerId).finalized, "fee not finalized");
        require(!s.economics.getWagerFee(wagerId).charged, "refund charged fees");
        s.engine.voidExpired(wagerId);
        require(s.token.balanceOf(PLAYER) == stake, "double refund");
    }

    function testVideoPokerRealResolverFundedWinConservation() public {
        Suite memory s = _deploy();
        bytes32 wagerId = keccak256("video-poker/funded-win");
        bytes32 game = keccak256("420BET.GAME.VIDEO_POKER");
        bytes32 version = keccak256("420BET.GAME.VIDEO_POKER.V1");
        bytes32 rules = keccak256("420BET.RULESET.VIDEO_POKER.V1");
        uint256 stake = 0.1 ether;
        uint256 maxGross = 80 ether;
        bytes32 profile = keccak256("profile");
        VideoPokerV1420.Params memory params = VideoPokerV1420.Params({
            paytableId: keccak256("420BET.PAYTABLE.VIDEO_POKER.JACKS_OR_BETTER.V1"), credits: 5
        });
        VideoPokerV1420 poker = new VideoPokerV1420(address(s.registry), game, version, rules);
        MockVideoPokerSecureRandomness randomness = new MockVideoPokerSecureRandomness();
        VideoPokerDealV1420 dealer = new VideoPokerDealV1420(address(poker), address(randomness));
        address provider = address(0xBABA);
        VideoPokerDrawV1420 draw = new VideoPokerDrawV1420(address(dealer), provider);
        VideoPokerResolverV1420 resolver = new VideoPokerResolverV1420(address(draw));
        VideoPokerEconomics420 handEvaluator = new VideoPokerEconomics420();
        _allow(s, address(this), BetIds420.ACTION_ECONOMICS_BIND, s.auth.scopeForGameVersion(version));
        _allow(s, address(s.engine), BetIds420.ACTION_ECONOMICS_FINALIZE, s.auth.scopeForGameVersion(version));
        _allow(s, ADMIN, BetIds420.ACTION_ECONOMICS_CONFIGURE, s.auth.scopeForGameVersion(version));
        vm.prank(ADMIN);
        s.economics.configureFeeSchedule(BetEconomics420.FeeSchedule({
            scheduleId: keccak256("video-poker/win-fees"), gameVersionId: version,
            protocolFeeBps: 0, operatorFeeBps: 0, protocolRecipient: address(0),
            manifestHash: keccak256("video-poker/win-fees-manifest"), exists: false
        }));
        s.token.mint(PLAYER, stake);
        vm.prank(PLAYER);
        s.token.approve(address(s.vault), stake);
        s.economics.bindWager(wagerId, version, OPERATOR, stake);
        s.vault.escrowWagerStakeToken(wagerId, PLAYER, stake);
        s.risk.reserveExposure(wagerId, VAULT, version, RISK, stake, maxGross, keccak256("video-poker/funded-win"));
        s.registry.recordAccepted(BetTypes420.Wager({
            wagerId: wagerId, player: PLAYER, operatorId: OPERATOR, gameId: game,
            gameVersionId: version, asset: address(s.token), stake: stake,
            maxGrossPayout: maxGross, paramsHash: poker.hashParams(params), vaultId: VAULT,
            randomnessProfileId: profile, riskProfileId: RISK,
            settlementProfileId: SETTLEMENT, accessPolicyId: ACCESS, rulesetId: rules,
            acceptedAt: uint64(block.timestamp), deadline: uint64(block.timestamp+1 hours),
            status: BetTypes420.WagerStatus.NONE
        }));
        _allow(s, address(s.engine), BetIds420.ACTION_WAGER_SETTLE_RECORD, s.auth.scopeForWager(wagerId));
        _allow(s, SETTLER, BetIds420.ACTION_SETTLE, s.auth.scopeForWager(wagerId));
        _allow(s, ADMIN, BetIds420.ACTION_GAME_REGISTER, s.auth.scopeForGame(game, version));
        vm.prank(ADMIN);
        s.engine.bindVideoPokerResolver(version, address(resolver));
        bytes32 chosenRoot;
        uint8[5] memory cards;
        for(uint256 attempt=1;attempt<=500;++attempt){
            bytes32 root = keccak256(abi.encodePacked("funded-video-poker-win",attempt));
            uint8[52] memory permutation = dealer.deriveDeck(wagerId,root,RandomnessRouter420.Source.PRIMARY);
            for(uint256 i;i<5;++i)cards[i]=permutation[i];
            if(handEvaluator.evaluate(cards)==VideoPokerJacksOrBetter420.Category.TWO_PAIR){
                chosenRoot=root;break;
            }
        }
        require(chosenRoot!=bytes32(0),"failed deterministic two-pair fixture");
        bytes32 replacementSeed=keccak256("funded win replacement entropy");
        bytes32 commitment=draw.seedCommitmentFor(wagerId,replacementSeed);
        vm.prank(provider);
        draw.commitReplacement(wagerId,commitment,params);
        randomness.setRequest(wagerId,RandomnessRouter420.RandomnessRequest({
            wagerId:wagerId,profileId:profile,gameVersionId:version,paramsHash:poker.hashParams(params),
            contextHash:keccak256("funded-context"),requestedAt:uint64(block.timestamp),
            fallbackAt:uint64(block.timestamp+120),root:chosenRoot,proofHash:keccak256("funded-proof"),
            entropyHash:keccak256("funded-entropy"),source:RandomnessRouter420.Source.PRIMARY,fulfilled:true
        }));
        vm.prank(PLAYER);
        dealer.startInitialDeal(wagerId,params);
        vm.prank(PLAYER);
        draw.commitHold(wagerId,31);
        vm.prank(provider);
        draw.revealAndDraw(wagerId,replacementSeed);
        uint256 gross=stake*2;
        vm.prank(SETTLER);
        s.engine.settleVideoPoker(wagerId,params);
        require(s.token.balanceOf(PLAYER)==gross,"canonical winner payout wrong");
        require(s.token.balanceOf(address(s.vault))==1000 ether-(gross-stake),"funded vault not conserved");
        require(s.accounting.getVault(VAULT).totalAssets==1000 ether-(gross-stake),"book assets not conserved");
        require(s.accounting.getVault(VAULT).activeReservedLiability==0,"reserve retained");
        require(s.vault.wagerStakeEscrow(wagerId)==0,"stake escrow retained");
        require(s.registry.getWager(wagerId).status==BetTypes420.WagerStatus.SETTLED,"settlement not recorded");
        require(s.economics.getWagerFee(wagerId).finalized,"fees not finalized");
        require(s.economics.getWagerFee(wagerId).charged,"winning settlement missing fee accounting disposition");
        vm.expectRevert(VideoPokerResolverV1420.InvalidWagerStatus.selector);
        vm.prank(SETTLER);
        s.engine.settleVideoPoker(wagerId,params);
        require(s.token.balanceOf(PLAYER)==gross,"duplicate settlement payment");
        vm.expectRevert(SettlementEngine420.VideoPokerCanonicalSettlementRequired.selector);
        s.engine.settle(wagerId,BetTypes420.TerminalOutcome.WIN,gross);
    }

    function testSettlementDefaultDenyPreservesAcceptedWager() public {
        Suite memory s = _deploy();
        bytes32 wagerId = keccak256("wager/default-deny");
        _accept(s, wagerId, 100 ether, 500 ether);
        s.caps.setAllowed(SETTLER, BetIds420.COMPONENT_BET, BetIds420.ACTION_SETTLE, s.auth.scopeForWager(wagerId), false);

        vm.prank(SETTLER);
        vm.expectRevert(SettlementEngine420.Unauthorized.selector);
        s.engine.settle(wagerId, BetTypes420.TerminalOutcome.WIN, 500 ether);

        require(s.vault.wagerStakeEscrow(wagerId) == 100 ether, "escrow changed");
        require(s.accounting.getVault(VAULT).activeReservedLiability == 400 ether, "liability changed");
        require(!s.registry.settlementExists(wagerId), "settlement recorded");
        require(!s.economics.getWagerFee(wagerId).finalized, "fee finalized on denied settlement");
    }

    function testPartialReturnLossAbsorbsOnlyUnreturnedStake() public {
        Suite memory s = _deploy();
        bytes32 wagerId = keccak256("wager/partial-loss");
        _accept(s, wagerId, 100 ether, 500 ether);

        vm.prank(SETTLER);
        s.engine.settle(wagerId, BetTypes420.TerminalOutcome.LOSS, 40 ether);

        VaultAccounting420.VaultState memory v = s.accounting.getVault(VAULT);
        require(v.totalAssets == 1_060 ether, "wrong loss assets");
        require(v.realizedPnl == int256(60 ether), "wrong loss pnl");
        require(v.activeReservedLiability == 0, "liability not released");
        require(s.token.balanceOf(PLAYER) == 40 ether, "partial return missing");
        require(s.token.balanceOf(address(s.vault)) == 1_060 ether, "custody mismatch");
        require(s.vault.activeWagerStakeEscrow() == 0, "escrow not cleared");
        require(s.economics.getWagerFee(wagerId).finalized, "fee not finalized");
    }

    function testWinPaysEscrowPlusProfitWithoutDoubleCounting() public {
        Suite memory s = _deploy();
        bytes32 wagerId = keccak256("wager/win");
        _accept(s, wagerId, 100 ether, 500 ether);

        vm.prank(SETTLER);
        s.engine.settle(wagerId, BetTypes420.TerminalOutcome.WIN, 500 ether);

        VaultAccounting420.VaultState memory v = s.accounting.getVault(VAULT);
        require(v.totalAssets == 600 ether, "wrong win assets");
        require(v.realizedPnl == -int256(400 ether), "wrong win pnl");
        require(v.activeReservedLiability == 0, "liability not released");
        require(s.token.balanceOf(PLAYER) == 500 ether, "winner not paid");
        require(s.token.balanceOf(address(s.vault)) == 600 ether, "custody mismatch");
        require(s.economics.getWagerFee(wagerId).finalized, "fee not finalized");
    }

    function testPushAndVoidReturnStakeWithoutPnl() public {
        Suite memory pushSuite = _deploy();
        bytes32 pushId = keccak256("wager/push");
        _accept(pushSuite, pushId, 100 ether, 500 ether);
        vm.prank(SETTLER);
        pushSuite.engine.settle(pushId, BetTypes420.TerminalOutcome.PUSH, 100 ether);
        require(pushSuite.accounting.getVault(VAULT).totalAssets == 1_000 ether, "push assets changed");
        require(pushSuite.accounting.getVault(VAULT).realizedPnl == 0, "push pnl changed");
        require(pushSuite.token.balanceOf(PLAYER) == 100 ether, "push stake not returned");
        require(pushSuite.economics.getWagerFee(pushId).finalized, "push fee not finalized");
        require(!pushSuite.economics.getWagerFee(pushId).charged, "push charged fee");

        Suite memory voidSuite = _deploy();
        bytes32 voidId = keccak256("wager/void");
        _accept(voidSuite, voidId, 100 ether, 500 ether);
        vm.prank(SETTLER);
        voidSuite.engine.settle(voidId, BetTypes420.TerminalOutcome.VOID, 100 ether);
        require(voidSuite.accounting.getVault(VAULT).totalAssets == 1_000 ether, "void assets changed");
        require(voidSuite.accounting.getVault(VAULT).realizedPnl == 0, "void pnl changed");
        require(voidSuite.registry.getWager(voidId).status == BetTypes420.WagerStatus.VOID, "void status wrong");
        require(voidSuite.economics.getWagerFee(voidId).finalized, "void fee not finalized");
        require(!voidSuite.economics.getWagerFee(voidId).charged, "void charged fee");
    }

    function testIdenticalSettlementRetryIsIdempotentAndConflictFails() public {
        Suite memory s = _deploy();
        bytes32 wagerId = keccak256("wager/idempotent");
        _accept(s, wagerId, 100 ether, 500 ether);

        vm.prank(SETTLER);
        s.engine.settle(wagerId, BetTypes420.TerminalOutcome.WIN, 500 ether);
        uint256 playerAfter = s.token.balanceOf(PLAYER);
        uint256 vaultAfter = s.token.balanceOf(address(s.vault));

        vm.prank(SETTLER);
        s.engine.settle(wagerId, BetTypes420.TerminalOutcome.WIN, 500 ether);
        require(s.token.balanceOf(PLAYER) == playerAfter, "retry paid twice");
        require(s.token.balanceOf(address(s.vault)) == vaultAfter, "retry changed custody");

        vm.prank(SETTLER);
        vm.expectRevert(SettlementEngine420.SettlementConflict.selector);
        s.engine.settle(wagerId, BetTypes420.TerminalOutcome.PUSH, 100 ether);
    }

    function testInvalidTerminalEconomicsFailBeforeUnwind() public {
        Suite memory s = _deploy();
        bytes32 wagerId = keccak256("wager/invalid-economics");
        _accept(s, wagerId, 100 ether, 500 ether);

        vm.prank(SETTLER);
        vm.expectRevert(SettlementEngine420.InvalidPayout.selector);
        s.engine.settle(wagerId, BetTypes420.TerminalOutcome.WIN, 100 ether);
        require(s.vault.wagerStakeEscrow(wagerId) == 100 ether, "invalid settlement consumed escrow");
        require(s.accounting.getVault(VAULT).activeReservedLiability == 400 ether, "invalid settlement released risk");
        require(!s.economics.getWagerFee(wagerId).finalized, "invalid settlement finalized fee");
    }
}
