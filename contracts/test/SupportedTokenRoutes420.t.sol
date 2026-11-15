// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./helpers/GenesisMocks420.sol";
import "./helpers/TokenCatalogueFixture420.sol";
import "../src/bridge/BridgeAssetRegistry.sol";
import "../src/bridge/adapters/EthereumBridgeAdapter420.sol";
import "../src/bridge/adapters/SolanaBridgeAdapter420.sol";
import "../src/bridge/verifiers/EthereumFinalityVerifier420.sol";

interface TokenVm420 {
    function chainId(uint256) external;
    function prank(address) external;
}

contract TokenLocal420 {
    uint8 public immutable decimals;

    constructor(uint8 d) {
        decimals = d;
    }
}

contract TokenOracle420 {
    function isFinalizedExecutionBlock(uint64, bytes32, bytes32) external pure returns (bool) {
        return true;
    }
}

contract TokenMessages420 is IEthereumGatewayMessageVerifier420 {
    function verifyGatewayMessage(bytes calldata proof, uint64, bytes32, bytes32)
        external
        pure
        returns (GatewayMessage memory)
    {
        return abi.decode(proof, (GatewayMessage));
    }
}

/// Explicit controlled Solana verifier boundary; no native finality claim is made here.
contract TokenSolanaBoundary420 is ISolanaFinalityVerifier420 {
    address public quorum;

    constructor(address q) {
        quorum = q;
    }

    function verifyFinalizedTransfer(bytes calldata proof) external pure returns (FinalizedTransfer memory) {
        return abi.decode(proof, (FinalizedTransfer));
    }
}

contract TokenRouterBoundary420 {
    function inbound(IBridgeAdapter420 adapter, bytes memory proof)
        external
        returns (IBridgeAdapter420.VerifiedTransfer memory)
    {
        return adapter.verifyInbound(proof);
    }

    function outbound(IBridgeAdapter420 adapter, bytes32 route, bytes32 asset, uint256 amount)
        external
        returns (bytes32)
    {
        return adapter.initiateOutbound(
            route,
            asset,
            msg.sender,
            new bytes(adapter.adapterId() == keccak256("420/BRIDGE/SOLANA/MAINNET/V12.5.2") ? 32 : 20),
            amount,
            bytes("")
        );
    }
}

