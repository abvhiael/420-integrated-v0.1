// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "forge-std/Test.sol";
import "../src/interfaces/genesis/ICapabilityRegistry420.sol";
import "../src/compute/ComputeIds420.sol";
import "../src/compute/ComputeAuthorization420.sol";
import "../src/compute/ComputePolicyRegistry420.sol";
import "../src/compute/ComputeProviderRegistry420.sol";
import "../src/compute/ComputeNodeRegistry420.sol";
import "../src/compute/ComputeResourceRegistry420.sol";
import "../src/compute/ComputeOfferRegistry420.sol";
import "../src/compute/ComputeRequestRegistry420.sol";
import "../src/compute/ComputeMatch420.sol";
import "../src/compute/ComputeJobRegistry420.sol";
import "../src/ai/AIIds420.sol";
import "../src/ai/AIProviderRegistry.sol";
import "../src/ai/AIJobManager.sol";
import "../src/ai/AIComputeAdapter420.sol";
contract MockAIComputeCapabilities420 is ICapabilityRegistry420 {
    mapping(bytes32 => bool) private _allowed;
    function set(address principal, bytes32 componentId, bytes32 capabilityId, bytes32 scopeHash, uint256 amount, bool value) external {
        _allowed[keccak256(abi.encode(principal, componentId, capabilityId, scopeHash, amount))] = value;
    }
    function grant(bytes32) external pure returns (CapabilityGrant memory capabilityGrant) { return capabilityGrant; }
    function isAuthorized(address principal, bytes32 componentId, bytes32 capabilityId, bytes32 scopeHash, uint256 amount) external view returns (bool) {
        return _allowed[keccak256(abi.encode(principal, componentId, capabilityId, scopeHash, amount))];
    }
}
contract AIComputeRecovery420Test is Test {
    address constant USER = address(0xA11CE);
    address constant PROVIDER = address(0xB0B);
    bytes32 constant COMPUTE_PROVIDER_ID = keccak256("compute-provider");
    bytes32 constant AI_PROVIDER_ID = keccak256("ai-provider");
    bytes32 constant NODE_ID = keccak256("node");
    bytes32 constant RESOURCE_ID = keccak256("resource");
    bytes32 constant OFFER_ID = keccak256("offer");
    bytes32 constant REQUEST_ID = keccak256("compute-request");
    bytes32 constant AI_JOB_ID = keccak256("ai-job");
    bytes32 constant POLICY_ID = keccak256("compute-policy");
    bytes32 constant VERIFY_PROFILE = keccak256("verify-profile");
    bytes32 constant PRIVACY_POLICY = keccak256("privacy-policy");
    bytes32 constant REQUEST_HASH = keccak256("request-payload");
    MockAIComputeCapabilities420 caps;
    ComputeAuthorization420 auth;
    ComputePolicyRegistry420 policy;
    ComputeProviderRegistry420 providers;
    ComputeNodeRegistry420 nodes;
    ComputeResourceRegistry420 resources;
    ComputeOfferRegistry420 offers;
    ComputeRequestRegistry420 requests;
    ComputeMatch420 matches;
    ComputeJobRegistry420 computeJobs;
    AIProviderRegistry aiProviders;
    AIJobManager aiJobs;
    AIComputeAdapter420 adapter;
    bytes32 matchId;
    bytes32 computeJobId;
    function setUp() public {
        caps = new MockAIComputeCapabilities420();
        auth = new ComputeAuthorization420(address(caps));
        policy = new ComputePolicyRegistry420(address(this));
        providers = new ComputeProviderRegistry420(address(auth));
        nodes = new ComputeNodeRegistry420(address(auth), address(providers));
        resources = new ComputeResourceRegistry420(address(auth), address(providers), address(nodes));
        offers = new ComputeOfferRegistry420(address(auth), address(providers), address(nodes), address(resources), address(policy));
        requests = new ComputeRequestRegistry420(address(auth));
        policy.setPolicy(POLICY_ID, keccak256("fixed-job"), keccak256("sla"), VERIFY_PROFILE, PRIVACY_POLICY, 3600, 100, true);
        vm.prank(PROVIDER);
        providers.registerProvider(COMPUTE_PROVIDER_ID, PROVIDER, PROVIDER, keccak256("provider-manifest"), keccak256("stake"));
        vm.prank(PROVIDER);
        providers.setState(COMPUTE_PROVIDER_ID, ComputeProviderRegistry420.State.ACTIVE);
        vm.prank(PROVIDER);
        nodes.registerNode(NODE_ID, COMPUTE_PROVIDER_ID, PROVIDER, keccak256("node-manifest"), keccak256("endpoint-manifest"), uint64(block.timestamp + 1 days));
        vm.prank(PROVIDER);
        nodes.setState(NODE_ID, ComputeNodeRegistry420.State.ACTIVE);
        vm.prank(PROVIDER);
        resources.registerResource(RESOURCE_ID, NODE_ID, ComputeIds420.CLASS_GPU_INFERENCE, keccak256("gpu-profile"), keccak256("runtime-profile"), keccak256("capabilities"), 100);
        vm.prank(PROVIDER);
        resources.setState(RESOURCE_ID, ComputeResourceRegistry420.State.ACTIVE);
        vm.prank(PROVIDER);
        offers.publishOffer(OFFER_ID, RESOURCE_ID, POLICY_ID, 5, 100, uint64(block.timestamp + 1 days), keccak256("region-policy"));
        vm.prank(USER);
        requests.createRequest(REQUEST_ID, ComputeIds420.WORKLOAD_AI_INFERENCE, keccak256("resource-requirement"), REQUEST_HASH, 100, uint64(block.timestamp + 1 hours), PRIVACY_POLICY, VERIFY_PROFILE, keccak256("provider-constraints"));
        vm.prank(USER);
        requests.confirmFunding(REQUEST_ID, keccak256("funding"), 100);
        matches = new ComputeMatch420(address(auth), address(offers), address(requests), address(resources));
        caps.set(address(matches), ComputeIds420.COMPONENT_COMPUTE, ComputeIds420.ACTION_ACCEPT_MATCH, auth.scopeRequest(REQUEST_ID), 100, true);
        matchId = matches.canonicalMatchId(REQUEST_ID, OFFER_ID);
        computeJobs = new ComputeJobRegistry420(address(auth), address(matches), address(providers), address(requests));
        computeJobId = computeJobs.canonicalJobId(matchId);
        aiProviders = new AIProviderRegistry(address(this));
        vm.prank(PROVIDER);
        aiProviders.registerProvider(AI_PROVIDER_ID, PROVIDER, PROVIDER, keccak256("ai-provider-manifest"), keccak256("ai-stake"), COMPUTE_PROVIDER_ID);
        vm.prank(PROVIDER);
        aiProviders.activate(AI_PROVIDER_ID);
        aiJobs = new AIJobManager(address(this));
        adapter = new AIComputeAdapter420(address(aiJobs), address(aiProviders), address(requests), address(matches), address(computeJobs));
        aiJobs.bindComputeAdapter(address(adapter));
        vm.prank(USER);
        aiJobs.createRequest(AI_JOB_ID, keccak256("model-version"), AIIds420.WORKLOAD_TEXT, REQUEST_HASH, PRIVACY_POLICY, VERIFY_PROFILE, 100, uint64(block.timestamp + 1 hours));
        vm.prank(aiJobs.AI_JOB_ESCROW());
        aiJobs.confirmFunding(AI_JOB_ID, keccak256("funding"), 100);
    }
    function testEndToEndAIJobBindsAndSynchronizesComputeLifecycle() public {
        // Both requests must be FUNDED when the requester first binds them.
        // Accepting the Compute match advances its request to MATCHED, so that
        // action must follow bindComputeRequest rather than precede it in setUp.
        vm.prank(USER);
        adapter.bindComputeRequest(AI_JOB_ID, REQUEST_ID);
        vm.prank(USER);
        uint256 quote = matches.acceptMatch(matchId, REQUEST_ID, OFFER_ID, 10);
        assertEq(quote, 50);
        vm.prank(USER);
        computeJobs.createJob(computeJobId, matchId);
        vm.prank(USER);
        adapter.bindComputeMatch(AI_JOB_ID, matchId, computeJobId, AI_PROVIDER_ID);
        vm.prank(PROVIDER);
        computeJobs.accept(computeJobId);
        vm.prank(PROVIDER);
        computeJobs.markRunning(computeJobId);
        vm.prank(PROVIDER);
        computeJobs.commitResult(computeJobId, keccak256("output"), keccak256("result-manifest"));
        caps.set(USER, ComputeIds420.COMPONENT_COMPUTE, ComputeIds420.ACTION_VERIFY, auth.scopeJob(computeJobId), 0, true);
        vm.prank(USER);
        computeJobs.markVerified(computeJobId);
        adapter.sync(AI_JOB_ID);
        AIJobManager.Job memory ai = aiJobs.getJob(AI_JOB_ID);
        assertEq(uint256(uint8(ai.status)), uint256(uint8(AIJobManager.Status.VERIFIED)));
        assertEq(uint256(ai.computeRequestId), uint256(REQUEST_ID));
        assertEq(uint256(ai.computeJobId), uint256(computeJobId));
        assertEq(uint256(ai.providerId), uint256(AI_PROVIDER_ID));
        assertEq(uint256(ai.resultHash), uint256(keccak256("output")));
        assertEq(uint256(ai.resultManifestHash), uint256(keccak256("result-manifest")));
    }
    function testCannotBindAlreadyMatchedComputeRequest() public {
        vm.prank(USER);
        uint256 quote = matches.acceptMatch(matchId, REQUEST_ID, OFFER_ID, 10);
        assertEq(quote, 50);
        vm.prank(USER);
        vm.expectRevert(AIComputeAdapter420.IncompatibleComputeState.selector);
        adapter.bindComputeRequest(AI_JOB_ID, REQUEST_ID);
    }
    function testAdapterRejectsComputeRequestThatBroadensSpend() public {
        bytes32 badId = keccak256("bad-request");
        vm.prank(USER);
        requests.createRequest(badId, ComputeIds420.WORKLOAD_AI_INFERENCE, keccak256("resource-requirement"), REQUEST_HASH, 101, uint64(block.timestamp + 1 hours), PRIVACY_POLICY, VERIFY_PROFILE, keccak256("provider-constraints"));
        vm.prank(USER);
        requests.confirmFunding(badId, keccak256("bad-funding"), 101);
        vm.prank(USER);
        vm.expectRevert(AIComputeAdapter420.InvalidBinding.selector);
        adapter.bindComputeRequest(AI_JOB_ID, badId);
    }
}
