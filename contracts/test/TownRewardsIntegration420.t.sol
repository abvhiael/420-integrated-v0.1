// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/interfaces/genesis/ICapabilityRegistry420.sol";
import "../src/rewards/RewardIds420.sol";
import "../src/rewards/RewardAuthorization420.sol";
import "../src/rewards/ContributionRegistry420.sol";
import "../src/town/ITownContributionVerifier420.sol";
import "../src/town/TownRewardTypes420.sol";
import "../src/town/TownRewardsAdapter420.sol";

interface VmTownRewards420 {
    function prank(address) external;
    function expectRevert(bytes4) external;
}

contract MockTownRewardCapabilities420 is ICapabilityRegistry420 {
    mapping(bytes32 => bool) private _allowed;

    function set(address principal, bytes32 componentId, bytes32 capabilityId, bytes32 scopeHash, uint256 amount, bool value) external {
        _allowed[keccak256(abi.encode(principal, componentId, capabilityId, scopeHash, amount))] = value;
    }

    function grant(bytes32) external pure override returns (CapabilityGrant memory capabilityGrant) { return capabilityGrant; }

    function isAuthorized(address principal, bytes32 componentId, bytes32 capabilityId, bytes32 scopeHash, uint256 amount) external view override returns (bool) {
        return _allowed[keccak256(abi.encode(principal, componentId, capabilityId, scopeHash, amount))];
    }
}

contract MockTownContributionVerifier420 is ITownContributionVerifier420 {
    mapping(bytes32 => bool) public valid;

    function set(bytes32 contributionType, bytes32 sourceId, address beneficiary, bytes32 evidenceHash, bool value) external {
        valid[keccak256(abi.encode(contributionType, sourceId, beneficiary, evidenceHash))] = value;
    }

    function verifyContribution(bytes32 contributionType, bytes32 sourceId, address beneficiary, bytes32 evidenceHash) external view returns (bool) {
        return valid[keccak256(abi.encode(contributionType, sourceId, beneficiary, evidenceHash))];
    }
}

