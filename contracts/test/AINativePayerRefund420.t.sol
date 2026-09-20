// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/ai/AINativeSettlementWithRefund420.sol";

contract RefundManagerMock420 {
    mapping(bytes32 => AIJobManager.Job) internal jobs;
    function seed(bytes32 id, address payer, bytes32 provider, bytes32 funding, uint256 amount,
        AIJobManager.Status status) external {
        AIJobManager.Job storage j = jobs[id];
        j.requester = payer; j.providerId = provider; j.fundingRef = funding;
        j.fundedAmount = amount; j.status = status;
    }
    function setStatus(bytes32 id, AIJobManager.Status status) external { jobs[id].status = status; }
    function getJob(bytes32 id) external view returns (AIJobManager.Job memory) { return jobs[id]; }
}
contract RefundEscrowMock420 {
    error CloseRejected();
    address public immutable AI_JOB_MANAGER;
    address public settlementAdapter;
    bool public settlementAdapterBound;
    bool public failClose;
    mapping(bytes32 => AIJobEscrow.Escrow) public escrows;
    constructor(address manager_) { AI_JOB_MANAGER = manager_; }
    function bind(address adapter_) external { settlementAdapter = adapter_; settlementAdapterBound = true; }
    function seed(bytes32 id, address payer, address provider, bytes32 providerId, bytes32 vaultId,
        bytes32 fundingRef, uint256 amount) external {
        escrows[id] = AIJobEscrow.Escrow(payer, provider, providerId, vaultId, fundingRef,
            bytes32(0), amount, AIJobEscrow.EscrowState.FUNDED);
    }
    function markRefundable(bytes32 id, bytes32 ref) external {
        require(msg.sender == settlementAdapter && escrows[id].state == AIJobEscrow.EscrowState.FUNDED, "not bound");
        escrows[id].settlementRef = ref;
        escrows[id].state = AIJobEscrow.EscrowState.REFUNDABLE;
    }
    function refund(bytes32 id) external {
        require(msg.sender == settlementAdapter && escrows[id].state == AIJobEscrow.EscrowState.REFUNDABLE, "not refundable");
        if (failClose) revert CloseRejected();
        escrows[id].state = AIJobEscrow.EscrowState.CLOSED;
    }
    function setFailClose(bool v) external { failClose = v; }
}
contract RefundAccountingMock420 {
    mapping(bytes32 => VaultAccounting420.Obligation) internal obligations;
    function seed(bytes32 id, bytes32 vaultId, address beneficiary, uint256 amount, bytes32 ref) external {
        obligations[id] = VaultAccounting420.Obligation(vaultId, address(0), beneficiary, amount,
            keccak256("420AI_NATIVE_JOB_V1"), ref, 1, true);
    }
    function getObligation(bytes32 id) external view returns (VaultAccounting420.Obligation memory) { return obligations[id]; }
    function setState(bytes32 id, uint8 state) external { obligations[id].state = state; }
    function create(bytes32 id, bytes32 vaultId, address payer, uint256 amount, bytes32 kind, bytes32 ref) external {
        require(!obligations[id].exists, "duplicate obligation");
        obligations[id] = VaultAccounting420.Obligation(vaultId, address(0), payer, amount, kind, ref, 1, true);
    }
}
contract RefundVaultMock420 {
    error ClaimRejected();
    error ReceiverRejected();
    bytes32 public immutable vaultId;
    RefundAccountingMock420 public accounting;
    bool public rejectClaim;
    mapping(bytes32 => bool) public executedOperation;
    constructor(bytes32 id, RefundAccountingMock420 a) { vaultId = id; accounting = a; }
    function setRejectClaim(bool v) external { rejectClaim = v; }
    function consume(bytes32 operation) internal { require(!executedOperation[operation], "replay"); executedOperation[operation] = true; }
    function cancelObligation(bytes32 op, bytes32 id) external {
        consume(op); require(accounting.getObligation(id).state == 1, "not reserved"); accounting.setState(id, 4);
    }
    function createObligation(bytes32 op, bytes32 id, address asset, address payer,
        uint256 amount, bytes32 kind, bytes32 ref) external {
        consume(op); require(asset == address(0), "not native"); accounting.create(id, vaultId, payer, amount, kind, ref);
    }
    function releaseObligation(bytes32 op, bytes32 id) external {
        consume(op); require(accounting.getObligation(id).state == 1, "not reserved"); accounting.setState(id, 2);
    }
    function claim(bytes32 op, bytes32 id) external {
        if (rejectClaim) revert ClaimRejected();
        consume(op);
        VaultAccounting420.Obligation memory o = accounting.getObligation(id);
        require(o.state == 2, "not claimable");
        accounting.setState(id, 3);
        (bool ok,) = payable(o.beneficiary).call{value: o.amount}("");
        if (!ok) revert ReceiverRejected();
    }
    receive() external payable {}
}
contract RefundFundingMock420 {
    address public immutable manager;
    address public immutable escrow;
    address public immutable vault;
    bytes32 public immutable vaultRef;
    mapping(bytes32 => bool) public consumedJob;
    mapping(bytes32 => bytes32) public obligationForJob;
    constructor(address m, address e, address v, bytes32 id) { manager = m; escrow = e; vault = v; vaultRef = id; }
    function seed(bytes32 job, bytes32 obligation) external { consumedJob[job] = true; obligationForJob[job] = obligation; }
}
contract RefundRejectPayee420 { receive() external payable { revert("recipient rejected"); } }

