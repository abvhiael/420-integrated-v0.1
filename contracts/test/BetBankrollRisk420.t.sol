// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/interfaces/genesis/ICapabilityRegistry420.sol";
import "../src/bet/BetAuthorization420.sol";
import "../src/bet/BetIds420.sol";
import "../src/bet/BetProfileRegistry420.sol";
import "../src/bet/VaultAccounting420.sol";
import "../src/bet/WithdrawalQueue420.sol";
import "../src/bet/BankrollVault420.sol";
import "../src/bet/RiskManager420.sol";

interface VmBetBankrollRisk420 {
    function prank(address) external;
    function expectRevert(bytes4) external;
    function warp(uint256) external;
}

contract MockCapabilityRegistryBetBankrollRisk420 is ICapabilityRegistry420 {
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

contract MockBetToken420 {
    string public constant name = "Mock Bet Token";
    string public constant symbol = "MBT";
    uint8 public constant decimals = 18;
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

contract BetBankrollRisk420Test {
    VmBetBankrollRisk420 constant vm = VmBetBankrollRisk420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address constant ADMIN = address(0xA11CE);
    address constant LP = address(0xB0B);
    address constant ROUTER = address(0xCAFE);

    bytes32 constant VAULT = keccak256("420BET.VAULT.CADC.1");
    bytes32 constant RISK_PROFILE = keccak256("profile/risk/bankroll-v1");
    bytes32 constant GAME_V1 = keccak256("420BET.GAME.DICE.V1");
    bytes32 constant CORRELATION = keccak256("dice/shared-exposure");

    struct Suite {
        MockCapabilityRegistryBetBankrollRisk420 caps;
        BetAuthorization420 auth;
        BetProfileRegistry420 profiles;
        VaultAccounting420 accounting;
        WithdrawalQueue420 queue;
        MockBetToken420 token;
        BankrollVault420 vault;
        RiskManager420 risk;
    }

    function _deploy() private returns (Suite memory s) {
        s.caps = new MockCapabilityRegistryBetBankrollRisk420();
        s.auth = new BetAuthorization420(address(s.caps));
        s.profiles = new BetProfileRegistry420(address(s.auth));
        s.accounting = new VaultAccounting420(address(s.auth));
        s.queue = new WithdrawalQueue420(address(s.auth));
        s.token = new MockBetToken420();
        s.vault = new BankrollVault420(VAULT, address(s.token), address(s.auth), address(s.accounting), address(s.queue), 1 days);
        s.risk = new RiskManager420(address(s.auth), address(s.profiles), address(s.accounting));

        _allow(s, ADMIN, BetIds420.ACTION_VAULT_REGISTER, s.auth.scopeForVault(VAULT));
        vm.prank(ADMIN);
        s.accounting.registerVault(VAULT, address(s.token));

        _allow(s, address(s.vault), BetIds420.ACTION_VAULT_RECORD_DEPOSIT, s.auth.scopeForVault(VAULT));
        _allow(s, address(s.vault), BetIds420.ACTION_VAULT_QUEUE_WITHDRAWAL, s.auth.scopeForVault(VAULT));
        _allow(s, address(s.vault), BetIds420.ACTION_VAULT_CLAIM_WITHDRAWAL, s.auth.scopeForVault(VAULT));
        _allow(s, address(s.risk), BetIds420.ACTION_VAULT_RESERVE_LIABILITY, s.auth.scopeForVault(VAULT));
        _allow(s, address(s.risk), BetIds420.ACTION_VAULT_RELEASE_LIABILITY, s.auth.scopeForVault(VAULT));
    }

    function _allow(Suite memory s, address principal, bytes32 action, bytes32 scope) private {
        s.caps.setAllowed(principal, BetIds420.COMPONENT_BET, action, scope, true);
    }

    function _seedRisk(Suite memory s) private {
        _allow(s, ADMIN, BetIds420.ACTION_PROFILE_REGISTER, s.auth.scopeForProfile(RISK_PROFILE));
        vm.prank(ADMIN);
        s.profiles.registerProfile(RISK_PROFILE, keccak256("RISK"), keccak256("risk-manifest"), keccak256("risk-artifact"));

        _allow(s, ADMIN, BetIds420.ACTION_RISK_CONFIGURE, s.auth.scopeForProfile(RISK_PROFILE));
        RiskManager420.RiskProfile memory p = RiskManager420.RiskProfile({
            profileId: RISK_PROFILE,
            maxStakePerWager: 200 ether,
            maxGrossPayoutPerWager: 600 ether,
            maxReservedLiabilityPerWager: 500 ether,
            maxReservedLiabilityPerGame: 700 ether,
            maxReservedLiabilityPerVault: 800 ether,
            maxReservedLiabilityPerCorrelationKey: 600 ether,
            manifestHash: keccak256("risk-terms"),
            exists: false
        });
        vm.prank(ADMIN);
        s.risk.configureProfile(p);

        _allow(s, ROUTER, BetIds420.ACTION_RISK_RESERVE, s.auth.scopeForVault(VAULT));
        _allow(s, ROUTER, BetIds420.ACTION_RISK_RELEASE, s.auth.scopeForVault(VAULT));
    }

    function _grantLpAndDeposit(Suite memory s, uint256 amount) private {
        _allow(s, LP, BetIds420.ACTION_LP_DEPOSIT, s.auth.scopeForVault(VAULT));
        s.token.mint(LP, amount);
        vm.prank(LP);
        s.token.approve(address(s.vault), amount);
        vm.prank(LP);
        s.vault.depositToken(amount);
    }

    function testLpDepositDefaultDeny() public {
        Suite memory s = _deploy();
        s.token.mint(LP, 100 ether);
        vm.prank(LP);
        s.token.approve(address(s.vault), 100 ether);
        vm.prank(LP);
        vm.expectRevert(BankrollVault420.Unauthorized.selector);
        s.vault.depositToken(100 ether);
    }

    function testDepositIsSingleAssetAndExactlyAccounted() public {
        Suite memory s = _deploy();
        _grantLpAndDeposit(s, 1_000 ether);
        VaultAccounting420.VaultState memory state = s.accounting.getVault(VAULT);
        require(state.totalAssets == 1_000 ether, "wrong total assets");
        require(s.token.balanceOf(address(s.vault)) == 1_000 ether, "custody mismatch");
        require(s.vault.totalShares() == 1_000 ether, "wrong shares");
        require(s.vault.shareBalance(LP) == 1_000 ether, "wrong LP balance");
    }

    function testReservedLiabilityUsesAdditionalLiabilityNotGrossPayout() public {
        Suite memory s = _deploy();
        _grantLpAndDeposit(s, 1_000 ether);
        _seedRisk(s);
        bytes32 wagerId = keccak256("wager-1");
        vm.prank(ROUTER);
        uint256 reserved = s.risk.reserveExposure(wagerId, VAULT, GAME_V1, RISK_PROFILE, 100 ether, 500 ether, CORRELATION);
        require(reserved == 400 ether, "wrong reserved liability");
        require(s.accounting.reservedByWager(VAULT, wagerId) == 400 ether, "accounting reservation mismatch");
        require(s.risk.reservedByVault(VAULT) == 400 ether, "vault exposure mismatch");
    }

    function testWithdrawalCannotConsumeLiabilityOrSafetyReserve() public {
        Suite memory s = _deploy();
        _grantLpAndDeposit(s, 1_000 ether);
        _seedRisk(s);

        _allow(s, ADMIN, BetIds420.ACTION_VAULT_SET_SAFETY_RESERVE, s.auth.scopeForVault(VAULT));
        vm.prank(ADMIN);
        s.accounting.setSafetyReserve(VAULT, 100 ether);

        vm.prank(ROUTER);
        s.risk.reserveExposure(keccak256("wager-1"), VAULT, GAME_V1, RISK_PROFILE, 100 ether, 500 ether, CORRELATION);
        require(s.accounting.availableForWithdrawal(VAULT) == 500 ether, "wrong free liquidity");

        _allow(s, LP, BetIds420.ACTION_LP_REQUEST_WITHDRAWAL, s.auth.scopeForVault(VAULT));
        vm.prank(LP);
        vm.expectRevert(BankrollVault420.InsufficientFreeLiquidity.selector);
        s.vault.requestWithdrawal(600 ether);

        vm.prank(LP);
        (bytes32 requestId, uint256 assets) = s.vault.requestWithdrawal(500 ether);
        require(assets == 500 ether, "wrong queued amount");
        require(s.accounting.availableForWithdrawal(VAULT) == 0, "protected funds became withdrawable");

        _allow(s, LP, BetIds420.ACTION_LP_CLAIM_WITHDRAWAL, s.auth.scopeForVault(VAULT));
        vm.warp(block.timestamp + 1 days);
        vm.prank(LP);
        s.vault.claimWithdrawal(requestId);
        VaultAccounting420.VaultState memory state = s.accounting.getVault(VAULT);
        require(state.totalAssets == 500 ether, "wrong post-withdraw assets");
        require(state.activeReservedLiability == 400 ether, "liability consumed");
        require(state.safetyReserve == 100 ether, "safety reserve consumed");
    }

    function testRiskLimitsAndCorrelationExposureAreBounded() public {
        Suite memory s = _deploy();
        _grantLpAndDeposit(s, 2_000 ether);
        _seedRisk(s);
        vm.prank(ROUTER);
        s.risk.reserveExposure(keccak256("wager-a"), VAULT, GAME_V1, RISK_PROFILE, 100 ether, 500 ether, CORRELATION);

        vm.prank(ROUTER);
        vm.expectRevert(RiskManager420.LimitExceeded.selector);
        s.risk.reserveExposure(keccak256("wager-b"), VAULT, GAME_V1, RISK_PROFILE, 100 ether, 400 ether, CORRELATION);
    }

    function testReleaseSurvivesLaterProfileDeprecation() public {
        Suite memory s = _deploy();
        _grantLpAndDeposit(s, 1_000 ether);
        _seedRisk(s);
        bytes32 wagerId = keccak256("wager-final");
        vm.prank(ROUTER);
        s.risk.reserveExposure(wagerId, VAULT, GAME_V1, RISK_PROFILE, 100 ether, 500 ether, bytes32(0));

        _allow(s, ADMIN, BetIds420.ACTION_PROFILE_DEPRECATE, s.auth.scopeForProfile(RISK_PROFILE));
        vm.prank(ADMIN);
        s.profiles.deprecate(RISK_PROFILE);

        vm.prank(ROUTER);
        uint256 released = s.risk.releaseExposure(wagerId);
        require(released == 400 ether, "wrong released liability");
        require(s.accounting.getVault(VAULT).activeReservedLiability == 0, "liability remained reserved");
    }
}
