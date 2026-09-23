// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @notice Governance-attested controller identities and independently appointed verifier selection.
/// @dev A controller ID is an attestation, NOT an on-chain discovery of beneficial ownership.
/// The attestor must independently review legal/control relationships and evidence off-chain.
contract ComputeVerifierIndependencePolicy420 {
    struct Identity {
        bytes32 controllerId;
        bytes32 evidenceHash;
        uint64 validUntil;
        bool active;
    }
    struct Appointment {
        address verifier;
        bytes32 profileId;
        bytes32 controllerId;
        bytes32 evidenceHash;
        bytes32 ownerController;
        bytes32 payerController;
        bytes32 operatorController;
        uint64 validUntil;
        uint64 epoch;
        bool active;
    }

    address public immutable governance;
    address public identityAttestor;
    address public verifierSelector;
    uint64 public policyEpoch = 1;
    mapping(address => Identity) public identities;
    mapping(bytes32 => Appointment) private appointments;
    mapping(address => bool) public suspendedControllerAccount;
    error Unauthorized();
    error InvalidEvidence();
    event IdentityAttested(address indexed account, bytes32 indexed controllerId, bytes32 evidenceHash, uint64 validUntil);
    event IdentityWithdrawn(address indexed account);
    event AuthoritiesUpdated(address indexed attestor, address indexed selector, uint64 epoch);
    event Appointed(bytes32 indexed jobId, address indexed verifier, bytes32 indexed controllerId, bytes32 profileId, bytes32 evidenceHash, uint64 validUntil, uint64 epoch);
    event AppointmentRevoked(bytes32 indexed jobId);
    event AccountSuspended(address indexed account, bool suspended);

    constructor(address governance_, address attestor_, address selector_) {
        if (governance_ == address(0) || attestor_ == address(0) || selector_ == address(0)) revert InvalidEvidence();
        governance = governance_;
        identityAttestor = attestor_;
        verifierSelector = selector_;
    }

    function setAuthorities(address attestor_, address selector_) external {
        if (msg.sender != governance) revert Unauthorized();
        if (attestor_ == address(0) || selector_ == address(0)) revert InvalidEvidence();
        identityAttestor = attestor_;
        verifierSelector = selector_;
        ++policyEpoch;
        emit AuthoritiesUpdated(attestor_, selector_, policyEpoch);
    }

    function attest(address account, bytes32 controllerId, bytes32 evidenceHash, uint64 validUntil) external {
        if (msg.sender != identityAttestor) revert Unauthorized();
        if (account == address(0) || controllerId == bytes32(0) || evidenceHash == bytes32(0)
            || validUntil <= block.timestamp) revert InvalidEvidence();
        identities[account] = Identity(controllerId, evidenceHash, validUntil, true);
        emit IdentityAttested(account, controllerId, evidenceHash, validUntil);
    }

    function withdraw(address account) external {
        if (msg.sender != identityAttestor && msg.sender != governance) revert Unauthorized();
        identities[account].active = false;
        emit IdentityWithdrawn(account);
    }

    function suspendAccount(address account, bool suspended) external {
        if (msg.sender != governance) revert Unauthorized();
        suspendedControllerAccount[account] = suspended;
        emit AccountSuspended(account, suspended);
    }

    function appoint(bytes32 jobId, address verifier, bytes32 profileId,
        address owner, address payer, address operator, bytes32 evidenceHash, uint64 validUntil) external {
        if (msg.sender != verifierSelector) revert Unauthorized();
        if (jobId == bytes32(0) || profileId == bytes32(0) || evidenceHash == bytes32(0)
            || verifier == owner || verifier == payer || verifier == operator || validUntil <= block.timestamp
            || suspendedControllerAccount[verifier]) revert InvalidEvidence();
        // Fail closed without CURRENT independent-controller attestations for all parties.
        bytes32 v = _controller(verifier);
        bytes32 o = _controller(owner);
        bytes32 p = _controller(payer);
        bytes32 w = _controller(operator);
        if (v == o || v == p || v == w) revert InvalidEvidence();
        appointments[jobId] = Appointment(verifier, profileId, v, evidenceHash, o, p, w,
            validUntil, policyEpoch, true);
        emit Appointed(jobId, verifier, v, profileId, evidenceHash, validUntil, policyEpoch);
    }

    function revokeAppointment(bytes32 jobId) external {
        if (msg.sender != governance && msg.sender != verifierSelector) revert Unauthorized();
        appointments[jobId].active = false;
        emit AppointmentRevoked(jobId);
    }

    /// @notice Caller must supply canonical job parties, including ACTUAL payer rather than job creator.
    function eligible(bytes32 jobId, address verifier, bytes32 profileId,
        address owner, address payer, address operator) external view returns (bool) {
        Appointment storage a = appointments[jobId];
        if (!a.active || a.epoch != policyEpoch || a.validUntil < block.timestamp
            || a.verifier != verifier || a.profileId != profileId || a.evidenceHash == bytes32(0)
            || verifier == owner || verifier == payer || verifier == operator
            || suspendedControllerAccount[verifier]) return false;
        return _current(verifier, a.controllerId) && _current(owner, a.ownerController)
            && _current(payer, a.payerController) && _current(operator, a.operatorController)
            && a.controllerId != a.ownerController && a.controllerId != a.payerController
            && a.controllerId != a.operatorController;
    }

    function appointment(bytes32 jobId) external view returns (Appointment memory) { return appointments[jobId]; }

    function _controller(address account) private view returns (bytes32 controllerId) {
        Identity storage i = identities[account];
        if (!i.active || i.controllerId == bytes32(0) || i.evidenceHash == bytes32(0)
            || i.validUntil < block.timestamp || suspendedControllerAccount[account]) revert InvalidEvidence();
        return i.controllerId;
    }
    function _current(address account, bytes32 expected) private view returns (bool) {
        Identity storage i = identities[account];
        return account != address(0) && !suspendedControllerAccount[account]
            && i.active && i.controllerId == expected && expected != bytes32(0)
            && i.evidenceHash != bytes32(0) && i.validUntil >= block.timestamp;
    }
}
