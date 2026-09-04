// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/town/ITownContributionSource420.sol";
import "../src/town/TownContributionVerifier420.sol";
import "../src/town/TownRewardTypes420.sol";
import "./MockTownContributionSource420.sol";

contract TownContributionVerifierGovernance420Test {
    address constant USER = address(0x4201);
    MockTownContributionSource420 source;
    TownContributionVerifier420 verifier;

    function setUp() public {
        source = new MockTownContributionSource420();
        verifier = new TownContributionVerifier420(address(source));
    }

    function testModerationRequiresAuthorizedFinalNonOverturnedAction() public {
        bytes32 id = keccak256("moderation");
        bytes32 h = keccak256("action");
        bytes32 community = keccak256("community");
        bytes32 target = keccak256("target");

        source.setModeration(id, ITownContributionSource420.ModerationRecord(true, true, false, true, USER, community, target, h));
        require(verifier.verifyContribution(TownRewardTypes420.MODERATION_ACTION, id, USER, h), "valid moderation");

        source.setModeration(id, ITownContributionSource420.ModerationRecord(true, true, true, true, USER, community, target, h));
        require(!verifier.verifyContribution(TownRewardTypes420.MODERATION_ACTION, id, USER, h), "overturn rejected");

        source.setModeration(id, ITownContributionSource420.ModerationRecord(true, true, false, false, USER, community, target, h));
        require(!verifier.verifyContribution(TownRewardTypes420.MODERATION_ACTION, id, USER, h), "authorization required");

        source.setModeration(id, ITownContributionSource420.ModerationRecord(true, false, false, true, USER, community, target, h));
        require(!verifier.verifyContribution(TownRewardTypes420.MODERATION_ACTION, id, USER, h), "finality required");
    }

    function testTranslationRequiresAcceptedDistinctLanguagePair() public {
        bytes32 id = keccak256("translation");
        bytes32 h = keccak256("translated");
        bytes32 en = keccak256("en");
        bytes32 fr = keccak256("fr");
        bytes32 sourceId = keccak256("source");

        source.setTranslation(id, ITownContributionSource420.TranslationRecord(true, true, USER, sourceId, en, fr, h));
        require(verifier.verifyContribution(TownRewardTypes420.TRANSLATION, id, USER, h), "valid translation");

        source.setTranslation(id, ITownContributionSource420.TranslationRecord(true, true, USER, sourceId, en, en, h));
        require(!verifier.verifyContribution(TownRewardTypes420.TRANSLATION, id, USER, h), "languages differ");

        source.setTranslation(id, ITownContributionSource420.TranslationRecord(true, false, USER, sourceId, en, fr, h));
        require(!verifier.verifyContribution(TownRewardTypes420.TRANSLATION, id, USER, h), "acceptance required");
    }

    function testEvidenceAndUnsupportedTypesFailClosed() public {
        bytes32 id = keccak256("post");
        bytes32 h = keccak256("body");
        source.setPost(id, ITownContributionSource420.PostRecord(true, true, USER, h));
        require(!verifier.verifyContribution(TownRewardTypes420.POST, id, USER, keccak256("different")), "exact evidence");
        require(!verifier.verifyContribution(keccak256("UNSUPPORTED"), id, USER, h), "unsupported");
        require(!verifier.verifyContribution(TownRewardTypes420.POST, bytes32(0), USER, h), "source required");
        require(!verifier.verifyContribution(TownRewardTypes420.POST, id, address(0), h), "beneficiary required");
        require(!verifier.verifyContribution(TownRewardTypes420.POST, id, USER, bytes32(0)), "evidence required");
    }
}
