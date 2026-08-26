// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../system/SystemAccess.sol";
import "../interfaces/I420System.sol";

/// @notice Canonical `.420` presentation-name registry and resolver.
/// @dev Names are aliases only. Ownership of a name does not override ProtocolRegistry,
/// Identity420, smart-account authority, governance, or any economic-rights registry.
contract Names420 is SystemAccess, I420System {
    uint64 public constant MIN_COMMITMENT_AGE = 60 seconds;
    uint64 public constant MAX_COMMITMENT_AGE = 24 hours;
    uint64 public constant MIN_REGISTRATION_PERIOD = 30 days;
    uint64 public constant MAX_REGISTRATION_PERIOD = 365 days;
    uint8 public constant MAX_LABEL_LENGTH = 63;

    bytes32 public constant COMMITMENT_DOMAIN = keccak256("420/NAMES/COMMITMENT/V1");

    struct Record {
        address owner;
        address pendingOwner;
        address resolvedAddress;
        bytes32 profileId;
        bytes32 serviceId;
        uint64 expiresAt;
        uint8 labelLength;
    }

    mapping(bytes32 => Record) public records;
    mapping(bytes32 => uint64) public commitments;

    error InvalidLabel();
    error InvalidDuration();
    error NameUnavailable();
    error NameExpired();
    error NotNameOwner();
    error InvalidOwner();
    error NotPendingOwner();
    error UnknownCommitment();
    error CommitmentTooNew();
    error CommitmentExpired();
    error CommitmentExists();

    event CommitmentMade(bytes32 indexed commitment, address indexed committer, uint64 committedAt);
    event NameRegistered(bytes32 indexed labelHash, address indexed owner, uint64 expiresAt, uint8 labelLength);
    event NameRenewed(bytes32 indexed labelHash, address indexed owner, uint64 expiresAt);
    event ResolutionUpdated(
        bytes32 indexed labelHash,
        address indexed resolvedAddress,
        bytes32 indexed profileId,
        bytes32 serviceId
    );
    event NameTransferStarted(bytes32 indexed labelHash, address indexed owner, address indexed pendingOwner);
    event NameTransferred(bytes32 indexed labelHash, address indexed previousOwner, address indexed newOwner);

    constructor(address timelock_) SystemAccess(timelock_) {}

    function systemName() external pure returns (string memory) { return "Names420"; }
    function protocolVersion() external pure returns (uint32) { return 2; }

    function makeCommitment(
        bytes32 labelHash,
        uint8 labelLength,
        address owner,
        uint64 duration,
        bytes32 salt,
        address committer
    ) public pure returns (bytes32) {
        return keccak256(abi.encode(
            COMMITMENT_DOMAIN,
            labelHash,
            labelLength,
            owner,
            duration,
            salt,
            committer
        ));
    }

    function commit(bytes32 commitment) external {
        if (commitment == bytes32(0)) revert UnknownCommitment();
        uint64 existing = commitments[commitment];
        if (existing != 0 && block.timestamp <= uint256(existing) + MAX_COMMITMENT_AGE) revert CommitmentExists();
        uint64 committedAt = uint64(block.timestamp);
        commitments[commitment] = committedAt;
        emit CommitmentMade(commitment, msg.sender, committedAt);
    }

    /// @notice Register an available name after the anti-front-running commit delay.
    /// @dev Label normalization is performed by clients; labelHash commits the normalized label.
    function register(
        bytes32 labelHash,
        uint8 labelLength,
        address owner,
        uint64 duration,
        bytes32 salt
    ) external {
        if (labelHash == bytes32(0) || labelLength == 0 || labelLength > MAX_LABEL_LENGTH) revert InvalidLabel();
        if (owner == address(0)) revert InvalidOwner();
        if (duration < MIN_REGISTRATION_PERIOD || duration > MAX_REGISTRATION_PERIOD) revert InvalidDuration();

        Record storage current = records[labelHash];
        if (current.owner != address(0) && block.timestamp < current.expiresAt) revert NameUnavailable();

        bytes32 commitment = makeCommitment(labelHash, labelLength, owner, duration, salt, msg.sender);
        uint64 committedAt = commitments[commitment];
        if (committedAt == 0) revert UnknownCommitment();
        if (block.timestamp < uint256(committedAt) + MIN_COMMITMENT_AGE) revert CommitmentTooNew();
        if (block.timestamp > uint256(committedAt) + MAX_COMMITMENT_AGE) revert CommitmentExpired();
        delete commitments[commitment];

        uint64 expiresAt = uint64(block.timestamp + duration);
        records[labelHash] = Record({
            owner: owner,
            pendingOwner: address(0),
            resolvedAddress: owner,
            profileId: bytes32(0),
            serviceId: bytes32(0),
            expiresAt: expiresAt,
            labelLength: labelLength
        });
        emit NameRegistered(labelHash, owner, expiresAt, labelLength);
    }

    function renew(bytes32 labelHash, uint64 duration) external {
        Record storage record = records[labelHash];
        if (record.owner != msg.sender) revert NotNameOwner();
        if (block.timestamp >= record.expiresAt) revert NameExpired();
        if (duration < MIN_REGISTRATION_PERIOD || duration > MAX_REGISTRATION_PERIOD) revert InvalidDuration();

        record.expiresAt += duration;
        emit NameRenewed(labelHash, msg.sender, record.expiresAt);
    }

    function setResolution(
        bytes32 labelHash,
        address resolvedAddress,
        bytes32 profileId,
        bytes32 serviceId
    ) external {
        Record storage record = records[labelHash];
        if (record.owner != msg.sender) revert NotNameOwner();
        if (block.timestamp >= record.expiresAt) revert NameExpired();
        record.resolvedAddress = resolvedAddress;
        record.profileId = profileId;
        record.serviceId = serviceId;
        emit ResolutionUpdated(labelHash, resolvedAddress, profileId, serviceId);
    }

    function transferName(bytes32 labelHash, address newOwner) external {
        Record storage record = records[labelHash];
        if (record.owner != msg.sender) revert NotNameOwner();
        if (block.timestamp >= record.expiresAt) revert NameExpired();
        if (newOwner == address(0) || newOwner == msg.sender) revert InvalidOwner();
        record.pendingOwner = newOwner;
        emit NameTransferStarted(labelHash, msg.sender, newOwner);
    }

    function acceptName(bytes32 labelHash) external {
        Record storage record = records[labelHash];
        if (block.timestamp >= record.expiresAt) revert NameExpired();
        if (record.pendingOwner != msg.sender) revert NotPendingOwner();
        address previous = record.owner;
        record.owner = msg.sender;
        record.pendingOwner = address(0);
        record.resolvedAddress = msg.sender;
        record.profileId = bytes32(0);
        record.serviceId = bytes32(0);
        emit NameTransferred(labelHash, previous, msg.sender);
        emit ResolutionUpdated(labelHash, msg.sender, bytes32(0), bytes32(0));
    }

    function isAvailable(bytes32 labelHash) external view returns (bool) {
        Record memory record = records[labelHash];
        return record.owner == address(0) || block.timestamp >= record.expiresAt;
    }

    function resolve(bytes32 labelHash) external view returns (Record memory) {
        Record memory record = records[labelHash];
        if (record.owner == address(0) || block.timestamp >= record.expiresAt) revert NameExpired();
        return record;
    }
}
