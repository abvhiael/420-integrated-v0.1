// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/interfaces/genesis/ICapabilityRegistry420.sol";
import "../src/rewards/RewardIds420.sol";
import "../src/rewards/RewardAuthorization420.sol";
import "../src/rewards/ContributionRegistry420.sol";
import "../src/ai/IAIContributionSource420.sol";
import "../src/ai/AIRewardTypes420.sol";
import "../src/ai/AIContributionVerifier420.sol";
import "../src/ai/AIRewardsAdapter420.sol";

interface VmAIRewards420 {
    function expectRevert(bytes4) external;
}

contract MockAICapabilities420 is ICapabilityRegistry420 {
    mapping(bytes32 => bool) private _allowed;

    function set(address principal, bytes32 componentId, bytes32 capabilityId, bytes32 scopeHash, uint256 amount, bool value) external {
        _allowed[keccak256(abi.encode(principal, componentId, capabilityId, scopeHash, amount))] = value;
    }

    function grant(bytes32) external pure override returns (CapabilityGrant memory capabilityGrant) { return capabilityGrant; }

    function isAuthorized(address principal, bytes32 componentId, bytes32 capabilityId, bytes32 scopeHash, uint256 amount) external view override returns (bool) {
        return _allowed[keccak256(abi.encode(principal, componentId, capabilityId, scopeHash, amount))];
    }
}

contract MockAIContributionSource420 is IAIContributionSource420 {
    struct Dataset { address contributor; bytes32 datasetId; bytes32 hash; bool accepted; bool active; }
    struct Evaluation { address evaluator; bytes32 modelId; bytes32 hash; bool finalized; bool active; }
    struct Correction { address contributor; bytes32 modelId; bytes32 hash; bool accepted; bool active; }
    struct Validation { address validator; bytes32 providerId; bytes32 hash; bool finalized; bool overturned; }

    mapping(bytes32 => Dataset) datasets;
    mapping(bytes32 => Evaluation) evaluations;
    mapping(bytes32 => Correction) corrections;
    mapping(bytes32 => Validation) validations;

    function setDataset(bytes32 id, address contributor, bytes32 datasetId, bytes32 hash, bool accepted, bool active) external { datasets[id] = Dataset(contributor, datasetId, hash, accepted, active); }
    function setEvaluation(bytes32 id, address evaluator, bytes32 modelId, bytes32 hash, bool finalized, bool active) external { evaluations[id] = Evaluation(evaluator, modelId, hash, finalized, active); }
    function setCorrection(bytes32 id, address contributor, bytes32 modelId, bytes32 hash, bool accepted, bool active) external { corrections[id] = Correction(contributor, modelId, hash, accepted, active); }
    function setValidation(bytes32 id, address validator, bytes32 providerId, bytes32 hash, bool finalized, bool overturned) external { validations[id] = Validation(validator, providerId, hash, finalized, overturned); }

    function datasetContributionRecord(bytes32 id) external view returns (address, bytes32, bytes32, bool, bool) { Dataset memory r = datasets[id]; return (r.contributor, r.datasetId, r.hash, r.accepted, r.active); }
    function evaluationRecord(bytes32 id) external view returns (address, bytes32, bytes32, bool, bool) { Evaluation memory r = evaluations[id]; return (r.evaluator, r.modelId, r.hash, r.finalized, r.active); }
    function modelCorrectionRecord(bytes32 id) external view returns (address, bytes32, bytes32, bool, bool) { Correction memory r = corrections[id]; return (r.contributor, r.modelId, r.hash, r.accepted, r.active); }
    function providerValidationRecord(bytes32 id) external view returns (address, bytes32, bytes32, bool, bool) { Validation memory r = validations[id]; return (r.validator, r.providerId, r.hash, r.finalized, r.overturned); }
}

