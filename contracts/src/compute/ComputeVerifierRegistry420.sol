// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "../system/SystemAccess.sol";

/// @notice Canonical ComputeMarket verifier identity and lifecycle registry.
/// @dev Registration establishes identity only. It grants no verification capability, class/profile,
///      appointment, settlement, custody, stake/slash, governance, worker, validator, bridge, or wallet authority.
contract ComputeVerifierRegistry420 is I420System, SystemAccess {
    bytes32 public constant IDENTITY_DOMAIN_V1 = keccak256("420Integrated.ComputeMarket.Identity.v1");
    bytes32 public constant VERIFIER_TAG = keccak256("VERIFIER");

    enum Status { NONE, REGISTERED, ACTIVE, SUSPENDED, RETIRED }

    struct Verifier {
        address authority;
        bytes32 registrationManifestHash;
        uint64 createdAt;
        uint64 revision;
        Status status;
    }

    struct PendingRotation {
        address newAuthority;
        bytes32 newRegistrationManifestHash;
        uint64 requestedFromRevision;
    }

    uint64 public nextSerial;
    mapping(bytes32 => Verifier) private _current;
    mapping(bytes32 => mapping(uint64 => Verifier)) private _history;
    mapping(address => bytes32) public verifierIdForAuthority;
    mapping(bytes32 => PendingRotation) private _pendingRotation;

    error InvalidIdentity();
    error InvalidState();
    error UnauthorizedAuthority();
    error AuthorityAlreadyBound();
    error SerialExhausted();

    event VerifierRegistered(
        bytes32 indexed verifierId,
        address indexed authority,
        bytes32 indexed registrationManifestHash,
        uint64 serial
    );
    event VerifierRevised(
        bytes32 indexed verifierId,
        uint64 oldRevision,
        uint64 newRevision,
        bytes32 oldCommitment,
        bytes32 newCommitment
    );
    event RotationProposed(
        bytes32 indexed verifierId,
        address indexed oldAuthority,
        address indexed newAuthority,
        uint64 requestedFromRevision,
        bytes32 newRegistrationManifestHash
    );
    event RotationCancelled(bytes32 indexed verifierId, address indexed newAuthority);
    event RotationAccepted(
        bytes32 indexed verifierId,
        address indexed oldAuthority,
        address indexed newAuthority,
        uint64 newRevision
    );

    constructor(address timelock_) SystemAccess(timelock_) {}

    function systemName() external pure returns (string memory) { return "ComputeVerifierRegistry420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function deriveId(uint64 serial) public view returns (bytes32) {
        if (block.chainid == 0 || serial == 0) revert InvalidIdentity();
        return keccak256(
            abi.encode(
                IDENTITY_DOMAIN_V1,
                block.chainid,
                address(this),
                VERIFIER_TAG,
                serial
            )
        );
    }

    /// @notice Self-register a verifier authority. Registration is not activation or verification capability.
    function register(bytes32 registrationManifestHash) external returns (bytes32 verifierId) {
        if (
            msg.sender == address(0) || registrationManifestHash == bytes32(0) || block.chainid == 0
        ) revert InvalidIdentity();
        if (verifierIdForAuthority[msg.sender] != bytes32(0)) revert AuthorityAlreadyBound();
        if (nextSerial == type(uint64).max) revert SerialExhausted();

        uint64 serial = nextSerial + 1;
        verifierId = deriveId(serial);
        if (_current[verifierId].status != Status.NONE) revert InvalidIdentity();

        nextSerial = serial;
        Verifier memory v = Verifier({
            authority: msg.sender,
            registrationManifestHash: registrationManifestHash,
            createdAt: uint64(block.timestamp),
            revision: 1,
            status: Status.REGISTERED
        });
        _current[verifierId] = v;
        _history[verifierId][1] = v;
        verifierIdForAuthority[msg.sender] = verifierId;
        emit VerifierRegistered(verifierId, msg.sender, registrationManifestHash, serial);
    }

    function verifier(bytes32 verifierId) public view returns (Verifier memory v) {
        v = _current[verifierId];
        if (v.status == Status.NONE) revert InvalidIdentity();
    }

    function revision(bytes32 verifierId, uint64 version) external view returns (Verifier memory v) {
        v = _history[verifierId][version];
        if (v.status == Status.NONE) revert InvalidIdentity();
    }

    function pendingRotation(bytes32 verifierId) external view returns (PendingRotation memory p) {
        verifier(verifierId);
        return _pendingRotation[verifierId];
    }

    /// @dev Governance activation is an administrative admission gate only.
    function activate(bytes32 verifierId) external onlyGovernance {
        Verifier memory v = verifier(verifierId);
        if (v.status != Status.REGISTERED && v.status != Status.SUSPENDED) revert InvalidState();
        if (_pendingRotation[verifierId].newAuthority != address(0)) revert InvalidState();
        v.status = Status.ACTIVE;
        _commit(verifierId, v);
    }

    /// @notice An active verifier may fail-closed itself; governance may also suspend it.
    function suspend(bytes32 verifierId) external {
        Verifier memory v = verifier(verifierId);
        if (msg.sender != v.authority && msg.sender != governanceTimelock) revert UnauthorizedAuthority();
        if (v.status != Status.ACTIVE) revert InvalidState();
        v.status = Status.SUSPENDED;
        _commit(verifierId, v);
    }

    /// @notice Governance begins rotation; the proposed new authority must explicitly accept.
    /// @dev Rotation never transfers unrelated authority and never reactivates automatically.
    function proposeRotation(
        bytes32 verifierId,
        address newAuthority,
        bytes32 newRegistrationManifestHash
    ) external onlyGovernance {
        Verifier memory v = verifier(verifierId);
        if (
            v.status == Status.RETIRED || newAuthority == address(0) || newAuthority == v.authority
                || newRegistrationManifestHash == bytes32(0)
        ) revert InvalidState();
        if (verifierIdForAuthority[newAuthority] != bytes32(0)) revert AuthorityAlreadyBound();
        if (_pendingRotation[verifierId].newAuthority != address(0)) revert InvalidState();

        _pendingRotation[verifierId] = PendingRotation({
            newAuthority: newAuthority,
            newRegistrationManifestHash: newRegistrationManifestHash,
            requestedFromRevision: v.revision
        });
        emit RotationProposed(
            verifierId,
            v.authority,
            newAuthority,
            v.revision,
            newRegistrationManifestHash
        );
    }

    function cancelRotation(bytes32 verifierId) external onlyGovernance {
        PendingRotation memory p = _pendingRotation[verifierId];
        if (p.newAuthority == address(0)) revert InvalidState();
        delete _pendingRotation[verifierId];
        emit RotationCancelled(verifierId, p.newAuthority);
    }

    function acceptRotation(bytes32 verifierId) external {
        Verifier memory v = verifier(verifierId);
        PendingRotation memory p = _pendingRotation[verifierId];
        if (
            p.newAuthority == address(0) || msg.sender != p.newAuthority
                || p.requestedFromRevision != v.revision || v.status == Status.RETIRED
        ) revert UnauthorizedAuthority();
        if (verifierIdForAuthority[msg.sender] != bytes32(0)) revert AuthorityAlreadyBound();

        address oldAuthority = v.authority;
        verifierIdForAuthority[oldAuthority] = bytes32(0);
        verifierIdForAuthority[msg.sender] = verifierId;

        v.authority = msg.sender;
        v.registrationManifestHash = p.newRegistrationManifestHash;
        v.status = Status.SUSPENDED;
        delete _pendingRotation[verifierId];
        _commit(verifierId, v);

        emit RotationAccepted(verifierId, oldAuthority, msg.sender, v.revision);
    }

    function retire(bytes32 verifierId) external onlyGovernance {
        Verifier memory v = verifier(verifierId);
        if (v.status == Status.RETIRED) revert InvalidState();

        delete _pendingRotation[verifierId];
        verifierIdForAuthority[v.authority] = bytes32(0);
        v.status = Status.RETIRED;
        _commit(verifierId, v);
    }

    /// @notice Exact-current identity/lifecycle eligibility only.
    /// @dev This does not prove class/profile capability, appointment, independence, or correctness.
    function isActive(bytes32 verifierId, address authority, uint64 expectedRevision)
        external view returns (bool)
    {
        Verifier storage v = _current[verifierId];
        return v.status == Status.ACTIVE
            && authority != address(0)
            && v.authority == authority
            && expectedRevision != 0
            && v.revision == expectedRevision
            && verifierIdForAuthority[authority] == verifierId;
    }

    function _commit(bytes32 verifierId, Verifier memory v) private {
        Verifier memory old = _current[verifierId];
        if (old.revision == type(uint64).max) revert SerialExhausted();
        v.revision = old.revision + 1;
        bytes32 oldHash = keccak256(abi.encode(old));
        bytes32 newHash = keccak256(abi.encode(v));
        _current[verifierId] = v;
        _history[verifierId][v.revision] = v;
        emit VerifierRevised(verifierId, old.revision, v.revision, oldHash, newHash);
    }
}
