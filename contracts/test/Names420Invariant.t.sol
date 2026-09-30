// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/apps/Names420.sol";
import "./helpers/InvariantTarget420.sol";

interface VmNamesInvariant420 {
    function warp(
        uint256
    ) external;
}

contract Names420InvariantHandler {
    VmNamesInvariant420 internal constant vm =
        VmNamesInvariant420(address(uint160(uint256(keccak256("hevm cheat code")))));

    Names420 public immutable names;
    bytes32 public immutable labelHash;

    uint64 public expectedExpiry;
    address public expectedResolution;
    bytes32 public bootstrapCommitment;
    bool public reverseEverSet;
    bool public bootstrapped;

    constructor(
        Names420 names_,
        bytes32 labelHash_
    ) {
        names = names_;
        labelHash = labelHash_;
    }

    function bootstrap() external {
        if (bootstrapped) return;
        bootstrapped = true;

        uint64 duration = names.MIN_REGISTRATION_PERIOD();
        bytes32 salt = keccak256("names-invariant-bootstrap");
        bytes32 commitment = names.makeCommitment(labelHash, 9, address(this), duration, salt, address(this));
        bootstrapCommitment = commitment;
        names.commit(commitment);
        vm.warp(block.timestamp + names.MIN_COMMITMENT_AGE());
        names.register(labelHash, 9, address(this), duration, salt);

        Names420.Record memory record = names.resolve(labelHash);
        expectedExpiry = record.expiresAt;
        expectedResolution = address(this);
    }

    function renew(
        uint64 rawDuration
    ) external {
        if (!bootstrapped || block.timestamp >= expectedExpiry) return;

        uint64 minDuration = names.MIN_REGISTRATION_PERIOD();
        uint64 maxDuration = names.MAX_REGISTRATION_PERIOD();
        uint64 duration = minDuration + (rawDuration % (maxDuration - minDuration + 1));

        names.renew(labelHash, duration);
        expectedExpiry += duration;
    }

    function setResolution(
        address resolvedAddress
    ) external {
        if (!bootstrapped || block.timestamp >= expectedExpiry) return;

        names.setResolution(labelHash, resolvedAddress, bytes32(0), bytes32(0));
        expectedResolution = resolvedAddress;
    }

    function setReverseWhenEligible() external {
        if (!bootstrapped || block.timestamp >= expectedExpiry || expectedResolution != address(this)) return;

        names.setReverseName(labelHash);
        reverseEverSet = true;
    }

    function advance(
        uint32 rawSeconds
    ) external {
        if (!bootstrapped) return;
        uint256 delta = uint256(rawSeconds) % (400 days + 1);
        vm.warp(block.timestamp + delta);
    }
}

contract Names420InvariantTest is InvariantTarget420 {
    Names420 internal names;
    Names420InvariantHandler internal handler;
    bytes32 internal constant LABEL_HASH = keccak256("invariant");

    function setUp() public {
        names = new Names420(address(this));
        handler = new Names420InvariantHandler(names, LABEL_HASH);
        handler.bootstrap();
        targetContract(address(handler));
    }

    function invariant_AvailabilityMatchesLeaseBoundary() public view {
        bool expectedAvailable = block.timestamp >= handler.expectedExpiry();
        require(names.isAvailable(LABEL_HASH) == expectedAvailable, "availability drift");
    }

    function invariant_ActiveRecordMatchesModelAndExpiredResolveFails() public view {
        if (block.timestamp < handler.expectedExpiry()) {
            Names420.Record memory record = names.resolve(LABEL_HASH);
            require(record.owner == address(handler), "owner drift");
            require(record.pendingOwner == address(0), "unexpected pending owner");
            require(record.resolvedAddress == handler.expectedResolution(), "resolution drift");
            require(record.expiresAt == handler.expectedExpiry(), "expiry drift");
        } else {
            try names.resolve(LABEL_HASH) returns (Names420.Record memory) {
                revert("expired resolve succeeded");
            } catch { }
        }
    }

    function invariant_ReverseResolutionRequiresCurrentForwardAgreement() public view {
        bytes32 expectedReverse;
        if (
            handler.reverseEverSet() && block.timestamp < handler.expectedExpiry()
                && handler.expectedResolution() == address(handler)
        ) {
            expectedReverse = LABEL_HASH;
        }
        require(names.reverseResolve(address(handler)) == expectedReverse, "reverse agreement drift");
    }

    function invariant_RegistrationCommitmentRemainsConsumed() public view {
        require(names.commitments(handler.bootstrapCommitment()) == 0, "consumed commitment restored");
    }

    function invariant_GovernanceBoundaryIsStable() public view {
        require(names.governanceTimelock() == address(this), "governance boundary changed");
    }
}
