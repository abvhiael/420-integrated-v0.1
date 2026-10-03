// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/apps/ProtocolRegistry.sol";
import "../src/interfaces/genesis/Types420.sol";
import "../src/system/CapabilityRegistry420.sol";
import "../src/treasury/TreasuryAuthorization420.sol";
import "../src/treasury/TreasuryPolicyRegistry420.sol";
import "../src/treasury/TreasuryBudgetRegistry420.sol";
import "../src/treasury/TreasuryDisbursementRegistry420.sol";
import "../src/grants/GrantIds420.sol";
import "../src/grants/GrantAuthorization420.sol";
import "../src/grants/GrantProgramRegistry420.sol";
import "../src/grants/GrantApplicationRegistry420.sol";
import "../src/grants/GrantAwardRegistry420.sol";
import "../src/grants/GrantMilestoneRegistry420.sol";
import "../src/grants/GrantRouter420.sol";

contract GrantsDeploymentBinding420Test {
    bytes32 internal constant GRANTS_SERVICE_ID = keccak256("420/service/grants/v1");
    bytes32 internal constant METADATA_HASH = keccak256("420/GRANTS/RELEASE/METADATA/V1");
    bytes32 internal constant MANIFEST_HASH = keccak256("420/GRANTS/AUDIT-5/RELEASE-MATERIALIZATION/V1");
    bytes32 internal constant INTERFACE_HASH = keccak256("420/GRANTS/GRANT_ROUTER/INTERFACE/V1");

    event DeploymentAddress(string name, address implementation);
    event RuntimeCodeHash(string name, bytes32 codeHash);
    event ReleaseCommitment(string name, bytes32 value);

    struct Env {
        CapabilityRegistry420 caps;
        ProtocolRegistry registry;
        TreasuryAuthorization420 treasuryAuthorization;
        TreasuryPolicyRegistry420 treasuryPolicy;
        TreasuryBudgetRegistry420 treasuryBudgets;
        TreasuryDisbursementRegistry420 treasuryDisbursements;
        GrantAuthorization420 authorization;
        GrantProgramRegistry420 programs;
        GrantApplicationRegistry420 applications;
        GrantAwardRegistry420 awards;
        GrantMilestoneRegistry420 milestones;
        GrantRouter420 router;
        bytes32 dependencyRoot;
    }

    function _deploy() internal returns (Env memory e) {
        // Repository-local qualification uses this test contract as the
        // governance/timelock actor. Production uses frozen GovernanceTimelock
        // 0x0000000000000000000000000000000000000429.
        e.caps = new CapabilityRegistry420();
        e.registry = new ProtocolRegistry(address(this));

        // A real TreasuryDisbursementRegistry420 is deployed as the canonical
        // Grants payment-state dependency. It remains external authority.
        e.treasuryAuthorization = new TreasuryAuthorization420(address(e.caps));
        e.treasuryPolicy = new TreasuryPolicyRegistry420(address(this));
        e.treasuryBudgets = new TreasuryBudgetRegistry420(address(this), address(e.treasuryPolicy));
        e.treasuryDisbursements = new TreasuryDisbursementRegistry420(
            address(this), address(e.treasuryAuthorization), address(e.treasuryPolicy), address(e.treasuryBudgets)
        );
        e.treasuryBudgets.setController(address(e.treasuryDisbursements));

        e.authorization = new GrantAuthorization420(address(e.caps));
        e.programs = new GrantProgramRegistry420(address(this));
        e.applications = new GrantApplicationRegistry420(address(e.authorization), address(e.programs));
        e.awards = new GrantAwardRegistry420(address(this), address(e.programs), address(e.applications));
        e.programs.bindAwardRegistry(address(e.awards));
        e.milestones = new GrantMilestoneRegistry420(
            address(this),
            address(e.authorization),
            address(e.programs),
            address(e.awards),
            address(e.treasuryDisbursements)
        );
        e.router = new GrantRouter420(address(e.programs), address(e.awards), address(e.milestones));

        e.dependencyRoot = keccak256(
            abi.encode(
                address(e.caps),
                address(e.treasuryDisbursements),
                address(e.authorization),
                address(e.programs),
                address(e.applications),
                address(e.awards),
                address(e.milestones),
                address(e.router),
                address(e.authorization).codehash,
                address(e.programs).codehash,
                address(e.applications).codehash,
                address(e.awards).codehash,
                address(e.milestones).codehash,
                address(e.router).codehash
            )
        );

        e.registry
            .registerComponent(
                GrantIds420.COMPONENT_GRANTS,
                address(e.router),
                Types420.Version({ major: 1, minor: 0, patch: 0 }),
                Types420.Lifecycle.ACTIVE
            );
        e.registry
            .publishRegisteredService(
                GRANTS_SERVICE_ID,
                address(e.router),
                METADATA_HASH,
                1,
                true,
                ProtocolRegistry.ComponentType.SERVICE,
                MANIFEST_HASH,
                e.dependencyRoot,
                INTERFACE_HASH
            );

        emit DeploymentAddress("GrantAuthorization420", address(e.authorization));
        emit DeploymentAddress("GrantProgramRegistry420", address(e.programs));
        emit DeploymentAddress("GrantApplicationRegistry420", address(e.applications));
        emit DeploymentAddress("GrantAwardRegistry420", address(e.awards));
        emit DeploymentAddress("GrantMilestoneRegistry420", address(e.milestones));
        emit DeploymentAddress("GrantRouter420", address(e.router));

        emit RuntimeCodeHash("GrantAuthorization420", address(e.authorization).codehash);
        emit RuntimeCodeHash("GrantProgramRegistry420", address(e.programs).codehash);
        emit RuntimeCodeHash("GrantApplicationRegistry420", address(e.applications).codehash);
        emit RuntimeCodeHash("GrantAwardRegistry420", address(e.awards).codehash);
        emit RuntimeCodeHash("GrantMilestoneRegistry420", address(e.milestones).codehash);
        emit RuntimeCodeHash("GrantRouter420", address(e.router).codehash);
        emit ReleaseCommitment("dependencyRoot", e.dependencyRoot);
        emit ReleaseCommitment("manifestHash", MANIFEST_HASH);
        emit ReleaseCommitment("interfaceHash", INTERFACE_HASH);
    }

    function testDeploymentOrderAndConstructorBindings() public {
        Env memory e = _deploy();

        require(address(e.authorization.capabilityRegistry()) == address(e.caps), "authorization/capability binding");
        require(e.programs.governanceTimelock() == address(this), "program/timelock binding");
        require(
            address(e.applications.authorization()) == address(e.authorization), "application/authorization binding"
        );
        require(address(e.applications.programs()) == address(e.programs), "application/program binding");
        require(e.awards.governanceTimelock() == address(this), "award/timelock binding");
        require(address(e.awards.programs()) == address(e.programs), "award/program binding");
        require(address(e.awards.applications()) == address(e.applications), "award/application binding");
        require(e.programs.awardRegistry() == address(e.awards), "award registry binding");
        require(e.milestones.governanceTimelock() == address(this), "milestone/timelock binding");
        require(address(e.milestones.authorization()) == address(e.authorization), "milestone/authorization binding");
        require(address(e.milestones.programs()) == address(e.programs), "milestone/program binding");
        require(address(e.milestones.awards()) == address(e.awards), "milestone/award binding");
        require(address(e.milestones.treasury()) == address(e.treasuryDisbursements), "milestone/treasury binding");
        require(address(e.router.programs()) == address(e.programs), "router/program binding");
        require(address(e.router.awards()) == address(e.awards), "router/award binding");
        require(address(e.router.milestones()) == address(e.milestones), "router/milestone binding");

        (bool secondBind,) =
            address(e.programs).call(abi.encodeWithSelector(e.programs.bindAwardRegistry.selector, address(0xBEEF)));
        require(!secondBind, "award registry rebound");
    }

    function testProtocolRegistryPublishesExactRouterAndRuntimeIdentity() public {
        Env memory e = _deploy();

        ProtocolRegistry.Service memory service = e.registry.getService(GRANTS_SERVICE_ID);
        require(service.implementation == address(e.router), "service implementation");
        require(service.codeHash == address(e.router).codehash, "service codehash");
        require(service.metadataHash == METADATA_HASH, "service metadata");
        require(service.version == 1 && service.active, "service lifecycle");

        ProtocolRegistry.RegistrationProfile memory profile = e.registry.getRegistrationProfile(GRANTS_SERVICE_ID, 1);
        require(profile.componentType == ProtocolRegistry.ComponentType.SERVICE, "component type");
        require(profile.manifestHash == MANIFEST_HASH, "manifest hash");
        require(profile.dependencyRoot == e.dependencyRoot, "dependency root");
        require(profile.interfaceHash == INTERFACE_HASH, "interface hash");

        (address resolved, uint32 version) = e.registry.resolveActive(GRANTS_SERVICE_ID);
        require(resolved == address(e.router) && version == 1, "active resolution");

        Types420.ContractRef memory component = e.registry.component(GrantIds420.COMPONENT_GRANTS);
        require(component.implementation == address(e.router), "component implementation");
        require(component.runtimeCodeHash == address(e.router).codehash, "component codehash");
        require(component.lifecycle == Types420.Lifecycle.ACTIVE, "component lifecycle");
    }

    function testWrongRouterBindingIsVisible() public {
        Env memory e = _deploy();
        GrantRouter420 wrong = new GrantRouter420(address(e.programs), address(e.awards), address(e.milestones));
        require(address(wrong) != address(e.router), "wrong router unexpectedly same");

        ProtocolRegistry.Service memory service = e.registry.getService(GRANTS_SERVICE_ID);
        require(service.implementation != address(wrong), "registry accepted wrong router");
        require(service.codeHash == address(e.router).codehash, "registered codehash drift");
    }
}