contract TownRewardsIntegration420Test {
    VmTownRewards420 constant vm = VmTownRewards420(address(uint160(uint256(keccak256("hevm cheat code")))));
    address constant USER = address(0x4201);
    address constant CALLER = address(0x4202);

    MockTownRewardCapabilities420 caps;
    RewardAuthorization420 auth;
    ContributionRegistry420 contributions;
    MockTownContributionVerifier420 verifier;
    TownRewardsAdapter420 adapter;

    function setUp() public {
        caps = new MockTownRewardCapabilities420();
        auth = new RewardAuthorization420(address(caps));
        contributions = new ContributionRegistry420(address(auth));
        verifier = new MockTownContributionVerifier420();
        adapter = new TownRewardsAdapter420(address(contributions), address(verifier));
    }

    function _authorizeAdapter() internal {
        caps.set(
            address(adapter),
            RewardIds420.COMPONENT_REWARDS,
            RewardIds420.ACTION_PUBLISH_CONTRIBUTION,
            auth.scopeForApp(TownRewardTypes420.APP_ID),
            0,
            true
        );
    }

    function testTownAdapterIsOptionalAndDefaultDeny() public {
        bytes32 sourceId = keccak256("post-1");
        bytes32 evidenceHash = keccak256("post-evidence");
        verifier.set(TownRewardTypes420.POST, sourceId, USER, evidenceHash, true);

        vm.expectRevert(ContributionRegistry420.Unauthorized.selector);
        adapter.publishContribution(TownRewardTypes420.POST, sourceId, USER, evidenceHash);
    }

    function testVerifiedPostPublishesCanonicalContribution() public {
        _authorizeAdapter();
        bytes32 sourceId = keccak256("post-2");
        bytes32 evidenceHash = keccak256("post-evidence-2");
        verifier.set(TownRewardTypes420.POST, sourceId, USER, evidenceHash, true);

        vm.prank(CALLER);
        bytes32 contributionId = adapter.publishContribution(TownRewardTypes420.POST, sourceId, USER, evidenceHash);
        ContributionRegistry420.Contribution memory c = contributions.contribution(contributionId);

        require(c.exists, "contribution exists");
        require(c.appId == TownRewardTypes420.APP_ID, "town app");
        require(c.contributionType == TownRewardTypes420.POST, "post type");
        require(c.publisher == address(adapter), "adapter publisher");
        require(c.beneficiary == USER, "beneficiary preserved");
    }

    function testUnverifiedContributionRejected() public {
        _authorizeAdapter();
        vm.expectRevert(TownRewardsAdapter420.UnverifiedContribution.selector);
        adapter.publishContribution(TownRewardTypes420.COMMENT, keccak256("comment-1"), USER, keccak256("evidence"));
    }

    function testUnsupportedContributionTypeRejected() public {
        _authorizeAdapter();
        vm.expectRevert(TownRewardsAdapter420.UnsupportedContributionType.selector);
        adapter.publishContribution(keccak256("LIKE_FARM"), keccak256("source"), USER, keccak256("evidence"));
    }

    function testSourceCannotBeRewardRegisteredTwiceForSameType() public {
        _authorizeAdapter();
        bytes32 sourceId = keccak256("post-3");
        bytes32 evidenceHash = keccak256("post-evidence-3");
        verifier.set(TownRewardTypes420.POST, sourceId, USER, evidenceHash, true);
        adapter.publishContribution(TownRewardTypes420.POST, sourceId, USER, evidenceHash);

        vm.expectRevert(ContributionRegistry420.Replay.selector);
        adapter.publishContribution(TownRewardTypes420.POST, sourceId, USER, evidenceHash);
    }

    function testSameSourceCanRepresentDifferentApprovedContributionClasses() public {
        _authorizeAdapter();
        bytes32 sourceId = keccak256("resource-1");
        bytes32 evidenceHash = keccak256("resource-evidence");
        verifier.set(TownRewardTypes420.POST, sourceId, USER, evidenceHash, true);
        verifier.set(TownRewardTypes420.CURATION, sourceId, USER, evidenceHash, true);

        bytes32 postId = adapter.publishContribution(TownRewardTypes420.POST, sourceId, USER, evidenceHash);
        bytes32 curateId = adapter.publishContribution(TownRewardTypes420.CURATION, sourceId, USER, evidenceHash);
        require(postId != curateId, "classes separated");
    }

    function testVerifierBindsBeneficiaryAndEvidence() public {
        _authorizeAdapter();
        bytes32 sourceId = keccak256("translation-1");
        bytes32 evidenceHash = keccak256("translation-proof");
        verifier.set(TownRewardTypes420.TRANSLATION, sourceId, USER, evidenceHash, true);

        vm.expectRevert(TownRewardsAdapter420.UnverifiedContribution.selector);
        adapter.publishContribution(TownRewardTypes420.TRANSLATION, sourceId, address(0xBEEF), evidenceHash);

        vm.expectRevert(TownRewardsAdapter420.UnverifiedContribution.selector);
        adapter.publishContribution(TownRewardTypes420.TRANSLATION, sourceId, USER, keccak256("tampered"));
    }

    function testAllFrozenTownContributionClassesAreSupported() public {
        require(TownRewardTypes420.supported(TownRewardTypes420.POST), "post");
        require(TownRewardTypes420.supported(TownRewardTypes420.COMMENT), "comment");
        require(TownRewardTypes420.supported(TownRewardTypes420.CURATION), "curation");
        require(TownRewardTypes420.supported(TownRewardTypes420.MODERATION_ACTION), "moderation");
        require(TownRewardTypes420.supported(TownRewardTypes420.TRANSLATION), "translation");
        require(TownRewardTypes420.supported(TownRewardTypes420.COMMUNITY_RESOURCE), "resource");
    }
}
