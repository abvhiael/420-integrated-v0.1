// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/ai/AINativeVaultFundingAdapter420.sol";

contract MockNativeJobManager420 {
    mapping(bytes32 => AIJobManager.Job) internal _jobs;
    function setJob(bytes32 id, address payer, uint256 maxSpend, uint64 deadline) external {
        AIJobManager.Job storage j = _jobs[id];
        j.requester = payer;
        j.maxSpend = maxSpend;
        j.deadline = deadline;
        j.status = AIJobManager.Status.CREATED;
    }
    function getJob(bytes32 id) external view returns (AIJobManager.Job memory) { return _jobs[id]; }
}

contract MockNativeEscrow420 {
    address public immutable AI_JOB_MANAGER;
    address public vaultAdapter;
    bool public vaultAdapterBound;
    bool public rejectFunding;
    mapping(bytes32 => uint256) public funded;
    constructor(address manager_) { AI_JOB_MANAGER = manager_; }
    function bindVaultAdapter(address adapter_) external { vaultAdapter = adapter_; vaultAdapterBound = true; }
    function setReject(bool reject_) external { rejectFunding = reject_; }
    function confirmVaultFunding(bytes32 id, address, bytes32, address, bytes32, bytes32, uint256 value) external {
        require(msg.sender == vaultAdapter && !rejectFunding, "escrow rejected");
        funded[id] = value;
    }
}

contract MockNativeAccounting420 {
    mapping(bytes32 => VaultAccounting420.Obligation) internal _obligations;
    function record(bytes32 id, bytes32 vaultId, address beneficiary, uint256 amount, bytes32 sourceRef) external {
        require(!_obligations[id].exists, "duplicate obligation");
        _obligations[id] = VaultAccounting420.Obligation(vaultId, address(0), beneficiary, amount,
            keccak256("420AI_NATIVE_JOB_V1"), sourceRef, 1, true);
    }
    function getObligation(bytes32 id) external view returns (VaultAccounting420.Obligation memory) {
        return _obligations[id];
    }
}

contract MockNativeVault420 {
    bytes32 public immutable vaultId;
    MockNativeAccounting420 public accounting;
    address public registry = address(0xA1);
    address public authorization = address(0xA2);
    bool public rejectObligation;
    mapping(bytes32 => bool) public operations;
    constructor(bytes32 vaultId_, MockNativeAccounting420 accounting_) { vaultId = vaultId_; accounting = accounting_; }
    function setReject(bool reject_) external { rejectObligation = reject_; }
    function depositNative() external payable { require(msg.value > 0, "empty deposit"); }
    function createObligation(bytes32 operationId, bytes32 obligationId, address asset,
        address beneficiary, uint256 amount, bytes32, bytes32 sourceRef) external {
        require(!rejectObligation && !operations[operationId] && asset == address(0)
            && address(this).balance >= amount, "vault reservation rejected");
        operations[operationId] = true;
        accounting.record(obligationId, vaultId, beneficiary, amount, sourceRef);
    }
}

