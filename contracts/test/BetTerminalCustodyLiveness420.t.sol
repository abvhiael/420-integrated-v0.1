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

interface VmBetTerminalCustody420 {
    function prank(address) external;
    function warp(uint256) external;
    function expectRevert(bytes4) external;
}

contract MockCapabilityRegistryTerminalCustody420 is ICapabilityRegistry420 {
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

contract MockTerminalCustodyToken420 {
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

contract BetTerminalCustodyLiveness420Test {
    VmBetTerminalCustody420 constant vm = VmBetTerminalCustody420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address constant ADMIN = address(0xA11CE);
    address constant LP = address(0xB0B);
    address constant PLAYER = address(0xC0FFEE);
    address constant SETTLER = address(0x5151);
    address constant RESCUER = address(0xBEEF);
    address constant FEE_FUNDER = address(0xFEE1);
    address constant PROTOCOL = address(0xFEE2);
    address constant OPERATOR_ACCOUNT = address(0x0B0B);

    bytes32 constant VAULT = keccak256("420BET.TERMINAL.VAULT");
    bytes32 constant GAME = keccak256("420BET.TERMINAL.GAME");
    bytes32 constant GAME_V1 = keccak256("420BET.TERMINAL.GAME.V1");
    bytes32 constant OPERATOR = keccak256("420BET.TERMINAL.OPERATOR");
    bytes32 constant RANDOMNESS = keccak256("terminal/randomness");
    bytes32 constant RISK = keccak256("terminal/risk");
    bytes32 constant SETTLEMENT = keccak256("terminal/settlement");
    bytes32 constant ACCESS = keccak256("terminal/access");
    bytes32 constant RULESET = keccak256("terminal/ruleset");
    bytes32 constant FEE_SCHEDULE = keccak256("terminal/fees/v1");

    struct Suite {
        MockCapabilityRegistryTerminalCustody420 caps;
        BetAuthorization420 auth;
        BetProfileRegistry420 profiles;
        BetOperatorRegistry420 operators;
        VaultAccounting420 accounting;
        WithdrawalQueue420 queue;
        MockTerminalCustodyToken420 token;
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
        s.caps = new MockCapabilityRegistryTerminalCustody420();
        s.auth = new BetAuthorization420(address(s.caps));
        s.profiles = new BetProfileRegistry420(address(s.auth));
        s.operators = new BetOperatorRegistry420(address(s.auth));
        s.accounting = new VaultAccounting420(address(s.auth));
        s.queue = new WithdrawalQueue420(address(s.auth));
        s.token = new MockTerminalCustodyToken420();
        s.vault = new BankrollVault420(VAULT, address(s.token), address(s.auth), address(s.accounting), address(s.queue), 1 days);
        s.economics = new BetEconomics420(address(s.auth), address(s.operators), address(s.token));
        s.risk = new RiskManager420(address(s.auth), address(s.profiles), address(s.accounting));
        s.registry = new BetRegistry420(address(s.auth));
        s.engine = new SettlementEngine420(address(s.auth), address(s.registry), address(s.risk), address(s.vault), address(s.economics));

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
        vm.prank(ADMIN);
        s.risk.configureProfile(RiskManager420.RiskProfile({
            profileId: RISK,
            maxStakePerWager: 200 ether,
            maxGrossPayoutPerWager: 600 ether,
            maxReservedLiabilityPerWager: 500 ether,
            maxReservedLiabilityPerGame: 800 ether,
            maxReservedLiabilityPerVault: 800 ether,
            maxReservedLiabilityPerCorrelationKey: 600 ether,
            manifestHash: keccak256("risk-terms"),
            exists: false
        }));

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
            protocolFeeBps: 100,
            operatorFeeBps: 100,
            protocolRecipient: PROTOCOL,
            manifestHash: keccak256("fees/terminal/v1"),
            exists: false
        }));

        _allow(s, FEE_FUNDER, BetIds420.ACTION_ECONOMICS_FUND, s.auth.scopeForAsset(address(s.token)));
        s.token.mint(FEE_FUNDER, 100 ether);
        vm.prank(FEE_FUNDER);
        s.token.approve(address(s.economics), 100 ether);
        vm.prank(FEE_FUNDER);
        s.economics.fundFees(100 ether);

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

    function _accept(Suite memory s, bytes32 wagerId) private returns (uint64 deadline) {
        uint256 stake = 100 ether;
        uint256 maxGross = 500 ether;
        s.token.mint(PLAYER, stake);
        vm.prank(PLAYER);
        s.token.approve(address(s.vault), stake);

        s.economics.bindWager(wagerId, GAME_V1, OPERATOR, stake);
        s.vault.escrowWagerStakeToken(wagerId, PLAYER, stake);
        s.risk.reserveExposure(wagerId, VAULT, GAME_V1, RISK, stake, maxGross, keccak256("terminal-correlation"));
        deadline = uint64(block.timestamp + 1 hours);

        s.registry.recordAccepted(BetTypes420.Wager({
            wagerId: wagerId,
            player: PLAYER,
            operatorId: OPERATOR,
            gameId: GAME,
            gameVersionId: GAME_V1,
            asset: address(s.token),
            stake: stake,
            maxGrossPayout: maxGross,
            paramsHash: keccak256("terminal-params"),
            vaultId: VAULT,
            randomnessProfileId: RANDOMNESS,
            riskProfileId: RISK,
            settlementProfileId: SETTLEMENT,
            accessPolicyId: ACCESS,
            rulesetId: RULESET,
            acceptedAt: 0,
            deadline: deadline,
            status: BetTypes420.WagerStatus.NONE
        }));

        _allow(s, SETTLER, BetIds420.ACTION_SETTLE, s.auth.scopeForWager(wagerId));
        _allow(s, address(s.engine), BetIds420.ACTION_WAGER_SETTLE_RECORD, s.auth.scopeForWager(wagerId));
    }

    function testProviderSilenceCannotStrandCustodyPastDeadline() public {
        Suite memory s = _deploy();
        bytes32 wagerId = keccak256("terminal/provider-silence");
        uint64 deadline = _accept(s, wagerId);

        require(s.vault.wagerStakeEscrow(wagerId) == 100 ether, "stake not escrowed");
        require(s.accounting.getVault(VAULT).activeReservedLiability == 400 ether, "liability not reserved");
        require(s.economics.feeReserved() == 2 ether, "fee not reserved");
        require(s.economics.feeAvailable() == 98 ether, "fee pool wrong before rescue");

        vm.warp(deadline);
        vm.prank(RESCUER);
        s.engine.voidExpired(wagerId);

        BetTypes420.Settlement memory settlement = s.registry.getSettlement(wagerId);
        require(settlement.outcome == BetTypes420.TerminalOutcome.VOID, "not void");
        require(settlement.grossPayout == 100 ether, "wrong refund");
        require(s.vault.wagerStakeEscrow(wagerId) == 0, "stake stranded");
        require(s.vault.activeWagerStakeEscrow() == 0, "aggregate escrow stranded");
        require(s.accounting.getVault(VAULT).activeReservedLiability == 0, "liability stranded");
        require(!s.risk.getReservation(wagerId).active, "risk reservation active");
        require(s.economics.feeReserved() == 0, "fee reservation stranded");
        require(s.economics.feeAvailable() == 100 ether, "void fee not restored");
        require(s.economics.feeClaimableTotal() == 0, "void created fee claim");
        BetEconomics420.WagerFeeBinding memory fee = s.economics.getWagerFee(wagerId);
        require(fee.finalized && !fee.charged, "fee binding not void-finalized");
        require(s.token.balanceOf(PLAYER) == 100 ether, "player not refunded");
    }

    function testRepeatedSettlementFailureStillEndsInPermissionlessVoid() public {
        Suite memory s = _deploy();
        bytes32 wagerId = keccak256("terminal/repeated-settlement-failure");
        uint64 deadline = _accept(s, wagerId);

        s.caps.setAllowed(SETTLER, BetIds420.COMPONENT_BET, BetIds420.ACTION_SETTLE, s.auth.scopeForWager(wagerId), false);
        vm.prank(SETTLER);
        vm.expectRevert(SettlementEngine420.Unauthorized.selector);
        s.engine.settle(wagerId, BetTypes420.TerminalOutcome.WIN, 500 ether);

        require(s.vault.wagerStakeEscrow(wagerId) == 100 ether, "failed settle changed escrow");
        require(s.accounting.getVault(VAULT).activeReservedLiability == 400 ether, "failed settle changed liability");
        require(s.economics.feeReserved() == 2 ether, "failed settle changed fee reserve");

        vm.warp(deadline);
        vm.prank(RESCUER);
        s.engine.voidExpired(wagerId);

        require(s.vault.wagerStakeEscrow(wagerId) == 0, "escrow remained after rescue");
        require(s.accounting.getVault(VAULT).activeReservedLiability == 0, "liability remained after rescue");
        require(s.economics.feeReserved() == 0, "fees remained after rescue");
        require(s.registry.getWager(wagerId).status == BetTypes420.WagerStatus.VOID, "not terminal void");
    }

    function testExpiredVoidRetryDoesNotDoubleReleaseAnyDomain() public {
        Suite memory s = _deploy();
        bytes32 wagerId = keccak256("terminal/void-retry");
        uint64 deadline = _accept(s, wagerId);
        vm.warp(deadline);

        vm.prank(RESCUER);
        s.engine.voidExpired(wagerId);
        uint256 playerBalance = s.token.balanceOf(PLAYER);
        uint256 feeAvailable = s.economics.feeAvailable();

        vm.prank(address(0xD00D));
        s.engine.voidExpired(wagerId);

        require(s.token.balanceOf(PLAYER) == playerBalance, "double refund");
        require(s.economics.feeAvailable() == feeAvailable, "double fee release");
        require(s.vault.activeWagerStakeEscrow() == 0, "escrow resurrected");
        require(s.accounting.getVault(VAULT).activeReservedLiability == 0, "liability resurrected");
        require(s.economics.feeReserved() == 0, "fee reserve resurrected");
    }
}
