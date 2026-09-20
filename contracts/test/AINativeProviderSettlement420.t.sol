// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/ai/AINativeProviderSettlement420.sol";

contract SettlementManagerMock420 {
    mapping(bytes32 => AIJobManager.Job) internal jobs;
    function setJob(bytes32 id, address payer, bytes32 provider, bytes32 fundingRef, uint256 amount,
        AIJobManager.Status status) external {
        AIJobManager.Job storage j = jobs[id];
        j.requester = payer;
        j.providerId = provider;
        j.fundingRef = fundingRef;
        j.fundedAmount = amount;
        j.status = status;
    }
    function setStatus(bytes32 id, AIJobManager.Status status) external { jobs[id].status = status; }
    function getJob(bytes32 id) external view returns (AIJobManager.Job memory) { return jobs[id]; }
}
contract SettlementEscrowMock420 {
    error MockCloseRejected();
    address public immutable AI_JOB_MANAGER;
    address public settlementAdapter;
    bool public settlementAdapterBound;
    bool public rejectClose;
    mapping(bytes32 => AIJobEscrow.Escrow) public escrows;
    constructor(address manager_) { AI_JOB_MANAGER = manager_; }
    function bind(address adapter_) external { settlementAdapter = adapter_; settlementAdapterBound = true; }
    function seed(bytes32 job, address payer, address beneficiary, bytes32 provider, bytes32 vaultRef,
        bytes32 fundingRef, uint256 amount) external {
        escrows[job] = AIJobEscrow.Escrow(payer, beneficiary, provider, vaultRef, fundingRef,
            bytes32(0), amount, AIJobEscrow.EscrowState.FUNDED);
    }
    function setRejectClose(bool reject_) external { rejectClose = reject_; }
    function markClaimable(bytes32 job, bytes32 settlementRef) external {
        require(msg.sender == settlementAdapter && escrows[job].state == AIJobEscrow.EscrowState.FUNDED, "not bound");
        escrows[job].settlementRef = settlementRef;
        escrows[job].state = AIJobEscrow.EscrowState.CLAIMABLE;
    }
    function release(bytes32 job, address payable recipient) external {
        require(msg.sender == settlementAdapter, "not bound");
        if (rejectClose) revert MockCloseRejected();
        require(escrows[job].state == AIJobEscrow.EscrowState.CLAIMABLE
            && escrows[job].beneficiary == recipient, "wrong recipient");
        escrows[job].state = AIJobEscrow.EscrowState.CLOSED;
    }
}
contract SettlementAccountingMock420 {
    mapping(bytes32 => VaultAccounting420.Obligation) internal obligations;
    function seed(bytes32 id, bytes32 vaultRef, address beneficiary, uint256 amount, bytes32 fundingRef) external {
        obligations[id] = VaultAccounting420.Obligation(vaultRef, address(0), beneficiary, amount,
            keccak256("420AI_NATIVE_JOB_V1"), fundingRef, 1, true);
    }
    function setBeneficiary(bytes32 id, address beneficiary) external { obligations[id].beneficiary = beneficiary; }
    function setState(bytes32 id, uint8 state) external { obligations[id].state = state; }
    function getObligation(bytes32 id) external view returns (VaultAccounting420.Obligation memory) {
        return obligations[id];
    }
}
contract SettlementVaultMock420 {
    error MockClaimRejected();
    bytes32 public immutable vaultId;
    SettlementAccountingMock420 public accounting;
    bool public rejectClaim;
    mapping(bytes32 => bool) public executedOperation;
    constructor(bytes32 id, SettlementAccountingMock420 accounting_) { vaultId = id; accounting = accounting_; }
    function setRejectClaim(bool reject_) external { rejectClaim = reject_; }
    function releaseObligation(bytes32 operation, bytes32 obligationId) external {
        require(!executedOperation[operation], "replay");
        executedOperation[operation] = true;
        require(accounting.getObligation(obligationId).state == 1, "not reserved");
        accounting.setState(obligationId, 2);
    }
    function claim(bytes32 operation, bytes32 obligationId) external {
        if (rejectClaim) revert MockClaimRejected();
        require(!executedOperation[operation], "claim replay");
        VaultAccounting420.Obligation memory o = accounting.getObligation(obligationId);
        require(o.state == 2 && address(this).balance >= o.amount, "not claimable");
        executedOperation[operation] = true;
        accounting.setState(obligationId, 3);
        (bool ok,) = payable(o.beneficiary).call{value: o.amount}("");
        require(ok, "receiver rejected");
    }
    receive() external payable {}
}
contract SettlementFundingMock420 {
    address public immutable manager;
    address public immutable escrow;
    address public immutable vault;
    bytes32 public immutable vaultRef;
    mapping(bytes32 => bool) public consumedJob;
    mapping(bytes32 => bytes32) public obligationForJob;
    constructor(address manager_, address escrow_, address vault_, bytes32 vaultRef_) {
        manager = manager_; escrow = escrow_; vault = vault_; vaultRef = vaultRef_;
    }
    function seed(bytes32 jobId, bytes32 obligationId) external {
        consumedJob[jobId] = true;
        obligationForJob[jobId] = obligationId;
    }
}
contract RejectNativePayment420 {
    error NativePaymentRejected();
    receive() external payable { revert NativePaymentRejected(); }
}

