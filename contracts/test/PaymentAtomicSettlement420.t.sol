// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/pay/PaymentRouter420.sol";
import "../src/interfaces/ICanonicalSettlement420.sol";
import "./helpers/GenesisMocks420.sol";

contract MockSettlementV1 is ICanonicalSettlement420 {
    bool public fail;
    uint256 public spent;
    uint256 public delivered;
    function setResult(bool f, uint256 s, uint256 d) external { fail = f; spent = s; delivered = d; }
    function quote(bytes32, address, address, uint256) external pure returns (Quote memory) { revert(); }
    function execute(Quote calldata, address, address, uint256) external payable returns (uint256, uint256) {
        require(!fail, "swap failed");
        return (spent, delivered);
    }
}

contract PaymentAtomicSettlement420Test {
    function _quote(address settlementAsset, uint256 input, uint256 settle)
        internal
        view
        returns (ICanonicalSettlement420.Quote memory q)
    {
        q = ICanonicalSettlement420.Quote(
            bytes32(uint256(1)),
            bytes32(uint256(2)),
            address(3),
            settlementAsset,
            input,
            settle,
            settle,
            0,
            0,
            uint64(block.timestamp)
        );
    }

    function _setup()
        internal
        returns (GenesisMockEnvironment420 env, PaymentRouter420 r, MockSettlementV1 s, address settlementAsset)
    {
        env = new GenesisMockEnvironment420();
        r = new PaymentRouter420(address(this), address(env.registry()), keccak256("pay-atomic"));
        env.registerResident(address(r), r.componentId());
        settlementAsset = address(0xCA420);
        bytes32 assetId = keccak256("CADC");
        env.setSettlementAsset(settlementAsset, assetId, true);
        env.health().setMarket(bytes32(uint256(2)), true);
        env.fees().set(0, 0, false);
        s = new MockSettlementV1();
        r.setSettlementAdapter(address(s));
    }

    function testAtomicFailureReverts() public {
        (GenesisMockEnvironment420 env, PaymentRouter420 r, MockSettlementV1 s, address settlementAsset) = _setup();
        env;
        s.setResult(true, 0, 0);
        PaymentRouter420.PayerLimits memory l = PaymentRouter420.PayerLimits(
            100, 1 ether, 42, 0, 0, 0, uint64(block.timestamp)
        );
        ICanonicalSettlement420.Quote memory q = _quote(settlementAsset, 100, 84);
        (bool ok,) = address(r).call(
            abi.encodeWithSelector(
                r.executeSwapSettlement.selector,
                bytes32(uint256(7)),
                q,
                address(8),
                address(9),
                84,
                l,
                0,
                0
            )
        );
        require(!ok, "partial failure accepted");
        require(!r.consumedPaymentAuthorization(bytes32(uint256(7))), "authorization consumed after revert");
    }

    function testMerchantUnderpaymentReverts() public {
        (, PaymentRouter420 r, MockSettlementV1 s, address settlementAsset) = _setup();
        s.setResult(false, 100, 83);
        PaymentRouter420.PayerLimits memory l = PaymentRouter420.PayerLimits(
            100, 1 ether, 42, 0, 0, 0, uint64(block.timestamp)
        );
        ICanonicalSettlement420.Quote memory q = _quote(settlementAsset, 100, 84);
        (bool ok,) = address(r).call(
            abi.encodeWithSelector(
                r.executeSwapSettlement.selector,
                bytes32(uint256(8)),
                q,
                address(8),
                address(9),
                84,
                l,
                0,
                0
            )
        );
        require(!ok, "merchant underpaid");
    }

    function testSharedReplayProtectionFailsClosed() public {
        (GenesisMockEnvironment420 env, PaymentRouter420 r, MockSettlementV1 s, address settlementAsset) = _setup();
        s.setResult(false, 100, 84);
        bytes32 paymentId = bytes32(uint256(9));
        env.replay().setConsumed(paymentId, true);
        PaymentRouter420.PayerLimits memory l = PaymentRouter420.PayerLimits(
            100, 1 ether, 42, 0, 0, 0, uint64(block.timestamp)
        );
        ICanonicalSettlement420.Quote memory q = _quote(settlementAsset, 100, 84);
        (bool ok,) = address(r).call(
            abi.encodeWithSelector(r.executeSwapSettlement.selector, paymentId, q, address(8), address(9), 84, l, 0, 0)
        );
        require(!ok, "shared replay accepted");
    }

    function testPausedPaymentFailsClosed() public {
        (GenesisMockEnvironment420 env, PaymentRouter420 r, MockSettlementV1 s, address settlementAsset) = _setup();
        s.setResult(false, 100, 84);
        env.pause().setPaused(true);
        PaymentRouter420.PayerLimits memory l = PaymentRouter420.PayerLimits(
            100, 1 ether, 42, 0, 0, 0, uint64(block.timestamp)
        );
        ICanonicalSettlement420.Quote memory q = _quote(settlementAsset, 100, 84);
        (bool ok,) = address(r).call(
            abi.encodeWithSelector(
                r.executeSwapSettlement.selector,
                bytes32(uint256(10)),
                q,
                address(8),
                address(9),
                84,
                l,
                0,
                0
            )
        );
        require(!ok, "paused payment accepted");
    }
}
