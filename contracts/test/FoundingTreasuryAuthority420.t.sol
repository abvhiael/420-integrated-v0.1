// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/treasury/FoundingTreasuryAuthority420.sol";
import "../src/treasury/TreasuryAuthorization420.sol";
import "../src/governance/FoundingWalletClaims420.sol";

interface VmFounding420 {
    function prank(address caller) external;
    function warp(uint256 nextTimestamp) external;
}

contract ReadinessMockFounding420 is IFoundingRetirementReadiness420 {
    bool public override retirementReady;
    function setReady(bool value) external { retirementReady = value; }
}

contract CivicStatusMockFounding420 is IFoundingCivicStatus420 {
    bool public override civicAuthorityActivated;
    function setActive(bool value) external { civicAuthorityActivated = value; }
}

contract VaultListMockFounding420 {
    bytes32 public immutable operations;
    bytes32 public immutable contingency;
    constructor(bytes32 o, bytes32 c) { operations = o; contingency = c; }
    function getVault(bytes32 id) external view returns (VaultRegistry420.Vault memory v) {
        require(id == operations || id == contingency, "unknown");
        v.vaultAddress = id == operations ? address(0x1234) : address(0x5678);
        v.vaultType = VaultIds420.VAULT_TREASURY;
        v.state = VaultRegistry420.VaultState.ACTIVE;
        v.exists = true;
    }
}

