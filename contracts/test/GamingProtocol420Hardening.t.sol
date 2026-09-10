// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/interfaces/genesis/ICapabilityRegistry420.sol";
import "../src/gaming/GamingAuthorization420.sol";
import "../src/gaming/GamingIds420.sol";
import "../src/gaming/GameRegistry420.sol";
import "../src/gaming/GameIdentity420.sol";
import "../src/gaming/GameEntitlements420.sol";
import "../src/gaming/GameClaims420.sol";
import "../src/gaming/CrossGameRegistry420.sol";

interface VmGaming420Hardening {
    function prank(address) external;
    function warp(uint256) external;
}

contract MockGamingCapabilities420Hardening is ICapabilityRegistry420 {
    bool public authorized;

    function setAuthorized(bool value) external { authorized = value; }
    function grant(bytes32) external pure returns (CapabilityGrant memory g) { return g; }
    function isAuthorized(address, bytes32, bytes32, bytes32, uint256) external view returns (bool) {
        return authorized;
    }
}

contract GamingProtocol420HardeningTest {
    VmGaming420Hardening internal constant vm = VmGaming420Hardening(address(uint160(uint256(keccak256("hevm cheat code")))));

    address internal constant GOVERNOR = address(0x420);
    address internal constant OPERATOR = address(0xBEEF);
    address internal constant ATTACKER = address(0xBAD);
    address internal constant ALICE = address(0xA11CE);
    address internal constant BOB = address(0xB0B);

    bytes32 internal constant GAME_ID = keccak256("420/GAMING/GAME/HIGH_COUNTRY/V1");

    struct Stack {
        MockGamingCapabilities420Hardening caps;
        GameRegistry420 games;
        GameIdentity420 identity;
        GameEntitlements420 entitlements;
        GameClaims420 claims;
        CrossGameRegistry420 crossGame;
    }

    function _setup() internal returns (Stack memory s) {
        s.caps = new MockGamingCapabilities420Hardening();
        GamingAuthorization420 auth = new GamingAuthorization420(address(s.caps));
        s.games = new GameRegistry420(address(auth));
        s.identity = new GameIdentity420(address(s.games));
        s.entitlements = new GameEntitlements420(address(s.games), address(s.identity));
        s.claims = new GameClaims420(address(s.games), address(s.identity));
        s.crossGame = new CrossGameRegistry420(address(s.games), address(s.identity));

        s.caps.setAuthorized(true);
        vm.prank(GOVERNOR);
        s.games.registerGame(GAME_ID, OPERATOR, keccak256("high-country-v1"));
    }

    function _profile(Stack memory s, address account) internal returns (bytes32 profileId) {
        vm.prank(account);
        profileId = s.identity.createProfile(GAME_ID, keccak256(abi.encodePacked("profile", account)));
    }

    function testUnauthorizedRegistryMutationFailsClosed() public {
        Stack memory s = _setup();
        s.caps.setAuthorized(false);

        vm.prank(ATTACKER);
        (bool updateOk,) = address(s.games).call(
            abi.encodeWithSelector(s.games.updateGame.selector, GAME_ID, ATTACKER, keccak256("hostile-metadata"))
        );
        require(!updateOk, "unauthorized update accepted");
        require(s.games.operatorOf(GAME_ID) == OPERATOR, "operator changed after denied update");

        vm.prank(ATTACKER);
        (bool statusOk,) = address(s.games).call(
            abi.encodeWithSelector(s.games.setGameStatus.selector, GAME_ID, false)
        );
        require(!statusOk, "unauthorized status change accepted");
        require(s.games.isActive(GAME_ID), "game deactivated after denied status change");
    }

    function testDuplicateWalletProfileIsRejected() public {
        Stack memory s = _setup();
        bytes32 first = _profile(s, ALICE);

        vm.prank(ALICE);
        (bool duplicateOk,) = address(s.identity).call(
            abi.encodeWithSelector(s.identity.createProfile.selector, GAME_ID, keccak256("replacement"))
        );
        require(!duplicateOk, "duplicate profile accepted");
        require(s.identity.profileIdOf(GAME_ID, ALICE) == first, "canonical profile changed");
    }

    function testWrongOperatorCannotIssueOrRevokeEntitlement() public {
        Stack memory s = _setup();
        bytes32 profileId = _profile(s, ALICE);
        bytes32 entitlementId = keccak256("gp16-entitlement");

        vm.prank(ATTACKER);
        (bool issueOk,) = address(s.entitlements).call(
            abi.encodeWithSelector(
                s.entitlements.issue.selector,
                entitlementId,
                profileId,
                GamingIds420.ENTITLEMENT_CLASS_CONTENT,
                keccak256("CONTENT"),
                uint64(0),
                uint64(0)
            )
        );
        require(!issueOk, "wrong operator issued entitlement");
        require(!s.entitlements.isActive(entitlementId), "denied entitlement became active");

        vm.prank(OPERATOR);
        s.entitlements.issue(
            entitlementId,
            profileId,
            GamingIds420.ENTITLEMENT_CLASS_CONTENT,
            keccak256("CONTENT"),
            0,
            0
        );

        vm.prank(ATTACKER);
        (bool revokeOk,) = address(s.entitlements).call(
            abi.encodeWithSelector(s.entitlements.revoke.selector, entitlementId)
        );
        require(!revokeOk, "wrong operator revoked entitlement");
        require(s.entitlements.isActive(entitlementId), "denied revoke changed entitlement");
    }

    function testEntitlementTimeWindowFailsClosed() public {
        Stack memory s = _setup();
        bytes32 profileId = _profile(s, ALICE);
        bytes32 entitlementId = keccak256("gp16-timed-entitlement");
        uint64 start = uint64(block.timestamp + 100);
        uint64 end = uint64(block.timestamp + 200);

        vm.prank(OPERATOR);
        s.entitlements.issue(
            entitlementId,
            profileId,
            GamingIds420.ENTITLEMENT_CLASS_EVENT,
            keccak256("EVENT"),
            start,
            end
        );

        require(!s.entitlements.isActive(entitlementId), "future entitlement active early");
        vm.warp(start);
        require(s.entitlements.isActive(entitlementId), "entitlement inactive at start");
        vm.warp(uint256(end) + 1);
        require(!s.entitlements.isActive(entitlementId), "expired entitlement active");
    }

    function testMigrationRequiresCanonicalProfileAndRejectsReplay() public {
        Stack memory s = _setup();
        bytes32 claimId = keccak256("gp16-migration");

        vm.prank(OPERATOR);
        s.claims.issue(
            claimId,
            GAME_ID,
            ALICE,
            keccak256("guest-state"),
            keccak256("payload"),
            uint64(block.timestamp + 1 days)
        );

        vm.prank(ALICE);
        (bool noProfileOk,) = address(s.claims).call(abi.encodeWithSelector(s.claims.consume.selector, claimId));
        require(!noProfileOk, "claim consumed without canonical profile");

        bytes32 profileId = _profile(s, ALICE);
        vm.prank(ALICE);
        bytes32 consumed = s.claims.consume(claimId);
        require(consumed == profileId, "claim consumed to wrong profile");

        vm.prank(ALICE);
        (bool replayOk,) = address(s.claims).call(abi.encodeWithSelector(s.claims.consume.selector, claimId));
        require(!replayOk, "claim replay accepted");
    }

    function testMigrationWrongAccountCancelledAndExpiredClaimsFailClosed() public {
        Stack memory s = _setup();
        _profile(s, ALICE);
        _profile(s, BOB);

        bytes32 claimId = keccak256("gp16-cancelled-migration");
        vm.prank(OPERATOR);
        s.claims.issue(claimId, GAME_ID, ALICE, keccak256("guest-a"), keccak256("payload-a"), uint64(block.timestamp + 1 days));

        vm.prank(BOB);
        (bool wrongAccountOk,) = address(s.claims).call(abi.encodeWithSelector(s.claims.consume.selector, claimId));
        require(!wrongAccountOk, "wrong account consumed claim");

        vm.prank(OPERATOR);
        s.claims.cancel(claimId);
        vm.prank(ALICE);
        (bool cancelledOk,) = address(s.claims).call(abi.encodeWithSelector(s.claims.consume.selector, claimId));
        require(!cancelledOk, "cancelled claim consumed");

        bytes32 expiredId = keccak256("gp16-expired-migration");
        uint64 expiry = uint64(block.timestamp + 10);
        vm.prank(OPERATOR);
        s.claims.issue(expiredId, GAME_ID, ALICE, keccak256("guest-b"), keccak256("payload-b"), expiry);
        vm.warp(uint256(expiry) + 1);
        vm.prank(ALICE);
        (bool expiredOk,) = address(s.claims).call(abi.encodeWithSelector(s.claims.consume.selector, expiredId));
        require(!expiredOk, "expired claim consumed");
    }

    function testWrongOperatorCannotIssueOrRevokeCrossGameAttestation() public {
        Stack memory s = _setup();
        bytes32 profileId = _profile(s, ALICE);
        bytes32 attestationId = keccak256("gp16-attestation");

        vm.prank(ATTACKER);
        (bool issueOk,) = address(s.crossGame).call(
            abi.encodeWithSelector(
                s.crossGame.issue.selector,
                attestationId,
                profileId,
                keccak256("ACHIEVEMENT"),
                keccak256("SUBJECT"),
                keccak256("payload"),
                uint64(0)
            )
        );
        require(!issueOk, "wrong operator issued attestation");
        require(!s.crossGame.isActive(attestationId), "denied attestation became active");

        vm.prank(OPERATOR);
        s.crossGame.issue(
            attestationId,
            profileId,
            keccak256("ACHIEVEMENT"),
            keccak256("SUBJECT"),
            keccak256("payload"),
            0
        );

        vm.prank(ATTACKER);
        (bool revokeOk,) = address(s.crossGame).call(
            abi.encodeWithSelector(s.crossGame.revoke.selector, attestationId)
        );
        require(!revokeOk, "wrong operator revoked attestation");
        require(s.crossGame.isActive(attestationId), "denied revoke changed attestation");
    }

    function testCrossGameAttestationExpiryAndRevocationFailClosed() public {
        Stack memory s = _setup();
        bytes32 profileId = _profile(s, ALICE);
        bytes32 expiringId = keccak256("gp16-expiring-attestation");
        uint64 expiry = uint64(block.timestamp + 10);

        vm.prank(OPERATOR);
        s.crossGame.issue(expiringId, profileId, keccak256("PRESTIGE"), keccak256("CUP"), keccak256("payload"), expiry);
        require(s.crossGame.isActive(expiringId), "fresh attestation inactive");
        vm.warp(uint256(expiry) + 1);
        require(!s.crossGame.isActive(expiringId), "expired attestation active");

        bytes32 revokedId = keccak256("gp16-revoked-attestation");
        vm.prank(OPERATOR);
        s.crossGame.issue(revokedId, profileId, keccak256("PRESTIGE"), keccak256("CUP2"), keccak256("payload2"), 0);
        vm.prank(OPERATOR);
        s.crossGame.revoke(revokedId);
        require(!s.crossGame.isActive(revokedId), "revoked attestation active");
    }

    function testNoWalletWideEnumerationSurface() public {
        Stack memory s = _setup();

        (bool profilesOk,) = address(s.identity).staticcall(
            abi.encodeWithSignature("profilesOf(address)", ALICE)
        );
        require(!profilesOk, "wallet-wide profile enumeration exposed");

        (bool claimsOk,) = address(s.claims).staticcall(
            abi.encodeWithSignature("claimsOf(address)", ALICE)
        );
        require(!claimsOk, "wallet-wide claim enumeration exposed");

        (bool attestationsOk,) = address(s.crossGame).staticcall(
            abi.encodeWithSignature("attestationsOf(address)", ALICE)
        );
        require(!attestationsOk, "wallet-wide attestation enumeration exposed");
    }
}
