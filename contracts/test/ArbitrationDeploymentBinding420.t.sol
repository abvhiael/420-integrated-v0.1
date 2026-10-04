// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/apps/ProtocolRegistry.sol";
import "../src/interfaces/genesis/Types420.sol";
import "../src/arbitration/ArbitrationIds420.sol";
import "../src/arbitration/ArbitrationPolicyRegistry420.sol";
import "../src/arbitration/ArbitrationCaseRegistry420.sol";
import "../src/arbitration/ArbitrationRulingRegistry420.sol";
import "../src/arbitration/ArbitrationRouter420.sol";

contract ArbitrationDeploymentBinding420Test {
    bytes32 internal constant SID = keccak256("420/service/arbitration/v1");
    bytes32 internal constant DOMAIN = keccak256("420/arbitration/domain/local-qualification/v1");
    bytes32 internal constant METADATA_HASH = keccak256("420/ARBITRATION/RELEASE/METADATA/LOCAL-QUALIFICATION/V1");
    bytes32 internal constant MANIFEST_HASH = keccak256("420/ARBITRATION/AUDIT-4/RELEASE-MATERIALIZATION/V1");
    bytes32 internal constant INTERFACE_HASH = keccak256("420/ARBITRATION/ROUTER/INTERFACE/V1");

    struct Env {
        ProtocolRegistry registry;
        ArbitrationPolicyRegistry420 policies;
        ArbitrationCaseRegistry420 cases;
        ArbitrationRulingRegistry420 rulings;
        ArbitrationRouter420 router;
        bytes32 dependencyRoot;
    }

    function _deploy() internal returns (Env memory e) {
        e.registry = new ProtocolRegistry(address(this));
        e.policies = new ArbitrationPolicyRegistry420(address(this));
        e.cases = new ArbitrationCaseRegistry420(address(this), address(e.policies));
        e.rulings = new ArbitrationRulingRegistry420(address(e.cases));
        e.cases.bindRulingRegistry(address(e.rulings));
        e.router = new ArbitrationRouter420(address(e.policies), address(e.cases), address(e.rulings));

        e.dependencyRoot = keccak256(
            abi.encode(
                address(e.policies),
                address(e.cases),
                address(e.rulings),
                address(e.router),
                address(e.policies).codehash,
                address(e.cases).codehash,
                address(e.rulings).codehash,
                address(e.router).codehash
            )
        );

        e.registry.registerComponent(
            ArbitrationIds420.COMPONENT_ARBITRATION,
            address(e.router),
            Types420.Version({major: 1, minor: 0, patch: 0}),
            Types420.Lifecycle.ACTIVE
        );
        e.registry.publishRegisteredService(
            SID,
            address(e.router),
            METADATA_HASH,
            1,
            true,
            ProtocolRegistry.ComponentType.SERVICE,
            MANIFEST_HASH,
            e.dependencyRoot,
            INTERFACE_HASH
        );
    }

    function testDeploymentGraphAndRegistryPublication() public {
        Env memory e = _deploy();
        require(e.policies.governanceTimelock() == address(this), "policy/timelock");
        require(e.cases.governanceTimelock() == address(this), "case/timelock");
        require(address(e.cases.policies()) == address(e.policies), "case/policy");
        require(e.cases.rulingRegistry() == address(e.rulings), "case/ruling");
        require(address(e.rulings.cases()) == address(e.cases), "ruling/case");
        require(address(e.router.policies()) == address(e.policies), "router/policy");
        require(address(e.router.cases()) == address(e.cases), "router/case");
        require(address(e.router.rulings()) == address(e.rulings), "router/ruling");

        ProtocolRegistry.Service memory s = e.registry.getService(SID);
        require(s.implementation == address(e.router), "service implementation");
        require(s.codeHash == address(e.router).codehash, "service codehash");

        ProtocolRegistry.RegistrationProfile memory p = e.registry.getRegistrationProfile(SID, 1);
        require(p.componentType == ProtocolRegistry.ComponentType.SERVICE, "service type");
        require(p.manifestHash == MANIFEST_HASH, "manifest");
        require(p.interfaceHash == INTERFACE_HASH, "interface");
        require(p.dependencyRoot == e.dependencyRoot, "dependency root");

        (address resolved, uint32 version) = e.registry.resolveActive(SID);
        require(resolved == address(e.router) && version == 1, "active resolve");
    }

    function testRouterSmokeAndFailClosedRecovery() public {
        Env memory e = _deploy();
        e.policies.setPolicy(DOMAIN, address(this), address(this), 1 days, 1 days, 1, true);

        bytes32 caseId = e.cases.openCase(
            DOMAIN,
            address(0xBEEF),
            keccak256("420/component/local-origin/v1"),
            keccak256("LOCAL/OBJECT"),
            keccak256("LOCAL/CLAIM"),
            keccak256("LOCAL/REMEDY")
        );

        ArbitrationCaseRegistry420.CaseRecord memory c = e.router.getCase(caseId);
        require(c.claimant == address(this) && c.respondent == address(0xBEEF), "router case");

        e.rulings.submitRuling(caseId, 1, keccak256("LOCAL/RULING"), keccak256("LOCAL/REMEDY-RESULT"), bytes32(0));
        ArbitrationRulingRegistry420.Ruling memory r = e.router.getRuling(caseId, 0);
        require(r.exists && r.resolver == address(this), "router ruling");

        e.registry.deprecateService(SID);
        (bool ok,) = address(e.registry).call(abi.encodeWithSelector(e.registry.resolveActive.selector, SID));
        require(!ok, "deprecated resolved");

        e.registry.publishRegisteredService(
            SID,
            address(e.router),
            METADATA_HASH,
            2,
            true,
            ProtocolRegistry.ComponentType.SERVICE,
            MANIFEST_HASH,
            e.dependencyRoot,
            INTERFACE_HASH
        );
        (address recovered, uint32 version) = e.registry.resolveActive(SID);
        require(recovered == address(e.router) && version == 2, "recovery publication");
    }
}
