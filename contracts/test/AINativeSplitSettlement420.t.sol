// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/ai/AINativeSplitSettlement420.sol";
import "./AINativePayerRefund420.t.sol";

contract SplitEscrowMock420 is RefundEscrowMock420 {
    bytes32 public splitSettlement;
    bytes32 public providerObligation;
    bytes32 public payerObligation;
    uint256 public providerAmount;
    uint256 public payerAmount;
    constructor(address manager_) RefundEscrowMock420(manager_) {}
    function markSplitClaimable(bytes32 id, bytes32 ref, bytes32 providerId, bytes32 payerId,
        bytes32, bytes32, uint256 earned, uint256 unused) external {
        require(msg.sender == settlementAdapter && escrows[id].state == AIJobEscrow.EscrowState.FUNDED, "not bound");
        require(earned > 0 && unused > 0 && earned + unused == escrows[id].amount, "invalid split");
        splitSettlement = ref;
        providerObligation = providerId;
        payerObligation = payerId;
        providerAmount = earned;
        payerAmount = unused;
        escrows[id].settlementRef = ref;
        escrows[id].state = AIJobEscrow.EscrowState.SPLIT_CLAIMABLE;
    }
    function closeSplit(bytes32 id, bytes32 ref) external {
        require(msg.sender == settlementAdapter && escrows[id].state == AIJobEscrow.EscrowState.SPLIT_CLAIMABLE
            && splitSettlement == ref, "not split bound");
        if (failClose) revert CloseRejected();
        escrows[id].state = AIJobEscrow.EscrowState.CLOSED;
    }
}

