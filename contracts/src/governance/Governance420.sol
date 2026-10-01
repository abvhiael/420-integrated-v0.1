// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../system/SystemAccess.sol";
import "../interfaces/I420System.sol";
import "./GovernanceTimelock.sol";
import "./CivicIds420.sol";
import "./CivicConstitution420.sol";
import "./CivicProposalRegistry420.sol";
import "./CivicElectorateRegistry420.sol";
import "./CivicVoting420.sol";
import "./CivicGovernor420.sol";
import "./CivicMerkleElectorateSource420.sol";

interface IProtocolRegistryBootstrap420 {
    enum ComponentType {
        UNSET,
        PROTOCOL,
        APPLICATION,
        SERVICE,
        REGISTRY,
        ADAPTER,
        INFRASTRUCTURE
    }
    enum Lifecycle {
        NONE,
        PROPOSED,
        ACTIVE,
        PAUSED,
        SUSPENDED,
        DEPRECATED,
        WITHDRAWAL_ONLY,
        RETIRED
    }
    struct Version {
        uint16 major;
        uint16 minor;
        uint16 patch;
    }

    function registerComponent(
        bytes32 componentId,
        address implementation,
        Version calldata version,
        Lifecycle lifecycle
    ) external;
    function publishRegisteredService(
        bytes32 serviceId,
        address implementation,
        bytes32 metadataHash,
        uint32 version,
        bool active,
        ComponentType componentType_,
        bytes32 manifestHash,
        bytes32 dependencyRoot,
        bytes32 interfaceHash
    ) external;
    function resolve(
        bytes32 componentId
    ) external view returns (address implementation);
    function resolveActive(
        bytes32 serviceId
    ) external view returns (address implementation, uint32 version);
}

