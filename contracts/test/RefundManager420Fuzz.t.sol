// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/pay/RefundManager420.sol";
import "./helpers/GenesisMocks420.sol";

contract RefundAccountingMock420 {
    address public payer;
    address public settlementAsset;
    uint256 public maximum;
    uint256 public authorizedRefunded;
    uint8 public status;

    function set(
        address payer_,
        address settlementAsset_,
        uint256 maximum_,
        uint256 authorizedRefunded_,
        uint8 status_
    ) external {
        payer = payer_;
        settlementAsset = settlementAsset_;
        maximum = maximum_;
        authorizedRefunded = authorizedRefunded_;
        status = status_;
    }

    function refundAccounting(
        bytes32
    ) external view returns (address, address, uint256, uint256, uint8) {
        return (payer, settlementAsset, maximum, authorizedRefunded, status);
    }
}

contract RefundManager420FuzzTest {
    address internal constant PAYER = address(0xBEEF);

    function _setup(
        uint256 maximum,
        uint256 authorizedRefunded
    ) internal returns (RefundManager420 r, RefundAccountingMock420 accounting, address settlementAsset) {
        GenesisMockEnvironment420 env = new GenesisMockEnvironment420();
        r = new RefundManager420(address(this), address(env.registry()), keccak256("refund-fuzz"));
        accounting = new RefundAccountingMock420();
        env.registerResident(address(r), r.componentId());
        settlementAsset = address(0xCA420);
        env.setSettlementAsset(settlementAsset, keccak256("CADC"), true);
        accounting.set(PAYER, settlementAsset, maximum, authorizedRefunded, 7);
        r.setPaymentRegistry(address(accounting));
    }

    function _recordRefund(
        RefundManager420 r,
        bytes32 refundId,
        bytes32 paymentId,
        address settlementAsset,
        uint256 amount,
        uint256 maximum
    ) internal {
        r.recordRefund(refundId, paymentId, settlementAsset, PAYER, amount, maximum, bytes32(0));
    }

    function testFuzz_RefundNeverExceedsCanonicalAuthorizedAmount(uint96 maximum, uint96 first, uint96 second) public {
        if (maximum == 0) return;
        (RefundManager420 r, RefundAccountingMock420 accounting, address settlementAsset) =
            _setup(maximum, maximum);
        bytes32 paymentId = keccak256("payment");

        uint256 a = (uint256(first) % uint256(maximum)) + 1;
        _recordRefund(r, keccak256("r1"), paymentId, settlementAsset, a, maximum);
        uint256 room = uint256(maximum) - a;
        if (room == 0) return;

        uint256 b = (uint256(second) % room) + 1;
        accounting.set(PAYER, settlementAsset, maximum, a + b, 7);
        _recordRefund(r, keccak256("r2"), paymentId, settlementAsset, b, maximum);
        require(r.refundedByPayment(paymentId) <= maximum, "refund overflow");
    }

    function testRefundCannotExceedCanonicalAuthorizedAmount() public {
        (RefundManager420 r,, address settlementAsset) = _setup(100, 40);
        bytes32 paymentId = keccak256("payment-authorized");
        _recordRefund(r, keccak256("r1"), paymentId, settlementAsset, 40, 100);

        (bool ok,) = address(r).call(
            abi.encodeWithSelector(
                r.recordRefund.selector,
                keccak256("r2"),
                paymentId,
                settlementAsset,
                PAYER,
                1,
                100,
                bytes32(0)
            )
        );
        require(!ok, "refund exceeded canonical authorization");
    }

    function testRefundAllowedWhenSystemDegraded() public {
        GenesisMockEnvironment420 env = new GenesisMockEnvironment420();
        RefundManager420 r =
            new RefundManager420(address(this), address(env.registry()), keccak256("refund-safe"));
        RefundAccountingMock420 accounting = new RefundAccountingMock420();
        env.registerResident(address(r), r.componentId());
        address settlementAsset = address(0xCA420);
        env.setSettlementAsset(settlementAsset, keccak256("CADC"), true);
        accounting.set(PAYER, settlementAsset, 1, 1, 6);
        r.setPaymentRegistry(address(accounting));
        env.safety().setState(ISystemSafety420.SafetyState.DEGRADED);

        _recordRefund(r, keccak256("r"), keccak256("p"), settlementAsset, 1, 1);
        require(r.refundedByPayment(keccak256("p")) == 1, "safe refund blocked");
    }
}
