// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/compute/ComputeUsefulRewardFunding420.sol";
import "../src/interfaces/genesis/ICapabilityRegistry420.sol";
import "../src/vault/VaultAuthorization420.sol";
import "../src/vault/VaultPolicyRegistry420.sol";
import "../src/vault/VaultRegistry420.sol";
import "../src/vault/VaultAccounting420.sol";
import "../src/vault/AssetVault420.sol";
import "../src/vault/VaultIds420.sol";

interface VmComputeUsefulRewardFunding420 {
    function prank(address caller) external;
    function deal(address account, uint256 newBalance) external;
}

contract MockUsefulFundingCaps420 is ICapabilityRegistry420 {
    function grant(bytes32) external pure returns (CapabilityGrant memory g) { return g; }
    function isAuthorized(address, bytes32, bytes32, bytes32, uint256)
        external
        pure
        returns (bool)
    {
        return false;
    }
}

contract ComputeUsefulRewardFunding420Test {
    VmComputeUsefulRewardFunding420 private constant vm =
        VmComputeUsefulRewardFunding420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address private constant RESEARCHER = address(0xA11CE);
    address private constant UNIVERSITY = address(0xB0B);
    address private constant COMMUNITY = address(0xCAFE);

    bytes32 private constant AUTH_POLICY = keccak256("cmp6/funding/auth");
    bytes32 private constant ASSET_POLICY = keccak256("cmp6/funding/asset");
    bytes32 private constant RELEASE_POLICY = keccak256("cmp6/funding/release");
    bytes32 private constant ACCOUNTING_POLICY = keccak256("cmp6/funding/accounting");
    bytes32 private constant VAULT_ID = keccak256("cmp6/useful/reward/vault");

    VaultRegistry420 private registry;
    VaultAccounting420 private accounting;
    AssetVault420 private vault;
    ComputeUsefulRewardFunding420 private funding;

    function setUp() public {
        MockUsefulFundingCaps420 caps = new MockUsefulFundingCaps420();
        VaultAuthorization420 auth = new VaultAuthorization420(address(caps));
        VaultPolicyRegistry420 policies = new VaultPolicyRegistry420(address(this));
        registry = new VaultRegistry420(address(auth), address(policies));
        accounting = new VaultAccounting420(address(registry));

        policies.setPolicy(
            AUTH_POLICY, VaultIds420.POLICY_AUTHORIZATION, keccak256("auth"), bytes32(0), true
        );
        policies.setPolicy(
            ASSET_POLICY, VaultIds420.POLICY_ASSET, keccak256("asset"), bytes32(0), true
        );
        policies.setPolicy(
            RELEASE_POLICY, VaultIds420.POLICY_RELEASE, keccak256("release"), bytes32(0), true
        );
        policies.setPolicy(
            ACCOUNTING_POLICY, VaultIds420.POLICY_ACCOUNTING, keccak256("accounting"), bytes32(0), true
        );

        vault = new AssetVault420(
            VAULT_ID,
            address(registry),
            address(auth),
            address(accounting),
            address(this)
        );
        registry.registerVault(
            VAULT_ID,
            address(vault),
            VaultIds420.VAULT_RESERVE,
            AUTH_POLICY,
            ASSET_POLICY,
            RELEASE_POLICY,
            ACCOUNTING_POLICY,
            bytes32(0),
            keccak256("cmp6-useful-reward"),
            keccak256("cmp6-useful-reward-manifest")
        );

        funding = new ComputeUsefulRewardFunding420(address(vault));

        vm.deal(RESEARCHER, 100 ether);
        vm.deal(UNIVERSITY, 100 ether);
        vm.deal(COMMUNITY, 100 ether);
    }

    function testResearcherFundsJobIntoCanonicalVault() public {
        bytes32 jobRef = keccak256("job/cancer/001");
        bytes32 fundingRef = keccak256("researcher/grant/001");

        uint8 sourceKind = funding.SOURCE_RESEARCHER();
        uint8 targetKind = funding.TARGET_JOB();
        vm.prank(RESEARCHER);
        bytes32 contributionId =
            funding.fund{value: 12 ether}(sourceKind, targetKind, jobRef, fundingRef);

        ComputeUsefulRewardFunding420.Contribution memory c =
            funding.contribution(contributionId);
        require(c.contributor == RESEARCHER, "contributor drift");
        require(c.sourceKind == funding.SOURCE_RESEARCHER(), "source drift");
        require(c.targetKind == funding.TARGET_JOB(), "target kind drift");
        require(c.targetRef == jobRef, "target ref drift");
        require(c.fundingRef == fundingRef, "funding ref drift");
        require(c.amount == 12 ether, "amount drift");

        VaultAccounting420.AssetAccounting memory a =
            accounting.getAccounting(VAULT_ID, address(0));
        require(a.recordedBalance == 12 ether, "vault not funded");
        require(a.reserved == 0 && a.claimable == 0, "CMP-6.1 created payout authority");
        require(funding.totalFunded() == 12 ether, "total funding mismatch");
        require(
            funding.fundedBySourceKind(funding.SOURCE_RESEARCHER()) == 12 ether,
            "source accounting mismatch"
        );
        bytes32 key = funding.targetKey(funding.TARGET_JOB(), jobRef);
        require(funding.fundedByTarget(key) == 12 ether, "target accounting mismatch");
    }

    function testAllCanonicalFundingSourceKindsAreAccepted() public {
        bytes32 poolRef = keccak256("pool/protein-folding");
        uint8 targetKind = funding.TARGET_POOL();
        for (uint8 kind = 1; kind <= 6; kind++) {
            address contributor = address(uint160(0x1000 + kind));
            vm.deal(contributor, 2 ether);
            vm.prank(contributor);
            funding.fund{value: 1 ether}(
                kind,
                targetKind,
                poolRef,
                keccak256(abi.encode("source", kind))
            );
        }

        require(funding.totalFunded() == 6 ether, "canonical source total mismatch");
        bytes32 key = funding.targetKey(funding.TARGET_POOL(), poolRef);
        require(funding.fundedByTarget(key) == 6 ether, "pool funding mismatch");
        for (uint8 kind = 1; kind <= 6; kind++) {
            require(funding.fundedBySourceKind(kind) == 1 ether, "source kind missing");
        }
    }

    function testMultipleFundingSourcesCanConvergeOnOnePool() public {
        bytes32 poolRef = keccak256("pool/climate");
        uint8 universitySource = funding.SOURCE_UNIVERSITY();
        uint8 communitySource = funding.SOURCE_COMMUNITY();
        uint8 targetKind = funding.TARGET_POOL();

        vm.prank(UNIVERSITY);
        funding.fund{value: 8 ether}(
            universitySource,
            targetKind,
            poolRef,
            keccak256("university/climate/1")
        );

        vm.prank(COMMUNITY);
        funding.fund{value: 3 ether}(
            communitySource,
            targetKind,
            poolRef,
            keccak256("community/climate/1")
        );

        bytes32 key = funding.targetKey(funding.TARGET_POOL(), poolRef);
        require(funding.fundedByTarget(key) == 11 ether, "pooled amount mismatch");
        require(funding.fundedByContributor(UNIVERSITY) == 8 ether, "university accounting");
        require(funding.fundedByContributor(COMMUNITY) == 3 ether, "community accounting");
    }

    function testReplayAndInvalidFundingFailClosed() public {
        bytes32 poolRef = keccak256("pool/astronomy");
        bytes32 fundingRef = keccak256("community/astronomy/1");
        uint8 communitySource = funding.SOURCE_COMMUNITY();
        uint8 researcherSource = funding.SOURCE_RESEARCHER();
        uint8 targetPool = funding.TARGET_POOL();
        uint8 targetJob = funding.TARGET_JOB();

        vm.prank(COMMUNITY);
        funding.fund{value: 4 ether}(
            communitySource,
            targetPool,
            poolRef,
            fundingRef
        );

        vm.prank(COMMUNITY);
        (bool ok,) = address(funding).call{value: 4 ether}(
            abi.encodeCall(
                funding.fund,
                (
                    communitySource,
                    targetPool,
                    poolRef,
                    fundingRef
                )
            )
        );
        require(!ok, "duplicate funding reference accepted");
        require(funding.totalFunded() == 4 ether, "replay changed accounting");

        vm.prank(RESEARCHER);
        (ok,) = address(funding).call{value: 1 ether}(
            abi.encodeCall(funding.fund, (uint8(0), targetJob, poolRef, keccak256("bad")))
        );
        require(!ok, "invalid source accepted");

        vm.prank(RESEARCHER);
        (ok,) = address(funding).call{value: 1 ether}(
            abi.encodeCall(funding.fund, (researcherSource, uint8(3), poolRef, keccak256("bad-target")))
        );
        require(!ok, "invalid target accepted");
    }

    function testZeroAmountAndZeroReferencesFailClosed() public {
        uint8 researcherSource = funding.SOURCE_RESEARCHER();
        uint8 targetJob = funding.TARGET_JOB();
        vm.prank(RESEARCHER);
        (bool ok,) = address(funding).call(
            abi.encodeCall(
                funding.fund,
                (
                    researcherSource,
                    targetJob,
                    keccak256("job"),
                    keccak256("zero-amount")
                )
            )
        );
        require(!ok, "zero amount accepted");

        vm.prank(RESEARCHER);
        (ok,) = address(funding).call{value: 1 ether}(
            abi.encodeCall(
                funding.fund,
                (
                    researcherSource,
                    targetJob,
                    bytes32(0),
                    keccak256("zero-target")
                )
            )
        );
        require(!ok, "zero target accepted");

        vm.prank(RESEARCHER);
        (ok,) = address(funding).call{value: 1 ether}(
            abi.encodeCall(
                funding.fund,
                (
                    researcherSource,
                    targetJob,
                    keccak256("job"),
                    bytes32(0)
                )
            )
        );
        require(!ok, "zero funding ref accepted");
    }
}