/// @notice Frozen 0x0437 compatibility surface for 420Civic governance.
/// @dev Legacy proposal/vote/result mutation paths are permanently retired. Canonical governance
/// authority lives in CivicGovernor420 and executes only through GovernanceTimelock at 0x0429.
/// Before Civic activation only, this fixed identity may schedule the one canonical bootstrap plan;
/// it has no arbitrary proposal, vote or execution authority and the bootstrap role retires permanently.
contract Governance420 is SystemAccess, I420System {
    enum Class {
        G1,
        G2,
        G3,
        G4
    }
    enum State {
        NONE,
        ACTIVE,
        PASSED,
        FAILED,
        QUEUED,
        EXECUTED
    }

    struct Proposal {
        address proposer;
        Class class_;
        bytes32 metadataHash;
        uint64 snapshotBlock;
        uint64 voteEnd;
        uint256 communityYes;
        uint256 communityNo;
        uint256 validatorYes;
        uint256 validatorNo;
        State state;
    }

    mapping(bytes32 => Proposal) public proposals;

    address public constant PROTOCOL_REGISTRY = 0x0000000000000000000000000000000000000434;
    uint64 public constant ROTATION_BLOCKS = 17_640;

    bytes32 public constant COMMUNITY_COMPONENT_ID = keccak256("420/component/governance/civic-constitution/v1");
    bytes32 public constant PROPOSAL_COMPONENT_ID = keccak256("420/component/governance/civic-proposal-registry/v1");
    bytes32 public constant ELECTORATE_COMPONENT_ID =
        keccak256("420/component/governance/civic-electorate-registry/v1");
    bytes32 public constant VOTING_COMPONENT_ID = keccak256("420/component/governance/civic-voting/v1");
    bytes32 public constant GOVERNOR_COMPONENT_ID = keccak256("420/component/governance/civic-governor/v1");
    bytes32 public constant GOVERNANCE_SERVICE_ID = keccak256("420/service/governance/v1");
    bytes32 public constant GOVERNANCE_INTERFACE_HASH = keccak256("420/interface/governance-civic/v1");
    bytes32 public constant GOVERNANCE_MANIFEST_HASH = keccak256("420/governance/deployment-manifest/v1");
    bytes32 public constant GOVERNANCE_METADATA_HASH = keccak256("420/governance/metadata/v1");
    bytes32 private constant BOOTSTRAP_DOMAIN = keccak256("420CIVIC_BOOTSTRAP_V1");

    address public civicGovernor;
    bytes32 public bootstrapPlanHash;
    bool public bootstrapPlanScheduled;
    bool public bootstrapRetired;

    error LegacySurfaceRetired();
    error InvalidCivicGovernor();
    error CivicGovernorAlreadyBound();
    error InvalidBootstrapState();
    error InvalidBootstrapGraph();
    error InvalidElectorateSource();

    event CivicGovernorBound(address indexed civicGovernor);
    event CivicBootstrapPlanScheduled(bytes32 indexed planHash, address indexed civicGovernor);
    event CivicBootstrapRetired(address indexed civicGovernor);

    constructor(
        address timelock_
    ) SystemAccess(timelock_) { }

    function systemName() external pure returns (string memory) {
        return "Governance420";
    }

    function protocolVersion() external pure returns (uint32) {
        return 3;
    }

    function bindCivicGovernor(
        address governor
    ) external onlyGovernance {
        if (civicGovernor != address(0)) revert CivicGovernorAlreadyBound();
        if (!_isCanonicalCivicGovernor(governor)) revert InvalidCivicGovernor();
        civicGovernor = governor;
        emit CivicGovernorBound(governor);
    }

    /// @notice Permissionless scheduling of the exact canonical initialization plan.
    /// @dev Safety comes from the frozen 0x0437 bootstrap identity plus exact graph/source validation and
    /// hard-coded initial constitutional rules. No caller-selected rule, Registry ID, or authority is accepted.
    function scheduleCanonicalCivicBootstrap(
        address constitution_,
        address proposals_,
        address electorates_,
        address voting_,
        address governor_,
        address communitySource_,
        address validatorSource_
    ) external {
        GovernanceTimelock timelock = GovernanceTimelock(payable(governanceTimelock));
        if (
            bootstrapPlanScheduled || bootstrapRetired || timelock.civicAuthorityActivated()
                || timelock.bootstrapGovernor() != address(this) || timelock.scheduler() != address(this)
        ) revert InvalidBootstrapState();

        CivicConstitution420 constitution = CivicConstitution420(constitution_);
        CivicProposalRegistry420 proposalsContract = CivicProposalRegistry420(proposals_);
        CivicElectorateRegistry420 electorates = CivicElectorateRegistry420(electorates_);
        CivicVoting420 voting = CivicVoting420(voting_);
        CivicGovernor420 governor = CivicGovernor420(governor_);

        if (
            constitution_.code.length == 0 || proposals_.code.length == 0 || electorates_.code.length == 0
                || voting_.code.length == 0 || governor_.code.length == 0
                || constitution.governanceTimelock() != governanceTimelock
                || proposalsContract.governanceTimelock() != governanceTimelock
                || electorates.governanceTimelock() != governanceTimelock
                || address(voting.proposalRegistry()) != proposals_
                || address(voting.electorateRegistry()) != electorates_
                || address(governor.constitution()) != constitution_
                || address(governor.proposalRegistry()) != proposals_
                || address(governor.electorateRegistry()) != electorates_ || address(governor.voting()) != voting_
                || address(governor.timelock()) != governanceTimelock
        ) revert InvalidBootstrapGraph();

        CivicMerkleElectorateSource420 community = CivicMerkleElectorateSource420(communitySource_);
        CivicMerkleElectorateSource420 validator = CivicMerkleElectorateSource420(validatorSource_);
        if (
            communitySource_.code.length == 0 || validatorSource_.code.length == 0
                || community.governanceTimelock() != governanceTimelock
                || validator.governanceTimelock() != governanceTimelock
                || community.sourceType() != community.COMMUNITY_SOURCE_TYPE()
                || validator.sourceType() != validator.VALIDATOR_SOURCE_TYPE()
        ) revert InvalidElectorateSource();

        bytes32 plan = keccak256(
            abi.encode(
                BOOTSTRAP_DOMAIN,
                block.chainid,
                constitution_,
                proposals_,
                electorates_,
                voting_,
                governor_,
                communitySource_,
                validatorSource_
            )
        );
        bootstrapPlanHash = plan;
        bootstrapPlanScheduled = true;

        _schedule(timelock, plan, 0, electorates_,
            abi.encodeCall(CivicElectorateRegistry420.setHouseSource, (CivicIds420.House.COMMUNITY, communitySource_)));
        _schedule(timelock, plan, 1, electorates_,
            abi.encodeCall(CivicElectorateRegistry420.setHouseSource, (CivicIds420.House.VALIDATOR, validatorSource_)));

        _schedule(timelock, plan, 2, constitution_, abi.encodeCall(
            CivicConstitution420.setRule,
            (CivicIds420.ProposalClass.G1, ROTATION_BLOCKS, uint64(7 days), uint16(1000), uint16(5001), uint16(0), uint16(0), false)
        ));
        _schedule(timelock, plan, 3, constitution_, abi.encodeCall(
            CivicConstitution420.setRule,
            (CivicIds420.ProposalClass.G2, ROTATION_BLOCKS * 2, uint64(14 days), uint16(2000), uint16(6000), uint16(0), uint16(0), false)
        ));
        _schedule(timelock, plan, 4, constitution_, abi.encodeCall(
            CivicConstitution420.setRule,
            (CivicIds420.ProposalClass.G3, ROTATION_BLOCKS * 2, uint64(14 days), uint16(3334), uint16(6667), uint16(3334), uint16(6667), true)
        ));
        _schedule(timelock, plan, 5, constitution_, abi.encodeCall(
            CivicConstitution420.setRule,
            (CivicIds420.ProposalClass.G4, ROTATION_BLOCKS * 6, uint64(42 days), uint16(5000), uint16(7500), uint16(5000), uint16(7500), true)
        ));

        _schedule(timelock, plan, 6, proposals_,
            abi.encodeCall(CivicProposalRegistry420.bindProposalAuthority, (governor_)));
        _schedule(timelock, plan, 7, electorates_,
            abi.encodeCall(CivicElectorateRegistry420.bindSnapshotAuthority, (governor_)));
        _schedule(timelock, plan, 8, address(this), abi.encodeCall(Governance420.bindCivicGovernor, (governor_)));

        IProtocolRegistryBootstrap420.Version memory version =
            IProtocolRegistryBootstrap420.Version({ major: 1, minor: 0, patch: 0 });
        _schedule(timelock, plan, 9, PROTOCOL_REGISTRY, abi.encodeCall(
            IProtocolRegistryBootstrap420.registerComponent,
            (COMMUNITY_COMPONENT_ID, constitution_, version, IProtocolRegistryBootstrap420.Lifecycle.ACTIVE)
        ));
        _schedule(timelock, plan, 10, PROTOCOL_REGISTRY, abi.encodeCall(
            IProtocolRegistryBootstrap420.registerComponent,
            (PROPOSAL_COMPONENT_ID, proposals_, version, IProtocolRegistryBootstrap420.Lifecycle.ACTIVE)
        ));
        _schedule(timelock, plan, 11, PROTOCOL_REGISTRY, abi.encodeCall(
            IProtocolRegistryBootstrap420.registerComponent,
            (ELECTORATE_COMPONENT_ID, electorates_, version, IProtocolRegistryBootstrap420.Lifecycle.ACTIVE)
        ));
        _schedule(timelock, plan, 12, PROTOCOL_REGISTRY, abi.encodeCall(
            IProtocolRegistryBootstrap420.registerComponent,
            (VOTING_COMPONENT_ID, voting_, version, IProtocolRegistryBootstrap420.Lifecycle.ACTIVE)
        ));
        _schedule(timelock, plan, 13, PROTOCOL_REGISTRY, abi.encodeCall(
            IProtocolRegistryBootstrap420.registerComponent,
            (GOVERNOR_COMPONENT_ID, governor_, version, IProtocolRegistryBootstrap420.Lifecycle.ACTIVE)
        ));

        bytes32 dependencyRoot = keccak256(
            abi.encode(constitution_, proposals_, electorates_, voting_, governor_, communitySource_, validatorSource_)
        );
        _schedule(timelock, plan, 14, PROTOCOL_REGISTRY, abi.encodeCall(
            IProtocolRegistryBootstrap420.publishRegisteredService,
            (
                GOVERNANCE_SERVICE_ID,
                governor_,
                GOVERNANCE_METADATA_HASH,
                uint32(1),
                true,
                IProtocolRegistryBootstrap420.ComponentType.PROTOCOL,
                GOVERNANCE_MANIFEST_HASH,
                dependencyRoot,
                GOVERNANCE_INTERFACE_HASH
            )
        ));

        emit CivicBootstrapPlanScheduled(plan, governor_);
    }

    /// @notice Retire bootstrap scheduling and irreversibly hand the Timelock scheduler to CivicGovernor420.
    /// @dev This succeeds only after every scheduled initialization/publication operation is actually reflected on-chain.
    function activateCanonicalCivic(
        address constitution_,
        address proposals_,
        address electorates_,
        address voting_,
        address governor_,
        address communitySource_,
        address validatorSource_
    ) external {
        if (!bootstrapPlanScheduled || bootstrapRetired || civicGovernor != governor_) revert InvalidBootstrapState();
        bytes32 plan = keccak256(
            abi.encode(
                BOOTSTRAP_DOMAIN,
                block.chainid,
                constitution_,
                proposals_,
                electorates_,
                voting_,
                governor_,
                communitySource_,
                validatorSource_
            )
        );
        if (plan != bootstrapPlanHash) revert InvalidBootstrapGraph();

        CivicConstitution420 constitution = CivicConstitution420(constitution_);
        CivicProposalRegistry420 proposalsContract = CivicProposalRegistry420(proposals_);
        CivicElectorateRegistry420 electorates = CivicElectorateRegistry420(electorates_);
        IProtocolRegistryBootstrap420 registry = IProtocolRegistryBootstrap420(PROTOCOL_REGISTRY);

        if (proposalsContract.proposalAuthority() != governor_ || electorates.snapshotAuthority() != governor_) {
            revert InvalidBootstrapGraph();
        }
        CivicElectorateRegistry420.SourceConfig memory communityConfig =
            electorates.sourceFor(CivicIds420.House.COMMUNITY);
        CivicElectorateRegistry420.SourceConfig memory validatorConfig =
            electorates.sourceFor(CivicIds420.House.VALIDATOR);
        if (communityConfig.source != communitySource_ || validatorConfig.source != validatorSource_) {
            revert InvalidBootstrapGraph();
        }

        _requireRule(constitution.ruleFor(CivicIds420.ProposalClass.G1), ROTATION_BLOCKS, 7 days, 1000, 5001, 0, 0, false);
        _requireRule(constitution.ruleFor(CivicIds420.ProposalClass.G2), ROTATION_BLOCKS * 2, 14 days, 2000, 6000, 0, 0, false);
        _requireRule(constitution.ruleFor(CivicIds420.ProposalClass.G3), ROTATION_BLOCKS * 2, 14 days, 3334, 6667, 3334, 6667, true);
        _requireRule(constitution.ruleFor(CivicIds420.ProposalClass.G4), ROTATION_BLOCKS * 6, 42 days, 5000, 7500, 5000, 7500, true);

        if (
            registry.resolve(COMMUNITY_COMPONENT_ID) != constitution_
                || registry.resolve(PROPOSAL_COMPONENT_ID) != proposals_
                || registry.resolve(ELECTORATE_COMPONENT_ID) != electorates_
                || registry.resolve(VOTING_COMPONENT_ID) != voting_
                || registry.resolve(GOVERNOR_COMPONENT_ID) != governor_
        ) revert InvalidBootstrapGraph();
        (address serviceImplementation, uint32 serviceVersion) = registry.resolveActive(GOVERNANCE_SERVICE_ID);
        if (serviceImplementation != governor_ || serviceVersion != 1) revert InvalidBootstrapGraph();

        GovernanceTimelock(payable(governanceTimelock)).activateCivicAuthority(governor_);
        bootstrapRetired = true;
        emit CivicBootstrapRetired(governor_);
    }

    function bootstrapOperationId(
        bytes32 plan,
        uint8 index
    ) public pure returns (bytes32) {
        return keccak256(abi.encode(BOOTSTRAP_DOMAIN, plan, index));
    }

    function _schedule(
        GovernanceTimelock timelock,
        bytes32 plan,
        uint8 index,
        address target,
        bytes memory data
    ) private {
        timelock.schedule(bootstrapOperationId(plan, index), target, 0, data, GovernanceTimelock.Class.G1);
    }

    function _requireRule(
        CivicConstitution420.Rule memory rule,
        uint64 votingBlocks,
        uint64 delay,
        uint16 communityQuorum,
        uint16 communityApproval,
        uint16 validatorQuorum,
        uint16 validatorApproval,
        bool dual
    ) private pure {
        if (
            !rule.exists || rule.votingPeriodBlocks != votingBlocks || rule.timelockDelay != delay
                || rule.communityQuorumBps != communityQuorum || rule.communityApprovalBps != communityApproval
                || rule.validatorQuorumBps != validatorQuorum || rule.validatorApprovalBps != validatorApproval
                || rule.dualHouseRequired != dual || rule.revision != 1
        ) revert InvalidBootstrapGraph();
    }

    function _isCanonicalCivicGovernor(
        address governor
    ) private view returns (bool) {
        if (governor == address(0) || governor.code.length == 0) return false;
        (bool ok, bytes memory data) = governor.staticcall(abi.encodeWithSignature("timelock()"));
        return ok && data.length >= 32 && abi.decode(data, (address)) == governanceTimelock;
    }

    function createProposal(
        bytes32,
        Class,
        bytes32,
        uint64,
        uint64
    ) external pure {
        revert LegacySurfaceRetired();
    }

    function applyVote(
        bytes32,
        bool,
        bool,
        uint256
    ) external pure {
        revert LegacySurfaceRetired();
    }

    function applyResult(
        bytes32,
        bool
    ) external pure {
        revert LegacySurfaceRetired();
    }
}
