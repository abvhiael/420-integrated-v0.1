// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "../interfaces/genesis/IIdentityCredential420.sol";
import "../interfaces/genesis/Types420.sol";

interface IComputeResearchIdentitySource420 is IIdentityCredential420 {
    function systemName() external view returns (string memory);
    function protocolVersion() external view returns (uint32);
    function profiles(bytes32 profileId) external view returns (
        address controller,
        address pendingController,
        bytes32 metadataHash,
        bytes32 primaryName,
        uint64 createdAt,
        uint64 updatedAt,
        bool active
    );
    function credentialValid(bytes32 credentialId) external view returns (bool);
}

/// @notice CMP-4.3 compute-scoped researcher/institution identity bindings.
/// @dev Identity420 remains the canonical profile/issuer/credential authority. This contract only
///      binds a role-specific Identity420 profile/credential into Compute Market scientific scope.
contract ComputeResearchIdentity420 is I420System {
    bytes32 public constant BINDING_DOMAIN =
        keccak256("420/COMPUTE/RESEARCH_IDENTITY_BINDING/V1");
    bytes32 public constant RESEARCHER_CREDENTIAL_TYPE =
        keccak256("420/COMPUTE/RESEARCHER_CREDENTIAL/V1");
    bytes32 public constant INSTITUTION_CREDENTIAL_TYPE =
        keccak256("420/COMPUTE/INSTITUTION_CREDENTIAL/V1");

    enum Role { NONE, RESEARCHER, INSTITUTION }

    struct Binding {
        bytes32 profileId;
        bytes32 credentialId;
        bytes32 metadataCommitment;
        bytes32 predecessorCommitment;
        uint64 revision;
        Role role;
        bool active;
    }

    IComputeResearchIdentitySource420 public immutable identity420;
    mapping(bytes32 => Binding) private _bindings;
    mapping(bytes32 => mapping(uint64 => Binding)) private _history;

    error InvalidIdentitySource();
    error InvalidBinding();
    error BindingExists();
    error UnknownBinding();
    error Unauthorized();
    error StaleRevision();
    error InvalidCredential();
    error NoChange();

    event ResearchIdentityRegistered(
        bytes32 indexed bindingId,
        bytes32 indexed profileId,
        Role indexed role,
        uint64 revision,
        bytes32 bindingCommitment
    );
    event ResearchIdentityRevised(
        bytes32 indexed bindingId,
        uint64 indexed previousRevision,
        uint64 indexed currentRevision,
        bytes32 bindingCommitment
    );
    event ResearchIdentityActivationSet(
        bytes32 indexed bindingId,
        bool active,
        uint64 revision,
        bytes32 bindingCommitment
    );

    constructor(IComputeResearchIdentitySource420 identity420_) {
        address source = address(identity420_);
        if (source == address(0) || source.code.length == 0) revert InvalidIdentitySource();
        if (
            keccak256(bytes(identity420_.systemName())) != keccak256(bytes("Identity420"))
                || identity420_.protocolVersion() != 3
        ) revert InvalidIdentitySource();
        identity420 = identity420_;
    }

    function systemName() external pure returns (string memory) {
        return "ComputeResearchIdentity420";
    }

    function protocolVersion() external pure returns (uint32) {
        return 1;
    }

    function bindingId(bytes32 profileId, Role role) public view returns (bytes32) {
        if (profileId == bytes32(0) || role == Role.NONE) revert InvalidBinding();
        return keccak256(abi.encode(BINDING_DOMAIN, block.chainid, address(this), profileId, role));
    }

    function register(
        bytes32 profileId,
        bytes32 credentialId,
        Role role,
        bytes32 metadataCommitment
    ) external returns (bytes32 id) {
        if (metadataCommitment == bytes32(0)) revert InvalidBinding();
        _requireCurrentProfileController(profileId, msg.sender);
        _requireCredential(profileId, credentialId, role);

        id = bindingId(profileId, role);
        if (_bindings[id].revision != 0) revert BindingExists();

        Binding memory b = Binding({
            profileId: profileId,
            credentialId: credentialId,
            metadataCommitment: metadataCommitment,
            predecessorCommitment: bytes32(0),
            revision: 1,
            role: role,
            active: true
        });
        _bindings[id] = b;
        _history[id][1] = b;
        emit ResearchIdentityRegistered(id, profileId, role, 1, _commitment(id, b));
    }

    function revise(
        bytes32 id,
        uint64 expectedRevision,
        bytes32 credentialId,
        bytes32 metadataCommitment
    ) external {
        Binding storage b = _guardController(id, expectedRevision);
        if (metadataCommitment == bytes32(0)) revert InvalidBinding();
        _requireCredential(b.profileId, credentialId, b.role);
        if (b.credentialId == credentialId && b.metadataCommitment == metadataCommitment) {
            revert NoChange();
        }

        uint64 previousRevision = b.revision;
        bytes32 predecessor = _commitment(id, b);
        b.credentialId = credentialId;
        b.metadataCommitment = metadataCommitment;
        b.predecessorCommitment = predecessor;
        b.revision = previousRevision + 1;
        _history[id][b.revision] = b;
        emit ResearchIdentityRevised(id, previousRevision, b.revision, _commitment(id, b));
    }

    function setActive(bytes32 id, uint64 expectedRevision, bool active) external {
        Binding storage b = _guardController(id, expectedRevision);
        if (b.active == active) revert NoChange();
        if (active) _requireCredential(b.profileId, b.credentialId, b.role);

        bytes32 predecessor = _commitment(id, b);
        b.active = active;
        b.predecessorCommitment = predecessor;
        b.revision += 1;
        _history[id][b.revision] = b;
        emit ResearchIdentityActivationSet(id, active, b.revision, _commitment(id, b));
    }

    function binding(bytes32 id) external view returns (Binding memory) {
        Binding memory b = _bindings[id];
        if (b.revision == 0) revert UnknownBinding();
        return b;
    }

    function revision(bytes32 id, uint64 revision_) external view returns (Binding memory) {
        Binding memory b = _history[id][revision_];
        if (b.revision == 0) revert UnknownBinding();
        return b;
    }

    function commitment(bytes32 id, uint64 revision_) public view returns (bytes32) {
        Binding memory b = _history[id][revision_];
        if (b.revision == 0) revert UnknownBinding();
        return _commitment(id, b);
    }

    function currentCommitment(bytes32 id) external view returns (bytes32) {
        Binding memory b = _bindings[id];
        if (b.revision == 0) revert UnknownBinding();
        return _commitment(id, b);
    }

    function isCurrentEligible(
        bytes32 id,
        uint64 revision_,
        bytes32 exactCommitment,
        address actor
    ) external view returns (bool) {
        Binding memory b = _bindings[id];
        if (
            b.revision == 0 || !b.active || b.revision != revision_
                || exactCommitment == bytes32(0) || exactCommitment != _commitment(id, b)
                || actor == address(0)
        ) return false;

        (address controller,,,,,,bool profileActive) = identity420.profiles(b.profileId);
        if (!profileActive || controller != actor) return false;
        return _credentialMeetsRole(b.profileId, b.credentialId, b.role);
    }

    function _guardController(bytes32 id, uint64 expectedRevision)
        private view returns (Binding storage b)
    {
        b = _bindings[id];
        if (b.revision == 0) revert UnknownBinding();
        if (b.revision != expectedRevision) revert StaleRevision();
        _requireCurrentProfileController(b.profileId, msg.sender);
    }

    function _requireCurrentProfileController(bytes32 profileId, address actor) private view {
        (address controller,,,,,,bool active) = identity420.profiles(profileId);
        if (!active || controller == address(0) || controller != actor) revert Unauthorized();
    }

    function _requireCredential(bytes32 profileId, bytes32 credentialId, Role role) private view {
        if (!_credentialMeetsRole(profileId, credentialId, role)) revert InvalidCredential();
    }

    function _credentialMeetsRole(bytes32 profileId, bytes32 credentialId, Role role)
        private view returns (bool)
    {
        if (credentialId == bytes32(0) || role == Role.NONE) return false;
        if (!identity420.credentialValid(credentialId)) return false;

        IIdentityCredential420.CredentialView memory c = identity420.credential(credentialId);
        if (c.subjectId != profileId) return false;

        if (role == Role.RESEARCHER) {
            return c.credentialType == RESEARCHER_CREDENTIAL_TYPE
                && uint8(c.assurance) >= uint8(Types420.IdentityAssurance.ATTESTED);
        }
        if (role == Role.INSTITUTION) {
            return c.credentialType == INSTITUTION_CREDENTIAL_TYPE
                && uint8(c.assurance) >= uint8(Types420.IdentityAssurance.CREDENTIALED);
        }
        return false;
    }

    function _commitment(bytes32 id, Binding memory b) private view returns (bytes32) {
        return keccak256(abi.encode(
            BINDING_DOMAIN,
            block.chainid,
            address(this),
            address(identity420),
            id,
            b.profileId,
            b.credentialId,
            b.metadataCommitment,
            b.predecessorCommitment,
            b.revision,
            b.role,
            b.active
        ));
    }
}
