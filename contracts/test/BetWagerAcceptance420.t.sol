// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/interfaces/genesis/ICapabilityRegistry420.sol";
import "../src/bet/BankrollVault420.sol";
import "../src/bet/BetAccessPolicy420.sol";
import "../src/bet/BetAuthorization420.sol";
import "../src/bet/BetGameRegistry420.sol";
import "../src/bet/BetIds420.sol";
import "../src/bet/BetModuleRegistry420.sol";
import "../src/bet/BetOperatorRegistry420.sol";
import "../src/bet/BetProfileRegistry420.sol";
import "../src/bet/BetRegistry420.sol";
import "../src/bet/BetTypes420.sol";
import "../src/bet/RiskManager420.sol";
import "../src/bet/VaultAccounting420.sol";
import "../src/bet/WagerRouter420.sol";
import "../src/bet/WithdrawalQueue420.sol";

interface VmBetWagerAcceptance420 {
    function prank(address) external;
    function expectRevert(bytes4) external;
}

contract MockCapabilityRegistryBetWager420 is ICapabilityRegistry420 {
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

contract MockBetWagerToken420 {
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

contract BetWagerAcceptance420Test {
    VmBetWagerAcceptance420 constant vm = VmBetWagerAcceptance420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address constant ADMIN = address(0xA11CE);
    address constant LP = address(0xB0B);
    address constant PLAYER = address(0xC0FFEE);
    address constant OPERATOR_ACCOUNT = address(0x0B0B);

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
        MockCapabilityRegistryBetWager420 caps;
        BetAuthorization420 auth;
        BetModuleRegistry420 modules;
        BetProfileRegistry420 profiles;
        BetAccessPolicy420 access;
        BetOperatorRegistry420 operators;
        BetGameRegistry420 games;
        VaultAccounting420 accounting;
        WithdrawalQueue420 queue;
        MockBetWagerToken420 token;
        BankrollVault420 vault;
        RiskManager420 risk;
        BetRegistry420 registry;
        WagerRouter420 router;
    }

    function _allow(Suite memory s, address principal, bytes32 action, bytes32 scope) private {
        s.caps.setAllowed(principal, BetIds420.COMPONENT_BET, action, scope, true);
    }

    function _deploy() private returns (Suite memory s) {
        s.caps = new MockCapabilityRegistryBetWager420();
        s.auth = new BetAuthorization420(address(s.caps));
        s.modules = new BetModuleRegistry420(address(s.auth));
        s.profiles = new BetProfileRegistry420(address(s.auth));
        s.access = new BetAccessPolicy420(address(s.auth), address(s.profiles));
        s.operators = new BetOperatorRegistry420(address(s.auth));
        s.games = new BetGameRegistry420(address(s.auth), address(s.modules), address(s.profiles));
        s.accounting = new VaultAccounting420(address(s.auth));
        s.queue = new WithdrawalQueue420(address(s.auth));
        s.token = new MockBetWagerToken420();
        s.vault = new BankrollVault420(VAULT, address(s.token), address(s.auth), address(s.accounting), address(s.queue), 1 days);
        s.risk = new RiskManager420(address(s.auth), address(s.profiles), address(s.accounting));
        s.registry = new BetRegistry420(address(s.auth));
        s.router = new WagerRouter420(
            address(s.auth),
            address(s.games),
            address(s.modules),
            address(s.operators),
            address(s.profiles),
            address(s.access),
            address(s.risk),
            address(s.registry),
            address(s.vault)
        );

        _allow(s, ADMIN, BetIds420.ACTION_VAULT_REGISTER, s.auth.scopeForVault(VAULT));
        vm.prank(ADMIN);
        s.accounting.registerVault(VAULT, address(s.token));
        _allow(s, address(s.vault), BetIds420.ACTION_VAULT_RECORD_DEPOSIT, s.auth.scopeForVault(VAULT));
        _allow(s, address(s.risk), BetIds420.ACTION_VAULT_RESERVE_LIABILITY, s.auth.scopeForVault(VAULT));
        _allow(s, address(s.risk), BetIds420.ACTION_VAULT_RELEASE_LIABILITY, s.auth.scopeForVault(VAULT));

        _seedProfiles(s);
        _seedAccess(s);
        _seedModuleGameOperator(s);
        _seedRisk(s);
        _seedLiquidity(s, 1_000 ether);

        _allow(s, address(s.router), BetIds420.ACTION_ACCESS_RECORD, s.auth.scopeForProfile(ACCESS));
        _allow(s, address(s.router), BetIds420.ACTION_VAULT_ESCROW_STAKE, s.auth.scopeForVault(VAULT));
        _allow(s, address(s.router), BetIds420.ACTION_RISK_RESERVE, s.auth.scopeForVault(VAULT));
        _allow(s, address(s.router), BetIds420.ACTION_WAGER_RECORD, s.auth.scopeForVault(VAULT));
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
        s.access.configurePolicy(ACCESS, address(s.token), address(0), requirements, 0, 0, 0, keccak256("access-policy"));
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
        s.modules.registerModule(MODULE, MODULE_V1, address(this), keccak256("module-manifest"), keccak256("module-code"));
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

    function _seedLiquidity(Suite memory s, uint256 amount) private {
        _allow(s, LP, BetIds420.ACTION_LP_DEPOSIT, s.auth.scopeForVault(VAULT));
        s.token.mint(LP, amount);
        vm.prank(LP);
        s.token.approve(address(s.vault), amount);
        vm.prank(LP);
        s.vault.depositToken(amount);
    }

    function _approvePlayer(Suite memory s, uint256 amount) private {
        _allow(s, PLAYER, BetIds420.ACTION_PLACE, s.auth.scopeForGame(GAME, GAME_V1));
        s.token.mint(PLAYER, amount);
        vm.prank(PLAYER);
        s.token.approve(address(s.vault), amount);
    }

    function _request(uint256 stake, uint256 gross) private view returns (WagerRouter420.AcceptanceRequest memory r) {
        r = WagerRouter420.AcceptanceRequest({
            operatorId: OPERATOR,
            gameVersionId: GAME_V1,
            stake: stake,
            maxGrossPayout: gross,
            paramsHash: keccak256("dice-under-50"),
            correlationKey: keccak256("dice"),
            deadline: uint64(block.timestamp + 1 hours)
        });
    }

    function testPlaceWagerDefaultDeny() public {
        Suite memory s = _deploy();
        s.token.mint(PLAYER, 100 ether);
        vm.prank(PLAYER);
        s.token.approve(address(s.vault), 100 ether);
        vm.prank(PLAYER);
        vm.expectRevert(WagerRouter420.Unauthorized.selector);
        s.router.placeWager(_request(100 ether, 500 ether));
        require(s.token.balanceOf(PLAYER) == 100 ether, "default deny moved stake");
        require(s.router.nextNonce(PLAYER) == 0, "default deny consumed nonce");
    }

    function testAtomicAcceptanceEscrowsStakeReservesAdditionalLiabilityAndRecordsWager() public {
        Suite memory s = _deploy();
        _approvePlayer(s, 100 ether);

        vm.prank(PLAYER);
        (bytes32 wagerId, uint256 reserved) = s.router.placeWager(_request(100 ether, 500 ether));

        require(reserved == 400 ether, "wrong additional liability");
        require(s.vault.wagerStakeEscrow(wagerId) == 100 ether, "stake not escrowed");
        require(s.vault.activeWagerStakeEscrow() == 100 ether, "aggregate stake escrow wrong");
        require(s.accounting.getVault(VAULT).totalAssets == 1_000 ether, "stake became LP equity");
        require(s.accounting.getVault(VAULT).activeReservedLiability == 400 ether, "liability not protected");
        require(s.token.balanceOf(address(s.vault)) == 1_100 ether, "physical custody mismatch");

        BetTypes420.Wager memory wager = s.registry.getWager(wagerId);
        require(wager.player == PLAYER, "wrong player");
        require(wager.gameId == GAME && wager.gameVersionId == GAME_V1, "wrong game binding");
        require(wager.vaultId == VAULT && wager.asset == address(s.token), "wrong vault binding");
        require(wager.stake == 100 ether && wager.maxGrossPayout == 500 ether, "economic terms changed");
        require(wager.riskProfileId == RISK && wager.rulesetId == RULESET, "profile/ruleset not bound");
        require(wager.status == BetTypes420.WagerStatus.ACCEPTED, "not accepted");
    }

    function testRiskFailureRollsBackStakeEscrowNonceAndAccessUsage() public {
        Suite memory s = _deploy();
        _approvePlayer(s, 100 ether);
        uint256 playerBefore = s.token.balanceOf(PLAYER);
        uint256 vaultBefore = s.token.balanceOf(address(s.vault));

        vm.prank(PLAYER);
        vm.expectRevert(RiskManager420.LimitExceeded.selector);
        s.router.placeWager(_request(100 ether, 700 ether));

        require(s.token.balanceOf(PLAYER) == playerBefore, "failed acceptance kept player stake");
        require(s.token.balanceOf(address(s.vault)) == vaultBefore, "failed acceptance changed vault custody");
        require(s.vault.activeWagerStakeEscrow() == 0, "failed acceptance left escrow");
        require(s.accounting.getVault(VAULT).activeReservedLiability == 0, "failed acceptance left liability");
        require(s.router.nextNonce(PLAYER) == 0, "failed acceptance consumed nonce");
        require(s.access.policyUsage(ACCESS, PLAYER).stakeUsed == 0, "failed acceptance consumed access limit");
    }

    function testDeprecatedBoundProfileStopsNewWagersBeforeStakeMoves() public {
        Suite memory s = _deploy();
        _approvePlayer(s, 100 ether);
        _allow(s, ADMIN, BetIds420.ACTION_PROFILE_DEPRECATE, s.auth.scopeForProfile(ACCESS));
        vm.prank(ADMIN);
        s.profiles.deprecate(ACCESS);

        vm.prank(PLAYER);
        vm.expectRevert(WagerRouter420.InactiveProfile.selector);
        s.router.placeWager(_request(100 ether, 500 ether));
        require(s.token.balanceOf(PLAYER) == 100 ether, "inactive policy moved stake");
    }
}
