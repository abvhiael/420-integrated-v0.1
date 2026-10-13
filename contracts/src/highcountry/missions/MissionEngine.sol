// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import {R04EmergencyConsumer} from "../security/R04EmergencyConsumer.sol";
import {EmergencyDomains} from "../constants/EmergencyDomains.sol";

/// @notice Versioned, proof-gated, wallet-free mission lifecycle.
/// @dev Actual BUDS rewards require an independently authorized R04.5 issuer; this contract never mints.
contract MissionEngine is R04EmergencyConsumer {
    error InvalidMission();
    enum State {
        None,
        Active,
        Complete,
        Claimed,
        Failed,
        Expired
    }

    struct Template {
        bytes32 version;
        bytes32 objective;
        bytes32 prerequisite;
        uint64 duration;
        uint32 target;
        uint32 rewardUnits;
        bool enabled;
    }

    struct Mission {
        State state;
        uint64 startedAt;
        uint64 deadline;
        uint32 progress;
        bytes32 proofRoot;
        bytes32 version;
        bytes32 objective;
        uint32 target;
        uint32 rewardUnits;
    }
    address public immutable administrator;
    mapping(address => bool) public verifiers;
    mapping(bytes32 => Template) private templates;
    mapping(address => mapping(bytes32 => Mission)) private missions;
    mapping(address => mapping(bytes32 => bool)) public completed;
    mapping(bytes32 => bool) public evidenceUsed;
    event TemplateRegistered(bytes32 indexed id, bytes32 version);
    event VerifierSet(address indexed verifier, bool approved);
    event Activated(address indexed player, bytes32 indexed id, uint64 deadline);
    event Progressed(address indexed player, bytes32 indexed id, bytes32 proof, uint32 amount);
    event Transition(address indexed player, bytes32 indexed id, State state);

    constructor(address r04Authorization_) R04EmergencyConsumer(r04Authorization_) {
        administrator = msg.sender;
    }

    function setVerifier(
        address verifier,
        bool approved
    ) external {
        if (msg.sender != administrator || verifier == address(0)) revert InvalidMission();
        verifiers[verifier] = approved;
        emit VerifierSet(verifier, approved);
    }

    function registerTemplate(
        bytes32 id,
        bytes32 version,
        bytes32 objective,
        bytes32 prerequisite,
        uint64 duration,
        uint32 target,
        uint32 rewardUnits
    ) external {
        if (
            msg.sender != administrator || id == bytes32(0) || version == bytes32(0) || objective == bytes32(0)
                || target == 0 || duration == 0 || templates[id].enabled || id == prerequisite
                || (prerequisite != bytes32(0) && !templates[prerequisite].enabled)
        ) revert InvalidMission();
        templates[id] = Template(version, objective, prerequisite, duration, target, rewardUnits, true);
        emit TemplateRegistered(id, version);
    }

    function template(
        bytes32 id
    ) external view returns (Template memory) {
        return templates[id];
    }

    function mission(
        address player,
        bytes32 id
    ) external view returns (Mission memory) {
        return missions[player][id];
    }

    /// @dev A mission is one-shot per account; no client-imported completion or repeat activation.
    function activate(
        bytes32 id
    ) external  r04Unrestricted(EmergencyDomains.MISSION_ACTIVATION) {
        Template memory t = templates[id];
        Mission storage m = missions[msg.sender][id];
        if (
            !t.enabled || m.state != State.None || block.timestamp > type(uint64).max - t.duration
                || (t.prerequisite != bytes32(0) && !completed[msg.sender][t.prerequisite])
        ) {
            revert InvalidMission();
        }
        uint64 until = uint64(block.timestamp) + t.duration;
        missions[msg.sender][id] = Mission(
            State.Active, uint64(block.timestamp), until, 0, bytes32(0), t.version, t.objective, t.target, t.rewardUnits
        );
        emit Activated(msg.sender, id, until);
    }

    /// @dev An authorized verifier must validate mission ownership, objective and independently unique evidence.
    function attest(
        address player,
        bytes32 id,
        bytes32 proof,
        uint32 amount
    ) external  r04Unrestricted(EmergencyDomains.MISSION_ACTIVATION) {
        Mission storage m = missions[player][id];
        if (
            !verifiers[msg.sender] || player == address(0) || m.state != State.Active || block.timestamp >= m.deadline
                || proof == bytes32(0) || evidenceUsed[proof] || amount == 0 || uint256(m.progress) + amount > m.target
        ) revert InvalidMission();
        evidenceUsed[proof] = true;
        m.progress += amount;
        m.proofRoot = keccak256(abi.encode(m.proofRoot, proof, amount));
        emit Progressed(player, id, proof, amount);
        if (m.progress == m.target) {
            m.state = State.Complete;
            completed[player][id] = true;
            emit Transition(player, id, State.Complete);
        }
    }

    /// @notice Claim only emits a catalogue-defined entitlement; no implicit currency transfer.
    function claim(
        bytes32 id
    ) external  r04Unrestricted(EmergencyDomains.MISSION_ACTIVATION) {
        Mission storage m = missions[msg.sender][id];
        if (m.state != State.Complete || block.timestamp >= m.deadline) revert InvalidMission();
        m.state = State.Claimed;
        emit Transition(msg.sender, id, State.Claimed);
    }

    function fail(
        address player,
        bytes32 id
    ) external {
        Mission storage m = missions[player][id];
        if (!verifiers[msg.sender] || m.state != State.Active || block.timestamp >= m.deadline) {
            revert InvalidMission();
        }
        m.state = State.Failed;
        emit Transition(player, id, State.Failed);
    }

    function expire(
        address player,
        bytes32 id
    ) external {
        Mission storage m = missions[player][id];
        if ((m.state != State.Active && m.state != State.Complete) || block.timestamp < m.deadline) {
            revert InvalidMission();
        }
        m.state = State.Expired;
        emit Transition(player, id, State.Expired);
    }
}

