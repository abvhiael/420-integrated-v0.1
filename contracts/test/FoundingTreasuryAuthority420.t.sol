// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/treasury/FoundingTreasuryAuthority420.sol";
import "../src/treasury/TreasuryAuthorization420.sol";
import "../src/governance/FoundingWalletClaims420.sol";

interface VmFounding420 {
    struct Log { bytes32[] topics; bytes data; address emitter; }
    function prank(address caller) external;
    function warp(uint256 nextTimestamp) external;
    function recordLogs() external;
    function getRecordedLogs() external returns (Log[] memory);
}

contract ReadinessMockFounding420 is IFoundingRetirementReadiness420 {
    bool public override retirementReady;
    bool public override retirementExecutionAuthorized;
    function setReady(bool value) external {
        retirementReady = value;
        retirementExecutionAuthorized = value;
    }
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

    function testPublicNoticeRevealsImmutablePurposeBeforeFortyEightHours() public {
        bytes32 caseEvidence = keccak256("independently-reviewed-contract-evidence");
        uint64 proposed = uint64(block.timestamp);
        vm.recordLogs();
        vm.prank(ANDREW);
        bytes32 paymentId = founder.proposePayment(
            false, PAYEE, uint128(110_000 ether),
            FoundingTreasuryAuthority420.Purpose.INFRASTRUCTURE,
            caseEvidence, proposed, proposed + 10 days
        );
        VmFounding420.Log[] memory emitted = vm.getRecordedLogs();
        bytes32 eventId = keccak256(
            "FoundingPaymentNotice(bytes32,bytes32,bytes32,uint64,uint64,uint64,bool)"
        );
        bytes32 reviewedPurpose;
        bool found;
        for (uint256 i; i < emitted.length; ++i) {
            if (emitted[i].emitter == address(founder) &&
                emitted[i].topics.length == 4 && emitted[i].topics[0] == eventId) {
                require(emitted[i].topics[1] == paymentId &&
                        emitted[i].topics[2] == caseEvidence, "notice identity/evidence mismatch");
                reviewedPurpose = emitted[i].topics[3];
                (uint64 whenProposed, uint64 notBefore, uint64 expiry, bool twoRequired) =
                    abi.decode(emitted[i].data, (uint64, uint64, uint64, bool));
                require(whenProposed == proposed && notBefore == proposed &&
                        expiry == proposed + 10 days && twoRequired,
                        "notice failed to disclose immutable approval window");
                found = true;
            }
        }
        require(found && reviewedPurpose != bytes32(0),
                "no public case/purpose notice issued at proposal time");
        vm.prank(JANET);
        founder.approvePayment(paymentId);
        vm.prank(ANDREW);
        (bool premature,) = address(founder).call(
            abi.encodeCall(founder.schedulePayment, (paymentId))
        );
        require(!premature, "approved exceptional payment bypassed 48-hour notice");
        vm.warp(uint256(proposed) + 49 hours);
        vm.prank(ANDREW);
        bytes32 disbId = founder.schedulePayment(paymentId);
        require(disb.disbursement(disbId).purposeHash == reviewedPurpose,
                "scheduled payment replaced public purpose after notice");
    }

    function testDuplicateDetailsProduceDistinctPurposeBoundDisbursements() public {
        // Both proposals have identical recipient/amount/evidence/time boundaries.
        // Distinct payment IDs must not alias one canonical Treasury disbursement.
        bytes32 evidence = keccak256("same-purpose-different-approved-payments");
        uint64 nowTime = uint64(block.timestamp);
        vm.prank(ADMIN);
        bytes32 first = founder.proposePayment(
            false, PAYEE, uint128(1 ether), FoundingTreasuryAuthority420.Purpose.BOUNTY,
            evidence, nowTime, nowTime + 10 days
        );
        vm.prank(ADMIN);
        bytes32 second = founder.proposePayment(
            false, PAYEE, uint128(1 ether), FoundingTreasuryAuthority420.Purpose.BOUNTY,
            evidence, nowTime, nowTime + 10 days
        );
        require(first != second, "duplicate payment ID");
        vm.prank(ADMIN);
        bytes32 firstId = founder.schedulePayment(first);
        vm.prank(ADMIN);
        bytes32 secondId = founder.schedulePayment(second);
        require(firstId != secondId, "canonical Treasury disbursement ID collision");
        require(disb.disbursement(firstId).purposeHash != disb.disbursement(secondId).purposeHash,
                "case evidence was not bound to unique payments");
        require(founder.rollingCommitted(false) == 2 ether, "each real payment must be counted");
    }

    function testContingencySameIncidentCannotSplitAcrossRecipients() public {
        bytes32 incident = keccak256("shared-security-incident-id");
        uint64 nowTime = uint64(block.timestamp);
        vm.prank(ADMIN);
        bytes32 first = founder.proposePayment(
            true, PAYEE, uint128(150_000 ether), FoundingTreasuryAuthority420.Purpose.SECURITY,
            incident, nowTime, nowTime + 10 days
        );
        vm.prank(JANET);
        founder.approvePayment(first);
        vm.prank(ANDREW);
        founder.approvePayment(first);
        vm.prank(ADMIN);
        founder.schedulePayment(first);
        require(founder.contingencyCommittedByIncident(incident) == 150_000 ether, "incident principal");

        vm.prank(ADMIN);
        bytes32 second = founder.proposePayment(
            true, address(0xB1CE), uint128(60_000 ether),
            FoundingTreasuryAuthority420.Purpose.SECURITY,
            incident, nowTime, nowTime + 10 days
        );
        vm.prank(JANET);
        founder.approvePayment(second);
        vm.prank(ANDREW);
        founder.approvePayment(second);
        vm.prank(ADMIN);
        founder.schedulePayment(second);
        require(founder.contingencyCommittedByIncident(incident) == 210_000 ether, "incident max");

        vm.prank(ADMIN);
        bytes32 third = founder.proposePayment(
            true, address(0xB2CE), uint128(1 ether),
            FoundingTreasuryAuthority420.Purpose.SECURITY,
            incident, nowTime, nowTime + 10 days
        );
        vm.prank(JANET);
        founder.approvePayment(third);
        vm.prank(ANDREW);
        founder.approvePayment(third);
        vm.prank(ADMIN);
        (bool split,) = address(founder).call(abi.encodeCall(founder.schedulePayment, (third)));
        require(!split, "incident limit bypassed by different recipients");
        require(founder.contingencyCommittedByIncident(incident) == 210_000 ether,
                "rejected incident changed accounting");
    }

    function testSeparateThirtyDayOperationsLimitRejectsEvenDifferentRecipients() public {
        uint64 proposalTime = uint64(block.timestamp);
        bytes32[2] memory authorized;
        // Foundry warp can cause an optimized block.timestamp within one test
        // function to be cached; authorize both payments before advancing time.
        for (uint256 i; i < 2; ++i) {
            vm.prank(ANDREW);
            authorized[i] = founder.proposePayment(
                false, address(uint160(0xB000 + i)), uint128(420_000 ether),
                FoundingTreasuryAuthority420.Purpose.INFRASTRUCTURE,
                keccak256(abi.encode("ops", i)), proposalTime, proposalTime + 10 days
            );
            vm.prank(JANET);
            founder.approvePayment(authorized[i]);
        }
        vm.warp(uint256(proposalTime) + 49 hours);
        for (uint256 i; i < 2; ++i) {
            vm.prank(ANDREW);
            founder.schedulePayment(authorized[i]);
        }
        require(founder.rollingCommitted(false) == 840_000 ether, "operations rolling sum");
        vm.prank(ADMIN);
        bytes32 extra = founder.proposePayment(
            false, address(0xBA77), uint128(1 ether),
            FoundingTreasuryAuthority420.Purpose.BOUNTY, keccak256("extra-ops"),
            proposalTime + 49 hours, proposalTime + 10 days
        );
        vm.prank(ADMIN);
        (bool overflow,) = address(founder).call(abi.encodeCall(founder.schedulePayment, (extra)));
        require(!overflow, "operations 30-day cap exceeded through multiple recipients");
        require(founder.operationsCommitted() == 840_000 ether, "failed operation recorded");
    }

    function testSeparateThirtyDayContingencyLimitRejectsDifferentIncidents() public {
        uint64 nowTime = uint64(block.timestamp);
        for (uint256 i; i < 2; ++i) {
            vm.prank(ANDREW);
            bytes32 paymentId = founder.proposePayment(
                true, address(uint160(0xD000 + i)), uint128(210_000 ether),
                FoundingTreasuryAuthority420.Purpose.SECURITY,
                keccak256(abi.encode("incident", i)), nowTime, nowTime + 10 days
            );
            vm.prank(JANET);
            founder.approvePayment(paymentId);
            vm.prank(ADMIN);
            founder.approvePayment(paymentId);
            vm.prank(ANDREW);
            founder.schedulePayment(paymentId);
            nowTime = uint64(block.timestamp);
        }
        require(founder.rollingCommitted(true) == 420_000 ether, "contingency rolling sum");
        vm.prank(ADMIN);
        bytes32 extra = _propose(
            true, address(0xD777), uint128(1 ether), FoundingTreasuryAuthority420.Purpose.SECURITY
        );
        vm.prank(ANDREW);
        founder.approvePayment(extra);
        vm.prank(JANET);
        founder.approvePayment(extra);
        vm.prank(ADMIN);
        (bool overflow,) = address(founder).call(abi.encodeCall(founder.schedulePayment, (extra)));
        require(!overflow, "contingency rolling cap exceeded through multiple incidents");
        require(founder.contingencyCommitted() == 420_000 ether, "failed contingency accounted");
    }

    function testExpiredProposalCannotBeApprovedOrScheduled() public {
        vm.prank(ADMIN);
        bytes32 id = _propose(false, PAYEE, uint128(1 ether), FoundingTreasuryAuthority420.Purpose.BOUNTY);
        vm.warp(block.timestamp + 11 days);
        vm.prank(JANET);
        (bool approved,) = address(founder).call(abi.encodeCall(founder.approvePayment, (id)));
        require(!approved, "expired payment gained approval");
        vm.prank(ADMIN);
        (bool scheduled,) = address(founder).call(abi.encodeCall(founder.schedulePayment, (id)));
        require(!scheduled, "expired proposal became a Treasury commitment");
    }

    function testGeneralGovernanceCannotBypassFoundingBudgetSchedulingLimits() public {
        uint64 nowTime = uint64(block.timestamp);
        bytes32 purposeHash = keccak256("unapproved-direct-governance-transfer");
        bytes32 budgetId = founder.operationsBudgetId();
        bytes32 forgedId = disb.canonicalId(
            budgetId, PAYEE, uint128(1 ether), nowTime, nowTime + 1 days,
            founder.operationsActionHash(), purposeHash
        );
        // The general GovernanceTimelock can schedule ordinary Civic budgets,
        // but cannot counterfeit a founding controller's budget commitment.
        vm.prank(disb.governanceTimelock());
        (bool bypass,) = address(disb).call(abi.encodeCall(
            disb.schedule, (forgedId, budgetId, PAYEE, uint128(1 ether), nowTime,
                nowTime + 1 days, founder.operationsActionHash(), purposeHash)
        ));
        require(!bypass, "general Treasury writer bypassed founding approval/rolling limits");
        require(budgets.budget(budgetId).committed == 0, "forgery reserved founding budget");
        require(founder.operationsCommitted() == 0, "forgery changed founding usage");
    }

    function testUnboundExecutorAndForgedReleaseMarkerAreRejected() public {
        vm.prank(ADMIN);
        bytes32 paymentId = _propose(false, PAYEE, uint128(1 ether), FoundingTreasuryAuthority420.Purpose.BOUNTY);
        vm.prank(ADMIN);
        bytes32 id = founder.schedulePayment(paymentId);
        vm.prank(ADMIN);
        (bool unbound,) = address(founder).call(abi.encodeCall(
            founder.executeApprovedRelease, (paymentId, address(0xDEAD), keccak256("fake"))
        ));
        require(!unbound, "unbound executor permitted a transfer");

        // This call is rejected by the founding settlement guard even before any
        // capability check, preventing forged executed-state/accounting records.
        (bool forged,) = address(disb).call(
            abi.encodeCall(disb.markExecuted, (id, keccak256("forged-vault-release")))
        );
        require(!forged, "disbursement forged without verified active founder release");
        require(disb.disbursement(id).state == TreasuryDisbursementRegistry420.State.SCHEDULED,
                "forged execution mutated Treasury record");
        require(budgets.budget(founder.operationsBudgetId()).executed == 0,
                "forged execution inflated settled funds");
    }

    function testUnsettledFoundingCommitmentBlocksEvenAuthorizedRetirement() public {
        civic.setActive(true);
        readiness.setReady(true);
        vm.prank(ADMIN);
        bytes32 id = _propose(false, PAYEE, uint128(1 ether), FoundingTreasuryAuthority420.Purpose.BOUNTY);
        vm.prank(ADMIN);
        founder.schedulePayment(id);
        require(founder.operationsCommitted() == 1 ether && founder.operationsReleased() == 0,
            "unpaid founding obligation");
        vm.prank(address(civic));
        (bool retiredWithDebt,) = address(founder).call(abi.encodeCall(founder.retire, ()));
        require(!retiredWithDebt && !founder.retired(), "unpaid commitment extinguished by retirement");
    }

    function testRetirementIsIrreversibleAndDisablesFoundingWrites() public {
        vm.prank(ADMIN);
        (bool premature,) = address(founder).call(abi.encodeCall(founder.retire, ()));
        require(!premature, "premature");
        civic.setActive(true);
        readiness.setReady(true);
        (bool unrelated,) = address(founder).call(abi.encodeCall(founder.retire, ()));
        require(!unrelated, "unrelated caller retired founder without real Timelock");
        vm.prank(address(civic));
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