contract AINativeSplitSettlement420Test is Test {
    bytes32 constant JOB = keccak256("native-split-job");
    bytes32 constant FUNDING = keccak256("native-split-funding");
    bytes32 constant PROVIDER_ID = keccak256("native-split-provider");
    bytes32 constant VAULT_ID = keccak256("native-split-vault");
    bytes32 constant DECISION = keccak256("native-split-approved");
    address constant PAYER = address(0xBEEF);
    address constant PROVIDER = address(0xCAFE);
    uint256 constant AMOUNT = 1 ether;
    uint256 constant EARNED = 0.37 ether;
    RefundManagerMock420 manager;
    SplitEscrowMock420 escrow;
    RefundAccountingMock420 accounting;
    RefundVaultMock420 vault;
    RefundFundingMock420 funding;
    AINativeSplitSettlement420 adapter;
    bytes32 original;

    function setUp() public {
        manager = new RefundManagerMock420();
        escrow = new SplitEscrowMock420(address(manager));
        accounting = new RefundAccountingMock420();
        vault = new RefundVaultMock420(VAULT_ID, accounting);
        funding = new RefundFundingMock420(address(manager), address(escrow), address(vault), VAULT_ID);
        adapter = new AINativeSplitSettlement420(address(this), address(manager), payable(address(escrow)),
            address(funding), payable(address(vault)), VAULT_ID);
        original = keccak256(abi.encode("420AI_NATIVE_OBLIGATION_V1", FUNDING));
        manager.seed(JOB, PAYER, PROVIDER_ID, FUNDING, AMOUNT, AIJobManager.Status.VERIFIED);
        escrow.seed(JOB, PAYER, PROVIDER, PROVIDER_ID, VAULT_ID, FUNDING, AMOUNT);
        escrow.bind(address(adapter));
        accounting.seed(original, VAULT_ID, PROVIDER, AMOUNT, FUNDING);
        funding.seed(JOB, original);
        vm.deal(address(vault), AMOUNT);
    }

    function escrowState() internal view returns (AIJobEscrow.EscrowState s) {
        (,,,,,,,s) = escrow.escrows(JOB);
    }
    function assertUnchanged() internal view {
        assertEq(uint256(escrowState()), uint256(AIJobEscrow.EscrowState.FUNDED));
        assertEq(uint256(accounting.getObligation(original).state), 1);
        assertEq(address(vault).balance, AMOUNT);
        assertEq(uint256(adapter.splitJob(JOB) ? 1 : 0), 0);
    }

    function testSplitPaysBothRecipientsAndCancelsProviderFullReservation() public {
        adapter.settleSplit(JOB, DECISION, EARNED);
        assertEq(PROVIDER.balance, EARNED);
        assertEq(PAYER.balance, AMOUNT - EARNED);
        assertEq(address(vault).balance, 0);
        assertEq(uint256(accounting.getObligation(original).state), 4);
        VaultAccounting420.Obligation memory provider = accounting.getObligation(escrow.providerObligation());
        VaultAccounting420.Obligation memory payer = accounting.getObligation(escrow.payerObligation());
        assertEq(uint256(provider.beneficiary), uint256(uint160(PROVIDER)));
        assertEq(uint256(payer.beneficiary), uint256(uint160(PAYER)));
        assertEq(provider.amount, EARNED);
        assertEq(payer.amount, AMOUNT - EARNED);
        assertEq(uint256(provider.state), 3);
        assertEq(uint256(payer.state), 3);
        assertEq(uint256(escrowState()), uint256(AIJobEscrow.EscrowState.CLOSED));
        assertEq(uint256(escrow.providerAmount() + escrow.payerAmount()), AMOUNT);
    }

    function testOnlyGovernanceAndCannotReplayOrCompeteAfterSplit() public {
        vm.prank(PAYER);
        vm.expectRevert(AINativeSplitSettlement420.SplitUnauthorized.selector);
        adapter.settleSplit(JOB, DECISION, EARNED);
        assertUnchanged();
        adapter.settleSplit(JOB, DECISION, EARNED);
        vm.expectRevert(AINativeSplitSettlement420.SplitReplay.selector);
        adapter.settleSplit(JOB, DECISION, EARNED);
        vm.expectRevert(AINativeProviderSettlement420.InvalidSettlement.selector);
        adapter.payProvider(JOB, DECISION);
    }

    function testBothLegsMustBeNonzeroAndOriginalMustStillBeReserved() public {
        vm.expectRevert(AINativePartialSettlementPlan420.InvalidSplit.selector);
        adapter.settleSplit(JOB, DECISION, 0);
        vm.expectRevert(AINativePartialSettlementPlan420.InvalidSplit.selector);
        adapter.settleSplit(JOB, DECISION, AMOUNT);
        assertUnchanged();
        accounting.setState(original, 2);
        vm.expectRevert(AINativeSplitSettlement420.SplitInvalidObligation.selector);
        adapter.settleSplit(JOB, DECISION, EARNED);
    }

    function testDisputeBlocksBothTransfers() public {
        manager.setStatus(JOB, AIJobManager.Status.DISPUTED);
        vm.expectRevert(AINativeSplitSettlement420.SplitInvalidJob.selector);
        adapter.settleSplit(JOB, DECISION, EARNED);
        assertUnchanged();
    }

    function testSecondRecipientFailureRollsBackFirstTransferAndOriginalCancellation() public {
        RefundRejectPayee420 reject = new RefundRejectPayee420();
        manager.seed(JOB, address(reject), PROVIDER_ID, FUNDING, AMOUNT, AIJobManager.Status.VERIFIED);
        escrow.seed(JOB, address(reject), PROVIDER, PROVIDER_ID, VAULT_ID, FUNDING, AMOUNT);
        vm.expectRevert(RefundVaultMock420.ReceiverRejected.selector);
        adapter.settleSplit(JOB, DECISION, EARNED);
        assertEq(PROVIDER.balance, 0);
        assertUnchanged();
    }

    function testEscrowCloseFailureRollsBackBothNativeClaims() public {
        escrow.setFailClose(true);
        vm.expectRevert(RefundEscrowMock420.CloseRejected.selector);
        adapter.settleSplit(JOB, DECISION, EARNED);
        assertEq(PROVIDER.balance, 0);
        assertEq(PAYER.balance, 0);
        assertUnchanged();
    }

    function testClaimRejectionRollsBackAllReservations() public {
        vault.setRejectClaim(true);
        vm.expectRevert(RefundVaultMock420.ClaimRejected.selector);
        adapter.settleSplit(JOB, DECISION, EARNED);
        assertUnchanged();
    }
}
