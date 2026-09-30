// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/apps/Names420.sol";
import "../src/interfaces/genesis/INames420.sol";

interface VmNamesAudit420 {
    function warp(
        uint256
    ) external;
    function prank(
        address
    ) external;
    function expectRevert(
        bytes4
    ) external;
}

contract Names420AuditTest {
    VmNamesAudit420 internal constant vm = VmNamesAudit420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address internal constant ALICE = address(0xA11CE);
    address internal constant BOB = address(0xB0B);
    address internal constant CAROL = address(0xCA401);

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

    function _registerAlice(
        Names420 names,
        bytes32 labelHash
    ) internal {
        bytes32 salt = keccak256("alice-salt");
        uint64 duration = names.MIN_REGISTRATION_PERIOD();
        _commit(names, labelHash, 5, ALICE, duration, salt, ALICE);
        vm.warp(block.timestamp + names.MIN_COMMITMENT_AGE());
        vm.prank(ALICE);
        names.register(labelHash, 5, ALICE, duration, salt);
    }

    function testFrozenInterfaceDecodesCanonicalRecordRatherThanOwnerAsResolution() public {
        Names420 names = new Names420(address(this));
        bytes32 labelHash = keccak256("alice");
        _registerAlice(names, labelHash);

        vm.prank(ALICE);
        names.setResolution(labelHash, BOB, bytes32(uint256(1)), bytes32(uint256(2)));

        INames420.Record memory record = INames420(address(names)).resolve(labelHash);
        require(record.owner == ALICE, "owner mismatch");
        require(record.resolvedAddress == BOB, "resolved address mismatch");
        require(record.profileId == bytes32(uint256(1)), "profile mismatch");
        require(record.serviceId == bytes32(uint256(2)), "service mismatch");
        require(record.labelLength == 5, "length mismatch");
    }

    function testCommitmentCannotBeStolenByDifferentRevealer() public {
        Names420 names = new Names420(address(this));
        bytes32 labelHash = keccak256("alice");
        bytes32 salt = keccak256("secret");
        uint64 duration = names.MIN_REGISTRATION_PERIOD();

        _commit(names, labelHash, 5, ALICE, duration, salt, ALICE);
        vm.warp(block.timestamp + names.MIN_COMMITMENT_AGE());

        vm.expectRevert(Names420.UnknownCommitment.selector);
        vm.prank(BOB);
        names.register(labelHash, 5, ALICE, duration, salt);
    }

    function testExpiredCommitmentCannotRegister() public {
        Names420 names = new Names420(address(this));
        bytes32 labelHash = keccak256("alice");
        bytes32 salt = keccak256("secret");
        uint64 duration = names.MIN_REGISTRATION_PERIOD();

        _commit(names, labelHash, 5, ALICE, duration, salt, ALICE);
        vm.warp(block.timestamp + names.MAX_COMMITMENT_AGE() + 1);

        vm.expectRevert(Names420.CommitmentExpired.selector);
        vm.prank(ALICE);
        names.register(labelHash, 5, ALICE, duration, salt);
    }

    function testRegistrationValidationRejectsInvalidLabelOwnerAndDuration() public {
        Names420 names = new Names420(address(this));
        bytes32 salt = keccak256("salt");
        uint64 minDuration = names.MIN_REGISTRATION_PERIOD();

        vm.expectRevert(Names420.InvalidLabel.selector);
        vm.prank(ALICE);
        names.register(bytes32(0), 5, ALICE, minDuration, salt);

        vm.expectRevert(Names420.InvalidLabel.selector);
        vm.prank(ALICE);
        names.register(keccak256("alice"), 0, ALICE, minDuration, salt);

        vm.expectRevert(Names420.InvalidOwner.selector);
        vm.prank(ALICE);
        names.register(keccak256("alice"), 5, address(0), minDuration, salt);

        vm.expectRevert(Names420.InvalidDuration.selector);
        vm.prank(ALICE);
        names.register(keccak256("alice"), 5, ALICE, minDuration - 1, salt);
    }

    function testOnlyOwnerCanRenewResolveOrStartTransfer() public {
        Names420 names = new Names420(address(this));
        bytes32 labelHash = keccak256("alice");
        _registerAlice(names, labelHash);

        uint64 minDuration = names.MIN_REGISTRATION_PERIOD();
        vm.expectRevert(Names420.NotNameOwner.selector);
        vm.prank(BOB);
        names.renew(labelHash, minDuration);

        vm.expectRevert(Names420.NotNameOwner.selector);
        vm.prank(BOB);
        names.setResolution(labelHash, BOB, bytes32(0), bytes32(0));

        vm.expectRevert(Names420.NotNameOwner.selector);
        vm.prank(BOB);
        names.transferName(labelHash, CAROL);
    }

    function testOnlyPendingOwnerCanAcceptTransfer() public {
        Names420 names = new Names420(address(this));
        bytes32 labelHash = keccak256("alice");
        _registerAlice(names, labelHash);

        vm.prank(ALICE);
        names.transferName(labelHash, BOB);

        vm.expectRevert(Names420.NotPendingOwner.selector);
        vm.prank(CAROL);
        names.acceptName(labelHash);
    }

    function testExpiryInvalidatesForwardReverseAndOwnerMutations() public {
        Names420 names = new Names420(address(this));
        bytes32 labelHash = keccak256("alice");
        _registerAlice(names, labelHash);

        vm.prank(ALICE);
        names.setReverseName(labelHash);
        require(names.reverseResolve(ALICE) == labelHash, "reverse expected");

        Names420.Record memory beforeExpiry = names.resolve(labelHash);
        vm.warp(uint256(beforeExpiry.expiresAt));

        require(names.reverseResolve(ALICE) == bytes32(0), "expired reverse must clear");

        vm.expectRevert(Names420.NameExpired.selector);
        names.resolve(labelHash);

        uint64 minDuration = names.MIN_REGISTRATION_PERIOD();
        vm.expectRevert(Names420.NameExpired.selector);
        vm.prank(ALICE);
        names.renew(labelHash, minDuration);

        vm.expectRevert(Names420.NameExpired.selector);
        vm.prank(ALICE);
        names.setResolution(labelHash, BOB, bytes32(0), bytes32(0));
    }

    function testExpiredNameCanBeRegisteredByNewOwnerWithFreshCommitment() public {
        Names420 names = new Names420(address(this));
        bytes32 labelHash = keccak256("alice");
        _registerAlice(names, labelHash);

        Names420.Record memory first = names.resolve(labelHash);
        vm.warp(uint256(first.expiresAt));

        bytes32 salt = keccak256("bob-salt");
        uint64 duration = names.MIN_REGISTRATION_PERIOD();
        _commit(names, labelHash, 5, BOB, duration, salt, BOB);
        vm.warp(block.timestamp + names.MIN_COMMITMENT_AGE());

        vm.prank(BOB);
        names.register(labelHash, 5, BOB, duration, salt);

        Names420.Record memory second = names.resolve(labelHash);
        require(second.owner == BOB, "new owner");
        require(second.resolvedAddress == BOB, "new resolution");
        require(second.pendingOwner == address(0), "pending owner reset");
        require(second.profileId == bytes32(0) && second.serviceId == bytes32(0), "links reset");
    }
}