contract FoundingTreasuryAuthority420Test {
    VmFounding420 internal constant vm = VmFounding420(address(uint160(uint256(keccak256("hevm cheat code")))));
    address internal constant ADMIN = address(0xA11CE);
    address internal constant ANDREW = address(0xA22);
    address internal constant JANET = address(0xA33);
    address internal constant PAYEE = address(0xBEEF);
    bytes32 internal constant OPS = keccak256("founding-ops-vault");
    bytes32 internal constant CONT = keccak256("founding-contingency-vault");

    ReadinessMockFounding420 internal readiness;
    CivicStatusMockFounding420 internal civic;
    TreasuryPolicyRegistry420 internal policy;
    TreasuryBudgetRegistry420 internal budgets;
    TreasuryDisbursementRegistry420 internal disb;
    FoundingTreasuryAuthority420 internal founder;
    FoundingWalletClaims420 internal claims;

    function setUp() public {
        vm.warp(1_000_000);
        readiness = new ReadinessMockFounding420();
        civic = new CivicStatusMockFounding420();
        policy = new TreasuryPolicyRegistry420(address(civic));
        budgets = new TreasuryBudgetRegistry420(address(civic), address(policy));
        TreasuryAuthorization420 auth = new TreasuryAuthorization420(address(0x123));
        disb = new TreasuryDisbursementRegistry420(address(civic), address(auth), address(policy), address(budgets));
        // No mock of the executor: Treasury release must still satisfy the actual two capability grants.
        claims = new FoundingWalletClaims420(ADMIN, ANDREW, JANET, keccak256("founding-gov-genesis"));
        vm.prank(ADMIN); claims.claimFounderWallet();
        vm.prank(ANDREW); claims.claimFounderWallet();
        vm.prank(JANET); claims.claimFounderWallet();
        founder = new FoundingTreasuryAuthority420(
            ADMIN, ANDREW, JANET, address(claims), address(civic), address(readiness),
            address(budgets), address(disb), address(policy),
            address(new VaultListMockFounding420(OPS, CONT)), OPS, CONT
        );
        budgets.bindFoundingAuthority(address(founder));
        disb.bindFoundingAuthority(address(founder));
        policy.bindFoundingAuthority(address(founder));
        // The Budget controller is still the real Disbursement registry, not the founder.
        vm.prank(address(civic));
        budgets.setController(address(disb));
        vm.prank(ADMIN);
        founder.initializeNativePolicy();
        vm.prank(ADMIN);
        founder.initializeBudgets();
    }

    function _propose(
        bool isContingency, address payee, uint128 amount, FoundingTreasuryAuthority420.Purpose purpose
    ) internal returns (bytes32 id) {
        id = founder.proposePayment(
            isContingency, payee, amount, purpose, keccak256(abi.encode(payee, amount, purpose)),
            uint64(block.timestamp), uint64(block.timestamp + 10 days)
        );
    }

    function testUnclaimedFounderCannotExerciseAuthority() public {
        // This test uses a fresh claims contract. A registered identity is NOT a claim.
        FoundingWalletClaims420 pending = new FoundingWalletClaims420(ADMIN, ANDREW, JANET, keccak256("founding-gov-genesis"));
        FoundingTreasuryAuthority420 other = new FoundingTreasuryAuthority420(
            ADMIN, ANDREW, JANET, address(pending), address(civic), address(readiness),
            address(budgets), address(disb), address(policy),
            address(new VaultListMockFounding420(OPS, CONT)), OPS, CONT
        );
        vm.prank(ADMIN);
        (bool allowed,) = address(other).call(abi.encodeCall(other.initializeBudgets, ()));
        require(!allowed, "unclaimed admin initialized budget");
        vm.prank(ANDREW);
        (allowed,) = address(other).call(abi.encodeCall(
            other.proposePayment, (false, PAYEE, uint128(1 ether),
              FoundingTreasuryAuthority420.Purpose.BOUNTY,
              keccak256("unclaimed"), uint64(block.timestamp), uint64(block.timestamp+1 days))
        ));
        require(!allowed, "unclaimed cofounder proposed");
    }

    function testRoutinePaymentSchedulesWithoutVaultAccess() public {
        vm.prank(ADMIN);
        bytes32 id = _propose(false, PAYEE, 100_000 ether, FoundingTreasuryAuthority420.Purpose.BOUNTY);
        vm.prank(ADMIN);
        bytes32 disbursementId = founder.schedulePayment(id);
        require(disb.disbursement(disbursementId).amount == 100_000 ether, "amount");
        require(budgets.budget(founder.operationsBudgetId()).committed == 100_000 ether, "committed");
        require(founder.rollingCommitted(false) == 100_000 ether, "rolling");
    }

    function testExceptionalRequiresTwoDistinctFoundersAndNotice() public {
        vm.prank(ANDREW);
        bytes32 id = _propose(false, PAYEE, 120_000 ether, FoundingTreasuryAuthority420.Purpose.PARTNERSHIP);
        vm.prank(ANDREW);
        (bool duplicate,) = address(founder).call(abi.encodeCall(founder.approvePayment, (id)));
        require(!duplicate, "double approval");
        vm.prank(ANDREW);
        (bool oneSignature,) = address(founder).call(abi.encodeCall(founder.schedulePayment, (id)));
        require(!oneSignature, "single founder accepted");
        vm.prank(JANET);
        founder.approvePayment(id);
        vm.prank(ANDREW);
        (bool early,) = address(founder).call(abi.encodeCall(founder.schedulePayment, (id)));
        require(!early, "notice bypass");
        vm.warp(block.timestamp + 49 hours);
        vm.prank(JANET);
        founder.schedulePayment(id);
        require(founder.operationsCommitted() == 120_000 ether, "exceptional spent");
    }

    function testRelatedPaymentsCannotBypassApprovalFloor() public {
        vm.prank(ADMIN);
        bytes32 first = _propose(false, PAYEE, 100_000 ether, FoundingTreasuryAuthority420.Purpose.BOUNTY);
        vm.prank(ADMIN);
        founder.schedulePayment(first);
        vm.prank(ADMIN);
        bytes32 second = _propose(false, PAYEE, 10_000 ether, FoundingTreasuryAuthority420.Purpose.BOUNTY);
        vm.prank(ADMIN);
        (bool bypass,) = address(founder).call(abi.encodeCall(founder.schedulePayment, (second)));
        require(!bypass, "recipient cap circumvented");
        vm.prank(JANET);
        founder.approvePayment(second);
        vm.warp(block.timestamp + 49 hours);
        vm.prank(ADMIN);
        founder.schedulePayment(second);
        require(founder.operationsCommitted() == 110_000 ether, "committed");
    }

    function testConcurrentRoutineProposalsMustEscalateBeforeScheduling() public {
        // Both were initially below 105k when proposed; the second cannot evade
        // two-founder approvals merely by being created before the first schedules.
        vm.prank(ADMIN);
        bytes32 first = _propose(false, PAYEE, 60_000 ether, FoundingTreasuryAuthority420.Purpose.BOUNTY);
        vm.prank(ADMIN);
        bytes32 second = _propose(false, PAYEE, 60_000 ether, FoundingTreasuryAuthority420.Purpose.BOUNTY);
        vm.prank(ADMIN);
        founder.schedulePayment(first);
        vm.prank(ADMIN);
        (bool bypass,) = address(founder).call(abi.encodeCall(founder.schedulePayment, (second)));
        require(!bypass, "concurrent over-limit proposal bypass");
        vm.prank(JANET);
        founder.approvePayment(second);
        vm.warp(block.timestamp + 49 hours);
        vm.prank(ADMIN);
        founder.schedulePayment(second);
        require(founder.operationsCommitted() == 120_000 ether, "both commitments counted");
    }

    function testContingencyCannotFundMarketingOrSkipFounderVotes() public {
        vm.prank(ADMIN);
        (bool marketing,) = address(founder).call(abi.encodeCall(
            founder.proposePayment,
            (true, PAYEE, uint128(100_000 ether), FoundingTreasuryAuthority420.Purpose.PARTNERSHIP,
             keccak256("campaign"), uint64(block.timestamp), uint64(block.timestamp + 10 days))
        ));
        require(!marketing, "marketing from contingency");
        vm.prank(JANET);
        bytes32 incident = _propose(true, PAYEE, 200_000 ether, FoundingTreasuryAuthority420.Purpose.SECURITY);
        vm.prank(ADMIN);
        (bool bypass,) = address(founder).call(abi.encodeCall(founder.schedulePayment, (incident)));
        require(!bypass, "no cosigner");
        vm.prank(ANDREW);
        founder.approvePayment(incident);
        vm.prank(JANET);
        (bool noNotice,) = address(founder).call(abi.encodeCall(founder.schedulePayment, (incident)));
        require(!noNotice, "notice or unanimous");
        vm.prank(ADMIN);
        founder.approvePayment(incident);
        vm.prank(ANDREW);
        founder.schedulePayment(incident);
        require(founder.contingencyCommitted() == 200_000 ether, "emergency cap");
    }

    function testRetirementIsIrreversibleAndDisablesFoundingWrites() public {
        vm.prank(ADMIN);
        (bool premature,) = address(founder).call(abi.encodeCall(founder.retire, ()));
        require(!premature, "premature");
        civic.setActive(true);
        readiness.setReady(true);
        founder.retire();
        require(founder.retired(), "retired");
        vm.prank(ADMIN);
        (bool proposal,) = address(founder).call(abi.encodeCall(
            founder.proposePayment,
            (false, PAYEE, uint128(1 ether), FoundingTreasuryAuthority420.Purpose.BOUNTY,
             keccak256("nope"), uint64(block.timestamp), uint64(block.timestamp + 100))
        ));
        require(!proposal, "founder still writes");
        (bool direct,) = address(budgets).call(abi.encodeCall(
            budgets.createBudget,
            (keccak256("intrusion"), OPS, TreasuryIds420.BUDGET_ECOSYSTEM, address(0),
             uint128(1 ether), uint64(block.timestamp), uint64(block.timestamp + 100),
             keccak256("test"), keccak256("test"))
        ));
        require(!direct, "unprivileged write");
    }
}
