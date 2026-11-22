// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

// GOV-PRE-08 Step 2: authentic production-contract local value movements.
// vm.deal ONLY creates the explicitly synthetic block-zero funding fixture and,
// in one separately labelled test, an imported-consensus reward backing fixture.
// Nothing here is an approved V4 Genesis, real founder identity or mined Geth block.
import "./GOVPRE08LocalDeployment420.t.sol";
import "../src/system/ProtocolReserve.sol";
import "../src/system/CommunityRewardReserve.sol";
import "../src/system/FounderVestingRegistry.sol";
import "../src/system/RewardController.sol";

interface VmPRE08Fund {
    struct Log {
        bytes32[] topics;
        bytes data;
        address emitter;
    }
    function deal(address recipient, uint256 newBalance) external;
    function recordLogs() external;
    function getRecordedLogs() external returns (Log[] memory);
}

contract GOVPRE08LocalTestToken {
    string public constant name = "GOV PRE 08 LOCAL UNISSUED TOKEN FIXTURE";
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    bool public feeOnTransfer;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
    }

    function setFeeOnTransfer(bool enabled) external {
        feeOnTransfer = enabled;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(allowance[from][msg.sender] >= amount, "allowance");
        allowance[from][msg.sender] -= amount;
        _transfer(from, to, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) private {
        require(balanceOf[from] >= amount, "balance");
        balanceOf[from] -= amount;
        uint256 tax = feeOnTransfer ? amount / 100 : 0;
        balanceOf[to] += amount - tax;
        totalSupply -= tax;
    }
}

