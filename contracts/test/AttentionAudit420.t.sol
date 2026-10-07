// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./AttentionGenesis420.t.sol";

contract AttentionAudit420Test is AttentionGenesis420Test {
    address constant DELEGATE = address(0xD1);

    function _activeCampaign(uint64 startsAt, uint64 endsAt, uint256 cap) internal returns (bytes32 id) {
        vm.prank(SPONSOR);
        id = campaigns.createCampaign(
            keccak256("audit-meta"),
            keccak256("audit-audience"),
            VERIFIER,
            10 ether,
            1 ether,
            cap,
            startsAt,
            endsAt
        );
        vm.prank(SPONSOR);
        treasury.fundCampaign{value: 10 ether}(id);
        vm.prank(SPONSOR);
        campaigns.activate(id);
    }

    function _optIn(address account) internal {
        vm.prank(account);
        consent.setGlobal(account, true, keccak256("audit-policy"));
    }

    function testCampaignSpecificConsentOverridesGlobal() public {
        bytes32 id = _activeCampaign(1, type(uint64).max, 5 ether);
        _optIn(USER);
        require(consent.isOptedIn(USER, id), "global opt-in");
        vm.prank(USER);
        consent.setCampaign(USER, id, false, keccak256("campaign-policy"));
        require(!consent.isOptedIn(USER, id), "campaign revoke");
    }

    function testDelegatedConsentIsNarrowAndWorks() public {
        bytes32 scope = auth.scopeForAccount(USER);
        caps.set(
            DELEGATE,
            AttentionIds420.COMPONENT_ATTENTION,
            AttentionIds420.ACTION_MANAGE_CONSENT,
            scope,
            0,
            true
        );
        vm.prank(DELEGATE);
        consent.setGlobal(USER, true, keccak256("delegated-policy"));
        require(consent.isOptedIn(USER, bytes32(uint256(1))), "delegated consent");
        require(!auth.isAuthorized(DELEGATE, USER, AttentionIds420.ACTION_CLAIM_REWARD), "no ambient claim");
    }

    function testProofRejectsObservationOutsideCampaignWindow() public {
        bytes32 id = _activeCampaign(100, 200, 5 ether);
        _optIn(USER);
        vm.expectRevert(AttentionProofRegistry420.CampaignNotAcceptingProofs.selector);
        vm.prank(VERIFIER);
        proofs.commitProof(id, USER, 99, 1, keccak256("evidence"), keccak256("audit-window"));
    }

    function testRewardCapIsCumulativeAcrossProofs() public {
        bytes32 id = _activeCampaign(1, type(uint64).max, 3 ether);
        _optIn(USER);

        vm.prank(VERIFIER);
        bytes32 p1 = proofs.commitProof(id, USER, 1, 2, keccak256("e1"), keccak256("n-cap-1"));
        rewards.accrue(p1);

        vm.prank(VERIFIER);
        bytes32 p2 = proofs.commitProof(id, USER, 1, 2, keccak256("e2"), keccak256("n-cap-2"));
        vm.expectRevert(AttentionRewardRegistry420.CapExceeded.selector);
        rewards.accrue(p2);
    }

    function testReservedRewardBlocksSponsorRefund() public {
        bytes32 id = _activeCampaign(1, type(uint64).max, 5 ether);
        _optIn(USER);
        vm.prank(VERIFIER);
        bytes32 proofId = proofs.commitProof(id, USER, 1, 1, keccak256("evidence"), keccak256("n-reserved"));
        rewards.accrue(proofId);

        campaigns.close(id);
        vm.expectRevert(AttentionTreasury.InvalidInput.selector);
        vm.prank(SPONSOR);
        treasury.claimUnused(id);
    }

    function testDelegatedClaimPaysOnlyCanonicalAccount() public {
        bytes32 id = _activeCampaign(1, type(uint64).max, 5 ether);
        _optIn(USER);
        vm.prank(VERIFIER);
        bytes32 proofId = proofs.commitProof(id, USER, 1, 1, keccak256("evidence"), keccak256("n-delegated-claim"));
        bytes32 rewardId = rewards.accrue(proofId);

        caps.set(
            DELEGATE,
            AttentionIds420.COMPONENT_ATTENTION,
            AttentionIds420.ACTION_CLAIM_REWARD,
            auth.scopeForAccount(USER),
            0,
            true
        );

        uint256 beforeBalance = USER.balance;
        vm.prank(DELEGATE);
        rewards.claim(rewardId, USER);
        require(USER.balance == beforeBalance + 1 ether, "canonical recipient");
    }

    function testCancelledCampaignRefundsOnlyUnusedSponsorFunds() public {
        vm.prank(SPONSOR);
        bytes32 id = campaigns.createCampaign(
            keccak256("cancel-meta"),
            keccak256("cancel-audience"),
            VERIFIER,
            10 ether,
            1 ether,
            3 ether,
            1,
            type(uint64).max
        );
        vm.prank(SPONSOR);
        treasury.fundCampaign{value: 10 ether}(id);
        vm.prank(SPONSOR);
        campaigns.cancel(id);
        uint256 beforeBalance = SPONSOR.balance;
        vm.prank(SPONSOR);
        treasury.claimUnused(id);
        require(SPONSOR.balance == beforeBalance + 10 ether, "refund amount");
    }
}