abstract contract TokenRouteFixture420 {
    TokenVm420 constant tokenVm = TokenVm420(address(uint160(uint256(keccak256("hevm cheat code")))));
    GenesisMockEnvironment420 env;
    BridgeAssetRegistry assets;
    BridgeRouteRegistry routes;
    BridgeChainRegistry420 chains;
    TokenRouterBoundary420 router;
    EthereumBridgeAdapter420 eth;
    SolanaBridgeAdapter420 sol;
    EthereumFinalityVerifier420 verifier;
    TokenSolanaBoundary420 solVerifier;
    bytes32 constant GATEWAY = bytes32(uint256(0x4242));
    uint256 nonce;

    function setUp() public virtual {
        tokenVm.chainId(420);
        env = new GenesisMockEnvironment420();
        router = _newRouter();
        assets = new BridgeAssetRegistry(address(this), address(env.registry()), keccak256("token-assets"));
        routes = new BridgeRouteRegistry(address(this), address(env.registry()), keccak256("token-routes"));
        chains = new BridgeChainRegistry420(address(this), address(env.registry()), keccak256("token-chains"));
        env.registerResident(address(assets), assets.componentId());
        env.registerResident(address(routes), routes.componentId());
        env.registerResident(address(chains), chains.componentId());
        verifier = new EthereumFinalityVerifier420(
            address(this), address(new TokenOracle420()), address(new TokenMessages420())
        );
        eth = new EthereumBridgeAdapter420(address(this), address(router), address(verifier));
        eth.setTokenRoutePolicy(address(assets));
        eth.setGateway(address(uint160(uint256(GATEWAY))), true);
        solVerifier = new TokenSolanaBoundary420(address(new TokenOracle420()));
        sol = new SolanaBridgeAdapter420(address(this), address(router), address(solVerifier));
        sol.setTokenRoutePolicy(address(assets));
        sol.setGatewayProgram(GATEWAY, true);
        bytes32 nativeId = keccak256("ETH");
        bytes32 family = keccak256("CONTROLLED/CHAIN/BOUNDARY");
        chains.setChain(
            keccak256("ETH"),
            BridgeChainRegistry420.Chain(
                eth.ETH_ROUTE_CHAIN_ID(),
                keccak256("ETH/MAINNET"),
                nativeId,
                family,
                BridgeChainRegistry420.ChainFamily.EVM,
                true
            )
        );
        chains.setChain(
            keccak256("SOL"),
            BridgeChainRegistry420.Chain(
                sol.SOLANA_ROUTE_CHAIN_ID(),
                sol.SOLANA_MAINNET_GENESIS_HASH(),
                keccak256("SOL"),
                family,
                BridgeChainRegistry420.ChainFamily.SOLANA,
                true
            )
        );
        chains.setChain(
            keccak256("420"),
            BridgeChainRegistry420.Chain(
                420, keccak256("CONTROLLED/420"), nativeId, family, BridgeChainRegistry420.ChainFamily.EVM, true
            )
        );
    }

    function _newRouter() internal virtual returns (TokenRouterBoundary420) {
        return new TokenRouterBoundary420();
    }

    function source(uint256 i) internal pure returns (bytes32) {
        if (i == 0) return bytes32(uint256(uint160(0x18aAA7115705e8be94bfFEBDE57Af9BFc265B998)));
        if (i == 1) return bytes32(uint256(uint160(0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984)));
        if (i == 2) return bytes32(uint256(uint160(0x514910771AF9Ca656af840dff83E8264EcF986CA)));
        if (i == 3) return bytes32(uint256(uint160(0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9)));
        if (i == 4) return bytes32(uint256(uint160(0xdAC17F958D2ee523a2206206994597C13D831ec7)));
        if (i == 5) return bytes32(uint256(uint160(0x3Fa142dD3f384414e05E71Ad0939274EdC82EC0A)));
        if (i == 6) return bytes32(uint256(uint160(0x1aBaEA1f7C830bD89Acc67eC4af516284b1bC33c)));
        if (i == 7) return 0xfc931a2b58cd23db2d91d296d96505a06f80942083f841e8a887f138ac030437;
        return 0x37998ccbf2d0458b615cbcc6b1a367c4749e9fef7306622e1b1b58910120bc9a;
    }

    function profile(uint256 i) internal pure returns (SupportedTokenRoutes420.Profile memory) {
        return SupportedTokenRoutes420.profile(
            i < 7 ? keccak256("420/BRIDGE/ETHEREUM/MAINNET/V12.5.4") : keccak256("420/BRIDGE/SOLANA/MAINNET/V12.5.2"),
            source(i)
        );
    }

    function configure(uint256 i) internal returns (SupportedTokenRoutes420.Profile memory p) {
        p = profile(i);
        address adapter = i < 7 ? address(eth) : address(sol);
        bytes32 aid = IBridgeAdapter420(adapter).adapterId();
        address v = i < 7 ? address(verifier) : address(solVerifier);
        bytes32 snapshot = assets.tokenVerifierSnapshot(v, aid);
        (address local,,,,,,) = assets.assets(p.assetId);
        if (local == address(0)) {
            local = address(new TokenLocal420(18));
            env.setSettlementAsset(local, p.assetId, true);
            assets.setAsset(
                p.assetId, local, 0, aid, keccak256("CONTROLLED/LOCAL/TOKEN"), BridgeAssetRegistry.Status.ACTIVE, true
            );
        }
        routes.setRoute(
            p.routeId,
            BridgeRouteRegistry.Route(
                p.assetId,
                p.sourceChainId,
                420,
                p.sourceAsset,
                bytes32(uint256(uint160(local))),
                aid,
                snapshot,
                1,
                BridgeRouteRegistry.Status.ACTIVE,
                true,
                true
            )
        );
        assets.setTokenRoute(
            p.routeId,
            BridgeAssetRegistry.TokenRoute(
                p.sourceAsset, aid, adapter, v, GATEWAY, snapshot, keccak256("CONTROLLED/TOKEN/QUALIFICATION"), 18, true
            )
        );
        if (i < 7) {
            eth.setAssetMapping(p.sourceAsset, p.assetId, true);
            eth.setRouteBinding(p.assetId, p.routeId);
        } else {
            sol.setAssetMapping(p.sourceAsset, p.assetId, true);
            sol.setRouteBinding(p.assetId, p.routeId);
        }
    }

    function proof(uint256 i, uint256 amount) internal returns (bytes memory) {
        SupportedTokenRoutes420.Profile memory p = profile(i);
        bytes32 id = keccak256(abi.encode(++nonce, i));
        if (i < 7) {
            IEthereumGatewayMessageVerifier420.GatewayMessage memory m =
                IEthereumGatewayMessageVerifier420.GatewayMessage(
                    id,
                    address(uint160(uint256(GATEWAY))),
                    address(uint160(uint256(p.sourceAsset))),
                    address(0xA11CE),
                    address(0xB0B),
                    amount,
                    keccak256(abi.encode(id, "transaction")),
                    420,
                    address(router),
                    p.routeId
                );
            return abi.encode(uint64(1), keccak256("block"), keccak256("root"), abi.encode(m));
        }
        return abi.encode(
            ISolanaFinalityVerifier420.FinalizedTransfer(
                sol.SOLANA_MAINNET_GENESIS_HASH(),
                1,
                id,
                id,
                GATEWAY,
                p.sourceAsset,
                bytes32(uint256(0xA11CE)),
                address(0xB0B),
                amount,
                true,
                420,
                address(router),
                p.routeId
            )
        );
    }

    function deliver(uint256 i, uint256 amount) internal returns (IBridgeAdapter420.VerifiedTransfer memory) {
        return router.inbound(IBridgeAdapter420(i < 7 ? address(eth) : address(sol)), proof(i, amount));
    }

    function qualify(uint256 i) internal {
        SupportedTokenRoutes420.Profile memory p = configure(i);
        IBridgeAdapter420.VerifiedTransfer memory v = deliver(i, 42 * 10 ** uint256(p.decimals));
        require(
            v.assetId == p.assetId && v.routeId == p.routeId && v.amount == 42 ether,
            "independent canonical token and decimals"
        );
    }

    function testUniRoute() public {
        qualify(1);
    }

    function testLinkRoute() public {
        qualify(2);
    }

    function testAaveRoute() public {
        qualify(3);
    }

    function testUsdtRoute() public {
        qualify(4);
    }

    function testQcadRoute() public {
        qualify(5);
    }

    function testEurcEthereumRoute() public {
        qualify(6);
    }

    function testEurcSolanaRoute() public {
        qualify(7);
    }

    function testRayRoute() public {
        qualify(8);
    }

    function reject(uint256 i, uint256 amount) internal {
        (bool ok,) = address(router)
            .call(
                abi.encodeCall(
                    router.inbound, (IBridgeAdapter420(i < 7 ? address(eth) : address(sol)), proof(i, amount))
                )
            );
        require(!ok, "must reject");
    }
}

