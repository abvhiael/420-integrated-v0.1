// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/apps/ProtocolRegistry.sol";
import "../src/system/CapabilityRegistry420.sol";
import "../src/libraries/ServiceIds420.sol";
import "../src/resource/ResourceIds420.sol";
import "../src/resource/ResourceAuthorization420.sol";
import "../src/resource/ResourcePolicyRegistry420.sol";
import "../src/resource/ResourceProviderRegistry420.sol";
import "../src/resource/ResourceNodeRegistry420.sol";
import "../src/resource/ResourceOfferRegistry420.sol";
import "../src/resource/ResourceSessionRegistry420.sol";
import "../src/resource/ResourceReceiptRegistry420.sol";
import "../src/resource/ResourceRouter420.sol";
import "../src/resource/StorageProofSchemeRegistry420.sol";
import "../src/resource/StorageCapacityRegistry420.sol";
import "../src/resource/StorageCommitmentRegistry420.sol";
import "../src/resource/StorageProofRegistry420.sol";
import "../src/resource/StorageAgreementRegistry420.sol";
import "../src/resource/StorageObjectManifestRegistry420.sol";
import "../src/resource/StorageSettlementRegistry420.sol";

contract ResourceDeploymentBinding420Test {
    bytes32 internal constant RESOURCE_SERVICE_ID = keccak256("420/service/resource-protocol/v1");
    bytes32 internal constant METADATA_HASH = keccak256("420/RESOURCE/RELEASE/METADATA/V1");
    bytes32 internal constant MANIFEST_HASH = keccak256("420/RESOURCE/AUDIT-8/DEPLOYMENT-PACKAGE/V1");
    bytes32 internal constant INTERFACE_HASH = keccak256("420/RESOURCE/RESOURCE_ROUTER/INTERFACE/V1");

    event DeploymentAddress(string name, address implementation);
    event RuntimeCodeHash(string name, bytes32 codeHash);
    event ReleaseCommitment(string name, bytes32 value);

    struct Env {
        CapabilityRegistry420 caps;
        ProtocolRegistry registry;
        ResourceAuthorization420 authorization;
        ResourcePolicyRegistry420 policy;
        ResourceProviderRegistry420 providers;
        ResourceNodeRegistry420 nodes;
        ResourceOfferRegistry420 offers;
        ResourceSessionRegistry420 sessions;
        ResourceReceiptRegistry420 receipts;
        ResourceRouter420 router;
        StorageProofSchemeRegistry420 schemes;
        StorageCapacityRegistry420 capacity;
        StorageCommitmentRegistry420 commitments;
        StorageProofRegistry420 proofs;
        StorageAgreementRegistry420 agreements;
        StorageObjectManifestRegistry420 manifests;
        StorageSettlementRegistry420 settlements;
        bytes32 dependencyRoot;
    }

    function _deploy() internal returns (Env memory e) {
        // Repository qualification uses the test contract as the governance actor.
        // Live deployment binds GovernanceTimelock 0x...0429 and a separately
        // verified CapabilityRegistry420 deployment.
        e.caps = new CapabilityRegistry420();
        e.registry = new ProtocolRegistry(address(this));

        e.authorization = new ResourceAuthorization420(address(e.caps));
        e.policy = new ResourcePolicyRegistry420(address(this));
        e.providers = new ResourceProviderRegistry420(address(e.authorization));
        e.nodes = new ResourceNodeRegistry420(address(e.authorization), address(e.providers));
        e.offers = new ResourceOfferRegistry420(
            address(e.nodes), address(e.providers), address(e.policy), address(e.authorization)
        );
        e.sessions = new ResourceSessionRegistry420(address(e.offers), address(e.authorization));
        e.receipts = new ResourceReceiptRegistry420(address(e.sessions), address(e.offers), address(e.nodes));
        e.router = new ResourceRouter420(address(e.policy), address(e.nodes), address(e.offers));

        e.schemes = new StorageProofSchemeRegistry420(address(e.authorization));
        e.capacity = new StorageCapacityRegistry420(address(e.authorization), address(e.nodes), address(e.providers));
        e.commitments = new StorageCommitmentRegistry420(
            address(e.authorization), address(e.providers), address(e.nodes), address(e.schemes)
        );
        e.proofs = new StorageProofRegistry420(address(e.commitments), address(e.schemes), address(e.nodes));
        e.agreements = new StorageAgreementRegistry420(
            address(e.authorization),
            address(e.offers),
            address(e.nodes),
            address(e.providers),
            address(e.schemes),
            address(e.commitments),
            address(e.capacity)
        );
        e.manifests = new StorageObjectManifestRegistry420(address(e.agreements), address(e.commitments));
        e.settlements = new StorageSettlementRegistry420(address(e.agreements), address(e.proofs));

        e.caps.registerProtocolComponent(ResourceIds420.COMPONENT_RESOURCE, address(this));

        e.dependencyRoot = keccak256(
            abi.encode(
                address(e.caps),
                address(this),
                address(e.authorization),
                address(e.policy),
                address(e.providers),
                address(e.nodes),
                address(e.offers),
                address(e.sessions),
                address(e.receipts),
                address(e.router),
                address(e.schemes),
                address(e.capacity),
                address(e.commitments),
                address(e.proofs),
                address(e.agreements),
                address(e.manifests),
                address(e.settlements),
                address(e.authorization).codehash,
                address(e.policy).codehash,
                address(e.providers).codehash,
                address(e.nodes).codehash,
                address(e.offers).codehash,
                address(e.sessions).codehash,
                address(e.receipts).codehash,
                address(e.router).codehash,
                address(e.schemes).codehash,
                address(e.capacity).codehash,
                address(e.commitments).codehash,
                address(e.proofs).codehash,
                address(e.agreements).codehash,
                address(e.manifests).codehash,
                address(e.settlements).codehash
            )
        );

        e.registry.publishRegisteredService(
            RESOURCE_SERVICE_ID,
            address(e.router),
            METADATA_HASH,
            1,
            true,
            ProtocolRegistry.ComponentType.SERVICE,
            MANIFEST_HASH,
            e.dependencyRoot,
            INTERFACE_HASH
        );

        emit DeploymentAddress("ResourceAuthorization420", address(e.authorization));
        emit DeploymentAddress("ResourcePolicyRegistry420", address(e.policy));
        emit DeploymentAddress("ResourceProviderRegistry420", address(e.providers));
        emit DeploymentAddress("ResourceNodeRegistry420", address(e.nodes));
        emit DeploymentAddress("ResourceOfferRegistry420", address(e.offers));
        emit DeploymentAddress("ResourceSessionRegistry420", address(e.sessions));
        emit DeploymentAddress("ResourceReceiptRegistry420", address(e.receipts));
        emit DeploymentAddress("ResourceRouter420", address(e.router));
        emit DeploymentAddress("StorageProofSchemeRegistry420", address(e.schemes));
        emit DeploymentAddress("StorageCapacityRegistry420", address(e.capacity));
        emit DeploymentAddress("StorageCommitmentRegistry420", address(e.commitments));
        emit DeploymentAddress("StorageProofRegistry420", address(e.proofs));
        emit DeploymentAddress("StorageAgreementRegistry420", address(e.agreements));
        emit DeploymentAddress("StorageObjectManifestRegistry420", address(e.manifests));
        emit DeploymentAddress("StorageSettlementRegistry420", address(e.settlements));

        emit RuntimeCodeHash("ResourceRouter420", address(e.router).codehash);
        emit RuntimeCodeHash("StorageSettlementRegistry420", address(e.settlements).codehash);
        emit ReleaseCommitment("dependencyRoot", e.dependencyRoot);
        emit ReleaseCommitment("manifestHash", MANIFEST_HASH);
        emit ReleaseCommitment("interfaceHash", INTERFACE_HASH);
    }

    function testDeploymentOrderAndConstructorBindings() public {
        Env memory e = _deploy();

        require(address(e.authorization.capabilityRegistry()) == address(e.caps), "authorization/caps");
        require(e.policy.governanceTimelock() == address(this), "policy/timelock");
        require(address(e.providers.authorization()) == address(e.authorization), "providers/auth");
        require(address(e.nodes.authorization()) == address(e.authorization), "nodes/auth");
        require(address(e.nodes.providers()) == address(e.providers), "nodes/providers");

        require(address(e.offers.nodes()) == address(e.nodes), "offers/nodes");
        require(address(e.offers.providers()) == address(e.providers), "offers/providers");
        require(address(e.offers.policy()) == address(e.policy), "offers/policy");
        require(address(e.offers.authorization()) == address(e.authorization), "offers/auth");

        require(address(e.sessions.offers()) == address(e.offers), "sessions/offers");
        require(address(e.sessions.authorization()) == address(e.authorization), "sessions/auth");
        require(address(e.receipts.sessions()) == address(e.sessions), "receipts/sessions");
        require(address(e.receipts.offers()) == address(e.offers), "receipts/offers");
        require(address(e.receipts.nodes()) == address(e.nodes), "receipts/nodes");

        require(address(e.router.policy()) == address(e.policy), "router/policy");
        require(address(e.router.nodes()) == address(e.nodes), "router/nodes");
        require(address(e.router.offers()) == address(e.offers), "router/offers");

        require(address(e.schemes.authorization()) == address(e.authorization), "schemes/auth");
        require(address(e.capacity.authorization()) == address(e.authorization), "capacity/auth");
        require(address(e.capacity.nodes()) == address(e.nodes), "capacity/nodes");
        require(address(e.capacity.providers()) == address(e.providers), "capacity/providers");

        require(address(e.commitments.authorization()) == address(e.authorization), "commitments/auth");
        require(address(e.commitments.providers()) == address(e.providers), "commitments/providers");
        require(address(e.commitments.nodes()) == address(e.nodes), "commitments/nodes");
        require(address(e.commitments.schemes()) == address(e.schemes), "commitments/schemes");

        require(address(e.proofs.commitments()) == address(e.commitments), "proofs/commitments");
        require(address(e.proofs.schemes()) == address(e.schemes), "proofs/schemes");
        require(address(e.proofs.nodes()) == address(e.nodes), "proofs/nodes");

        require(address(e.agreements.authorization()) == address(e.authorization), "agreements/auth");
        require(address(e.agreements.offers()) == address(e.offers), "agreements/offers");
        require(address(e.agreements.nodes()) == address(e.nodes), "agreements/nodes");
        require(address(e.agreements.providers()) == address(e.providers), "agreements/providers");
        require(address(e.agreements.schemes()) == address(e.schemes), "agreements/schemes");
        require(address(e.agreements.commitments()) == address(e.commitments), "agreements/commitments");
        require(address(e.agreements.capacity()) == address(e.capacity), "agreements/capacity");

        require(address(e.manifests.agreements()) == address(e.agreements), "manifests/agreements");
        require(address(e.manifests.commitments()) == address(e.commitments), "manifests/commitments");
        require(address(e.settlements.agreements()) == address(e.agreements), "settlements/agreements");
        require(address(e.settlements.proofs()) == address(e.proofs), "settlements/proofs");
    }

    function testProtocolRegistryPublishesExactResourceRouterRuntimeIdentity() public {
        Env memory e = _deploy();

        require(RESOURCE_SERVICE_ID == ServiceIds420.RESOURCE_PROTOCOL, "service id drift");
        ProtocolRegistry.Service memory service = e.registry.getService(RESOURCE_SERVICE_ID);
        require(service.implementation == address(e.router), "service implementation");
        require(service.codeHash == address(e.router).codehash, "service codehash");
        require(service.metadataHash == METADATA_HASH, "service metadata");
        require(service.version == 1 && service.active, "service lifecycle");

        ProtocolRegistry.RegistrationProfile memory profile =
            e.registry.getRegistrationProfile(RESOURCE_SERVICE_ID, 1);
        require(profile.componentType == ProtocolRegistry.ComponentType.SERVICE, "component type");
        require(profile.manifestHash == MANIFEST_HASH, "manifest hash");
        require(profile.dependencyRoot == e.dependencyRoot, "dependency root");
        require(profile.interfaceHash == INTERFACE_HASH, "interface hash");

        (address resolved, uint32 version) = e.registry.resolveActive(RESOURCE_SERVICE_ID);
        require(resolved == address(e.router) && version == 1, "active resolution");
    }

    function testCapabilityAuthorityAndWrongRouterAreVisible() public {
        Env memory e = _deploy();

        require(
            e.caps.componentAuthority(ResourceIds420.COMPONENT_RESOURCE) == address(this),
            "resource capability authority"
        );

        ResourceRouter420 wrong = new ResourceRouter420(address(e.policy), address(e.nodes), address(e.offers));
        require(address(wrong) != address(e.router), "wrong router same address");

        ProtocolRegistry.Service memory service = e.registry.getService(RESOURCE_SERVICE_ID);
        require(service.implementation != address(wrong), "registry accepted wrong router");
        require(service.codeHash == address(e.router).codehash, "registered codehash drift");
    }
}
