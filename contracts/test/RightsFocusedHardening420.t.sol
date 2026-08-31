// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/interfaces/genesis/ICapabilityRegistry420.sol";
import "../src/rights/RightsAuthorization420.sol";
import "../src/rights/RightsPolicyRegistry420.sol";
import "../src/rights/RightsAssetRegistry420.sol";
import "../src/rights/RightsClaimRegistry420.sol";
import "../src/rights/RightsLicenseRegistry420.sol";
import "../src/rights/RightsIds420.sol";

interface VmRightsHardening420 {
    function prank(address) external;
    function warp(uint256) external;
}

contract ScopedCapabilityRights420 is ICapabilityRegistry420 {
    address public principal;
    bytes32 public componentId;
    bytes32 public capabilityId;
    bytes32 public scopeHash;
    uint64 public validFrom;
    uint64 public validUntil;
    bool public revoked;

    function configure(address principal_, bytes32 componentId_, bytes32 capabilityId_, bytes32 scopeHash_, uint64 validFrom_, uint64 validUntil_, bool revoked_) external {
        principal = principal_;
        componentId = componentId_;
        capabilityId = capabilityId_;
        scopeHash = scopeHash_;
        validFrom = validFrom_;
        validUntil = validUntil_;
        revoked = revoked_;
    }

    function grant(bytes32) external pure returns (CapabilityGrant memory g) { return g; }

    function isAuthorized(address p, bytes32 c, bytes32 a, bytes32 s, uint256) external view returns (bool) {
        if (revoked || p != principal || c != componentId || a != capabilityId || s != scopeHash) return false;
        if (block.timestamp < validFrom) return false;
        return validUntil == 0 || block.timestamp <= validUntil;
    }
}