contract SupportedTokenRoutes420Test is TokenRouteFixture420 {
    function testAudioRoute() public {
        qualify(0);
    }

    function testEurcBothChainsShareDestinationAsset() public {
        qualify(6);
        qualify(7);
    }

    function testOutboundExactConversionAllRoutes() public {
        for (uint256 i; i < 9; i++) {
            SupportedTokenRoutes420.Profile memory p = configure(i);
            require(
                router.outbound(IBridgeAdapter420(i < 7 ? address(eth) : address(sol)), p.routeId, p.assetId, 42 ether)
                    != 0,
                "outbound"
            );
        }
    }

    function testOutboundDustRejected() public {
        SupportedTokenRoutes420.Profile memory p = configure(4);
        (bool ok,) = address(router)
            .call(abi.encodeCall(router.outbound, (IBridgeAdapter420(address(eth)), p.routeId, p.assetId, 1)));
        require(!ok, "dust");
    }

    function testNoPolicyIsNotQualification() public {
        configure(1);
        EthereumBridgeAdapter420 a = new EthereumBridgeAdapter420(address(this), address(router), address(verifier));
        a.setGateway(address(uint160(uint256(GATEWAY))), true);
        SupportedTokenRoutes420.Profile memory p = profile(1);
        a.setAssetMapping(p.sourceAsset, p.assetId, true);
        a.setRouteBinding(p.assetId, p.routeId);
        (bool ok,) =
            address(router).call(abi.encodeCall(router.inbound, (IBridgeAdapter420(address(a)), proof(1, 1 ether))));
        require(!ok, "missing policy");
    }

    function testDestinationTokenDecimalsDrift() public {
        SupportedTokenRoutes420.Profile memory p = configure(4);
        address wrong = address(new TokenLocal420(6));
        env.setSettlementAsset(wrong, p.assetId, true);
        assets.setAsset(
            p.assetId, wrong, 0, eth.ADAPTER_ID(), keccak256("changed"), BridgeAssetRegistry.Status.ACTIVE, true
        );
        reject(4, 42e6);
    }

    function testSuspendedBridgeAssetRejected() public {
        SupportedTokenRoutes420.Profile memory p = configure(1);
        assets.setAsset(p.assetId, address(0), 0, 0, 0, BridgeAssetRegistry.Status.SUSPENDED, false);
        reject(1, 42 ether);
    }

    function testVerifierDependencyRotationRequiresQualification() public {
        configure(1);
        verifier.setMessageVerifier(address(new TokenMessages420()));
        reject(1, 42 ether);
    }

    function testInactiveRouteRejected() public {
        SupportedTokenRoutes420.Profile memory p = configure(1);
        routes.setDirection(p.routeId, false, true);
        reject(1, 42 ether);
    }

    function testCounterfeitAndLegacySourceMappingsRejected() public {
        SupportedTokenRoutes420.Profile memory p = configure(5);
        bytes32 fake = bytes32(uint256(uint160(0x4A16BAf414b8e637Ed12019faD5Dd705735DB2e0)));
        eth.setAssetMapping(fake, p.assetId, true);
        reject(5, 42e6);
    }

    function testNativeAssetCannotMasqueradeAsToken() public {
        SupportedTokenRoutes420.Profile memory p = configure(1);
        eth.setAssetMapping(eth.ETH_NATIVE_SOURCE_ASSET(), p.assetId, true);
        reject(1, 42 ether);
    }

    function testFuzzPrecisionRoundTrip(uint64 amount) public {
        if (amount == 0) return;
        uint256 converted = SupportedTokenRoutes420.convert(amount, 6, 18);
        require(SupportedTokenRoutes420.convert(converted, 18, 6) == amount, "precision");
    }

    function alteredSource(bytes memory encoded, address sourceToken) internal pure returns (bytes memory) {
        (uint64 n, bytes32 h, bytes32 r, bytes memory raw) = abi.decode(encoded, (uint64, bytes32, bytes32, bytes));
        IEthereumGatewayMessageVerifier420.GatewayMessage memory m =
            abi.decode(raw, (IEthereumGatewayMessageVerifier420.GatewayMessage));
        m.sourceToken = sourceToken;
        return abi.encode(n, h, r, abi.encode(m));
    }

    function testAuthenticatedLegacyQcadCannotSubstitute() public {
        SupportedTokenRoutes420.Profile memory p = configure(5);
        address fake = 0x4A16BAf414b8e637Ed12019faD5Dd705735DB2e0;
        eth.setAssetMapping(bytes32(uint256(uint160(fake))), p.assetId, true);
        (bool ok,) = address(router)
            .call(
                abi.encodeCall(router.inbound, (IBridgeAdapter420(address(eth)), alteredSource(proof(5, 42e6), fake)))
            );
        require(!ok, "authenticated legacy token substitution");
    }

    function testAuthenticatedNativeCannotMasqueradeAsUni() public {
        SupportedTokenRoutes420.Profile memory p = configure(1);
        eth.setAssetMapping(eth.ETH_NATIVE_SOURCE_ASSET(), p.assetId, true);
        (bool ok,) = address(router)
            .call(
                abi.encodeCall(
                    router.inbound, (IBridgeAdapter420(address(eth)), alteredSource(proof(1, 42 ether), address(0)))
                )
            );
        require(!ok, "native token policy bypass");
    }

    function testPolicyPinsGatewayWithinAdapterAllowlist() public {
        configure(1);
        eth.setGateway(address(0x9999), true);
        (uint64 n, bytes32 h, bytes32 r, bytes memory raw) =
            abi.decode(proof(1, 42 ether), (uint64, bytes32, bytes32, bytes));
        IEthereumGatewayMessageVerifier420.GatewayMessage memory m =
            abi.decode(raw, (IEthereumGatewayMessageVerifier420.GatewayMessage));
        m.gateway = address(0x9999);
        (bool ok,) = address(router)
            .call(abi.encodeCall(router.inbound, (IBridgeAdapter420(address(eth)), abi.encode(n, h, r, abi.encode(m)))));
        require(!ok, "gateway substitution");
    }

    function testQualifiedReplayStillRejected() public {
        configure(4);
        bytes memory encoded = proof(4, 42e6);
        router.inbound(eth, encoded);
        (bool ok,) = address(router).call(abi.encodeCall(router.inbound, (IBridgeAdapter420(address(eth)), encoded)));
        require(!ok, "qualified replay");
    }

    function testDestinationContractSubstitutionRejected() public {
        SupportedTokenRoutes420.Profile memory p = configure(1);
        bytes32 snapshot = assets.tokenVerifierSnapshot(address(verifier), eth.ADAPTER_ID());
        routes.setRoute(
            p.routeId,
            BridgeRouteRegistry.Route(
                p.assetId,
                p.sourceChainId,
                420,
                p.sourceAsset,
                bytes32(uint256(uint160(address(new TokenLocal420(18))))),
                eth.ADAPTER_ID(),
                snapshot,
                2,
                BridgeRouteRegistry.Status.ACTIVE,
                true,
                true
            )
        );
        reject(1, 42 ether);
    }

    function testRegistryCannotBeCalledAsAnAdapterByAnyone() public {
        SupportedTokenRoutes420.Profile memory p = configure(1);
        (bool ok,) = address(assets)
            .call(
                abi.encodeCall(
                    assets.qualifyTokenTransfer,
                    (
                        p.routeId,
                        p.assetId,
                        p.sourceAsset,
                        eth.ADAPTER_ID(),
                        address(verifier),
                        GATEWAY,
                        uint256(42 ether),
                        true
                    )
                )
            );
        require(!ok, "registry caller");
    }

    function quote(uint256 amount, uint8 from, uint8 to) external pure returns (uint256) {
        return SupportedTokenRoutes420.convert(amount, from, to);
    }

    function testFuzzPrecisionOverflowFailsClosed(uint256 amount) public {
        if (amount <= type(uint256).max / 1e12) return;
        (bool ok,) = address(this).call(abi.encodeCall(this.quote, (amount, uint8(6), uint8(18))));
        require(!ok, "precision overflow");
    }

    function testFrozenCatalogueMatchesRegistryProfilesIndependently() public {
        for (uint256 i; i < 9; i++) {
            (bytes32 asset, bytes32 route, bytes32 source_, uint8 decimals_, bytes32 adapter) =
                TokenCatalogueFixture420.expected(i);
            SupportedTokenRoutes420.Profile memory p = SupportedTokenRoutes420.profile(adapter, source_);
            require(
                p.assetId == asset && p.routeId == route && p.sourceAsset == source_ && p.decimals == decimals_,
                "frozen registry profile mismatch"
            );
        }
    }

    function testOnlyGovernanceCanQualifyTokenRoute() public {
        SupportedTokenRoutes420.Profile memory p = configure(1);
        BridgeAssetRegistry.TokenRoute memory c = BridgeAssetRegistry.TokenRoute(
            p.sourceAsset,
            eth.ADAPTER_ID(),
            address(eth),
            address(verifier),
            GATEWAY,
            assets.tokenVerifierSnapshot(address(verifier), eth.ADAPTER_ID()),
            keccak256("UNAUTHORIZED"),
            18,
            true
        );
        bytes memory call_ = abi.encodeCall(assets.setTokenRoute, (p.routeId, c));
        tokenVm.prank(address(0xBAD));
        (bool ok,) = address(assets).call(call_);
        require(!ok, "token qualification governance");
    }

    function testNativeOutboundKeepsQualifiedDigest() public {
        bytes32 asset = keccak256("420/BRIDGE/ASSET/ETH");
        bytes32 route = keccak256("NATIVE/ETH/ROUTE");
        eth.setAssetMapping(eth.ETH_NATIVE_SOURCE_ASSET(), asset, true);
        eth.setRouteBinding(asset, route);
        bytes32 id = router.outbound(eth, route, asset, 42 ether);
        bytes32 expected = keccak256(
            abi.encode(
                eth.ADAPTER_ID(),
                block.chainid,
                route,
                asset,
                address(this),
                new bytes(20),
                uint256(42 ether),
                eth.ETH_NATIVE_SOURCE_ASSET(),
                uint256(1),
                bytes("")
            )
        );
        require(id == expected, "native ETH digest drift");
        asset = keccak256("420/BRIDGE/ASSET/SOL");
        route = keccak256("NATIVE/SOL/ROUTE");
        sol.setAssetMapping(sol.SOL_NATIVE_SOURCE_ASSET(), asset, true);
        sol.setRouteBinding(asset, route);
        id = router.outbound(sol, route, asset, 42e9);
        expected = keccak256(
            abi.encode(
                sol.ADAPTER_ID(),
                block.chainid,
                route,
                asset,
                address(this),
                new bytes(32),
                uint256(42e9),
                sol.SOL_NATIVE_SOURCE_ASSET(),
                uint256(1),
                bytes("")
            )
        );
        require(id == expected, "native SOL digest drift");
    }

    function testSolanaInboundRejectsU64Overflow() public {
        configure(8);
        reject(8, uint256(type(uint64).max) + 1);
    }

    function testSolanaOutboundRejectsU64Overflow() public {
        SupportedTokenRoutes420.Profile memory p = configure(8);
        (bool ok,) = address(router)
            .call(
                abi.encodeCall(
                    router.outbound,
                    (IBridgeAdapter420(address(sol)), p.routeId, p.assetId, (uint256(type(uint64).max) + 1) * 1e12)
                )
            );
        require(!ok, "SPL wire overflow");
    }
}