contract AINativeProviderSettlement420Test is Test {
    bytes32 constant JOB = keccak256("settlement-job");
    bytes32 constant FUNDING = keccak256("settlement-funding");
    bytes32 constant PROVIDER = keccak256("settlement-provider");
    bytes32 constant VAULT = keccak256("settlement-vault");
    bytes32 constant DECISION = keccak256("independent-approved-settlement");
    address constant PAYER = address(0xBEEF);
    address constant BENEFICIARY = address(0xCAFE);
    uint256 constant AMOUNT = 1 ether;
    SettlementManagerMock420 manager;
    SettlementEscrowMock420 escrow;
    SettlementAccountingMock420 accounting;
    SettlementVaultMock420 vault;
    SettlementFundingMock420 funding;
    AINativeProviderSettlement420 settlement;
    bytes32 obligationId;

    function setUp() public {
        manager = new SettlementManagerMock420();
        escrow = new SettlementEscrowMock420(address(manager));
        accounting = new SettlementAccountingMock420();
        vault = new SettlementVaultMock420(VAULT, accounting);
        funding = new SettlementFundingMock420(address(manager), address(escrow), address(vault), VAULT);
        settlement = new AINativeProviderSettlement420(address(this), address(manager), payable(address(escrow)),
            address(funding), payable(address(vault)), VAULT);
        obligationId = keccak256(abi.encode("420AI_NATIVE_OBLIGATION_V1", FUNDING));
        manager.setJob(JOB, PAYER, PROVIDER, FUNDING, AMOUNT, AIJobManager.Status.VERIFIED);
        escrow.seed(JOB, PAYER, BENEFICIARY, PROVIDER, VAULT, FUNDING, AMOUNT);
        escrow.bind(address(settlement));
        accounting.seed(obligationId, VAULT, BENEFICIARY, AMOUNT, FUNDING);
        funding.seed(JOB, obligationId);
        vm.deal(address(vault), AMOUNT);
    }
    function state() internal view returns (AIJobEscrow.EscrowState s) {
        (,,,,,,,s) = escrow.escrows(JOB);
    }
    function testFullProviderClaimTransfersThenClosesEscrow() public {
        uint256 beforeBalance = BENEFICIARY.balance;
        settlement.payProvider(JOB, DECISION);
        assertEq(BENEFICIARY.balance, beforeBalance + AMOUNT);
        assertEq(address(vault).balance, 0);
        assertEq(uint256(accounting.getObligation(obligationId).state), 3);
        assertEq(uint256(state()), uint256(AIJobEscrow.EscrowState.CLOSED));
        assertEq(settlement.settledJob(JOB) ? uint256(1) : uint256(0), 1);
    }
    function testUnauthorizedAndReplayReject() public {
        vm.prank(PAYER);
        vm.expectRevert(AINativeProviderSettlement420.Unauthorized.selector);
        settlement.payProvider(JOB, DECISION);
        settlement.payProvider(JOB, DECISION);
        vm.expectRevert(AINativeProviderSettlement420.Replay.selector);
        settlement.payProvider(JOB, DECISION);
    }
    function testDisputeAndUnverifiedJobCannotPay() public {
        manager.setStatus(JOB, AIJobManager.Status.DISPUTED);
        vm.expectRevert(AINativeProviderSettlement420.InvalidSettlement.selector);
        settlement.payProvider(JOB, DECISION);
        manager.setStatus(JOB, AIJobManager.Status.RESULT_COMMITTED);
        vm.expectRevert(AINativeProviderSettlement420.InvalidSettlement.selector);
        settlement.payProvider(JOB, DECISION);
        assertEq(BENEFICIARY.balance, 0);
    }
    function testWrongBeneficiaryAndPreviouslyReleasedObligationReject() public {
        accounting.setBeneficiary(obligationId, PAYER);
        vm.expectRevert(AINativeProviderSettlement420.InvalidObligation.selector);
        settlement.payProvider(JOB, DECISION);
        accounting.setBeneficiary(obligationId, BENEFICIARY);
        accounting.setState(obligationId, 2);
        vm.expectRevert(AINativeProviderSettlement420.InvalidObligation.selector);
        settlement.payProvider(JOB, DECISION);
    }
    function testClaimFailureRollsBackReleaseAndEscrow() public {
        vault.setRejectClaim(true);
        vm.expectRevert(SettlementVaultMock420.MockClaimRejected.selector);
        settlement.payProvider(JOB, DECISION);
        assertEq(uint256(state()), uint256(AIJobEscrow.EscrowState.FUNDED));
        assertEq(uint256(accounting.getObligation(obligationId).state), 1);
        assertEq(settlement.settledJob(JOB) ? uint256(1) : uint256(0), 0);
        vault.setRejectClaim(false);
        settlement.payProvider(JOB, DECISION);
    }
    function testEscrowCallbackFailureRollsBackNativePayment() public {
        escrow.setRejectClose(true);
        vm.expectRevert(SettlementEscrowMock420.MockCloseRejected.selector);
        settlement.payProvider(JOB, DECISION);
        assertEq(BENEFICIARY.balance, 0);
        assertEq(address(vault).balance, AMOUNT);
        assertEq(uint256(state()), uint256(AIJobEscrow.EscrowState.FUNDED));
        assertEq(uint256(accounting.getObligation(obligationId).state), 1);
        escrow.setRejectClose(false);
        settlement.payProvider(JOB, DECISION);
    }
    function testRejectingRecipientRollsBackEverything() public {
        RejectNativePayment420 rejecting = new RejectNativePayment420();
        escrow.seed(JOB, PAYER, address(rejecting), PROVIDER, VAULT, FUNDING, AMOUNT);
        accounting.setBeneficiary(obligationId, address(rejecting));
        vm.expectRevert(RejectNativePayment420.NativePaymentRejected.selector);
        settlement.payProvider(JOB, DECISION);
        assertEq(address(vault).balance, AMOUNT);
        assertEq(uint256(state()), uint256(AIJobEscrow.EscrowState.FUNDED));
        assertEq(uint256(accounting.getObligation(obligationId).state), 1);
    }
}
