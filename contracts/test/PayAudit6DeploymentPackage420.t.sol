// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/apps/ProtocolRegistry.sol";
import "../src/pay/MerchantRegistry420.sol";
import "../src/pay/InvoiceRegistry420.sol";
import "../src/pay/PaymentRegistry420.sol";
import "../src/pay/PaymentRouter420.sol";
import "../src/pay/SettlementRouter420.sol";
import "../src/pay/RefundManager420.sol";
import "../src/pay/GasSponsor420.sol";
import "../src/pay/adapters/CanonicalSettlementAdapter420.sol";
import "../src/pay/adapters/CanonicalSwapHealthAdapter420.sol";
import "../src/pay/ReplayDomainIds420.sol";
import "../src/swap/CanonicalSwapExecutor420.sol";
import "../src/system/ReplayProtectionConsumer420.sol";
import "../src/libraries/GenesisInterfaceIds420.sol";
import "../src/libraries/AppDependencyIds420.sol";
import "./helpers/GenesisMocks420.sol";

interface VmPayAudit6 {
    function prank(
        address
    ) external;
}

contract PayAudit6DeploymentPackage420Test {
    VmPayAudit6 internal constant vm = VmPayAudit6(address(uint160(uint256(keccak256("hevm cheat code")))));

    address internal constant TIMELOCK = 0x0000000000000000000000000000000000000429;
    bytes32 internal constant CFG = 0x01aea63faef55d711e5f93e800b04702177874f4015375b659038ce991d20921;
    bytes32 internal constant MERCHANT_RUNTIME =
        0x46b97e9d6aae24fce442eeb825c156d057f1fe2c7a05cf0dd654277c26071f79;
    bytes32 internal constant INVOICE_RUNTIME =
        0x624d2c65e1e5c063f97b62684e5e4b2af04f5e0840a825b3519121e966eb893b;
    bytes32 internal constant PAYMENT_RUNTIME =
        0x58fc4d1dfb69e8ecc16d8af28440e0c6cf744b5bebb429be5eb0e215717ce8ac;
    bytes32 internal constant PAYMENT_ROUTER_RUNTIME =
        0x23229257e9368e576e5e28ace3d4be0ff7b02b7594d79c9aff4ccaa2e0c6900e;
    bytes32 internal constant SETTLEMENT_ROUTER_RUNTIME =
        0x3f1acffba6ad41a0a40c4025c542cca9707e1b978abe5f466a950db1b7f03305;
    bytes32 internal constant REFUND_RUNTIME =
        0x8d09fa4f299eb3326396c4872b5200373cfb3fe73ff5a217053fab33e91a1f7c;
    bytes32 internal constant SPONSOR_RUNTIME =
        0x6f753c83720149afa59e3b59aab91316705af00e248e8aa182d90d3c3d6595ff;
    bytes32 internal constant SETTLEMENT_ADAPTER_RUNTIME =
        0x49c98a763d4e1c4d514ef0c83e769f39fd1f906e92e785fc669d8f850119dc32;
    bytes32 internal constant HEALTH_ADAPTER_RUNTIME =
        0x88f49324c466e9c5013603af5b1a2f000d07f21670131a9dff83b91b2ee81e03;

    function _v() private pure returns (Types420.Version memory) {
        return Types420.Version({ major: 1, minor: 0, patch: 0 });
    }

    function _register(
        ProtocolRegistry registry,
        bytes32 id,
        address implementation
    ) private {
        vm.prank(TIMELOCK);
        registry.registerComponent(id, implementation, _v(), Types420.Lifecycle.ACTIVE);
    }

    function _stage(
        ProtocolRegistry registry,
        bytes32 id,
        address implementation
    ) private {
        vm.prank(TIMELOCK);
        registry.registerComponent(id, implementation, _v(), Types420.Lifecycle.SUSPENDED);
        Types420.ContractRef memory ref = registry.component(id);
        require(ref.implementation == implementation, "staged implementation");
        require(ref.runtimeCodeHash == implementation.codehash, "staged runtime hash");
        require(ref.lifecycle == Types420.Lifecycle.SUSPENDED, "staged lifecycle");
        require(!registry.isActive(id), "staged component active");
        (bool resolveOk,) = address(registry).staticcall(abi.encodeWithSelector(registry.resolve.selector, id));
        require(!resolveOk, "staged component resolved");
    }

    function _activate(
        ProtocolRegistry registry,
        bytes32 id
    ) private {
        vm.prank(TIMELOCK);
        registry.setComponentLifecycle(id, Types420.Lifecycle.ACTIVE);
    }

    function _assertRegistered(
        ProtocolRegistry registry,
        bytes32 id,
        address implementation
    ) private view {
        Types420.ContractRef memory ref = registry.component(id);
        require(ref.implementation == implementation, "registry implementation");
        require(ref.runtimeCodeHash == implementation.codehash, "registry runtime hash");
        require(ref.lifecycle == Types420.Lifecycle.ACTIVE, "registry lifecycle");
        require(registry.resolve(id) == implementation, "registry resolve");
        require(registry.runtimeCodeHash(id) == implementation.codehash, "registry codehash read");
        require(registry.supportsVersion(id, _v()), "registry version");
    }

    function testPayAudit6DeploymentPublicationAndWiring() public {
        ProtocolRegistry registry = new ProtocolRegistry(TIMELOCK);
        MockGovernanceAuthorityV1 governance = new MockGovernanceAuthorityV1();
        _register(registry, GenesisInterfaceIds420.GOVERNANCE_AUTHORITY, address(governance));

        CanonicalSwapExecutor420 executor = new CanonicalSwapExecutor420(TIMELOCK, address(registry), CFG);
        ReplayProtectionConsumer420 replay = new ReplayProtectionConsumer420(TIMELOCK, address(registry), CFG);

        MerchantRegistry420 merchants = new MerchantRegistry420(TIMELOCK, address(registry), CFG);
        InvoiceRegistry420 invoices = new InvoiceRegistry420(TIMELOCK, address(registry), CFG);
        PaymentRegistry420 payments = new PaymentRegistry420(TIMELOCK, address(registry), CFG);
        PaymentRouter420 paymentRouter = new PaymentRouter420(TIMELOCK, address(registry), CFG);
        SettlementRouter420 settlementRouter = new SettlementRouter420(TIMELOCK, address(registry), CFG);
        RefundManager420 refunds = new RefundManager420(TIMELOCK, address(registry), CFG);
        GasSponsor420 sponsor = new GasSponsor420(TIMELOCK, address(registry), CFG);
        CanonicalSettlementAdapter420 adapter =
            new CanonicalSettlementAdapter420(TIMELOCK, address(registry), CFG, address(executor));
        CanonicalSwapHealthAdapter420 health = new CanonicalSwapHealthAdapter420(TIMELOCK, address(registry), CFG);

        _register(registry, executor.componentId(), address(executor));
        _register(registry, replay.componentId(), address(replay));
        _register(registry, AppDependencyIds420.REPLAY_PROTECTION, address(replay));

        _stage(registry, merchants.componentId(), address(merchants));
        _stage(registry, invoices.componentId(), address(invoices));
        _stage(registry, payments.componentId(), address(payments));
        _stage(registry, paymentRouter.componentId(), address(paymentRouter));
        _stage(registry, settlementRouter.componentId(), address(settlementRouter));
        _stage(registry, refunds.componentId(), address(refunds));
        _stage(registry, sponsor.componentId(), address(sponsor));
        _stage(registry, adapter.componentId(), address(adapter));
        _stage(registry, health.componentId(), address(health));

        vm.prank(TIMELOCK);
        paymentRouter.setSettlementAdapter(address(adapter));
        vm.prank(TIMELOCK);
        paymentRouter.setSettlementRouter(address(settlementRouter));
        vm.prank(TIMELOCK);
        adapter.setPaymentRouter(address(paymentRouter));
        vm.prank(TIMELOCK);
        adapter.setSettlementRouter(address(settlementRouter));
        vm.prank(TIMELOCK);
        adapter.setSwapExecutor(address(executor));
        vm.prank(TIMELOCK);
        settlementRouter.setPaymentRouter(address(paymentRouter));
        vm.prank(TIMELOCK);
        settlementRouter.setSettlementAdapter(address(adapter));
        vm.prank(TIMELOCK);
        refunds.setPaymentRegistry(address(payments));
        vm.prank(TIMELOCK);
        executor.setTrustedCaller(address(adapter), true);
        vm.prank(TIMELOCK);
        replay.setDomainConsumer(ReplayDomainIds420.PAY_SETTLEMENT, address(paymentRouter));

        _activate(registry, merchants.componentId());
        _activate(registry, invoices.componentId());
        _activate(registry, payments.componentId());
        _activate(registry, paymentRouter.componentId());
        _activate(registry, settlementRouter.componentId());
        _activate(registry, refunds.componentId());
        _activate(registry, sponsor.componentId());
        _activate(registry, adapter.componentId());
        _activate(registry, health.componentId());

        _assertRegistered(registry, merchants.componentId(), address(merchants));
        _assertRegistered(registry, invoices.componentId(), address(invoices));
        _assertRegistered(registry, payments.componentId(), address(payments));
        _assertRegistered(registry, paymentRouter.componentId(), address(paymentRouter));
        _assertRegistered(registry, settlementRouter.componentId(), address(settlementRouter));
        _assertRegistered(registry, refunds.componentId(), address(refunds));
        _assertRegistered(registry, sponsor.componentId(), address(sponsor));
        _assertRegistered(registry, adapter.componentId(), address(adapter));
        _assertRegistered(registry, health.componentId(), address(health));

        require(address(merchants).codehash == MERCHANT_RUNTIME, "merchant package hash");
        require(address(invoices).codehash == INVOICE_RUNTIME, "invoice package hash");
        require(address(payments).codehash == PAYMENT_RUNTIME, "payment package hash");
        require(address(paymentRouter).codehash == PAYMENT_ROUTER_RUNTIME, "payment router package hash");
        require(address(settlementRouter).codehash == SETTLEMENT_ROUTER_RUNTIME, "settlement router package hash");
        require(address(refunds).codehash == REFUND_RUNTIME, "refund package hash");
        require(address(sponsor).codehash == SPONSOR_RUNTIME, "sponsor package hash");
        require(address(adapter).codehash == SETTLEMENT_ADAPTER_RUNTIME, "settlement adapter package hash");
        require(address(health).codehash == HEALTH_ADAPTER_RUNTIME, "health adapter package hash");

        require(paymentRouter.governanceTimelock() == TIMELOCK, "router timelock");
        require(paymentRouter.registry() == address(registry), "router registry");
        require(paymentRouter.genesisConfigHash() == CFG, "router config hash");
        require(paymentRouter.settlementAdapter() == address(adapter), "router adapter");
        require(paymentRouter.settlementRouter() == address(settlementRouter), "router split");
        require(adapter.paymentRouter() == address(paymentRouter), "adapter router");
        require(adapter.settlementRouter() == address(settlementRouter), "adapter split");
        require(adapter.swapExecutor() == address(executor), "adapter executor");
        require(settlementRouter.paymentRouter() == address(paymentRouter), "split router");
        require(settlementRouter.settlementAdapter() == address(adapter), "split adapter");
        require(refunds.paymentRegistry() == address(payments), "refund registry");
        require(executor.trustedCaller(address(adapter)), "executor trust");
        require(replay.domainConsumer(ReplayDomainIds420.PAY_SETTLEMENT) == address(paymentRouter), "replay domain");

        vm.prank(address(0xBEEF));
        (bool unauthorized,) = address(paymentRouter)
            .call(abi.encodeWithSelector(paymentRouter.setSettlementAdapter.selector, address(health)));
        require(!unauthorized, "governance handoff bypass");
    }
}
