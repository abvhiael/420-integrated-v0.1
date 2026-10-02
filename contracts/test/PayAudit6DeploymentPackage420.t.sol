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

        _register(registry, merchants.componentId(), address(merchants));
        _register(registry, invoices.componentId(), address(invoices));
        _register(registry, payments.componentId(), address(payments));
        _register(registry, paymentRouter.componentId(), address(paymentRouter));
        _register(registry, settlementRouter.componentId(), address(settlementRouter));
        _register(registry, refunds.componentId(), address(refunds));
        _register(registry, sponsor.componentId(), address(sponsor));
        _register(registry, adapter.componentId(), address(adapter));
        _register(registry, health.componentId(), address(health));

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

        _assertRegistered(registry, merchants.componentId(), address(merchants));
        _assertRegistered(registry, invoices.componentId(), address(invoices));
        _assertRegistered(registry, payments.componentId(), address(payments));
        _assertRegistered(registry, paymentRouter.componentId(), address(paymentRouter));
        _assertRegistered(registry, settlementRouter.componentId(), address(settlementRouter));
        _assertRegistered(registry, refunds.componentId(), address(refunds));
        _assertRegistered(registry, sponsor.componentId(), address(sponsor));
        _assertRegistered(registry, adapter.componentId(), address(adapter));
        _assertRegistered(registry, health.componentId(), address(health));

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
