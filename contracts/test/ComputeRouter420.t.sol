// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/compute/ComputeRouter420.sol";
import "../src/apps/ProtocolRegistry.sol";
import "../src/libraries/ServiceIds420.sol";

contract RouterComponentStub420 {
    function ping() external pure returns (bytes4) { return this.ping.selector; }
}

contract ComputeRouterFactory420 {
    function deploy(
        address jobs,
        address funding,
        address matches,
        address workers,
        address verification,
        address disputes,
        address settlement,
        address providers,
        address nodes,
        address resources,
        address offers
    ) external returns (address) {
        return address(new ComputeRouter420(
            jobs, funding, matches, workers, verification, disputes, settlement,
            providers, nodes, resources, offers
        ));
    }
}

contract ComputeRouter420Test {
    function _stub() private returns (address) {
        return address(new RouterComponentStub420());
    }

    function testRouterFreezesExactComponentGraphAndHasNoExecutionSurface() public {
        address jobs = _stub();
        address funding = _stub();
        address matches = _stub();
        address workers = _stub();
        address verification = _stub();
        address disputes = _stub();
        address settlement = _stub();
        address providers = _stub();
        address nodes = _stub();
        address resources = _stub();
        address offers = _stub();

        ComputeRouter420 router = new ComputeRouter420(
            jobs, funding, matches, workers, verification, disputes, settlement,
            providers, nodes, resources, offers
        );

        bytes32 expected = keccak256(abi.encode(
            uint256(block.chainid), address(router), jobs, funding, matches, workers,
            verification, disputes, settlement, providers, nodes, resources, offers
        ));
        require(router.componentGraphHash() == expected, "graph hash mismatch");
        require(router.jobRegistry() == jobs && router.fundingAdapter() == funding
            && router.matchRegistry() == matches && router.workerEvidence() == workers
            && router.verificationRouter() == verification
            && router.disputeResolver() == disputes && router.settlementAdapter() == settlement
            && router.providerRegistry() == providers && router.nodeRegistry() == nodes
            && router.resourceRegistry() == resources && router.offerRegistry() == offers,
            "component address mismatch");

        (bool arbitraryOk,) = address(router).call(abi.encodeWithSignature("settle(bytes32)", bytes32(uint256(1))));
        require(!arbitraryOk, "router exposed arbitrary execution surface");
    }

    function testRouterRejectsEOAOrZeroComponent() public {
        RouterComponentStub420 s = new RouterComponentStub420();
        ComputeRouterFactory420 factory = new ComputeRouterFactory420();
        address a = address(s);

        (bool zeroOk,) = address(factory).call(
            abi.encodeCall(factory.deploy, (
                address(0), a, a, a, a, a, a, a, a, a, a
            ))
        );
        require(!zeroOk, "zero component accepted");

        (bool eoaOk,) = address(factory).call(
            abi.encodeCall(factory.deploy, (
                address(0xBEEF), a, a, a, a, a, a, a, a, a, a
            ))
        );
        require(!eoaOk, "non-code component accepted");
    }

    function testProtocolRegistryPublishesRouterWithRuntimeCodeHash() public {
        address jobs = _stub();
        address funding = _stub();
        address matches = _stub();
        address workers = _stub();
        address verification = _stub();
        address disputes = _stub();
        address settlement = _stub();
        address providers = _stub();
        address nodes = _stub();
        address resources = _stub();
        address offers = _stub();

        ComputeRouter420 router = new ComputeRouter420(
            jobs, funding, matches, workers, verification, disputes, settlement,
            providers, nodes, resources, offers
        );
        ProtocolRegistry registry = new ProtocolRegistry(address(this));

        bytes32 serviceId = keccak256("420/service/compute-market/v1");
        require(registry.isGenesisCanonicalServiceId(serviceId), "compute service id not canonical");

        bytes32 metadataHash = keccak256("cmp-1.2.9-testnet-metadata-v1");
        bytes32 manifestHash = keccak256("cmp-1.2.9-deployment-manifest-v1");
        bytes32 dependencyRoot = router.componentGraphHash();
        bytes32 interfaceHash = keccak256("ICompute420-v1");

        registry.publishRegisteredService(
            serviceId,
            address(router),
            metadataHash,
            1,
            true,
            ProtocolRegistry.ComponentType.PROTOCOL,
            manifestHash,
            dependencyRoot,
            interfaceHash
        );

        ProtocolRegistry.Service memory svc = registry.getService(serviceId);
        ProtocolRegistry.RegistrationProfile memory profile =
            registry.getRegistrationProfile(serviceId, 1);
        bytes32 runtimeHash;
        address routerAddress = address(router);
        assembly { runtimeHash := extcodehash(routerAddress) }

        require(svc.implementation == address(router) && svc.codeHash == runtimeHash
            && svc.active && svc.version == 1, "registry publication mismatch");
        require(profile.componentType == ProtocolRegistry.ComponentType.PROTOCOL
            && profile.manifestHash == manifestHash
            && profile.dependencyRoot == dependencyRoot
            && profile.interfaceHash == interfaceHash,
            "registry profile mismatch");
    }
}
