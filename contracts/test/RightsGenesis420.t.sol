// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/interfaces/genesis/ICapabilityRegistry420.sol";
import "../src/rights/RightsAuthorization420.sol";
import "../src/rights/RightsPolicyRegistry420.sol";
import "../src/rights/RightsAssetRegistry420.sol";
import "../src/rights/RightsClaimRegistry420.sol";
import "../src/rights/RightsLicenseRegistry420.sol";
import "../src/rights/RightsRouter420.sol";
import "../src/rights/RightsIds420.sol";

interface VmRights420 { function prank(address) external; }

contract MockCapabilityRights420 is ICapabilityRegistry420 {
    bool public authorized;
    function setAuthorized(bool value) external { authorized = value; }
    function grant(bytes32) external pure returns (CapabilityGrant memory g) { return g; }
    function isAuthorized(address,bytes32,bytes32,bytes32,uint256) external view returns (bool) { return authorized; }
}

contract RightsGenesis420Test {
    VmRights420 internal constant vm = VmRights420(address(uint160(uint256(keccak256("hevm cheat code")))));
    address internal constant ALICE = address(0xA11CE);
    address internal constant BOB = address(0xB0B);

    function _setup() internal returns (MockCapabilityRights420 caps, RightsAuthorization420 auth, RightsPolicyRegistry420 policy, RightsAssetRegistry420 assets, RightsClaimRegistry420 claims, RightsLicenseRegistry420 licenses, RightsRouter420 router) {
        caps = new MockCapabilityRights420();
        auth = new RightsAuthorization420(address(caps));
        policy = new RightsPolicyRegistry420(address(this));
        assets = new RightsAssetRegistry420(address(auth));
        claims = new RightsClaimRegistry420(address(auth), address(assets), address(policy));
        licenses = new RightsLicenseRegistry420(address(auth), address(claims));
        router = new RightsRouter420(address(claims), address(licenses));
        policy.setRightClass(RightsIds420.RIGHT_COPYRIGHT, keccak256("copyright-policy"), true);
        policy.setRightClass(RightsIds420.RIGHT_GENETIC, keccak256("genetic-policy"), true);
    }

    function testRightsLifecycleAndLicenseScope() public {
        (, , , RightsAssetRegistry420 assets, RightsClaimRegistry420 claims, RightsLicenseRegistry420 licenses, RightsRouter420 router) = _setup();
        bytes32 subjectId = keccak256("work-1");
        bytes32 rightId = keccak256("right-1");
        bytes32 licenseId = keccak256("license-1");
        bytes32 scope = keccak256("streaming-canada");

        vm.prank(ALICE);
        assets.registerSubject(subjectId, keccak256("recording"), ALICE, keccak256("metadata"), keccak256("provenance"));
        vm.prank(ALICE);
        claims.declareClaim(rightId, subjectId, RightsIds420.RIGHT_COPYRIGHT, ALICE, keccak256("CA"), keccak256("evidence"), uint64(block.timestamp), 0);
        vm.prank(ALICE);
        licenses.grantLicense(licenseId, rightId, BOB, scope, keccak256("terms"), uint64(block.timestamp), 0, true);

        require(router.isRightEffective(rightId), "right inactive");
        require(router.canUse(licenseId, BOB, scope), "license unusable");
        require(!router.canUse(licenseId, BOB, keccak256("wrong-scope")), "scope bypass");

        vm.prank(ALICE);
        licenses.revokeLicense(licenseId);
        require(!router.canUse(licenseId, BOB, scope), "revoked license usable");
    }

    function testDefaultDenyForUnrelatedActor() public {
        (, , , RightsAssetRegistry420 assets, RightsClaimRegistry420 claims, RightsLicenseRegistry420 licenses,) = _setup();
        bytes32 subjectId = keccak256("work-2");
        bytes32 rightId = keccak256("right-2");
        vm.prank(ALICE);
        assets.registerSubject(subjectId, keccak256("genetic-line"), ALICE, bytes32(0), keccak256("provenance"));
        vm.prank(ALICE);
        claims.declareClaim(rightId, subjectId, RightsIds420.RIGHT_GENETIC, ALICE, keccak256("CA"), keccak256("evidence"), uint64(block.timestamp), 0);

        vm.prank(BOB);
        (bool ok,) = address(licenses).call(abi.encodeWithSelector(licenses.grantLicense.selector, keccak256("bad-license"), rightId, BOB, keccak256("scope"), keccak256("terms"), uint64(block.timestamp), uint64(0), true));
        require(!ok, "unrelated actor granted license");
    }

    function testClaimsDoNotSelfAssertLegalFinality() public {
        (, , , RightsAssetRegistry420 assets, RightsClaimRegistry420 claims,,) = _setup();
        bytes32 subjectId = keccak256("work-3");
        bytes32 rightId = keccak256("right-3");
        vm.prank(ALICE);
        assets.registerSubject(subjectId, keccak256("song"), ALICE, bytes32(0), keccak256("provenance"));
        vm.prank(ALICE);
        claims.declareClaim(rightId, subjectId, RightsIds420.RIGHT_COPYRIGHT, ALICE, keccak256("CA"), keccak256("evidence"), uint64(block.timestamp), 0);
        RightsClaimRegistry420.Claim memory c = claims.claim(rightId);
        require(c.evidenceHash != bytes32(0), "evidence not committed");
        require(c.jurisdictionHash != bytes32(0), "jurisdiction not committed");
    }
}