contract AIRewardsIntegration420Test {
    VmAIRewards420 constant vm = VmAIRewards420(address(uint160(uint256(keccak256("hevm cheat code")))));
    address constant USER = address(0xA1420);

    MockAICapabilities420 caps;
    RewardAuthorization420 auth;
    ContributionRegistry420 contributions;
    MockAIContributionSource420 source;
    AIContributionVerifier420 verifier;
    AIRewardsAdapter420 adapter;

    function setUp() public {
        caps = new MockAICapabilities420();
        auth = new RewardAuthorization420(address(caps));
        contributions = new ContributionRegistry420(address(auth));
        source = new MockAIContributionSource420();
        verifier = new AIContributionVerifier420(address(source));
        adapter = new AIRewardsAdapter420(address(contributions), address(verifier));
    }

    function _authorize() internal {
        caps.set(address(adapter), RewardIds420.COMPONENT_REWARDS, RewardIds420.ACTION_PUBLISH_CONTRIBUTION, auth.scopeForApp(AIRewardTypes420.APP_ID), 0, true);
    }

    function testAcceptedDatasetContributionPublishes() public {
        _authorize();
        bytes32 id = keccak256("dataset-contribution-1");
        bytes32 evidence = keccak256("dataset-content");
        source.setDataset(id, USER, keccak256("dataset-1"), evidence, true, true);
        bytes32 contributionId = adapter.publishContribution(AIRewardTypes420.DATASET_CONTRIBUTION, id, USER, evidence);
        ContributionRegistry420.Contribution memory c = contributions.contribution(contributionId);
        require(c.exists && c.appId == AIRewardTypes420.APP_ID, "ai contribution");
        require(c.beneficiary == USER && c.publisher == address(adapter), "binding");
    }

    function testDatasetRequiresAcceptanceActiveDatasetAndOwner() public {
        bytes32 id = keccak256("dataset-contribution-2");
        bytes32 evidence = keccak256("dataset-content-2");
        source.setDataset(id, USER, bytes32(0), evidence, true, true);
        require(!verifier.verifyContribution(AIRewardTypes420.DATASET_CONTRIBUTION, id, USER, evidence), "dataset required");
        source.setDataset(id, USER, keccak256("dataset"), evidence, false, true);
        require(!verifier.verifyContribution(AIRewardTypes420.DATASET_CONTRIBUTION, id, USER, evidence), "acceptance required");
        source.setDataset(id, USER, keccak256("dataset"), evidence, true, false);
        require(!verifier.verifyContribution(AIRewardTypes420.DATASET_CONTRIBUTION, id, USER, evidence), "active required");
        source.setDataset(id, address(0xBEEF), keccak256("dataset"), evidence, true, true);
        require(!verifier.verifyContribution(AIRewardTypes420.DATASET_CONTRIBUTION, id, USER, evidence), "owner binding");
    }

    function testEvaluationRequiresFinalityActiveModelAndEvidence() public {
        bytes32 id = keccak256("evaluation-1");
        bytes32 evidence = keccak256("evaluation-evidence");
        source.setEvaluation(id, USER, keccak256("model-1"), evidence, true, true);
        require(verifier.verifyContribution(AIRewardTypes420.EVALUATION, id, USER, evidence), "valid evaluation");
        source.setEvaluation(id, USER, keccak256("model-1"), evidence, false, true);
        require(!verifier.verifyContribution(AIRewardTypes420.EVALUATION, id, USER, evidence), "finality required");
        source.setEvaluation(id, USER, bytes32(0), evidence, true, true);
        require(!verifier.verifyContribution(AIRewardTypes420.EVALUATION, id, USER, evidence), "model required");
    }

    function testCorrectionRequiresAcceptedActiveModel() public {
        bytes32 id = keccak256("model-correction-1");
        bytes32 evidence = keccak256("correction-evidence");
        source.setCorrection(id, USER, keccak256("model-1"), evidence, true, true);
        require(verifier.verifyContribution(AIRewardTypes420.MODEL_CORRECTION, id, USER, evidence), "valid correction");
        source.setCorrection(id, USER, keccak256("model-1"), evidence, false, true);
        require(!verifier.verifyContribution(AIRewardTypes420.MODEL_CORRECTION, id, USER, evidence), "accepted required");
    }

    function testProviderValidationMustBeFinalAndNotOverturned() public {
        bytes32 id = keccak256("provider-validation-1");
        bytes32 evidence = keccak256("validation-evidence");
        source.setValidation(id, USER, keccak256("provider-1"), evidence, true, false);
        require(verifier.verifyContribution(AIRewardTypes420.PROVIDER_VALIDATION, id, USER, evidence), "valid validation");
        source.setValidation(id, USER, keccak256("provider-1"), evidence, false, false);
        require(!verifier.verifyContribution(AIRewardTypes420.PROVIDER_VALIDATION, id, USER, evidence), "final required");
        source.setValidation(id, USER, keccak256("provider-1"), evidence, true, true);
        require(!verifier.verifyContribution(AIRewardTypes420.PROVIDER_VALIDATION, id, USER, evidence), "overturn blocks");
    }

    function testAdapterDefaultDenyEvidenceBindingAndReplay() public {
        bytes32 id = keccak256("evaluation-2");
        bytes32 evidence = keccak256("evaluation-evidence-2");
        source.setEvaluation(id, USER, keccak256("model-2"), evidence, true, true);
        vm.expectRevert(ContributionRegistry420.Unauthorized.selector);
        adapter.publishContribution(AIRewardTypes420.EVALUATION, id, USER, evidence);

        _authorize();
        vm.expectRevert(AIRewardsAdapter420.UnverifiedContribution.selector);
        adapter.publishContribution(AIRewardTypes420.EVALUATION, id, USER, keccak256("tampered"));

        adapter.publishContribution(AIRewardTypes420.EVALUATION, id, USER, evidence);
        vm.expectRevert(ContributionRegistry420.Replay.selector);
        adapter.publishContribution(AIRewardTypes420.EVALUATION, id, USER, evidence);
    }

    function testUnsupportedTypeFailsClosed() public {
        _authorize();
        vm.expectRevert(AIRewardsAdapter420.UnsupportedContributionType.selector);
        adapter.publishContribution(keccak256("PROMPT_SPAM"), keccak256("id"), USER, keccak256("evidence"));
    }
}
