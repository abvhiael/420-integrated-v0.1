// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/apps/Names420.sol";

interface VmNamesHardening420 {
    function warp(uint256) external;
    function prank(address) external;
    function expectRevert(bytes4) external;
}

contract Names420HardeningTest {
    VmNamesHardening420 internal constant vm =
        VmNamesHardening420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address internal constant ALICE = address(0xA11CE);
    address internal constant BOB = address(0xB0B);
    address internal constant CAROL = address(0xCA401);

    function _boundedDuration(Names420 names, uint64 raw) internal view returns (uint64) {
        uint64 minDuration = names.MIN_REGISTRATION_PERIOD();
        uint64 maxDuration = names.MAX_REGISTRATION_PERIOD();
        return minDuration + (raw % (maxDuration - minDuration + 1));
    }

    function _boundedLabelLength(Names420 names, uint8 raw) internal view returns (uint8) {
        return uint8(1 + (uint256(raw) % names.MAX_LABEL_LENGTH()));
    }

    function _nonzero(bytes32 value, bytes32 fallbackValue) internal pure returns (bytes32) {
        return value == bytes32(0) ? fallbackValue : value;
    }

    function _commit(
        Names420 names,
        bytes32 labelHash,
        uint8 labelLength,
        address owner,
        uint64 duration,
        bytes32 salt,
        address committer
    ) internal returns (bytes32 commitment) {
        commitment = names.makeCommitment(labelHash, labelLength, owner, duration, salt, committer);
        vm.prank(committer);
        names.commit(commitment);
    }

    function _register(
        Names420 names,
        bytes32 labelHash,
        uint8 labelLength,
        address owner,
        uint64 duration,
        bytes32 salt,
        address committer
    ) internal returns (bytes32 commitment) {
        commitment = _commit(names, labelHash, labelLength, owner, duration, salt, committer);
        vm.warp(block.timestamp + names.MIN_COMMITMENT_AGE());
        vm.prank(committer);
        names.register(labelHash, labelLength, owner, duration, salt);
    }

    function testFuzzAvailabilityChangesExactlyAtExpiry(
        bytes32 rawLabelHash,
        uint8 rawLength,
        uint64 rawDuration
    ) public {
        Names420 names = new Names420(address(this));
        bytes32 labelHash = _nonzero(rawLabelHash, keccak256("availability"));
        uint8 labelLength = _boundedLabelLength(names, rawLength);
        uint64 duration = _boundedDuration(names, rawDuration);

        _register(names, labelHash, labelLength, ALICE, duration, keccak256("availability-salt"), ALICE);
        Names420.Record memory record = names.resolve(labelHash);

        require(!names.isAvailable(labelHash), "active name reported available");
        vm.warp(uint256(record.expiresAt) - 1);
        require(!names.isAvailable(labelHash), "available before expiry");
        vm.warp(record.expiresAt);
        require(names.isAvailable(labelHash), "unavailable at expiry");
    }

    function testFuzzCommitmentAcceptedAtExactMinimumAge(
        bytes32 rawLabelHash,
        uint8 rawLength,
        uint64 rawDuration,
        bytes32 rawSalt
    ) public {
        Names420 names = new Names420(address(this));
        bytes32 labelHash = _nonzero(rawLabelHash, keccak256("min-age"));
        bytes32 salt = _nonzero(rawSalt, keccak256("min-age-salt"));
        uint8 labelLength = _boundedLabelLength(names, rawLength);
        uint64 duration = _boundedDuration(names, rawDuration);

        bytes32 commitment = _commit(names, labelHash, labelLength, ALICE, duration, salt, ALICE);
        uint64 committedAt = names.commitments(commitment);

        vm.warp(uint256(committedAt) + names.MIN_COMMITMENT_AGE() - 1);
        vm.expectRevert(Names420.CommitmentTooNew.selector);
        vm.prank(ALICE);
        names.register(labelHash, labelLength, ALICE, duration, salt);

        vm.warp(uint256(committedAt) + names.MIN_COMMITMENT_AGE());
        vm.prank(ALICE);
        names.register(labelHash, labelLength, ALICE, duration, salt);
        require(names.commitments(commitment) == 0, "commitment not consumed");
    }

    function testFuzzCommitmentAcceptedAtExactMaximumAge(
        bytes32 rawLabelHash,
        uint8 rawLength,
        uint64 rawDuration,
        bytes32 rawSalt
    ) public {
        Names420 names = new Names420(address(this));
        bytes32 labelHash = _nonzero(rawLabelHash, keccak256("max-age"));
        bytes32 salt = _nonzero(rawSalt, keccak256("max-age-salt"));
        uint8 labelLength = _boundedLabelLength(names, rawLength);
        uint64 duration = _boundedDuration(names, rawDuration);

        bytes32 commitment = _commit(names, labelHash, labelLength, ALICE, duration, salt, ALICE);
        uint64 committedAt = names.commitments(commitment);
        vm.warp(uint256(committedAt) + names.MAX_COMMITMENT_AGE());

        vm.prank(ALICE);
        names.register(labelHash, labelLength, ALICE, duration, salt);
        require(names.commitments(commitment) == 0, "max-age commitment not consumed");
    }

    function testFuzzCommitmentRejectedAfterMaximumAge(
        bytes32 rawLabelHash,
        uint8 rawLength,
        uint64 rawDuration,
        bytes32 rawSalt
    ) public {
        Names420 names = new Names420(address(this));
        bytes32 labelHash = _nonzero(rawLabelHash, keccak256("expired-commitment"));
        bytes32 salt = _nonzero(rawSalt, keccak256("expired-commitment-salt"));
        uint8 labelLength = _boundedLabelLength(names, rawLength);
        uint64 duration = _boundedDuration(names, rawDuration);

        bytes32 commitment = _commit(names, labelHash, labelLength, ALICE, duration, salt, ALICE);
        uint64 committedAt = names.commitments(commitment);
        vm.warp(uint256(committedAt) + names.MAX_COMMITMENT_AGE() + 1);

        vm.expectRevert(Names420.CommitmentExpired.selector);
        vm.prank(ALICE);
        names.register(labelHash, labelLength, ALICE, duration, salt);
        require(names.commitments(commitment) == committedAt, "expired commitment mutated");
    }

    function testFuzzConsumedCommitmentCannotRegisterAgainWithoutFreshCommit(
        bytes32 rawLabelHash,
        uint8 rawLength,
        uint64 rawDuration,
        bytes32 rawSalt
    ) public {
        Names420 names = new Names420(address(this));
        bytes32 labelHash = _nonzero(rawLabelHash, keccak256("consumption"));
        bytes32 salt = _nonzero(rawSalt, keccak256("consumption-salt"));
        uint8 labelLength = _boundedLabelLength(names, rawLength);
        uint64 duration = _boundedDuration(names, rawDuration);

        bytes32 commitment = _register(names, labelHash, labelLength, ALICE, duration, salt, ALICE);
        Names420.Record memory record = names.resolve(labelHash);
        require(names.commitments(commitment) == 0, "successful reveal retained commitment");

        vm.warp(record.expiresAt);
        vm.expectRevert(Names420.UnknownCommitment.selector);
        vm.prank(ALICE);
        names.register(labelHash, labelLength, ALICE, duration, salt);

        _commit(names, labelHash, labelLength, ALICE, duration, salt, ALICE);
        vm.warp(block.timestamp + names.MIN_COMMITMENT_AGE());
        vm.prank(ALICE);
        names.register(labelHash, labelLength, ALICE, duration, salt);
    }

    function testFuzzActiveLeaseRejectsCompetingRegistration(
        bytes32 rawLabelHash,
        uint8 rawLength,
        uint64 rawDuration
    ) public {
        Names420 names = new Names420(address(this));
        bytes32 labelHash = _nonzero(rawLabelHash, keccak256("active-lease"));
        uint8 labelLength = _boundedLabelLength(names, rawLength);
        uint64 duration = _boundedDuration(names, rawDuration);

        _register(names, labelHash, labelLength, ALICE, duration, keccak256("alice"), ALICE);
        bytes32 bobSalt = keccak256("bob");
        _commit(names, labelHash, labelLength, BOB, duration, bobSalt, BOB);
        vm.warp(block.timestamp + names.MIN_COMMITMENT_AGE());

        vm.expectRevert(Names420.NameUnavailable.selector);
        vm.prank(BOB);
        names.register(labelHash, labelLength, BOB, duration, bobSalt);
        require(!names.isAvailable(labelHash), "failed overwrite changed availability");
    }

    function testFuzzRenewalBoundsAndExactExpiryAccounting(
        bytes32 rawLabelHash,
        uint8 rawLength,
        uint64 rawDuration
    ) public {
        Names420 names = new Names420(address(this));
        bytes32 labelHash = _nonzero(rawLabelHash, keccak256("renewal"));
        uint8 labelLength = _boundedLabelLength(names, rawLength);
        uint64 duration = _boundedDuration(names, rawDuration);
        _register(names, labelHash, labelLength, ALICE, duration, keccak256("renewal-salt"), ALICE);

        Names420.Record memory beforeRenew = names.resolve(labelHash);
        uint64 minDuration = names.MIN_REGISTRATION_PERIOD();
        uint64 maxDuration = names.MAX_REGISTRATION_PERIOD();

        vm.expectRevert(Names420.InvalidDuration.selector);
        vm.prank(ALICE);
        names.renew(labelHash, minDuration - 1);

        vm.expectRevert(Names420.InvalidDuration.selector);
        vm.prank(ALICE);
        names.renew(labelHash, maxDuration + 1);

        vm.prank(ALICE);
        names.renew(labelHash, minDuration);
        Names420.Record memory afterMin = names.resolve(labelHash);
        require(afterMin.expiresAt == beforeRenew.expiresAt + minDuration, "minimum renewal delta mismatch");

        vm.prank(ALICE);
        names.renew(labelHash, maxDuration);
        Names420.Record memory afterMax = names.resolve(labelHash);
        require(afterMax.expiresAt == afterMin.expiresAt + maxDuration, "maximum renewal delta mismatch");
    }

    function testFuzzTransferLatestNomineeWinsAndClearsAssociations(
        bytes32 rawLabelHash,
        uint8 rawLength,
        uint64 rawDuration,
        bytes32 profileId,
        bytes32 serviceId
    ) public {
        Names420 names = new Names420(address(this));
        bytes32 labelHash = _nonzero(rawLabelHash, keccak256("transfer"));
        uint8 labelLength = _boundedLabelLength(names, rawLength);
        uint64 duration = _boundedDuration(names, rawDuration);

        _register(names, labelHash, labelLength, ALICE, duration, keccak256("transfer-salt"), ALICE);
        vm.prank(ALICE);
        names.setResolution(labelHash, BOB, profileId, serviceId);

        vm.prank(ALICE);
        names.transferName(labelHash, BOB);
        vm.prank(ALICE);
        names.transferName(labelHash, CAROL);

        vm.expectRevert(Names420.NotPendingOwner.selector);
        vm.prank(BOB);
        names.acceptName(labelHash);

        vm.prank(CAROL);
        names.acceptName(labelHash);

        Names420.Record memory record = names.resolve(labelHash);
        require(record.owner == CAROL, "transfer owner mismatch");
        require(record.pendingOwner == address(0), "pending owner not cleared");
        require(record.resolvedAddress == CAROL, "resolution not reset");
        require(record.profileId == bytes32(0), "profile not cleared");
        require(record.serviceId == bytes32(0), "service not cleared");

        vm.expectRevert(Names420.NotNameOwner.selector);
        vm.prank(ALICE);
        names.transferName(labelHash, BOB);
    }

    function testFuzzReverseAgreementTracksForwardTargetAndExpiry(
        bytes32 rawLabelHash,
        uint8 rawLength,
        uint64 rawDuration
    ) public {
        Names420 names = new Names420(address(this));
        bytes32 labelHash = _nonzero(rawLabelHash, keccak256("reverse"));
        uint8 labelLength = _boundedLabelLength(names, rawLength);
        uint64 duration = _boundedDuration(names, rawDuration);

        _register(names, labelHash, labelLength, ALICE, duration, keccak256("reverse-salt"), ALICE);

        vm.prank(ALICE);
        names.setReverseName(labelHash);
        require(names.reverseResolve(ALICE) == labelHash, "initial reverse mismatch");

        vm.prank(ALICE);
        names.setResolution(labelHash, BOB, bytes32(0), bytes32(0));
        require(names.reverseResolve(ALICE) == bytes32(0), "stale reverse remained authoritative");

        vm.expectRevert(Names420.ResolutionMismatch.selector);
        vm.prank(ALICE);
        names.setReverseName(labelHash);

        vm.prank(BOB);
        names.setReverseName(labelHash);
        require(names.reverseResolve(BOB) == labelHash, "new target reverse mismatch");

        Names420.Record memory record = names.resolve(labelHash);
        vm.warp(record.expiresAt);
        require(names.reverseResolve(BOB) == bytes32(0), "expired reverse remained authoritative");
        require(names.isAvailable(labelHash), "expired name unavailable");
    }
}
