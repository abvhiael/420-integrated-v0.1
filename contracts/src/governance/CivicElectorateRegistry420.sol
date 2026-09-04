// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../system/SystemAccess.sol";
import "../interfaces/I420System.sol";
import "./CivicIds420.sol";
import "./ICivicElectorateSource420.sol";

/// @notice Canonical electorate-source and proposal-snapshot registry for 420Civic.
/// @dev Source upgrades are prospective only. Every proposal freezes the source, source revision,
/// electorate root and total voting weight used by each required house.
contract CivicElectorateRegistry420 is SystemAccess, I420System {
    struct SourceConfig {
        address source;
        bytes32 sourceType;
        uint32 revision;
        bool exists;
    }

    struct HouseSnapshot {
        address source;
        bytes32 sourceType;
        bytes32 electorateRoot;
        uint256 totalWeight;
        uint32 sourceRevision;
        bool required;
    }

    struct ProposalSnapshot {
        uint64 snapshotBlock;
        HouseSnapshot community;
        HouseSnapshot validator;
        bool dualHouseRequired;
        bool exists;
    }

    mapping(uint8 => SourceConfig) private _sources;
    mapping(bytes32 => ProposalSnapshot) private _proposalSnapshots;

    address public snapshotAuthority;

    error InvalidSource();
    error SourceNotConfigured();
    error InvalidSnapshot();
    error SnapshotExists();
    error SnapshotNotFound();
    error InvalidProposalId();
    error UnauthorizedAuthority();
    error AuthorityAlreadyBound();
    error HouseNotRequired();

    event CivicElectorateSourceSet(
        CivicIds420.House indexed house,
        address indexed source,
        bytes32 indexed sourceType,
        uint32 revision
    );
    event SnapshotAuthorityBound(address indexed authority);
    event CivicElectorateSnapshotted(
        bytes32 indexed proposalId,
        uint64 indexed snapshotBlock,
        bool dualHouseRequired,
        bytes32 communityRoot,
        uint256 communityTotalWeight,
        bytes32 validatorRoot,
        uint256 validatorTotalWeight
    );

    constructor(address timelock_) SystemAccess(timelock_) {}

    modifier onlySnapshotAuthority() {
        if (msg.sender != snapshotAuthority || snapshotAuthority == address(0)) revert UnauthorizedAuthority();
        _;
    }

    function systemName() external pure returns (string memory) {
        return "CivicElectorateRegistry420";
    }

    function protocolVersion() external pure returns (uint32) {
        return 1;
    }

    function sourceFor(CivicIds420.House house) external view returns (SourceConfig memory) {
        return _sources[uint8(house)];
    }

    function proposalSnapshot(bytes32 proposalId) external view returns (ProposalSnapshot memory) {
        ProposalSnapshot storage snapshot = _proposalSnapshots[proposalId];
        if (!snapshot.exists) revert SnapshotNotFound();
        return snapshot;
    }

    /// @notice Replace a house's electorate adapter prospectively through the governance timelock.
    /// @dev Existing proposal snapshots retain their original source and revision forever.
    function setHouseSource(CivicIds420.House house, address source) external onlyGovernance {
        if (source == address(0) || source.code.length == 0) revert InvalidSource();
        bytes32 sourceType_ = ICivicElectorateSource420(source).sourceType();
        if (sourceType_ == bytes32(0)) revert InvalidSource();

        SourceConfig storage prior = _sources[uint8(house)];
        uint32 revision = prior.exists ? prior.revision + 1 : 1;
        _sources[uint8(house)] = SourceConfig({
            source: source,
            sourceType: sourceType_,
            revision: revision,
            exists: true
        });

        emit CivicElectorateSourceSet(house, source, sourceType_, revision);
    }

    /// @notice Bind the sole coordinator allowed to freeze proposal electorates.
    function bindSnapshotAuthority(address authority) external onlyGovernance {
        if (snapshotAuthority != address(0)) revert AuthorityAlreadyBound();
        if (authority == address(0)) revert UnauthorizedAuthority();
        snapshotAuthority = authority;
        emit SnapshotAuthorityBound(authority);
    }

    /// @notice Freeze the electorate commitment used for a proposal before voting starts.
    function snapshotProposal(bytes32 proposalId, uint64 snapshotBlock, bool dualHouseRequired)
        external
        onlySnapshotAuthority
    {
        if (proposalId == bytes32(0)) revert InvalidProposalId();
        if (snapshotBlock >= block.number) revert InvalidSnapshot();
        if (_proposalSnapshots[proposalId].exists) revert SnapshotExists();

        SourceConfig memory communityConfig = _requireSource(CivicIds420.House.COMMUNITY);
        HouseSnapshot memory community = _capture(communityConfig, snapshotBlock, true);

        HouseSnapshot memory validator;
        if (dualHouseRequired) {
            SourceConfig memory validatorConfig = _requireSource(CivicIds420.House.VALIDATOR);
            validator = _capture(validatorConfig, snapshotBlock, true);
        }

        _proposalSnapshots[proposalId] = ProposalSnapshot({
            snapshotBlock: snapshotBlock,
            community: community,
            validator: validator,
            dualHouseRequired: dualHouseRequired,
            exists: true
        });

        emit CivicElectorateSnapshotted(
            proposalId,
            snapshotBlock,
            dualHouseRequired,
            community.electorateRoot,
            community.totalWeight,
            validator.electorateRoot,
            validator.totalWeight
        );
    }

    /// @notice Resolve source-specific voting weight against the immutable proposal snapshot.
    function votingWeight(bytes32 proposalId, CivicIds420.House house, address voter, bytes calldata proofData)
        external
        view
        returns (uint256)
    {
        ProposalSnapshot storage snapshot = _proposalSnapshots[proposalId];
        if (!snapshot.exists) revert SnapshotNotFound();
        HouseSnapshot storage houseSnapshot =
            house == CivicIds420.House.COMMUNITY ? snapshot.community : snapshot.validator;
        if (!houseSnapshot.required || houseSnapshot.source == address(0)) revert HouseNotRequired();
        return ICivicElectorateSource420(houseSnapshot.source).votingWeight(
            houseSnapshot.electorateRoot, voter, proofData
        );
    }

    function _requireSource(CivicIds420.House house) private view returns (SourceConfig memory config) {
        config = _sources[uint8(house)];
        if (!config.exists || config.source == address(0)) revert SourceNotConfigured();
    }

    function _capture(SourceConfig memory config, uint64 snapshotBlock, bool required)
        private
        view
        returns (HouseSnapshot memory)
    {
        (bytes32 root, uint256 totalWeight) = ICivicElectorateSource420(config.source).snapshotAt(snapshotBlock);
        if (root == bytes32(0) || totalWeight == 0) revert InvalidSnapshot();
        return HouseSnapshot({
            source: config.source,
            sourceType: config.sourceType,
            electorateRoot: root,
            totalWeight: totalWeight,
            sourceRevision: config.revision,
            required: required
        });
    }
}