contract RightsFocusedHardening420Test {
    VmRightsHardening420 internal constant vm = VmRightsHardening420(address(uint160(uint256(keccak256("hevm cheat code")))));
    address internal constant ALICE = address(0xA11CE);
    address internal constant BOB = address(0xB0B);
    address internal constant CAROL = address(0xCA401);

    struct Env {
        ScopedCapabilityRights420 caps;
        RightsAuthorization420 auth;
        RightsPolicyRegistry420 policy;
        RightsAssetRegistry420 assets;
        RightsClaimRegistry420 claims;
        RightsLicenseRegistry420 licenses;
    }

    function _setup() internal returns (Env memory e) {
        e.caps = new ScopedCapabilityRights420();
        e.auth = new RightsAuthorization420(address(e.caps));
        e.policy = new RightsPolicyRegistry420(address(this));
        e.assets = new RightsAssetRegistry420(address(e.auth));
        e.claims = new RightsClaimRegistry420(address(e.auth), address(e.assets), address(e.policy));
        e.licenses = new RightsLicenseRegistry420(address(e.auth), address(e.claims));
        e.policy.setRightClass(RightsIds420.RIGHT_COPYRIGHT, keccak256("copyright-policy"), true);
    }

    function _subjectAndClaim(Env memory e, bytes32 subjectId, bytes32 rightId, bytes32 evidence, uint64 from, uint64 until) internal {
        vm.prank(ALICE);
        e.assets.registerSubject(subjectId, keccak256("work"), ALICE, bytes32(0), keccak256(abi.encode(subjectId)));
        vm.prank(ALICE);
        e.claims.declareClaim(rightId, subjectId, RightsIds420.RIGHT_COPYRIGHT, ALICE, keccak256("CA"), evidence, from, until);
    }

    function testExactClaimReplayRejectedAndSupersessionTerminalizesOldClaim() public {
        Env memory e = _setup();
        bytes32 subjectId = keccak256("dup-work");
        bytes32 right1 = keccak256("right-a");
        bytes32 right2 = keccak256("right-b");
        uint64 nowTs = uint64(block.timestamp);
        _subjectAndClaim(e, subjectId, right1, keccak256("evidence-a"), nowTs, 0);

        vm.prank(ALICE);
        (bool replayOk,) = address(e.claims).call(abi.encodeWithSelector(e.claims.declareClaim.selector, right2, subjectId, RightsIds420.RIGHT_COPYRIGHT, ALICE, keccak256("CA"), keccak256("evidence-a"), nowTs, uint64(0)));
        require(!replayOk, "semantic duplicate claim accepted");

        vm.prank(ALICE);
        e.claims.declareClaim(right2, subjectId, RightsIds420.RIGHT_COPYRIGHT, ALICE, keccak256("CA"), keccak256("evidence-b"), nowTs, 0);
        vm.prank(ALICE);
        e.claims.supersedeClaim(right1, right2);
        require(!e.claims.isEffective(right1), "superseded claim still effective");
        require(e.claims.isEffective(right2), "replacement claim ineffective");
        RightsClaimRegistry420.Claim memory oldClaim = e.claims.claim(right1);
        require(oldClaim.supersededBy == right2, "supersession link missing");
    }

    function testCanonicalLicenseIdAndReplay() public {
        Env memory e = _setup();
        bytes32 subjectId = keccak256("license-work");
        bytes32 rightId = keccak256("license-right");
        uint64 nowTs = uint64(block.timestamp);
        _subjectAndClaim(e, subjectId, rightId, keccak256("evidence"), nowTs, 0);
        bytes32 scope = keccak256("scope");
        bytes32 terms = keccak256("terms");
        bytes32 canonicalId = e.licenses.deriveLicenseId(rightId, BOB, scope, terms, nowTs, 0, true);

        vm.prank(ALICE);
        (bool wrongIdOk,) = address(e.licenses).call(abi.encodeWithSelector(e.licenses.grantLicense.selector, keccak256("arbitrary"), rightId, BOB, scope, terms, nowTs, uint64(0), true));
        require(!wrongIdOk, "arbitrary license id accepted");

        vm.prank(ALICE);
        e.licenses.grantLicense(canonicalId, rightId, BOB, scope, terms, nowTs, 0, true);
        vm.prank(ALICE);
        (bool replayOk,) = address(e.licenses).call(abi.encodeWithSelector(e.licenses.grantLicense.selector, canonicalId, rightId, BOB, scope, terms, nowTs, uint64(0), true));
        require(!replayOk, "license replay accepted");
    }

    function testDelegatedAuthorityExpiresAndRevocationFailsClosed() public {
        Env memory e = _setup();
        bytes32 subjectId = keccak256("delegated-work");
        bytes32 rightId = keccak256("delegated-right");
        uint64 nowTs = uint64(block.timestamp);
        _subjectAndClaim(e, subjectId, rightId, keccak256("evidence"), nowTs, 0);
        bytes32 scopeHash = e.auth.scopeForRight(rightId);
        e.caps.configure(BOB, RightsIds420.COMPONENT_RIGHTS, RightsIds420.ACTION_GRANT_LICENSE, scopeHash, nowTs, nowTs + 10, false);

        bytes32 scope1 = keccak256("scope-1");
        bytes32 id1 = e.licenses.deriveLicenseId(rightId, CAROL, scope1, keccak256("terms-1"), nowTs, 0, true);
        vm.prank(BOB);
        e.licenses.grantLicense(id1, rightId, CAROL, scope1, keccak256("terms-1"), nowTs, 0, true);

        vm.warp(uint256(nowTs) + 11);
        bytes32 id2 = e.licenses.deriveLicenseId(rightId, CAROL, keccak256("scope-2"), keccak256("terms-2"), uint64(block.timestamp), 0, true);
        vm.prank(BOB);
        (bool expiredOk,) = address(e.licenses).call(abi.encodeWithSelector(e.licenses.grantLicense.selector, id2, rightId, CAROL, keccak256("scope-2"), keccak256("terms-2"), uint64(block.timestamp), uint64(0), true));
        require(!expiredOk, "expired capability authorized");

        e.caps.configure(BOB, RightsIds420.COMPONENT_RIGHTS, RightsIds420.ACTION_GRANT_LICENSE, scopeHash, uint64(block.timestamp), 0, true);
        bytes32 id3 = e.licenses.deriveLicenseId(rightId, CAROL, keccak256("scope-3"), keccak256("terms-3"), uint64(block.timestamp), 0, true);
        vm.prank(BOB);
        (bool revokedOk,) = address(e.licenses).call(abi.encodeWithSelector(e.licenses.grantLicense.selector, id3, rightId, CAROL, keccak256("scope-3"), keccak256("terms-3"), uint64(block.timestamp), uint64(0), true));
        require(!revokedOk, "revoked capability authorized");
    }

    function testTemporalEdgesAreInclusiveThenExpire() public {
        Env memory e = _setup();
        bytes32 subjectId = keccak256("timed-work");
        bytes32 rightId = keccak256("timed-right");
        uint64 start = uint64(block.timestamp + 10);
        uint64 end = start + 20;
        _subjectAndClaim(e, subjectId, rightId, keccak256("evidence"), start, end);
        require(!e.claims.isEffective(rightId), "future claim effective early");

        vm.warp(start);
        require(e.claims.isEffective(rightId), "claim inactive at start");
        bytes32 scope = keccak256("timed-scope");
        bytes32 terms = keccak256("timed-terms");
        bytes32 licenseId = e.licenses.deriveLicenseId(rightId, BOB, scope, terms, start, end, true);
        vm.prank(ALICE);
        e.licenses.grantLicense(licenseId, rightId, BOB, scope, terms, start, end, true);

        vm.warp(end);
        require(e.claims.isEffective(rightId), "claim expired at inclusive end");
        require(e.licenses.isEffective(licenseId), "license expired at inclusive end");
        vm.warp(uint256(end) + 1);
        require(!e.claims.isEffective(rightId), "claim effective after end");
        require(!e.licenses.isEffective(licenseId), "license effective after end");
    }

    function testHolderSuccessionPreservesExistingLicenseAndMovesDirectAuthority() public {
        Env memory e = _setup();
        bytes32 subjectId = keccak256("succession-work");
        bytes32 rightId = keccak256("succession-right");
        uint64 nowTs = uint64(block.timestamp);
        _subjectAndClaim(e, subjectId, rightId, keccak256("evidence"), nowTs, 0);
        bytes32 oldScope = keccak256("existing-scope");
        bytes32 oldTerms = keccak256("existing-terms");
        bytes32 oldLicense = e.licenses.deriveLicenseId(rightId, BOB, oldScope, oldTerms, nowTs, 0, true);
        vm.prank(ALICE);
        e.licenses.grantLicense(oldLicense, rightId, BOB, oldScope, oldTerms, nowTs, 0, true);

        vm.prank(ALICE);
        e.claims.transferHolder(rightId, CAROL, keccak256("estate-transfer-proof"));
        RightsClaimRegistry420.Claim memory c = e.claims.claim(rightId);
        require(c.holder == CAROL, "holder succession failed");
        require(e.licenses.isEffective(oldLicense), "existing license destroyed by succession");

        bytes32 newScope = keccak256("new-scope");
        bytes32 newTerms = keccak256("new-terms");
        bytes32 newLicense = e.licenses.deriveLicenseId(rightId, BOB, newScope, newTerms, nowTs, 0, true);
        vm.prank(ALICE);
        (bool formerHolderOk,) = address(e.licenses).call(abi.encodeWithSelector(e.licenses.grantLicense.selector, newLicense, rightId, BOB, newScope, newTerms, nowTs, uint64(0), true));
        require(!formerHolderOk, "former holder retained direct grant authority");
        vm.prank(CAROL);
        e.licenses.grantLicense(newLicense, rightId, BOB, newScope, newTerms, nowTs, 0, true);

        vm.prank(CAROL);
        e.licenses.revokeLicense(oldLicense);
        require(!e.licenses.isEffective(oldLicense), "successor could not administer inherited revocable license");
    }
}