contract GOVPRE08LocalFunding420Test is GOVPRE08LocalDeployment420Test {
    VmPRE08Fund private constant ledgerVm =
        VmPRE08Fund(address(uint160(uint256(keccak256("hevm cheat code")))));

    address private constant PROTOCOL = 0x0000000000000000000000000000000000000424;
    address private constant REWARD_RESERVE = 0x0000000000000000000000000000000000000426;
    address private constant VESTING = 0x0000000000000000000000000000000000000427;
    address private constant REWARD = 0x0000000000000000000000000000000000000420;
    address private constant GATEWAY = 0x000000000000000000000000000000000000043C;
    address private constant BENEFICIARY = address(0xB0B);
    address private constant PAYEE = address(0xBEEF);
    uint256 private constant TOTAL = 42_000_000 ether;
    uint256 private constant OPS_ALLOCATION = 4_200_000 ether;
    uint256 private constant CONTINGENCY_ALLOCATION = 840_000 ether;
    uint256 private constant REMAINING = 3_560_000 ether;
    uint64 private constant GENESIS_TIMESTAMP = 1_900_000_000;

    ProtocolReserve private protocol;
    CommunityRewardReserve private rewardReserve;
    FounderVestingRegistry private vesting;
    RewardController private reward;


    function setUp() public override {
        super.setUp();
        // Actual constructors, scoped only to the existing, frozen Genesis addresses.
        protocol = ProtocolReserve(payable(PROTOCOL));
        ProtocolReserve candidate = new ProtocolReserve(TIME);
        vm.etch(PROTOCOL, address(candidate).code);
        require(protocol.governanceTimelock() == TIME, "reserve source/code immutable drift");

        rewardReserve = CommunityRewardReserve(payable(REWARD_RESERVE));
        CommunityRewardReserve rewardCandidate = new CommunityRewardReserve(TIME);
        vm.etch(REWARD_RESERVE, address(rewardCandidate).code);

        // Constructor storage for the 3 locked grants is retained at 0x0427. No
        // extra mint, no real founder claim, no vesting timer fast-forward.
        address[3] memory founders = [ADMIN, ANDREW, JANET];
        FounderVestingRegistry actual = new FounderVestingRegistry(TIME, founders, GENESIS_TIMESTAMP);
        vm.etch(VESTING, address(actual).code);
        vesting = FounderVestingRegistry(payable(VESTING));
        for (uint256 i; i < 3; ++i) {
            vm.store(VESTING, bytes32(i * 2),
                bytes32((uint256(GENESIS_TIMESTAMP) << 160) | uint256(uint160(founders[i]))));
            (address owner, uint64 start, uint256 claimed) = vesting.grants(i);
            require(owner == founders[i] && start == GENESIS_TIMESTAMP && claimed == 0, "vesting state");
        }

        // EXACT block zero synthetic local native issuance: same eight funded
        // predeploy balances and three fixture wallets as materialize-local-funding.py.
        ledgerVm.deal(0x0000000000000000000000000000000000000421, 4_200_000 ether);
        ledgerVm.deal(0x0000000000000000000000000000000000000422, 4_200_000 ether);
        ledgerVm.deal(PROTOCOL, 8_600_000 ether);
        ledgerVm.deal(COMMUNITY_RESERVE, 6_300_000 ether);
        ledgerVm.deal(REWARD_RESERVE, 2_100_000 ether);
        ledgerVm.deal(VESTING, 500_000 ether);
        ledgerVm.deal(0x000000000000000000000000000000000000042A, 12_600_000 ether);
        ledgerVm.deal(0x000000000000000000000000000000000000042E, 3_000_000 ether);
        ledgerVm.deal(ADMIN, 250_000 ether);
        ledgerVm.deal(ANDREW, 125_000 ether);
        ledgerVm.deal(JANET, 125_000 ether);
        require(_sumNativeTracked() == TOTAL, "block-zero 42m supply conservation");
        require(vestingsLocked() && vesting.claimable(0) == 0 && vesting.claimable(1) == 0
                && vesting.claimable(2) == 0, "incorrect three-founder locked Genesis");

        // REAL native transfer from predeploy ProtocolReserve, only TIMElOCK may
        // issue it; Vault.receive records the actual in-vault custody and accounting.
        ledgerVm.recordLogs();
        vm.prank(TIME);
        protocol.treasuryTransfer(payable(address(opsVault)), OPS_ALLOCATION, keccak256("GOV/PRE08/OPS"));
        vm.prank(TIME);
        protocol.treasuryTransfer(payable(address(contingencyVault)), CONTINGENCY_ALLOCATION,
                                  keccak256("GOV/PRE08/CONTINGENCY"));
        _assertRealFundingReceipts(ledgerVm.getRecordedLogs());
        require(_sumNativeTracked() == TOTAL, "native supply changed on transfer");
        require(_fundingReconciled(), "post Genesis funding/accounting mismatch");

        RewardController instance = new RewardController(TIME);
        vm.etch(REWARD, address(instance).code);
        reward = RewardController(REWARD);
        vm.prank(TIME);
        reward.bindConsensusSystemCaller(GATEWAY);
        require(reward.consensusSystemCaller() == GATEWAY && reward.consensusSystemCallerBound(),
                "consensus caller not frozen");
    }

    function _assertRealFundingReceipts(VmPRE08Fund.Log[] memory logs) private view {
        bytes32 emittedTreasury = keccak256("TreasuryTransfer(address,uint256,bytes32)");
        bytes32 emittedAccounting = keccak256("DepositRecorded(bytes32,address,uint256,uint256)");
        bytes32 emittedVault = keccak256("NativeDeposited(address,uint256)");
        uint256 countTreasury;
        uint256 countAccounting;
        uint256 countVault;
        for (uint256 i; i < logs.length; ++i) {
            VmPRE08Fund.Log memory record = logs[i];
            if (record.topics.length == 0) continue;
            if (record.topics[0] == emittedTreasury) {
                require(record.emitter == PROTOCOL, "forged reserve transfer log");
                countTreasury++;
                uint256 amount = abi.decode(record.data, (uint256));
                require(amount == OPS_ALLOCATION || amount == CONTINGENCY_ALLOCATION, "extra reserve movement");
            }
            if (record.topics[0] == emittedAccounting) {
                require(record.emitter == address(vaultAccounting), "forged accounting receipt");
                countAccounting++;
                (uint256 amount, uint256 afterBalance) = abi.decode(record.data, (uint256, uint256));
                require((record.topics[1] == OPS && amount == OPS_ALLOCATION && afterBalance == amount)
                        || (record.topics[1] == CONT && amount == CONTINGENCY_ALLOCATION
                            && afterBalance == amount), "bad credited vault");
            }
            if (record.topics[0] == emittedVault) {
                require(record.emitter == address(opsVault) || record.emitter == address(contingencyVault),
                        "unexpected recipient of Treasury funding");
                countVault++;
            }
        }
        require(countTreasury == 2 && countAccounting == 2 && countVault == 2,
                "missing or duplicated actual reserve/Vault/accounting event receipts");
    }

    function vestingsLocked() private view returns (bool) {
        return address(vesting).balance == 500_000 ether
            && vesting.lockedAllocation(0) == 250_000 ether
            && vesting.lockedAllocation(1) == 125_000 ether
            && vesting.lockedAllocation(2) == 125_000 ether
            && vesting.totalLockedClaimed() == 0;
    }

    function _sumNativeTracked() private view returns (uint256) {
        return address(0x0000000000000000000000000000000000000421).balance
             + address(0x0000000000000000000000000000000000000422).balance
             + PROTOCOL.balance + COMMUNITY_RESERVE.balance + REWARD_RESERVE.balance
             + VESTING.balance + address(0x000000000000000000000000000000000000042A).balance
             + address(0x000000000000000000000000000000000000042E).balance
             + ADMIN.balance + ANDREW.balance + JANET.balance
             + address(opsVault).balance + address(contingencyVault).balance
             + address(communityVault).balance + PAYEE.balance + BENEFICIARY.balance
             + REWARD.balance;
    }

    function _fundingReconciled() private view returns (bool) {
        VaultAccounting420.AssetAccounting memory o = vaultAccounting.getAccounting(OPS, address(0));
        VaultAccounting420.AssetAccounting memory c = vaultAccounting.getAccounting(CONT, address(0));
        VaultAccounting420.AssetAccounting memory m = vaultAccounting.getAccounting(COMMUNITY, address(0));
        return PROTOCOL.balance == REMAINING
            && address(opsVault).balance == OPS_ALLOCATION
            && address(contingencyVault).balance == CONTINGENCY_ALLOCATION
            && address(communityVault).balance == 0
            && o.recordedBalance == OPS_ALLOCATION && c.recordedBalance == CONTINGENCY_ALLOCATION
            && m.recordedBalance == 0 && o.reserved == 0 && c.reserved == 0
            && vaultAccounting.freeBalance(OPS, address(0)) == OPS_ALLOCATION
            && vaultAccounting.freeBalance(CONT, address(0)) == CONTINGENCY_ALLOCATION
            && vaultAccounting.nonzeroAssetCount(OPS) == 1
            && vaultAccounting.nonzeroAssetCount(CONT) == 1
            && vaultRegistry.getVault(OPS).vaultAddress == address(opsVault)
            && vaultRegistry.getVault(CONT).vaultAddress == address(contingencyVault)
            && vaultRegistry.getVault(COMMUNITY).vaultAddress == address(communityVault);
    }

    function testV4NativeSupplyCustodyAndAllThreeSyntheticFounderBalances() public {
        require(_fundingReconciled() && _sumNativeTracked() == TOTAL, "42m Genesis drift");
        require(ADMIN.balance == 250_000 ether && ANDREW.balance == 125_000 ether
                && JANET.balance == 125_000 ether, "liquid founder shares drift");
        require(vestingsLocked(), "vested split drift");
        require(reward.FULL_SPONSOR_COMMUNITY_BPS() == 1000, "sponsored community reward share drift");
        require(address(sponsor.communityReserve()) == COMMUNITY_RESERVE, "sponsor collateral reserve");
        emit log_bytes32(keccak256(abi.encode(
            TOTAL, PROTOCOL.balance, address(opsVault).balance,
            address(contingencyVault).balance, address(communityVault).balance,
            ADMIN.balance, ANDREW.balance, JANET.balance, VESTING.balance,
            address(vaultAccounting), address(vaultRegistry), graphDigest
        )));
    }

    function testNoAdditionalFundingWithoutTimelockAndNoDoubleCounting() public {
        (bool ok,) = address(protocol).call(abi.encodeCall(
            protocol.treasuryTransfer, (payable(address(opsVault)), 1 ether, keccak256("duplicate"))));
        require(!ok, "non-Timelock transferred Protocol Reserve");
        vm.prank(TIME);
        (ok,) = address(protocol).call(abi.encodeCall(
            protocol.treasuryTransfer,
            (payable(address(opsVault)), REMAINING + 1 ether, keccak256("overspend"))));
        require(!ok, "reserve overspent");
        require(PROTOCOL.balance == REMAINING && address(opsVault).balance == OPS_ALLOCATION,
                "rejected transfer changed custody");
        vm.prank(ADMIN);
        (ok,) = VESTING.call{value: 1 ether}("");
        require(!ok, "vesting accepted post-genesis funding");
        require(_sumNativeTracked() == TOTAL, "rejected transfer minted or lost currency");
        require(!sweep.custodyHandoffComplete(), "premature community custody completion");
    }

    function testScheduledNativeReleaseUsesRealVaultAndBothGrantsAndConserves42m() public {
        uint128 amount = 100 ether;
        vm.prank(ADMIN);
        bytes32 payment = founding.proposePayment(false, PAYEE, amount,
            FoundingTreasuryAuthority420.Purpose.BOUNTY, keccak256("GOVPRE08-BOUNTY"),
            uint64(block.timestamp), uint64(block.timestamp + 10 days));
        vm.prank(ADMIN);
        bytes32 disbursementId = founding.schedulePayment(payment);
        (, bytes32 digest) = executor.preview(disbursementId);
        require(budgets.budget(founding.operationsBudgetId()).committed == amount,
                "budget not actually committed");

        vm.prank(ADMIN);
        (bool permitted,) = address(founding).call(abi.encodeCall(
            founding.executeApprovedRelease, (payment, address(executor), digest)));
        require(!permitted, "Treasury release worked without two independent grants");

        // Protocol capability authorizers are independently registered and
        // grant exact disbursement and exact Vault recipient scopes, respectively.
        capabilities.createGrant(keccak256("GOVPRE08/TREASURY/RELEASE"), address(executor),
            TreasuryIds420.COMPONENT_TREASURY, TreasuryIds420.ACTION_EXECUTE_DISBURSEMENT,
            auth.scopeForDisbursement(disbursementId), amount, 0, 0, 0, 0);
        capabilities.createGrant(keccak256("GOVPRE08/VAULT/RELEASE"), address(executor),
            VaultIds420.COMPONENT_VAULT, VaultIds420.ACTION_WITHDRAW,
            vaultAuth.scopeForRoute(OPS, address(0), PAYEE, VaultIds420.ACTION_WITHDRAW),
            amount, 0, 0, 0, 0);
        vm.prank(ADMIN);
        bytes32 actualCommitment = founding.executeApprovedRelease(payment, address(executor), digest);
        require(actualCommitment == digest && PAYEE.balance == amount, "payout not actually transferred");
        require(address(opsVault).balance == OPS_ALLOCATION - amount, "custody did not decrease");
        require(vaultAccounting.getAccounting(OPS, address(0)).recordedBalance == OPS_ALLOCATION - amount,
                "withdrawal not recorded");
        require(budgets.budget(founding.operationsBudgetId()).executed == amount, "budget not settled");
        require(disbursements.disbursement(disbursementId).state == TreasuryDisbursementRegistry420.State.EXECUTED,
                "payment not executed");
        require(_sumNativeTracked() == TOTAL, "Treasury payout created/destroyed $420");
        vm.prank(ADMIN);
        (bool replay,) = address(founding).call(abi.encodeCall(
            founding.executeApprovedRelease, (payment, address(executor), digest)));
        require(!replay && PAYEE.balance == amount, "replayed founding payout");
    }

    function testExactERC20DepositWithdrawalAndFeeTokenRollback() public {
        GOVPRE08LocalTestToken token = new GOVPRE08LocalTestToken();
        token.mint(address(this), 1_000 ether);
        token.approve(address(opsVault), 500 ether);
        opsVault.depositToken(address(token), 200 ether);
        token.approve(address(contingencyVault), 500 ether);
        contingencyVault.depositToken(address(token), 100 ether);
        require(token.balanceOf(address(opsVault)) == 200 ether
                && token.balanceOf(address(contingencyVault)) == 100 ether, "token not in custody");
        require(vaultAccounting.getAccounting(OPS, address(token)).recordedBalance == 200 ether
                && vaultAccounting.getAccounting(CONT, address(token)).recordedBalance == 100 ether,
                "token accounting mismatch");

        capabilities.createGrant(keccak256("GOVPRE08/ERC20/RELEASE"),
            address(this), VaultIds420.COMPONENT_VAULT, VaultIds420.ACTION_WITHDRAW,
            vaultAuth.scopeForRoute(OPS, address(token), PAYEE, VaultIds420.ACTION_WITHDRAW),
            50 ether, 0, 0, 0, 0);
        opsVault.withdraw(keccak256("GOVPRE08/ERC20/OP1"), address(token), PAYEE, 50 ether);
        require(token.balanceOf(PAYEE) == 50 ether && token.balanceOf(address(opsVault)) == 150 ether,
                "actual ERC20 release failed");
        require(vaultAccounting.getAccounting(OPS, address(token)).recordedBalance == 150 ether,
                "ERC20 released accounting mismatch");

        token.setFeeOnTransfer(true);
        (bool rejected,) = address(opsVault).call(abi.encodeCall(
            opsVault.depositToken, (address(token), 100 ether)));
        require(!rejected, "fee-bearing token silently credited full 100");
        require(token.balanceOf(address(opsVault)) == 150 ether
                && vaultAccounting.getAccounting(OPS, address(token)).recordedBalance == 150 ether,
                "failed token transfer changed real custody");
        // Token supply is separately minted in the isolated test and cannot be
        // counted in the native 42m Genesis distribution.
        require(token.totalSupply() == 1_000 ether && _sumNativeTracked() == TOTAL,
                "unrelated ERC20 inflated or affected native Genesis");
    }

    function testSponsoredValidatorTenPercentRewardIsBackedAndPhysicallyRouted() public {
        bytes32 id = keccak256("GOVPRE08/LOCAL/VERIFIED-BENEFICIAL-OWNER-FIXTURE");
        CommunityValidatorReserve reserve = CommunityValidatorReserve(payable(COMMUNITY_RESERVE));
        ValidatorRegistry validator = ValidatorRegistry(payable(VALIDATORS));
        // Canonical Timelock-only credit route, not an identity bypass of the
        // founder's verified-identity sponsorship entry point.
        vm.prank(TIME);
        reserve.assignCredit(id, BENEFICIARY, 42_000 ether);
        vm.prank(TIME);
        reserve.fundCredit(id);
        require(COMMUNITY_RESERVE.balance == 6_258_000 ether &&
                VALIDATORS.balance == 42_000 ether, "real protocol collateral not transferred");
        vm.prank(BENEFICIARY);
        validator.register(id, new bytes(48), BENEFICIARY, keccak256("local validator metadata"));
        require(validator.isFullyProtocolSponsoredOwner(BENEFICIARY), "full sponsorship not registered");

        // Local-only equivalent of node420/Geth's exact imported-block issuance
        // credit. This is NOT proof of live consensus verification or a mint ABI.
        ledgerVm.deal(REWARD, 100 ether);
        uint256 prior = REWARD_RESERVE.balance;
        uint256 beneficiaryBefore = BENEFICIARY.balance;
        vm.prank(GATEWAY);
        reward.applyConsensusReward(uint64(block.number), BENEFICIARY, new address[](0),
                                    100 ether, 0, 0, 0);
        require(REWARD.balance == 0 && BENEFICIARY.balance == beneficiaryBefore + 90 ether,
                "sponsored net reward not paid");
        require(REWARD_RESERVE.balance == prior + 10 ether &&
                reward.communityRewardSettled() == 10 ether
                && reward.validatorAccrued(REWARD_RESERVE) == 10 ether
                && reward.validatorAccrued(BENEFICIARY) == 90 ether,
                "10 percent share not physically settled");
        require(_sumNativeTracked() == TOTAL + 100 ether, "synthetic issuance not conserved");
        vm.prank(GATEWAY);
        (bool replay,) = address(reward).call(abi.encodeCall(reward.applyConsensusReward,
            (uint64(block.number), BENEFICIARY, new address[](0), 100 ether, 0, 0, 0)));
        require(!replay && REWARD_RESERVE.balance == prior + 10 ether,
                "duplicate reward caused double community settlement");
    }

    function testRewardWithoutAuthenticatedSystemCallerOrNativeBackingFailsClosed() public {
        vm.prank(GATEWAY);
        (bool ok,) = address(reward).call(abi.encodeCall(
            reward.applyConsensusReward,
            (uint64(block.number), BENEFICIARY, new address[](0), 100 ether, 0, 0, 0)));
        require(!ok, "unbacked reward accepted");
        (ok,) = address(reward).call(abi.encodeCall(
            reward.applyConsensusReward,
            (uint64(block.number), BENEFICIARY, new address[](0), 100 ether, 0, 0, 0)));
        require(!ok, "unauthorized consensus caller accepted");
        require(_sumNativeTracked() == TOTAL, "forged reward altered native supply");
    }
}
