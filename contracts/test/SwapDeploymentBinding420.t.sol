// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/apps/ProtocolRegistry.sol";
import "../src/swap/GenesisDEXFactory.sol";
import "../src/swap/CanonicalMarketRegistry.sol";
import "../src/swap/CanonicalSwapExecutor420.sol";
import "../src/swap/CanonicalConstantProductPool420.sol";
import "../src/pay/PaymentRouter420.sol";
import "../src/pay/adapters/CanonicalSettlementAdapter420.sol";
import "../src/libraries/GenesisInterfaceIds420.sol";
import "../src/libraries/AppDependencyIds420.sol";
import "../src/swap/SwapIds420.sol";
import "../src/pay/PayIds420.sol";
import "./helpers/GenesisMocks420.sol";

contract SwapAudit7Token420 {}

contract SwapDeploymentBinding420Test {
    bytes32 internal constant CFG = keccak256("swap-audit-7-binding");
    bytes32 internal constant POOL_ID = keccak256("swap-audit-7/pool");
    bytes32 internal constant MARKET_ID = keccak256("swap-audit-7/market");

    struct Deployment {
        ProtocolRegistry registry;
        GenesisDEXFactory factory;
        CanonicalMarketRegistry markets;
        CanonicalSwapExecutor420 executor;
        CanonicalSettlementAdapter420 adapter;
        PaymentRouter420 pay;
        CanonicalConstantProductPool420 pool;
        SwapAudit7Token420 token0;
        SwapAudit7Token420 token1;
    }

    function _v() private pure returns (Types420.Version memory) {
        return Types420.Version({major: 1, minor: 0, patch: 0});
    }

    function _register(ProtocolRegistry registry, bytes32 id, address implementation) private {
        registry.registerComponent(id, implementation, _v(), Types420.Lifecycle.ACTIVE);
    }

    function _deploy() private returns (Deployment memory d) {
        d.registry = new ProtocolRegistry(address(this));

        MockGovernanceAuthorityV1 governance = new MockGovernanceAuthorityV1();
        MockPauseRegistryV1 pause = new MockPauseRegistryV1();
        MockSystemSafetyV1 safety = new MockSystemSafetyV1();
        MockChainContextV1 chain = new MockChainContextV1();

        _register(d.registry, GenesisInterfaceIds420.GOVERNANCE_AUTHORITY, address(governance));
        _register(d.registry, GenesisInterfaceIds420.PAUSE_REGISTRY, address(pause));
        _register(d.registry, AppDependencyIds420.SYSTEM_SAFETY, address(safety));
        _register(d.registry, AppDependencyIds420.CHAIN_CONTEXT, address(chain));

        d.factory = new GenesisDEXFactory(address(this), address(d.registry), CFG);
        d.markets = new CanonicalMarketRegistry(address(this), address(d.registry), CFG);
        d.executor = new CanonicalSwapExecutor420(address(this), address(d.registry), CFG);
        d.adapter = new CanonicalSettlementAdapter420(address(this), address(d.registry), CFG, address(d.executor));
        d.pay = new PaymentRouter420(address(this), address(d.registry), CFG);
        d.token0 = new SwapAudit7Token420();
        d.token1 = new SwapAudit7Token420();
        d.pool = new CanonicalConstantProductPool420(address(d.token0), address(d.token1), address(d.executor), 30);

        _register(d.registry, SwapIds420.GENESIS_DEX_FACTORY, address(d.factory));
        _register(d.registry, SwapIds420.CANONICAL_MARKET_REGISTRY, address(d.markets));
        _register(d.registry, SwapIds420.CANONICAL_SWAP_EXECUTOR, address(d.executor));
        _register(d.registry, PayIds420.SETTLEMENT_ADAPTER, address(d.adapter));
        _register(d.registry, PayIds420.PAYMENT_ROUTER, address(d.pay));

        d.factory.setPoolImplementation(address(d.pool));
        d.factory.registerPool(POOL_ID, address(d.pool));
        d.markets.setMarket(
            MARKET_ID,
            address(d.pool),
            address(d.token0),
            address(d.token1),
            CanonicalMarketRegistry.Role.CANONICAL_USD,
            keccak256("swap-audit-7-market"),
            true
        );
        d.executor.setTrustedCaller(address(d.adapter), true);
        d.pay.setSettlementAdapter(address(d.adapter));
    }

    function _assertRegistered(
        ProtocolRegistry registry,
        bytes32 id,
        address implementation
    ) private view {
        Types420.ContractRef memory ref = registry.component(id);
        require(ref.implementation == implementation, "registry implementation");
        require(ref.runtimeCodeHash == implementation.codehash, "registry codehash");
        require(ref.lifecycle == Types420.Lifecycle.ACTIVE, "registry lifecycle");
        require(registry.resolve(id) == implementation, "registry resolve");
        require(registry.runtimeCodeHash(id) == implementation.codehash, "registry hash read");
        require(registry.supportsVersion(id, _v()), "registry version");
    }

    function testDeploymentBindingRegistryAndFailClosedGraph() public {
        Deployment memory d = _deploy();

        _assertRegistered(d.registry, SwapIds420.GENESIS_DEX_FACTORY, address(d.factory));
        _assertRegistered(d.registry, SwapIds420.CANONICAL_MARKET_REGISTRY, address(d.markets));
        _assertRegistered(d.registry, SwapIds420.CANONICAL_SWAP_EXECUTOR, address(d.executor));
        _assertRegistered(d.registry, PayIds420.SETTLEMENT_ADAPTER, address(d.adapter));
        _assertRegistered(d.registry, PayIds420.PAYMENT_ROUTER, address(d.pay));

        require(
            d.registry.runtimeCodeHash(SwapIds420.CANONICAL_SWAP_EXECUTOR) == address(d.executor).codehash,
            "executor identity mismatch"
        );
        require(
            d.registry.runtimeCodeHash(PayIds420.SETTLEMENT_ADAPTER) == address(d.adapter).codehash,
            "adapter identity mismatch"
        );

        require(d.factory.poolImplementation() == address(d.pool), "factory implementation binding");
        require(d.factory.pools(POOL_ID) == address(d.pool), "factory pool binding");

        (
            address marketPool,
            address asset0,
            address asset1,
            CanonicalMarketRegistry.Role role,
            bytes32 metadataHash,
            bool active
        ) = d.markets.markets(MARKET_ID);
        require(marketPool == address(d.pool), "market pool binding");
        require(asset0 == address(d.token0) && asset1 == address(d.token1), "market pair binding");
        require(role == CanonicalMarketRegistry.Role.CANONICAL_USD, "market role");
        require(metadataHash == keccak256("swap-audit-7-market"), "market metadata");
        require(active, "market inactive");

        require(d.pay.settlementAdapter() == address(d.adapter), "router adapter binding");
        require(d.adapter.swapExecutor() == address(d.executor), "adapter executor binding");
        require(d.executor.trustedCaller(address(d.adapter)), "adapter not trusted");

        CanonicalSettlementAdapter420 wrong =
            new CanonicalSettlementAdapter420(address(this), address(d.registry), CFG, address(d.executor));
        _register(d.registry, keccak256("420/TEST/WRONG_ADAPTER"), address(wrong));
        d.pay.setSettlementAdapter(address(wrong));
        require(d.pay.settlementAdapter() != address(d.adapter), "misbinding hidden");
        require(!d.executor.trustedCaller(address(wrong)), "wrong adapter trusted");
        require(d.executor.trustedCaller(address(d.adapter)), "canonical trust lost");

        d.registry.setComponentLifecycle(
            SwapIds420.CANONICAL_MARKET_REGISTRY,
            Types420.Lifecycle.SUSPENDED
        );
        (bool ok,) = address(d.markets).call(
            abi.encodeWithSelector(
                d.markets.setMarket.selector,
                keccak256("second-market"),
                address(d.pool),
                address(d.token0),
                address(d.token1),
                CanonicalMarketRegistry.Role.CANONICAL_USD,
                bytes32(0),
                true
            )
        );
        require(!ok, "inactive registry binding accepted mutation");
    }
}
