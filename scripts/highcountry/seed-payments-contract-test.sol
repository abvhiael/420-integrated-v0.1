// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import { SeedPackPayments } from "../../contracts/src/highcountry/seeds/SeedPackPayments.sol";
import { HighCountryAuthorization } from "../../contracts/src/highcountry/auth/HighCountryAuthorization.sol";
import { EmergencyState } from "../../contracts/src/highcountry/security/EmergencyState.sol";
import { MockCapabilityRegistry } from "../../contracts/test/highcountry/mocks/MockCapabilityRegistry.sol";
import { ICapabilityRegistry420 } from "../../contracts/src/interfaces/genesis/ICapabilityRegistry420.sol";
import { ActionIds } from "../../contracts/src/highcountry/constants/ActionIds.sol";
import { ModuleIds } from "../../contracts/src/highcountry/constants/ModuleIds.sol";

interface PaymentVm {
    function addr(
        uint256
    ) external pure returns (address);
    function sign(
        uint256,
        bytes32
    ) external pure returns (uint8, bytes32, bytes32);
    function deal(
        address,
        uint256
    ) external;
    function prank(
        address
    ) external;
}

contract SeedPaymentsQualificationTest {
    PaymentVm constant vm = PaymentVm(address(uint160(uint256(keccak256("hevm cheat code")))));
    SeedPackPayments payments;
    EmergencyState emergency;
    MockCapabilityRegistry caps;
    address constant BUYER = address(0xA11CE);
    address constant OTHER = address(0xB0B);
    bytes32 constant KEY = keccak256("TEST_PURCHASE_KEY");
    bytes32 constant COMMIT = keccak256("TEST_COMMIT");
    bool rejectFunds;

    receive() external payable {
        require(!rejectFunds, "receiver rejects");
    }

    function setUp() public {
        caps = new MockCapabilityRegistry();
        HighCountryAuthorization auth = new HighCountryAuthorization(address(caps));
        emergency = new EmergencyState(address(auth));
        payments = new SeedPackPayments(
            keccak256("game"), keccak256("policy"), address(this), address(emergency), vm.addr(0x420)
        );
        vm.deal(BUYER, 10 ether);
        vm.deal(OTHER, 10 ether);
    }

    function payload(
        bytes32 key,
        bytes32 commitment,
        uint8 pool
    ) private returns (bytes memory) {
        bytes32 digest = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", payments.quoteDigest(BUYER, key, commitment, pool))
        );
        (uint8 v, bytes32 r, bytes32 sigS) = vm.sign(0x420, digest);
        return abi.encodeCall(payments.pay, (key, commitment, pool, v, r, sigS));
    }

    function testUnsignedOrRedirectedQuoteCannotAcceptFunds() public {
        bytes memory data = payload(KEY, COMMIT, 3);
        vm.prank(OTHER);
        (bool redirected,) = address(payments).call{ value: 1 ether }(data);
        vm.prank(BUYER);
        (bool unsigned,) = address(payments).call{ value: 1 ether }(
            abi.encodeCall(payments.pay, (KEY, COMMIT, 3, 27, bytes32(0), bytes32(0)))
        );
        require(!redirected && !unsigned && payments.treasuryCredit() == 0, "unrecognized funds accepted");
    }

    function pay() private {
        bytes memory data = payload(KEY, COMMIT, 3);
        vm.prank(BUYER);
        (bool ok,) = address(payments).call{ value: 1 ether }(data);
        require(ok, "payment rejected");
    }

    function testQuoteCannotReplayAcrossPaymentDeployments() public {
        bytes memory data = payload(KEY, COMMIT, 3);
        SeedPackPayments other =
            new SeedPackPayments(
            keccak256("game"), keccak256("policy"), address(this), address(emergency), vm.addr(0x420)
        );
        vm.prank(BUYER);
        (bool ok,) = address(other).call{ value: 1 ether }(data);
        require(!ok && other.treasuryCredit() == 0, "cross-deployment quote replay");
    }

    function testExactNativeValueAndReceiptBinding() public {
        pay();
        SeedPackPayments.Receipt memory r = payments.receipt(payments.purchaseId(BUYER, KEY));
        require(r.buyer == BUYER && r.commitment == COMMIT && r.pool == 3 && r.status == 1, "receipt");
        require(payments.treasuryCredit() == 1 ether && address(payments).balance == 1 ether, "conservation");
    }

    function testUnderpaymentAndOverpaymentNeverAdmit() public {
        vm.prank(BUYER);
        (bool low,) = address(payments).call{ value: 1 }(payload(KEY, COMMIT, 3));
        vm.prank(BUYER);
        (bool high,) = address(payments).call{ value: 2 ether }(payload(KEY, COMMIT, 3));
        require(!low && !high && payments.treasuryCredit() == 0, "wrong price admitted");
    }

    function testDuplicatePaymentCannotChargeTwice() public {
        pay();
        uint256 before = BUYER.balance;
        vm.prank(BUYER);
        (bool ok,) = address(payments).call{ value: 1 ether }(payload(KEY, COMMIT, 3));
        require(!ok && BUYER.balance == before && payments.treasuryCredit() == 1 ether, "double charge");
    }

    function testCancellationPermanentlyPreventsLatePayment() public {
        vm.prank(BUYER);
        payments.cancel(KEY);
        vm.prank(BUYER);
        payments.cancel(KEY);
        vm.prank(BUYER);
        (bool ok,) = address(payments).call{ value: 1 ether }(payload(KEY, COMMIT, 3));
        require(!ok && payments.receipt(payments.purchaseId(BUYER, KEY)).status == 2, "late payment");
    }

    function testOtherBuyerCannotCancelOrClaimOriginalPurchase() public {
        vm.prank(OTHER);
        payments.cancel(KEY);
        pay();
        require(payments.receipt(payments.purchaseId(BUYER, KEY)).status == 1, "foreign cancellation");
        require(payments.purchaseId(BUYER, KEY) != payments.purchaseId(OTHER, KEY), "identity collision");
    }

    function testPaidReceiptCannotRefundOrCancel() public {
        pay();
        vm.prank(BUYER);
        (bool ok,) = address(payments).call(abi.encodeCall(payments.cancel, (KEY)));
        require(!ok && payments.receipt(payments.purchaseId(BUYER, KEY)).status == 1, "paid cancelled");
    }

    function testInvalidPoolAndCommitmentReject() public {
        vm.prank(BUYER);
        (bool a,) = address(payments).call{ value: 1 ether }(payload(KEY, COMMIT, 4));
        vm.prank(BUYER);
        (bool b,) = address(payments).call{ value: 1 ether }(payload(KEY, bytes32(0), 0));
        require(!a && !b, "invalid purchase");
    }

    function testTreasuryOnlyAndFailedWithdrawalPreservesCredit() public {
        pay();
        vm.prank(OTHER);
        (bool foreign,) = address(payments).call(abi.encodeCall(payments.withdraw, ()));
        require(!foreign, "foreign withdrawal");
        rejectFunds = true;
        (bool failed,) = address(payments).call(abi.encodeCall(payments.withdraw, ()));
        require(!failed && payments.treasuryCredit() == 1 ether, "lost credit");
        rejectFunds = false;
        payments.withdraw();
        require(payments.treasuryCredit() == 0 && address(payments).balance == 0, "withdrawal accounting");
    }

    function testMarketEmergencyBlocksPaymentButAllowsUnpaidCancellation() public {
        bytes32 domain = keccak256("HC.EMERGENCY.MARKET");
        caps.setGrant(
            keccak256(abi.encode(address(this), ModuleIds.EMERGENCY_STATE, ActionIds.EMERGENCY_RESTRICT, domain)),
            ICapabilityRegistry420.CapabilityGrant(
                address(this), ModuleIds.EMERGENCY_STATE, ActionIds.EMERGENCY_RESTRICT, domain, 0, 0, 0, 0, 0, false
            ),
            0
        );
        emergency.setRestricted(domain, true);
        vm.prank(BUYER);
        (bool ok,) = address(payments).call{ value: 1 ether }(payload(KEY, COMMIT, 3));
        require(!ok, "paused payment");
        vm.prank(BUYER);
        payments.cancel(KEY);
        require(payments.receipt(payments.purchaseId(BUYER, KEY)).status == 2, "cancellation blocked");
    }
}
