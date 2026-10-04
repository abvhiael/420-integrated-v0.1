// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/apps/ProtocolRegistry.sol";
import "../src/ai/AIIds420.sol";
import "../src/ai/AIAuthorization420.sol";
import "../src/ai/AIPolicyRegistry420.sol";
import "../src/ai/AIModelDeploymentRegistry420.sol";
import "../src/ai/AIRequestRegistry420.sol";
import "../src/ai/AIResultRegistry420.sol";
import "../src/ai/AIComputeAdapter420.sol";
import "../src/ai/AIRouter420.sol";
import "../src/ai/AIProviderRegistry.sol";
import "../src/ai/AIModelRegistry.sol";
import "../src/ai/AIJobManager.sol";
import "../src/ai/AIJobEscrow.sol";
import "../src/ai/AIReputationRegistry.sol";

interface VmAI9 {
    function prank(address) external;
    function etch(address, bytes calldata) external;
}

contract MockAI9Code {}

contract MockAI9JobRegistry {
    address public immutable requestEvidence;
    constructor(address requestEvidence_) { requestEvidence = requestEvidence_; }
}

contract MockAI9ComputeRouter is ICompute420 {
    bytes32 public immutable override componentGraphHash = keccak256("420/ai-audit-9/mock-compute-graph");
    address public immutable override jobRegistry;
    address public immutable override fundingAdapter;
    address public immutable override matchRegistry;
    address public immutable override workerEvidence;
    address public immutable override verificationRouter;
    address public immutable override disputeResolver;
    address public immutable override settlementAdapter;
    address public immutable override providerRegistry;
    address public immutable override nodeRegistry;
    address public immutable override resourceRegistry;
    address public immutable override offerRegistry;

    constructor(address requestEvidence_) {
        jobRegistry = address(new MockAI9JobRegistry(requestEvidence_));
        fundingAdapter = address(new MockAI9Code());
        matchRegistry = address(new MockAI9Code());
        workerEvidence = address(new MockAI9Code());
        verificationRouter = address(new MockAI9Code());
        disputeResolver = address(new MockAI9Code());
        settlementAdapter = address(new MockAI9Code());
        providerRegistry = address(new MockAI9Code());
        nodeRegistry = address(new MockAI9Code());
        resourceRegistry = address(new MockAI9Code());
        offerRegistry = address(new MockAI9Code());
    }
}

