// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { HighCountryMigration420 } from "../../../../src/highcountry/player/HighCountryMigration420.sol";
import { HighCountryGamingIds } from "../../../../src/highcountry/player/HighCountryGamingIds.sol";
import { IHighCountryAuthorization } from "../../../../src/highcountry/interfaces/IHighCountryAuthorization.sol";
import { AuthorizationRequest } from "../../../../src/highcountry/types/HighCountryTypes.sol";

contract MockHCAuthorizationMigration is IHighCountryAuthorization {
    bool public allowed = true;
    function setAllowed(bool value) external { allowed = value; }
    function capabilityRegistry() external pure returns (address) { return address(1); }
    function isAuthorized(AuthorizationRequest calldata) external view returns (bool) { return allowed; }
    function requireAuthorized(AuthorizationRequest calldata) external view { require(allowed, "unauthorized"); }
}

contract MockHCBridgeMigration {
    mapping(bytes32 => uint64) public growerProfileIdOfMigrationClaim;
    function bind(bytes32 claimId, uint64 growerProfileId) external {
        growerProfileIdOfMigrationClaim[claimId] = growerProfileId;
    }
}

contract MockGameClaimsMigration {
    struct MigrationClaim {
        bytes32 claimId;
        bytes32 gameId;
        address targetAccount;
        bytes32 guestStateCommitment;
        bytes32 migrationPayloadHash;
        uint64 validUntil;
        bool consumed;
        bool cancelled;
        bool exists;
    }
    mapping(bytes32 => MigrationClaim) internal claims;
    function setClaim(MigrationClaim calldata record) external { claims[record.claimId] = record; }
    function claim(bytes32 claimId) external view returns (MigrationClaim memory) {
        require(claims[claimId].exists, "missing");
        return claims[claimId];
    }
}

contract HighCountryMigration420Test {
    MockHCAuthorizationMigration internal authorization;
    MockHCBridgeMigration internal bridge;
    MockGameClaimsMigration internal claims;
    HighCountryMigration420 internal migration;

    bytes32 internal constant CLAIM_ID = keccak256("claim");
    uint64 internal constant GROWER_ID = 42;
    bytes32 internal guestCommitment;
    bytes32 internal payloadHash;

    function setUp() public {
        authorization = new MockHCAuthorizationMigration();
        bridge = new MockHCBridgeMigration();
        claims = new MockGameClaimsMigration();
        migration = new HighCountryMigration420(address(authorization), address(bridge), address(claims));

        guestCommitment = migration.guestStateCommitment(keccak256("guest-account"), 9, keccak256("state"));
        payloadHash = migration.migrationPayloadHash(guestCommitment, GROWER_ID, 1, keccak256("payload"));
        bridge.bind(CLAIM_ID, GROWER_ID);
        claims.setClaim(MockGameClaimsMigration.MigrationClaim({
            claimId: CLAIM_ID,
            gameId: HighCountryGamingIds.GAME_ID,
            targetAccount: address(0xBEEF),
            guestStateCommitment: guestCommitment,
            migrationPayloadHash: payloadHash,
            validUntil: 0,
            consumed: true,
            cancelled: false,
            exists: true
        }));
    }

    function testConsumedBoundClaimCanBeAppliedOnce() public {
        require(migration.isReadyToApply(CLAIM_ID, GROWER_ID, guestCommitment, payloadHash), "not ready");
        migration.markApplied(CLAIM_ID, GROWER_ID, guestCommitment, payloadHash);
        require(!migration.isReadyToApply(CLAIM_ID, GROWER_ID, guestCommitment, payloadHash), "replay ready");

        (bool ok,) = address(migration).call(
            abi.encodeWithSelector(migration.markApplied.selector, CLAIM_ID, GROWER_ID, guestCommitment, payloadHash)
        );
        require(!ok, "replay applied");
    }

    function testWrongPayloadFailsClosed() public {
        require(!migration.isReadyToApply(CLAIM_ID, GROWER_ID, guestCommitment, keccak256("wrong")), "wrong payload ready");
    }

    function testUnconsumedClaimFailsClosed() public {
        claims.setClaim(MockGameClaimsMigration.MigrationClaim({
            claimId: CLAIM_ID,
            gameId: HighCountryGamingIds.GAME_ID,
            targetAccount: address(0xBEEF),
            guestStateCommitment: guestCommitment,
            migrationPayloadHash: payloadHash,
            validUntil: 0,
            consumed: false,
            cancelled: false,
            exists: true
        }));
        require(!migration.isReadyToApply(CLAIM_ID, GROWER_ID, guestCommitment, payloadHash), "unconsumed ready");
    }

    function testWrongGameFailsClosed() public {
        claims.setClaim(MockGameClaimsMigration.MigrationClaim({
            claimId: CLAIM_ID,
            gameId: keccak256("other-game"),
            targetAccount: address(0xBEEF),
            guestStateCommitment: guestCommitment,
            migrationPayloadHash: payloadHash,
            validUntil: 0,
            consumed: true,
            cancelled: false,
            exists: true
        }));
        require(!migration.isReadyToApply(CLAIM_ID, GROWER_ID, guestCommitment, payloadHash), "other game ready");
    }

    function testApplyRequiresCapabilityAuthorization() public {
        authorization.setAllowed(false);
        (bool ok,) = address(migration).call(
            abi.encodeWithSelector(migration.markApplied.selector, CLAIM_ID, GROWER_ID, guestCommitment, payloadHash)
        );
        require(!ok, "unauthorized apply");
    }
}
