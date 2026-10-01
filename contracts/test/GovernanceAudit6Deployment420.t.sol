// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/apps/ProtocolRegistry.sol";
import "../src/interfaces/genesis/Types420.sol";
import "../src/governance/CivicIds420.sol";
import "../src/governance/ICivicElectorateSource420.sol";
import "../src/governance/GovernanceTimelock.sol";
import "../src/governance/Governance420.sol";
import "../src/governance/CivicConstitution420.sol";
import "../src/governance/CivicProposalRegistry420.sol";
import "../src/governance/CivicElectorateRegistry420.sol";
import "../src/governance/CivicVoting420.sol";
import "../src/governance/CivicGovernor420.sol";

interface VmGovAudit6 {
    function warp(uint256) external;
}

contract GovAudit6ElectorateSource is ICivicElectorateSource420 {
    bytes32 private immutable _type;
    constructor(bytes32 type_) { _type = type_; }
    function sourceType() external view returns (bytes32) { return _type; }
    function snapshotAt(uint64 blockNumber) external pure returns (bytes32,uint256) {
        return (keccak256(abi.encode("fixture", blockNumber)), 100);
    }
    function votingWeight(bytes32, address, bytes calldata) external pure returns (uint256) { return 1; }
}

/// @notice GOV-AUDIT-6 deployment-order simulation.
/// @dev Fixture policy values are intentionally non-canonical. This proves the deployment/handoff machinery only;
/// canonical bootstrap authority, electorate sources and initial rules remain external release inputs until frozen.
contract GovernanceAudit6Deployment420Test {
    VmGovAudit6 private constant vm =
        VmGovAudit6(address(uint160(uint256(keccak256("hevm cheat code")))));

    GovernanceTimelock private timelock;
    Governance420 private compatibility;
    ProtocolRegistry private registry;
    CivicConstitution420 private constitution;
    CivicProposalRegistry420 private proposals;
    CivicElectorateRegistry420 private electorates;
    CivicVoting420 private voting;
    CivicGovernor420 private governor;

    function _execute(address target, bytes memory data, bytes32 salt) private {
        bytes32 id = keccak256(abi.encode("GOV-AUDIT-6", salt, target, data, block.timestamp));
        timelock.schedule(id, target, 0, data, GovernanceTimelock.Class.G1);
        vm.warp(block.timestamp + timelock.G1_DELAY() + 1);
        timelock.execute(id);
    }

    function _deployGraph() private {
        timelock = new GovernanceTimelock(address(this));
        compatibility = new Governance420(address(timelock));
        registry = new ProtocolRegistry(address(timelock));
        constitution = new CivicConstitution420(address(timelock));
        proposals = new CivicProposalRegistry420(address(timelock));
        electorates = new CivicElectorateRegistry420(address(timelock));
        voting = new CivicVoting420(address(proposals), address(electorates));
        governor = new CivicGovernor420(
            address(constitution), address(proposals), address(electorates), address(voting)
        );
    }

    function _fixtureInitialize() private {
        GovAudit6ElectorateSource community =
            new GovAudit6ElectorateSource(keccak256("GOV_AUDIT_6_COMMUNITY_FIXTURE"));
        GovAudit6ElectorateSource validator =
            new GovAudit6ElectorateSource(keccak256("GOV_AUDIT_6_VALIDATOR_FIXTURE"));

        _execute(
            address(electorates),
            abi.encodeCall(CivicElectorateRegistry420.setHouseSource, (CivicIds420.House.COMMUNITY, address(community))),
            keccak256("community-source")
        );
        _execute(
            address(electorates),
            abi.encodeCall(CivicElectorateRegistry420.setHouseSource, (CivicIds420.House.VALIDATOR, address(validator))),
            keccak256("validator-source")
        );

        _execute(address(constitution), abi.encodeCall(CivicConstitution420.setRule,
            (CivicIds420.ProposalClass.G1, uint64(100), uint64(7 days), uint16(5000), uint16(6000), uint16(0), uint16(0), false)),
            keccak256("g1"));
        _execute(address(constitution), abi.encodeCall(CivicConstitution420.setRule,
            (CivicIds420.ProposalClass.G2, uint64(100), uint64(14 days), uint16(5000), uint16(6000), uint16(0), uint16(0), false)),
            keccak256("g2"));
        _execute(address(constitution), abi.encodeCall(CivicConstitution420.setRule,
            (CivicIds420.ProposalClass.G3, uint64(100), uint64(14 days), uint16(5000), uint16(6000), uint16(5000), uint16(6000), true)),
            keccak256("g3"));
        _execute(address(constitution), abi.encodeCall(CivicConstitution420.setRule,
            (CivicIds420.ProposalClass.G4, uint64(100), uint64(42 days), uint16(5000), uint16(6000), uint16(5000), uint16(6000), true)),
            keccak256("g4"));

        _execute(address(proposals), abi.encodeCall(CivicProposalRegistry420.bindProposalAuthority, (address(governor))),
            keccak256("proposal-authority"));
        _execute(address(electorates), abi.encodeCall(CivicElectorateRegistry420.bindSnapshotAuthority, (address(governor))),
            keccak256("snapshot-authority"));
        _execute(address(compatibility), abi.encodeCall(Governance420.bindCivicGovernor, (address(governor))),
            keccak256("compatibility-bind"));
    }

    function _register(bytes32 id, address implementation, bytes32 salt) private {
        Types420.Version memory version = Types420.Version({major:1, minor:0, patch:0});
        _execute(
            address(registry),
            abi.encodeCall(ProtocolRegistry.registerComponent, (id, implementation, version, Types420.Lifecycle.ACTIVE)),
            salt
        );
    }

    function testDeterministicDeploymentGraphRegistryDiscoveryAndIrreversibleHandoff() public {
        _deployGraph();
        require(timelock.scheduler() == address(this), "bootstrap scheduler mismatch");
        require(!timelock.civicAuthorityActivated(), "premature Civic activation");

        _fixtureInitialize();

        bytes32 constitutionId = keccak256("420/component/governance/civic-constitution/v1");
        bytes32 proposalsId = keccak256("420/component/governance/civic-proposal-registry/v1");
        bytes32 electoratesId = keccak256("420/component/governance/civic-electorate-registry/v1");
        bytes32 votingId = keccak256("420/component/governance/civic-voting/v1");
        bytes32 governorId = keccak256("420/component/governance/civic-governor/v1");

        _register(constitutionId, address(constitution), keccak256("reg-constitution"));
        _register(proposalsId, address(proposals), keccak256("reg-proposals"));
        _register(electoratesId, address(electorates), keccak256("reg-electorates"));
        _register(votingId, address(voting), keccak256("reg-voting"));
        _register(governorId, address(governor), keccak256("reg-governor"));

        bytes32 serviceId = keccak256("420/service/governance/v1");
        bytes32 dependencyRoot = keccak256(abi.encode(
            address(constitution), address(proposals), address(electorates), address(voting), address(governor)
        ));
        _execute(
            address(registry),
            abi.encodeCall(
                ProtocolRegistry.publishRegisteredService,
                (
                    serviceId,
                    address(governor),
                    keccak256("GOV-AUDIT-6-FIXTURE-METADATA"),
                    uint32(1),
                    true,
                    ProtocolRegistry.ComponentType.PROTOCOL,
                    keccak256("contracts/config/governance-deployment-v1.json"),
                    dependencyRoot,
                    keccak256("420/interface/governance-civic/v1")
                )
            ),
            keccak256("service-publication")
        );

        require(registry.resolve(constitutionId) == address(constitution), "constitution resolution");
        require(registry.resolve(proposalsId) == address(proposals), "proposal resolution");
        require(registry.resolve(electoratesId) == address(electorates), "electorate resolution");
        require(registry.resolve(votingId) == address(voting), "voting resolution");
        require(registry.resolve(governorId) == address(governor), "governor resolution");
        require(compatibility.civicGovernor() == address(governor), "compatibility pointer");
        require(proposals.proposalAuthority() == address(governor), "proposal authority");
        require(electorates.snapshotAuthority() == address(governor), "snapshot authority");

        timelock.activateCivicAuthority(address(governor));
        require(timelock.civicAuthorityActivated(), "Civic authority inactive");
        require(timelock.scheduler() == address(governor), "scheduler not transferred");

        (bool repeat,) = address(timelock).call(
            abi.encodeCall(GovernanceTimelock.activateCivicAuthority, (address(governor)))
        );
        require(!repeat, "authority handoff repeated");
        (bool cancel,) = address(timelock).call(abi.encodeCall(GovernanceTimelock.cancel, (bytes32(uint256(1)))));
        require(!cancel, "bootstrap cancellation remained available");
    }
}