contract AINativeVaultFundingAdapter420Test is Test {
    bytes32 constant JOB = keccak256("job");
    bytes32 constant JOB2 = keccak256("job2");
    bytes32 constant PROVIDER_ID = keccak256("provider");
    bytes32 constant VAULT_ID = keccak256("vault");
    bytes32 constant NONCE = keccak256("nonce");
    address constant PAYER = address(0xBEEF);
    address constant OTHER = address(0xCAFE);
    address constant BENEFICIARY = address(0xD00D);

    MockNativeJobManager420 manager;
    AIProviderRegistry providers;
    MockNativeEscrow420 escrow;
    MockNativeAccounting420 accounting;
    MockNativeVault420 vault;
    AINativeVaultFundingAdapter420 adapter;

    function setUp() public {
        manager = new MockNativeJobManager420();
        providers = new AIProviderRegistry(address(this));
        escrow = new MockNativeEscrow420(address(manager));
        accounting = new MockNativeAccounting420();
        vault = new MockNativeVault420(VAULT_ID, accounting);
        adapter = new AINativeVaultFundingAdapter420(address(manager), address(providers),
            address(escrow), payable(address(vault)), VAULT_ID);
        escrow.bindVaultAdapter(address(adapter));
        manager.setJob(JOB, PAYER, 10 ether, uint64(block.timestamp + 1 days));
        manager.setJob(JOB2, PAYER, 10 ether, uint64(block.timestamp + 1 days));
        vm.prank(OTHER);
        providers.registerProvider(PROVIDER_ID, OTHER, BENEFICIARY, keccak256("metadata"),
            keccak256("stake"), keccak256("compute"));
        vm.prank(OTHER);
        providers.activate(PROVIDER_ID);
        vm.deal(PAYER, 20 ether);
        vm.deal(OTHER, 20 ether);
    }

    function fund(bytes32 job, bytes32 nonce) internal {
        vm.prank(PAYER);
        adapter.fundNative{value: 1 ether}(job, PROVIDER_ID, nonce);
    }

    function testAtomicFundingDepositsReservesAndConfirmsExactAmount() public {
        fund(JOB, NONCE);
        bytes32 obligationId = adapter.obligationForJob(JOB);
        VaultAccounting420.Obligation memory o = accounting.getObligation(obligationId);
        assertTrue(o.exists);
        assertEq(o.vaultId, VAULT_ID);
        assertEq(o.asset, address(0));
        assertEq(o.beneficiary, BENEFICIARY);
        assertEq(o.amount, 1 ether);
        assertEq(o.state, 1);
        assertEq(o.sourceRef, keccak256(abi.encode(block.chainid, address(adapter), JOB, PAYER, NONCE)));
        assertEq(address(vault).balance, 1 ether);
        assertEq(address(adapter).balance, 0);
        assertEq(escrow.funded(JOB), 1 ether);
        assertTrue(adapter.consumedJob(JOB));
        assertTrue(adapter.consumedNonce(PAYER, NONCE));
    }

    function testRejectsOtherPayerAndReusedJobOrNonce() public {
        vm.prank(OTHER);
        vm.expectRevert(AINativeVaultFundingAdapter420.UnauthorizedPayer.selector);
        adapter.fundNative{value: 1 ether}(JOB, PROVIDER_ID, NONCE);
        fund(JOB, NONCE);
        vm.prank(PAYER);
        vm.expectRevert(AINativeVaultFundingAdapter420.FundingReplay.selector);
        adapter.fundNative{value: 1 ether}(JOB, PROVIDER_ID, keccak256("new nonce"));
        vm.prank(PAYER);
        vm.expectRevert(AINativeVaultFundingAdapter420.FundingReplay.selector);
        adapter.fundNative{value: 1 ether}(JOB2, PROVIDER_ID, NONCE);
    }

    function testVaultFailureRollsBackDepositAndNonce() public {
        vault.setReject(true);
        vm.prank(PAYER);
        vm.expectRevert();
        adapter.fundNative{value: 1 ether}(JOB, PROVIDER_ID, NONCE);
        assertEq(address(vault).balance, 0);
        assertEq(address(adapter).balance, 0);
        assertFalse(adapter.consumedJob(JOB));
        assertFalse(adapter.consumedNonce(PAYER, NONCE));
        vault.setReject(false);
        fund(JOB, NONCE);
    }

    function testEscrowFailureRollsBackVaultReservationAndDeposit() public {
        escrow.setReject(true);
        vm.prank(PAYER);
        vm.expectRevert();
        adapter.fundNative{value: 1 ether}(JOB, PROVIDER_ID, NONCE);
        assertEq(address(vault).balance, 0);
        assertFalse(adapter.consumedJob(JOB));
        assertFalse(adapter.consumedNonce(PAYER, NONCE));
        assertEq(escrow.funded(JOB), 0);
        escrow.setReject(false);
        fund(JOB, NONCE);
    }

    function testRejectsOverBudgetAndUnqualifiedProvider() public {
        vm.prank(PAYER);
        vm.expectRevert(AINativeVaultFundingAdapter420.InvalidFunding.selector);
        adapter.fundNative{value: 11 ether}(JOB, PROVIDER_ID, NONCE);
        vm.prank(PAYER);
        vm.expectRevert();
        adapter.fundNative{value: 1 ether}(JOB, keccak256("missing provider"), NONCE);
        assertEq(address(vault).balance, 0);
    }

    function testRejectsDirectTransfers() public {
        vm.prank(PAYER);
        vm.expectRevert(AINativeVaultFundingAdapter420.DirectTransferDisabled.selector);
        payable(address(adapter)).transfer(1 ether);
    }
}
