// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../system/SystemAccess.sol";
import "../interfaces/I420System.sol";

/// @notice Canonical `.420` presentation-name registry and resolver.
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
    mapping(address => bytes32) public primaryNameByAddress;

    error InvalidLabel(); error InvalidDuration(); error NameUnavailable(); error NameExpired();
    error NotNameOwner(); error InvalidOwner(); error NotPendingOwner(); error UnknownCommitment();
    error CommitmentTooNew(); error CommitmentExpired(); error CommitmentExists(); error ResolutionMismatch();

    event CommitmentMade(bytes32 indexed commitment, address indexed committer, uint64 committedAt);
    event NameRegistered(bytes32 indexed labelHash, address indexed owner, uint64 expiresAt, uint8 labelLength);
    event NameRenewed(bytes32 indexed labelHash, address indexed owner, uint64 expiresAt);
    event ResolutionUpdated(bytes32 indexed labelHash, address indexed resolvedAddress, bytes32 indexed profileId, bytes32 serviceId);
    event ReverseNameSet(address indexed resolvedAddress, bytes32 indexed labelHash);
    event NameTransferStarted(bytes32 indexed labelHash, address indexed owner, address indexed pendingOwner);
    event NameTransferred(bytes32 indexed labelHash, address indexed previousOwner, address indexed newOwner);

    constructor(address timelock_) SystemAccess(timelock_) {}
    function systemName() external pure returns (string memory) { return "Names420"; }
    function protocolVersion() external pure returns (uint32) { return 3; }

    function makeCommitment(bytes32 labelHash, uint8 labelLength, address owner, uint64 duration, bytes32 salt, address committer) public pure returns (bytes32) {
        return keccak256(abi.encode(COMMITMENT_DOMAIN, labelHash, labelLength, owner, duration, salt, committer));
    }

    function commit(bytes32 commitment) external {
        if (commitment == bytes32(0)) revert UnknownCommitment();
        uint64 existing = commitments[commitment];
        if (existing != 0 && block.timestamp <= uint256(existing) + MAX_COMMITMENT_AGE) revert CommitmentExists();
        uint64 committedAt = uint64(block.timestamp); commitments[commitment] = committedAt;
        emit CommitmentMade(commitment, msg.sender, committedAt);
    }

    function register(bytes32 labelHash, uint8 labelLength, address owner, uint64 duration, bytes32 salt) external {
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
        records[labelHash] = Record(owner, address(0), owner, bytes32(0), bytes32(0), expiresAt, labelLength);
        emit NameRegistered(labelHash, owner, expiresAt, labelLength);
    }

    function renew(bytes32 labelHash, uint64 duration) external {
        Record storage r = records[labelHash];
        if (r.owner != msg.sender) revert NotNameOwner();
        if (block.timestamp >= r.expiresAt) revert NameExpired();
        if (duration < MIN_REGISTRATION_PERIOD || duration > MAX_REGISTRATION_PERIOD) revert InvalidDuration();
        r.expiresAt += duration; emit NameRenewed(labelHash, msg.sender, r.expiresAt);
    }

    function setResolution(bytes32 labelHash, address resolvedAddress, bytes32 profileId, bytes32 serviceId) external {
        Record storage r = records[labelHash];
        if (r.owner != msg.sender) revert NotNameOwner();
        if (block.timestamp >= r.expiresAt) revert NameExpired();
        r.resolvedAddress = resolvedAddress; r.profileId = profileId; r.serviceId = serviceId;
        emit ResolutionUpdated(labelHash, resolvedAddress, profileId, serviceId);
    }

    /// @notice Address-controlled reverse resolution. The address must currently be the name's forward target.
    function setReverseName(bytes32 labelHash) external {
        Record memory r = records[labelHash];
        if (r.owner == address(0) || block.timestamp >= r.expiresAt) revert NameExpired();
        if (r.resolvedAddress != msg.sender) revert ResolutionMismatch();
        primaryNameByAddress[msg.sender] = labelHash;
        emit ReverseNameSet(msg.sender, labelHash);
    }

    /// @notice Returns a reverse name only while its forward resolution still agrees.
    function reverseResolve(address account) external view returns (bytes32) {
        bytes32 labelHash = primaryNameByAddress[account];
        if (labelHash == bytes32(0)) return bytes32(0);
        Record memory r = records[labelHash];
        if (r.owner == address(0) || block.timestamp >= r.expiresAt || r.resolvedAddress != account) return bytes32(0);
        return labelHash;
    }

    /// @notice One half of a bilateral Identity420↔Names420 binding.
    /// Consumers should also require Identity420.profile.primaryName == labelHash.
    function nameClaimsProfile(bytes32 labelHash, bytes32 profileId) external view returns (bool) {
        Record memory r = records[labelHash];
        return r.owner != address(0) && block.timestamp < r.expiresAt && r.profileId == profileId && profileId != bytes32(0);
    }

    function transferName(bytes32 labelHash, address newOwner) external {
        Record storage r = records[labelHash];
        if (r.owner != msg.sender) revert NotNameOwner();
        if (block.timestamp >= r.expiresAt) revert NameExpired();
        if (newOwner == address(0) || newOwner == msg.sender) revert InvalidOwner();
        r.pendingOwner = newOwner; emit NameTransferStarted(labelHash, msg.sender, newOwner);
    }

    function acceptName(bytes32 labelHash) external {
        Record storage r = records[labelHash];
        if (block.timestamp >= r.expiresAt) revert NameExpired();
        if (r.pendingOwner != msg.sender) revert NotPendingOwner();
        address previous = r.owner;
        r.owner = msg.sender; r.pendingOwner = address(0); r.resolvedAddress = msg.sender; r.profileId = bytes32(0); r.serviceId = bytes32(0);
        emit NameTransferred(labelHash, previous, msg.sender);
        emit ResolutionUpdated(labelHash, msg.sender, bytes32(0), bytes32(0));
    }

    function isAvailable(bytes32 labelHash) external view returns (bool) {
        Record memory r = records[labelHash]; return r.owner == address(0) || block.timestamp >= r.expiresAt;
    }

    function resolve(bytes32 labelHash) external view returns (Record memory) {
        Record memory r = records[labelHash];
        if (r.owner == address(0) || block.timestamp >= r.expiresAt) revert NameExpired();
        return r;
    }
}