contract AIDeploymentMaterialization420Test {
    VmAI9 internal constant vm = VmAI9(address(uint160(uint256(keccak256("hevm cheat code")))));

    address internal constant TIMELOCK = 0x0000000000000000000000000000000000000429;
    address internal constant AI_PROVIDER = 0x000000000000000000000000000000000000042f;
    address internal constant AI_MODEL = 0x0000000000000000000000000000000000000430;
    address internal constant AI_JOB_MANAGER = 0x0000000000000000000000000000000000000431;
    address internal constant AI_JOB_ESCROW = 0x0000000000000000000000000000000000000432;
    address internal constant AI_REPUTATION = 0x0000000000000000000000000000000000000433;
    address internal constant PROTOCOL_REGISTRY = 0x0000000000000000000000000000000000000434;

    bytes32 internal constant SERVICE_AI = keccak256("420/service/ai/v1");

    event log_named_bytes32(string key, bytes32 val);
    event log_named_address(string key, address val);

    function _v(uint16 major) private pure returns (Types420.Version memory) {
        return Types420.Version({major: major, minor: 0, patch: 0});
    }

    function _materializePredeploys() private {
        AIProviderRegistry providerImpl = new AIProviderRegistry(TIMELOCK);
        AIModelRegistry modelImpl = new AIModelRegistry(TIMELOCK);
        AIJobManager jobImpl = new AIJobManager(TIMELOCK);
        AIJobEscrow escrowImpl = new AIJobEscrow(TIMELOCK);
        AIReputationRegistry reputationImpl = new AIReputationRegistry(TIMELOCK);
        ProtocolRegistry registryImpl = new ProtocolRegistry(TIMELOCK);

        vm.etch(AI_PROVIDER, address(providerImpl).code);
        vm.etch(AI_MODEL, address(modelImpl).code);
        vm.etch(AI_JOB_MANAGER, address(jobImpl).code);
        vm.etch(AI_JOB_ESCROW, address(escrowImpl).code);
        vm.etch(AI_REPUTATION, address(reputationImpl).code);
        vm.etch(PROTOCOL_REGISTRY, address(registryImpl).code);

        require(AIProviderRegistry(AI_PROVIDER).governanceTimelock() == TIMELOCK, "provider timelock");
        require(AIModelRegistry(AI_MODEL).governanceTimelock() == TIMELOCK, "model timelock");
        require(AIJobManager(AI_JOB_MANAGER).governanceTimelock() == TIMELOCK, "jobs timelock");
        require(AIJobEscrow(AI_JOB_ESCROW).governanceTimelock() == TIMELOCK, "escrow timelock");
        require(AIReputationRegistry(AI_REPUTATION).governanceTimelock() == TIMELOCK, "reputation timelock");
        require(ProtocolRegistry(PROTOCOL_REGISTRY).governanceTimelock() == TIMELOCK, "registry timelock");

        emit log_named_bytes32("AIProviderRegistry runtimeCodeHash", AI_PROVIDER.codehash);
        emit log_named_bytes32("AIModelRegistry runtimeCodeHash", AI_MODEL.codehash);
        emit log_named_bytes32("AIJobManager runtimeCodeHash", AI_JOB_MANAGER.codehash);
        emit log_named_bytes32("AIJobEscrow runtimeCodeHash", AI_JOB_ESCROW.codehash);
        emit log_named_bytes32("AIReputationRegistry runtimeCodeHash", AI_REPUTATION.codehash);
    }

    function _stage(ProtocolRegistry registry, bytes32 id, address implementation, uint16 major) private {
        vm.prank(TIMELOCK);
        registry.registerComponent(id, implementation, _v(major), Types420.Lifecycle.SUSPENDED);
        Types420.ContractRef memory ref = registry.component(id);
        require(ref.implementation == implementation, "staged implementation");
        require(ref.runtimeCodeHash == implementation.codehash, "staged codehash");
        require(ref.lifecycle == Types420.Lifecycle.SUSPENDED, "staged lifecycle");
        require(!registry.isActive(id), "staged active");
    }

    function _activate(ProtocolRegistry registry, bytes32 id) private {
        vm.prank(TIMELOCK);
        registry.setComponentLifecycle(id, Types420.Lifecycle.ACTIVE);
        require(registry.resolve(id) != address(0), "resolve");
    }

    function testAIAudit9MaterializationPublicationAndGovernanceHandoff() public {
        _materializePredeploys();

        ProtocolRegistry registry = ProtocolRegistry(PROTOCOL_REGISTRY);
        MockAI9Code capabilityRegistry = new MockAI9Code();
        MockAI9Code requestAuthority = new MockAI9Code();
        MockAI9ComputeRouter compute = new MockAI9ComputeRouter(address(requestAuthority));
        MockAI9Code trustAdapter = new MockAI9Code();

        AIAuthorization420 auth = new AIAuthorization420(address(capabilityRegistry));
        AIPolicyRegistry420 policy = new AIPolicyRegistry420(TIMELOCK);
        AIModelDeploymentRegistry420 deployments =
            new AIModelDeploymentRegistry420(address(auth), AI_PROVIDER, AI_MODEL);
        AIRequestRegistry420 requests = new AIRequestRegistry420(AI_JOB_MANAGER);
        AIResultRegistry420 results = new AIResultRegistry420(AI_JOB_MANAGER);
        AIComputeAdapter420 adapter = new AIComputeAdapter420(
            AI_JOB_MANAGER,
            address(auth),
            address(compute),
            AI_PROVIDER,
            AI_MODEL,
            address(deployments)
        );
        AIRouter420 router = new AIRouter420(
            AI_PROVIDER,
            AI_MODEL,
            AI_JOB_MANAGER,
            address(auth),
            address(policy),
            address(deployments),
            address(requests),
            address(results),
            address(adapter)
        );

        _stage(registry, AIIds420.COMPONENT_AI_PROVIDER_REGISTRY, AI_PROVIDER, 2);
        _stage(registry, AIIds420.COMPONENT_AI_MODEL_REGISTRY, AI_MODEL, 2);
        _stage(registry, AIIds420.COMPONENT_AI_JOB_MANAGER, AI_JOB_MANAGER, 2);
        _stage(registry, AIIds420.COMPONENT_AI_JOB_ESCROW, AI_JOB_ESCROW, 2);
        _stage(registry, AIIds420.COMPONENT_AI_REPUTATION_REGISTRY, AI_REPUTATION, 2);
        _stage(registry, AIIds420.COMPONENT_AI_AUTHORIZATION, address(auth), 1);
        _stage(registry, AIIds420.COMPONENT_AI_POLICY_REGISTRY, address(policy), 1);
        _stage(registry, AIIds420.COMPONENT_AI_DEPLOYMENT_REGISTRY, address(deployments), 1);
        _stage(registry, AIIds420.COMPONENT_AI_REQUEST_REGISTRY, address(requests), 1);
        _stage(registry, AIIds420.COMPONENT_AI_RESULT_REGISTRY, address(results), 1);
        _stage(registry, AIIds420.COMPONENT_AI_COMPUTE_ADAPTER, address(adapter), 2);
        _stage(registry, AIIds420.COMPONENT_AI_ROUTER, address(router), 1);

        vm.prank(TIMELOCK);
        AIJobManager(AI_JOB_MANAGER).bindComputeAdapter(address(adapter));
        vm.prank(TIMELOCK);
        AIJobEscrow(AI_JOB_ESCROW).bindVaultAdapter(compute.fundingAdapter());
        vm.prank(TIMELOCK);
        AIJobEscrow(AI_JOB_ESCROW).bindSettlementAdapter(compute.settlementAdapter());
        vm.prank(TIMELOCK);
        AIReputationRegistry(AI_REPUTATION).bindTrustAdapter(address(trustAdapter));

        _activate(registry, AIIds420.COMPONENT_AI_PROVIDER_REGISTRY);
        _activate(registry, AIIds420.COMPONENT_AI_MODEL_REGISTRY);
        _activate(registry, AIIds420.COMPONENT_AI_JOB_MANAGER);
        _activate(registry, AIIds420.COMPONENT_AI_JOB_ESCROW);
        _activate(registry, AIIds420.COMPONENT_AI_REPUTATION_REGISTRY);
        _activate(registry, AIIds420.COMPONENT_AI_AUTHORIZATION);
        _activate(registry, AIIds420.COMPONENT_AI_POLICY_REGISTRY);
        _activate(registry, AIIds420.COMPONENT_AI_DEPLOYMENT_REGISTRY);
        _activate(registry, AIIds420.COMPONENT_AI_REQUEST_REGISTRY);
        _activate(registry, AIIds420.COMPONENT_AI_RESULT_REGISTRY);
        _activate(registry, AIIds420.COMPONENT_AI_COMPUTE_ADAPTER);
        _activate(registry, AIIds420.COMPONENT_AI_ROUTER);

        bytes32 manifestHash = keccak256("420/ai/deployment-manifest/v1");
        bytes32 dependencyRoot = keccak256(
            abi.encode(
                address(capabilityRegistry),
                address(compute),
                compute.componentGraphHash(),
                compute.fundingAdapter(),
                compute.settlementAdapter(),
                address(trustAdapter)
            )
        );
        bytes32 interfaceHash = keccak256(abi.encodePacked(type(IAI420).interfaceId));
        bytes32 metadataHash = keccak256("420/ai/service-metadata/v1");

        vm.prank(TIMELOCK);
        registry.publishRegisteredService(
            SERVICE_AI,
            address(router),
            metadataHash,
            1,
            true,
            ProtocolRegistry.ComponentType.APPLICATION,
            manifestHash,
            dependencyRoot,
            interfaceHash
        );

        (address resolved, uint32 version) = registry.resolveActive(SERVICE_AI);
        require(resolved == address(router), "service router");
        require(version == 1, "service version");
        require(registry.runtimeCodeHash(AIIds420.COMPONENT_AI_ROUTER) == address(router).codehash, "router hash");
        require(AIJobManager(AI_JOB_MANAGER).computeAdapter() == address(adapter), "job adapter");
        require(AIJobEscrow(AI_JOB_ESCROW).vaultAdapter() == compute.fundingAdapter(), "vault adapter");
        require(AIJobEscrow(AI_JOB_ESCROW).settlementAdapter() == compute.settlementAdapter(), "settlement adapter");
        require(AIReputationRegistry(AI_REPUTATION).trustAdapter() == address(trustAdapter), "trust adapter");

        emit log_named_address("AIAuthorization420 deployment", address(auth));
        emit log_named_bytes32("AIAuthorization420 runtimeCodeHash", address(auth).codehash);
        emit log_named_address("AIPolicyRegistry420 deployment", address(policy));
        emit log_named_bytes32("AIPolicyRegistry420 runtimeCodeHash", address(policy).codehash);
        emit log_named_address("AIModelDeploymentRegistry420 deployment", address(deployments));
        emit log_named_bytes32("AIModelDeploymentRegistry420 runtimeCodeHash", address(deployments).codehash);
        emit log_named_address("AIRequestRegistry420 deployment", address(requests));
        emit log_named_bytes32("AIRequestRegistry420 runtimeCodeHash", address(requests).codehash);
        emit log_named_address("AIResultRegistry420 deployment", address(results));
        emit log_named_bytes32("AIResultRegistry420 runtimeCodeHash", address(results).codehash);
        emit log_named_address("AIComputeAdapter420 deployment", address(adapter));
        emit log_named_bytes32("AIComputeAdapter420 runtimeCodeHash", address(adapter).codehash);
        emit log_named_address("AIRouter420 deployment", address(router));
        emit log_named_bytes32("AIRouter420 runtimeCodeHash", address(router).codehash);
        emit log_named_bytes32("AI dependencyRoot", dependencyRoot);
        emit log_named_bytes32("AI manifestHash", manifestHash);
        emit log_named_bytes32("AI interfaceHash", interfaceHash);

        vm.prank(address(0xBEEF));
        (bool unauthorized,) = AI_JOB_MANAGER.call(
            abi.encodeWithSelector(AIJobManager.bindComputeAdapter.selector, address(0xCAFE))
        );
        require(!unauthorized, "deployer/admin bypass");
    }
}
