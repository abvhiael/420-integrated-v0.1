// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @notice Shared immutable catalogue and proof-driven progression, without local-save authority.
/// @dev Three separate registries inherit this contract and have independent namespaces and administrators.
abstract contract ProgressionRegistryCore {
    error InvalidProgression();

    struct Track {
        bytes32 version;
        bytes32 prerequisite;
        uint32 requiredPoints;
        uint32 maxPointsPerProof;
        uint32 rewardUnits;
        bool exists;
    }

    struct Progress {
        uint32 points;
        bool completed;
    }

    address public immutable administrator;
    mapping(address => bool) public trustedVerifiers;
    mapping(bytes32 => Track) private _tracks;
    mapping(address => mapping(bytes32 => Progress)) private _progress;
    mapping(bytes32 => bool) public usedEvidence;
    mapping(address => mapping(bytes32 => bool)) public unlocked;
    event VerifierSet(address indexed verifier, bool approved);
    event TrackRegistered(bytes32 indexed trackId, bytes32 indexed version, bytes32 prerequisite);
    event ProgressRecorded(address indexed player, bytes32 indexed trackId, bytes32 indexed evidence, uint32 points);
    event TrackCompleted(address indexed player, bytes32 indexed trackId, uint32 rewardUnits);

    constructor() {
        administrator = msg.sender;
    }

    function setVerifier(
        address verifier,
        bool approved
    ) external {
        if (msg.sender != administrator || verifier == address(0)) revert InvalidProgression();
        trustedVerifiers[verifier] = approved;
        emit VerifierSet(verifier, approved);
    }

    /// @dev Track ids and versioned costs/effects are immutable. Prerequisite must already be catalogued.
    function registerTrack(
        bytes32 id,
        bytes32 version,
        bytes32 prerequisite,
        uint32 requiredPoints,
        uint32 maxPointsPerProof,
        uint32 rewardUnits
    ) external {
        if (
            msg.sender != administrator || id == bytes32(0) || version == bytes32(0) || _tracks[id].exists
                || id == prerequisite || requiredPoints == 0 || maxPointsPerProof == 0
                || maxPointsPerProof > requiredPoints || (prerequisite != bytes32(0) && !_tracks[prerequisite].exists)
        ) revert InvalidProgression();
        _tracks[id] = Track(version, prerequisite, requiredPoints, maxPointsPerProof, rewardUnits, true);
        emit TrackRegistered(id, version, prerequisite);
    }

    function track(
        bytes32 id
    ) external view returns (Track memory) {
        if (!_tracks[id].exists) revert InvalidProgression();
        return _tracks[id];
    }

    function progress(
        address player,
        bytes32 id
    ) external view returns (Progress memory) {
        return _progress[player][id];
    }

    /// @notice Verifier attests independently checked gameplay proof, not a raw user/client claim.
    /// @dev Verifiers must commit to unique proof IDs. All rewards are *catalogue metadata*;
    ///      no BUDS issuance occurs here or by calling a token/bridge.
    function attest(
        address player,
        bytes32 id,
        bytes32 evidence,
        uint32 points
    ) external {
        Track memory t = _tracks[id];
        if (
            !trustedVerifiers[msg.sender] || !t.exists || player == address(0) || evidence == bytes32(0)
                || usedEvidence[evidence] || points == 0 || points > t.maxPointsPerProof
        ) revert InvalidProgression();
        if (t.prerequisite != bytes32(0) && !unlocked[player][t.prerequisite]) revert InvalidProgression();
        Progress storage p = _progress[player][id];
        if (p.completed || uint256(p.points) + points > t.requiredPoints) revert InvalidProgression();
        usedEvidence[evidence] = true;
        p.points += points;
        emit ProgressRecorded(player, id, evidence, points);
        if (p.points == t.requiredPoints) {
            p.completed = true;
            unlocked[player][id] = true;
            emit TrackCompleted(player, id, t.rewardUnits);
        }
    }
}

/// @notice Skills: points/proofs become irreversible skill unlocks once complete.
contract SkillRegistry is ProgressionRegistryCore { }

/// @notice Research: independent verified evidence and prerequisite-bound technology unlocks.
contract ResearchRegistry is ProgressionRegistryCore { }

/// @notice Discoveries: catalogue-bound unique discoveries, without imported local save claims.
contract DiscoveryRegistry is ProgressionRegistryCore { }
