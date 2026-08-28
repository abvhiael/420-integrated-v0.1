// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/ai/AIIds420.sol";
import "../src/ai/AIProviderRegistry.sol";
import "../src/ai/AIModelRegistry.sol";
import "../src/ai/AIJobManager.sol";
import "../src/ai/AIJobEscrow.sol";
import "../src/ai/AIReputationRegistry.sol";

interface VmAIHardening420 {
    function prank(address) external;
    function expectRevert(bytes4) external;
    function etch(address target, bytes calldata code) external;
}

contract MockAIJobManagerHardening420 {
    function confirmFunding(bytes32, bytes32, uint256) external {}
    function confirmSettlement(bytes32) external {}
    function confirmRefund(bytes32) external {}
}

contract AIHardening420Test {
    VmAIHardening420 constant vm = VmAIHardening420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address constant REQUESTER = address(0xA11CE);
    address constant COMPUTE = address(0xC011);
    address constant VAULT = address(0xA017);
    address constant SETTLEMENT = address(0x5E771E);
    address constant TRUST = address(0x7A057);

    function testFuzz_ProviderRegistrationCannotBeClaimedByAnotherCaller(bytes32 seed, address claimedOperator) public {
        AIProviderRegistry providers = new AIProviderRegistry(address(this));
        bytes32 providerId = seed == bytes32(0) ? bytes32(uint256(1)) : seed;
        address operator = claimedOperator == address(0) ? address(0xA11CE) : claimedOperator;
        address attacker = address(uint160(uint256(keccak256(abi.encode(providerId, operator, "attacker")))));
        if (attacker == address(0) || attacker == operator) attacker = address(0xB0B);
        if (attacker == operator) attacker = address(0xCAFE);

        vm.prank(attacker);
        vm.expectRevert(AIProviderRegistry.NotOperator.selector);
        providers.registerProvider(providerId, operator, operator, bytes32(0), bytes32(0), bytes32(0));
    }

    function testFuzz_FundingNeverExceedsRequesterMaximum(uint96 maxSpendSeed, uint96 excessSeed, bytes32 seed) public {
        AIJobManager jobs = new AIJobManager(address(this));
        uint256 maxSpend = uint256(maxSpendSeed) + 1;
        uint256 excess = uint256(excessSeed) + 1;
        uint256 attempted = maxSpend + excess;
        bytes32 jobId = seed == bytes32(0) ? bytes32(uint256(1)) : seed;

        vm.prank(REQUESTER);
        jobs.createRequest(
            jobId,
            keccak256(abi.encode(jobId, "model")),
            AIIds420.WORKLOAD_TEXT,
            keccak256(abi.encode(jobId, "request")),
            bytes32(0),
            bytes32(0),
            maxSpend,
            uint64(block.timestamp + 1 days)
        );

        vm.prank(jobs.AI_JOB_ESCROW());
        vm.expectRevert(AIJobManager.FundingExceedsMaximum.selector);
        jobs.confirmFunding(jobId, keccak256(abi.encode(jobId, "funding")), attempted);
    }

    function testFuzz_OnlyBoundComputeAdapterCanAdvance(bytes32 seed, address attackerSeed) public {
        AIJobManager jobs = new AIJobManager(address(this));
        jobs.bindComputeAdapter(COMPUTE);
        bytes32 jobId = seed == bytes32(0) ? bytes32(uint256(2)) : seed;
        address attacker = attackerSeed;
        if (attacker == address(0) || attacker == COMPUTE) attacker = address(0xBAD);

        vm.prank(REQUESTER);
        jobs.createRequest(
            jobId,
            keccak256(abi.encode(jobId, "model")),
            AIIds420.WORKLOAD_TEXT,
            keccak256(abi.encode(jobId, "request")),
            bytes32(0),
            bytes32(0),
            100,
            uint64(block.timestamp + 1 days)
        );
        vm.prank(jobs.AI_JOB_ESCROW());
        jobs.confirmFunding(jobId, keccak256(abi.encode(jobId, "funding")), 100);

        vm.prank(attacker);
        vm.expectRevert(AIJobManager.NotComputeAdapter.selector);
        jobs.matchCompute(jobId, keccak256("request"), keccak256("compute-job"), keccak256("provider"));
    }

    function testFuzz_EscrowBeneficiaryCannotBeRedirected(address payerSeed, address beneficiarySeed, address redirectSeed, bytes32 seed) public {
        AIJobEscrow escrow = new AIJobEscrow(address(this));
        MockAIJobManagerHardening420 manager = new MockAIJobManagerHardening420();
        vm.etch(escrow.AI_JOB_MANAGER(), address(manager).code);
        escrow.bindVaultAdapter(VAULT);
        escrow.bindSettlementAdapter(SETTLEMENT);

        address payer = payerSeed == address(0) ? address(0xA11CE) : payerSeed;
        address beneficiary = beneficiarySeed == address(0) ? address(0xB0B) : beneficiarySeed;
        address redirect = redirectSeed;
        if (redirect == address(0) || redirect == beneficiary) redirect = address(0xCAFE);
        if (redirect == beneficiary) redirect = address(0xD00D);
        bytes32 jobId = seed == bytes32(0) ? bytes32(uint256(3)) : seed;

        vm.prank(VAULT);
        escrow.confirmVaultFunding(
            jobId,
            payer,
            keccak256(abi.encode(jobId, "provider")),
            beneficiary,
            keccak256(abi.encode(jobId, "vault")),
            keccak256(abi.encode(jobId, "funding")),
            1
        );
        vm.prank(SETTLEMENT);
        escrow.markClaimable(jobId, keccak256(abi.encode(jobId, "settlement")));

        vm.prank(SETTLEMENT);
        vm.expectRevert(AIJobEscrow.InvalidRecipient.selector);
        escrow.release(jobId, payable(redirect));
    }

    function testFuzz_ReputationEvidenceCannotReplay(bytes32 providerSeed, bytes32 evidenceSeed) public {
        AIReputationRegistry reputation = new AIReputationRegistry(address(this));
        reputation.bindTrustAdapter(TRUST);
        bytes32 providerId = providerSeed == bytes32(0) ? bytes32(uint256(4)) : providerSeed;
        bytes32 evidenceId = evidenceSeed == bytes32(0) ? bytes32(uint256(5)) : evidenceSeed;

        vm.prank(TRUST);
        reputation.applyEvidence(providerId, evidenceId, AIIds420.OUTCOME_COMPLETED);
        vm.prank(TRUST);
        vm.expectRevert(AIReputationRegistry.EvidenceAlreadyApplied.selector);
        reputation.applyEvidence(providerId, evidenceId, AIIds420.OUTCOME_COMPLETED);
    }
}