contract AINativePayerRefund420Test is Test {
    bytes32 constant JOB = keccak256("refund-job");
    bytes32 constant FUNDING = keccak256("refund-funding");
    bytes32 constant PROVIDER = keccak256("refund-provider");
    bytes32 constant VAULT = keccak256("refund-vault");
    bytes32 constant DECISION = keccak256("approved-full-refund");
    address constant PAYER = address(0xBEEF);
    address constant BENEFICIARY = address(0xCAFE);
    uint256 constant AMOUNT = 1 ether;
    RefundManagerMock420 manager;
    RefundEscrowMock420 escrow;
    RefundAccountingMock420 accounting;
    RefundVaultMock420 vault;
    RefundFundingMock420 funding;
    AINativeSettlementWithRefund420 settlement;
    bytes32 original;

    function setUp() public {
        manager = new RefundManagerMock420();
        escrow = new RefundEscrowMock420(address(manager));
        accounting = new RefundAccountingMock420();
        vault = new RefundVaultMock420(VAULT, accounting);
        funding = new RefundFundingMock420(address(manager), address(escrow), address(vault), VAULT);
        settlement = new AINativeSettlementWithRefund420(address(this), address(manager), payable(address(escrow)),
            address(funding), payable(address(vault)), VAULT);
        original = keccak256(abi.encode("420AI_NATIVE_OBLIGATION_V1", FUNDING));
        manager.seed(JOB, PAYER, PROVIDER, FUNDING, AMOUNT, AIJobManager.Status.FAILED);
        escrow.seed(JOB, PAYER, BENEFICIARY, PROVIDER, VAULT, FUNDING, AMOUNT);
        escrow.bind(address(settlement));
        accounting.seed(original, VAULT, BENEFICIARY, AMOUNT, FUNDING);
        funding.seed(JOB, original);
        vm.deal(address(vault), AMOUNT);
    }
    function state() internal view returns (AIJobEscrow.EscrowState s) { (,,,,,,,s) = escrow.escrows(JOB); }
    function refundId() internal view returns (bytes32) {
        (,,,,,bytes32 ref,,) = escrow.escrows(JOB);
        return keccak256(abi.encode("420AI_REFUND_OBLIGATION_V1", FUNDING, JOB, ref));
    }
    function assertRolledBack() internal view {
        assertEq(uint256(state()), uint256(AIJobEscrow.EscrowState.FUNDED));
        assertEq(uint256(accounting.getObligation(original).state), 1);
        assertEq(address(vault).balance, AMOUNT);
        assertEq(settlement.refundedJob(JOB) ? uint256(1) : uint256(0), 0);
    }
    function testFullRefundCancelsProviderAndActuallyPaysOriginalPayer() public {
        uint256 beforeBalance = PAYER.balance;
        settlement.refundPayer(JOB, DECISION);
        assertEq(PAYER.balance, beforeBalance + AMOUNT);
        assertEq(BENEFICIARY.balance, 0);
        assertEq(address(vault).balance, 0);
        assertEq(uint256(accounting.getObligation(original).state), 4);
        VaultAccounting420.Obligation memory o = accounting.getObligation(refundId());
        assertEq(o.beneficiary, PAYER);
        assertEq(o.amount, AMOUNT);
        assertEq(uint256(o.state), 3);
        assertEq(uint256(state()), uint256(AIJobEscrow.EscrowState.CLOSED));
    }
    function testUnauthorizedReplayAndCompetingProviderSettlementReject() public {
        vm.prank(PAYER);
        vm.expectRevert(AINativeSettlementWithRefund420.RefundUnauthorized.selector);
        settlement.refundPayer(JOB, DECISION);
        settlement.refundPayer(JOB, DECISION);
        vm.expectRevert(AINativeSettlementWithRefund420.RefundReplay.selector);
        settlement.refundPayer(JOB, DECISION);
    }
    function testActivelyDisputedAndVerifiedJobsCannotRefund() public {
        manager.setStatus(JOB, AIJobManager.Status.DISPUTED);
        vm.expectRevert(AINativeSettlementWithRefund420.RefundInvalidJob.selector);
        settlement.refundPayer(JOB, DECISION);
        manager.setStatus(JOB, AIJobManager.Status.VERIFIED);
        vm.expectRevert(AINativeSettlementWithRefund420.RefundInvalidJob.selector);
        settlement.refundPayer(JOB, DECISION);
        assertRolledBack();
    }
    function testClaimFailureRollsBackCancellationAndRefundCreation() public {
        vault.setRejectClaim(true);
        vm.expectRevert(RefundVaultMock420.ClaimRejected.selector);
        settlement.refundPayer(JOB, DECISION);
        assertRolledBack();
        vault.setRejectClaim(false);
        settlement.refundPayer(JOB, DECISION);
    }
    function testEscrowFailureRevertsNativeTransfer() public {
        escrow.setFailClose(true);
        uint256 beforeBalance = PAYER.balance;
        vm.expectRevert(RefundEscrowMock420.CloseRejected.selector);
        settlement.refundPayer(JOB, DECISION);
        assertEq(PAYER.balance, beforeBalance);
        assertRolledBack();
    }
    function testRejectedPayerTransferRevertsEverything() public {
        RefundRejectPayee420 rejecting = new RefundRejectPayee420();
        manager.seed(JOB, address(rejecting), PROVIDER, FUNDING, AMOUNT, AIJobManager.Status.FAILED);
        escrow.seed(JOB, address(rejecting), BENEFICIARY, PROVIDER, VAULT, FUNDING, AMOUNT);
        vm.expectRevert(RefundVaultMock420.ReceiverRejected.selector);
        settlement.refundPayer(JOB, DECISION);
        assertRolledBack();
    }
    function testProviderObligationAlreadyClaimableCannotRefund() public {
        accounting.setState(original, 2);
        vm.expectRevert(AINativeSettlementWithRefund420.RefundInvalidObligation.selector);
        settlement.refundPayer(JOB, DECISION);
        assertEq(uint256(state()), uint256(AIJobEscrow.EscrowState.FUNDED));
    }
}
