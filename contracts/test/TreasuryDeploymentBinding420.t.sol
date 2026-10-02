// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/apps/ProtocolRegistry.sol";
import "../src/interfaces/genesis/Types420.sol";
import "../src/system/CapabilityRegistry420.sol";
import "../src/treasury/TreasuryIds420.sol";
import "../src/treasury/TreasuryAuthorization420.sol";
import "../src/treasury/TreasuryPolicyRegistry420.sol";
import "../src/treasury/TreasuryBudgetRegistry420.sol";
import "../src/treasury/TreasuryDisbursementRegistry420.sol";
import "../src/treasury/TreasuryRouter420.sol";

contract TreasuryDeploymentBinding420Test {
    bytes32 internal constant TREASURY_SERVICE_ID = keccak256("420/service/treasury/v1");
    bytes32 internal constant TREASURY_ROUTER_COMPONENT_ID =
        keccak256("420/APP/420TREASURY/TREASURY_ROUTER");
    bytes32 internal constant METADATA_HASH =
        keccak256("420/TREASURY/RELEASE/METADATA/V1");
    bytes32 internal constant MANIFEST_HASH =
        keccak256("420/TREASURY/AUDIT-6/RELEASE-MATERIALIZATION/V1");
    bytes32 internal constant INTERFACE_HASH =
        keccak256("420/TREASURY/TREASURY_ROUTER/INTERFACE/V1");

    event DeploymentAddress(string name, address implementation);
    event RuntimeCodeHash(string name, bytes32 codeHash);
    event ReleaseCommitment(string name, bytes32 value);

    struct Env {
        CapabilityRegistry420 caps;
        ProtocolRegistry registry;
        TreasuryAuthorization420 authorization;
        TreasuryPolicyRegistry420 policy;
        TreasuryBudgetRegistry420 budgets;
        TreasuryDisbursementRegistry420 disbursements;
        TreasuryRouter420 router;
        bytes32 dependencyRoot;
    }

    function _deploy() internal returns (Env memory e) {
        // Repository-local qualification uses this test contract as the
        // governance/timelock actor. Production uses frozen GovernanceTimelock
        // 0x0000000000000000000000000000000000000429.
        e.caps = new CapabilityRegistry420();
        e.registry = new ProtocolRegistry(address(this));

        e.authorization = new TreasuryAuthorization420(address(e.caps));
        e.policy = new TreasuryPolicyRegistry420(address(this));
        e.budgets = new TreasuryBudgetRegistry420(address(this), address(e.policy));
        e.disbursements = new TreasuryDisbursementRegistry420(
            address(this),
            address(e.authorization),
            address(e.policy),
            address(e.budgets)
        );
        e.budgets.setController(address(e.disbursements));
        e.router = new TreasuryRouter420(address(e.budgets), address(e.disbursements));

        e.caps.registerProtocolComponent(TreasuryIds420.COMPONENT_TREASURY, address(this));

        e.dependencyRoot = keccak256(
            abi.encode(
                address(e.caps),
                address(e.authorization),
                address(e.policy),
                address(e.budgets),
                address(e.disbursements),
                address(e.router),
                address(e.authorization).codehash,
                address(e.policy).codehash,
                address(e.budgets).codehash,
                address(e.disbursements).codehash,
                address(e.router).codehash
            )
        );

        e.registry.registerComponent(
            TREASURY_ROUTER_COMPONENT_ID,
            address(e.router),
            Types420.Version({major: 1, minor: 0, patch: 0}),
            Types420.Lifecycle.ACTIVE
        );
        e.registry.publishRegisteredService(
            TREASURY_SERVICE_ID,
            address(e.router),
            METADATA_HASH,
            1,
            true,
            ProtocolRegistry.ComponentType.SERVICE,
            MANIFEST_HASH,
            e.dependencyRoot,
            INTERFACE_HASH
        );

        emit DeploymentAddress("CapabilityRegistry420", address(e.caps));
        emit DeploymentAddress("TreasuryAuthorization420", address(e.authorization));
        emit DeploymentAddress("TreasuryPolicyRegistry420", address(e.policy));
        emit DeploymentAddress("TreasuryBudgetRegistry420", address(e.budgets));
        emit DeploymentAddress("TreasuryDisbursementRegistry420", address(e.disbursements));
        emit DeploymentAddress("TreasuryRouter420", address(e.router));

        emit RuntimeCodeHash("TreasuryAuthorization420", address(e.authorization).codehash);
        emit RuntimeCodeHash("TreasuryPolicyRegistry420", address(e.policy).codehash);
        emit RuntimeCodeHash("TreasuryBudgetRegistry420", address(e.budgets).codehash);
        emit RuntimeCodeHash("TreasuryDisbursementRegistry420", address(e.disbursements).codehash);
        emit RuntimeCodeHash("TreasuryRouter420", address(e.router).codehash);
        emit ReleaseCommitment("dependencyRoot", e.dependencyRoot);
        emit ReleaseCommitment("manifestHash", MANIFEST_HASH);
        emit ReleaseCommitment("interfaceHash", INTERFACE_HASH);
    }

    function testDeploymentOrderAndConstructorBindings() public {
        Env memory e = _deploy();

        require(address(e.authorization.capabilityRegistry()) == address(e.caps), "authorization/capability binding");
        require(e.policy.governanceTimelock() == address(this), "policy/timelock binding");
        require(e.budgets.governanceTimelock() == address(this), "budget/timelock binding");
        require(address(e.budgets.policy()) == address(e.policy), "budget/policy binding");
        require(e.disbursements.governanceTimelock() == address(this), "disbursement/timelock binding");
        require(address(e.disbursements.authorization()) == address(e.authorization), "disbursement/authorization binding");
        require(address(e.disbursements.policy()) == address(e.policy), "disbursement/policy binding");
        require(address(e.disbursements.budgets()) == address(e.budgets), "disbursement/budget binding");
        require(e.budgets.controller() == address(e.disbursements), "budget controller binding");
        require(address(e.router.budgets()) == address(e.budgets), "router/budget binding");
        require(address(e.router.disbursements()) == address(e.disbursements), "router/disbursement binding");

        (bool secondController,) = address(e.budgets).call(
            abi.encodeWithSelector(e.budgets.setController.selector, address(0xBEEF))
        );
        require(!secondController, "budget controller changed twice");
    }

    function testProtocolRegistryPublishesExactRouterAndRuntimeIdentity() public {
        Env memory e = _deploy();

        ProtocolRegistry.Service memory service = e.registry.getService(TREASURY_SERVICE_ID);
        require(service.implementation == address(e.router), "service implementation");
        require(service.codeHash == address(e.router).codehash, "service codehash");
        require(service.metadataHash == METADATA_HASH, "service metadata");
        require(service.version == 1 && service.active, "service lifecycle");

        ProtocolRegistry.RegistrationProfile memory profile =
            e.registry.getRegistrationProfile(TREASURY_SERVICE_ID, 1);
        require(profile.componentType == ProtocolRegistry.ComponentType.SERVICE, "component type");
        require(profile.manifestHash == MANIFEST_HASH, "manifest hash");
        require(profile.dependencyRoot == e.dependencyRoot, "dependency root");
        require(profile.interfaceHash == INTERFACE_HASH, "interface hash");

        (address resolved, uint32 version) = e.registry.resolveActive(TREASURY_SERVICE_ID);
        require(resolved == address(e.router) && version == 1, "active resolution");

        Types420.ContractRef memory component = e.registry.component(TREASURY_ROUTER_COMPONENT_ID);
        require(component.implementation == address(e.router), "component implementation");
        require(component.runtimeCodeHash == address(e.router).codehash, "component codehash");
        require(component.lifecycle == Types420.Lifecycle.ACTIVE, "component lifecycle");
    }

    function testCapabilityComponentAndExecutionPathUseExactDeployedGraph() public {
        Env memory e = _deploy();
        address asset = address(0x420);
        address recipient = address(0xB0B);
        address executor = address(0xE);

        e.policy.setAssetPolicy(asset, true, 1000, 1500, 100);
        bytes32 budgetId = keccak256("audit6-budget");
        bytes32 civicAction = keccak256("audit6-civic");
        e.budgets.createBudget(
            budgetId,
            keccak256("treasury-vault"),
            TreasuryIds420.BUDGET_DEVELOPMENT,
            asset,
            2000,
            uint64(block.timestamp),
            uint64(block.timestamp + 1000),
            civicAction,
            keccak256("audit6-meta")
        );

        uint64 notBefore = uint64(block.timestamp);
        uint64 expiresAt = uint64(block.timestamp + 100);
        bytes32 purpose = keccak256("audit6-purpose");
        bytes32 disbursementId =
            e.disbursements.canonicalId(budgetId, recipient, 500, notBefore, expiresAt, civicAction, purpose);
        e.disbursements.schedule(
            disbursementId, budgetId, recipient, 500, notBefore, expiresAt, civicAction, purpose
        );

        bytes32 scope = e.authorization.scopeForDisbursement(disbursementId);
        e.caps.createGrant(
            keccak256("audit6-grant"),
            executor,
            TreasuryIds420.COMPONENT_TREASURY,
            TreasuryIds420.ACTION_EXECUTE_DISBURSEMENT,
            scope,
            500,
            0,
            0,
            0,
            0
        );

        require(
            e.authorization.isDisbursementAuthorized(
                executor,
                disbursementId,
                TreasuryIds420.ACTION_EXECUTE_DISBURSEMENT,
                500
            ),
            "real capability graph not authorized"
        );
    }

    function testWrongRouterBindingIsVisible() public {
        Env memory e = _deploy();
        TreasuryRouter420 wrong = new TreasuryRouter420(address(e.budgets), address(e.disbursements));
        require(address(wrong) != address(e.router), "wrong router unexpectedly same");
        ProtocolRegistry.Service memory service = e.registry.getService(TREASURY_SERVICE_ID);
        require(service.implementation != address(wrong), "registry accepted wrong router");
        require(service.codeHash == address(e.router).codehash, "registered codehash drift");
    }
}
