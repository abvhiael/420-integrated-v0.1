// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/apps/ProtocolRegistry.sol";
import "../src/interfaces/genesis/Types420.sol";
import "../src/system/CapabilityRegistry420.sol";
import "../src/rights/RightsIds420.sol";
import "../src/rights/RightsAuthorization420.sol";
import "../src/rights/RightsPolicyRegistry420.sol";
import "../src/rights/RightsAssetRegistry420.sol";
import "../src/rights/RightsClaimRegistry420.sol";
import "../src/rights/RightsLicenseRegistry420.sol";
import "../src/rights/RightsRouter420.sol";

contract RightsDeploymentBinding420Test {
    bytes32 internal constant RIGHTS_SERVICE_ID = keccak256("420/service/rights/v1");
    bytes32 internal constant METADATA_HASH = keccak256("420/RIGHTS/RELEASE/METADATA/LOCAL-QUALIFICATION/V1");
    bytes32 internal constant MANIFEST_HASH = keccak256("420/RIGHTS/AUDIT-4/RELEASE-MATERIALIZATION/V1");
    bytes32 internal constant INTERFACE_HASH = keccak256("420/RIGHTS/RIGHTS_ROUTER/INTERFACE/V1");

    event DeploymentAddress(string name, address implementation);
    event RuntimeCodeHash(string name, bytes32 codeHash);
    event ReleaseCommitment(string name, bytes32 value);

    struct Env {
        CapabilityRegistry420 caps;
        ProtocolRegistry registry;
        RightsAuthorization420 authorization;
        RightsPolicyRegistry420 policy;
        RightsAssetRegistry420 assets;
        RightsClaimRegistry420 claims;
        RightsLicenseRegistry420 licenses;
        RightsRouter420 router;
        bytes32 dependencyRoot;
    }

    function _deploy() internal returns (Env memory e) {
        e.caps = new CapabilityRegistry420();
        e.registry = new ProtocolRegistry(address(this));
        e.authorization = new RightsAuthorization420(address(e.caps));
        e.policy = new RightsPolicyRegistry420(address(this));
        e.assets = new RightsAssetRegistry420(address(e.authorization));
        e.claims = new RightsClaimRegistry420(address(e.authorization), address(e.assets), address(e.policy));
        e.licenses = new RightsLicenseRegistry420(address(e.authorization), address(e.claims));
        e.router = new RightsRouter420(address(e.claims), address(e.licenses));

        e.dependencyRoot = keccak256(
            abi.encode(
                address(e.caps),
                address(e.authorization),
                address(e.policy),
                address(e.assets),
                address(e.claims),
                address(e.licenses),
                address(e.router),
                address(e.authorization).codehash,
                address(e.policy).codehash,
                address(e.assets).codehash,
                address(e.claims).codehash,
                address(e.licenses).codehash,
                address(e.router).codehash
            )
        );

        e.registry.registerComponent(
            RightsIds420.COMPONENT_RIGHTS,
            address(e.router),
            Types420.Version({major: 1, minor: 0, patch: 0}),
            Types420.Lifecycle.ACTIVE
        );
        e.registry.publishRegisteredService(
            RIGHTS_SERVICE_ID,
            address(e.router),
            METADATA_HASH,
            1,
            true,
            ProtocolRegistry.ComponentType.SERVICE,
            MANIFEST_HASH,
            e.dependencyRoot,
            INTERFACE_HASH
        );

        emit DeploymentAddress("RightsAuthorization420", address(e.authorization));
        emit DeploymentAddress("RightsPolicyRegistry420", address(e.policy));
        emit DeploymentAddress("RightsAssetRegistry420", address(e.assets));
        emit DeploymentAddress("RightsClaimRegistry420", address(e.claims));
        emit DeploymentAddress("RightsLicenseRegistry420", address(e.licenses));
        emit DeploymentAddress("RightsRouter420", address(e.router));
        emit RuntimeCodeHash("RightsAuthorization420", address(e.authorization).codehash);
        emit RuntimeCodeHash("RightsPolicyRegistry420", address(e.policy).codehash);
        emit RuntimeCodeHash("RightsAssetRegistry420", address(e.assets).codehash);
        emit RuntimeCodeHash("RightsClaimRegistry420", address(e.claims).codehash);
        emit RuntimeCodeHash("RightsLicenseRegistry420", address(e.licenses).codehash);
        emit RuntimeCodeHash("RightsRouter420", address(e.router).codehash);
        emit ReleaseCommitment("dependencyRoot", e.dependencyRoot);
        emit ReleaseCommitment("manifestHash", MANIFEST_HASH);
        emit ReleaseCommitment("interfaceHash", INTERFACE_HASH);
    }

    function _configureAllClasses(RightsPolicyRegistry420 policy) internal {
        policy.setRightClass(RightsIds420.RIGHT_COPYRIGHT, keccak256("LOCAL/COPYRIGHT"), true);
        policy.setRightClass(RightsIds420.RIGHT_TRADEMARK, keccak256("LOCAL/TRADEMARK"), true);
        policy.setRightClass(RightsIds420.RIGHT_PATENT, keccak256("LOCAL/PATENT"), true);
        policy.setRightClass(RightsIds420.RIGHT_PERSONALITY, keccak256("LOCAL/PERSONALITY"), true);
        policy.setRightClass(RightsIds420.RIGHT_GENETIC, keccak256("LOCAL/GENETIC"), true);
        policy.setRightClass(RightsIds420.RIGHT_DATA, keccak256("LOCAL/DATA"), true);
        policy.setRightClass(RightsIds420.RIGHT_MODEL, keccak256("LOCAL/MODEL"), true);
        policy.setRightClass(RightsIds420.RIGHT_CONTRACTUAL, keccak256("LOCAL/CONTRACTUAL"), true);
    }

    function testDeploymentOrderAndConstructorBindings() public {
        Env memory e = _deploy();
        require(address(e.authorization.capabilityRegistry()) == address(e.caps), "authorization/capability");
        require(e.policy.governanceTimelock() == address(this), "policy/timelock");
        require(address(e.assets.authorization()) == address(e.authorization), "assets/authorization");
        require(address(e.claims.authorization()) == address(e.authorization), "claims/authorization");
        require(address(e.claims.assets()) == address(e.assets), "claims/assets");
        require(address(e.claims.policy()) == address(e.policy), "claims/policy");
        require(address(e.licenses.authorization()) == address(e.authorization), "licenses/authorization");
        require(address(e.licenses.claims()) == address(e.claims), "licenses/claims");
        require(address(e.router.claims()) == address(e.claims), "router/claims");
        require(address(e.router.licenses()) == address(e.licenses), "router/licenses");
    }

    function testGovernedEightClassMetadataCommitments() public {
        Env memory e = _deploy();
        _configureAllClasses(e.policy);
        bytes32[8] memory classes = [
            RightsIds420.RIGHT_COPYRIGHT,
            RightsIds420.RIGHT_TRADEMARK,
            RightsIds420.RIGHT_PATENT,
            RightsIds420.RIGHT_PERSONALITY,
            RightsIds420.RIGHT_GENETIC,
            RightsIds420.RIGHT_DATA,
            RightsIds420.RIGHT_MODEL,
            RightsIds420.RIGHT_CONTRACTUAL
        ];
        for (uint256 i; i < classes.length; ++i) {
            RightsPolicyRegistry420.RightClassPolicy memory p = e.policy.getRightClass(classes[i]);
            require(p.exists && p.active && p.metadataHash != bytes32(0) && p.revision == 1, "class commitment");
        }
    }

    function testProtocolRegistryPublicationSmokeAndRecovery() public {
        Env memory e = _deploy();
        ProtocolRegistry.Service memory service = e.registry.getService(RIGHTS_SERVICE_ID);
        require(service.implementation == address(e.router), "service implementation");
        require(service.codeHash == address(e.router).codehash, "service codehash");
        ProtocolRegistry.RegistrationProfile memory profile = e.registry.getRegistrationProfile(RIGHTS_SERVICE_ID, 1);
        require(profile.manifestHash == MANIFEST_HASH, "manifest");
        require(profile.interfaceHash == INTERFACE_HASH, "interface");
        require(profile.dependencyRoot == e.dependencyRoot, "dependencies");

        _configureAllClasses(e.policy);
        bytes32 subjectId = keccak256("LOCAL/SUBJECT");
        bytes32 rightId = keccak256("LOCAL/RIGHT");
        bytes32 scopeHash = keccak256("LOCAL/SCOPE");
        uint64 start = uint64(block.timestamp);
        uint64 end = start + 1000;
        address licensee = address(0xBEEF);

        e.assets.registerSubject(subjectId, keccak256("LOCAL/TYPE"), address(this), keccak256("LOCAL/META"), keccak256("LOCAL/PROVENANCE"));
        e.claims.declareClaim(
            rightId,
            subjectId,
            RightsIds420.RIGHT_COPYRIGHT,
            address(this),
            keccak256("LOCAL/JURISDICTION"),
            keccak256("LOCAL/EVIDENCE"),
            start,
            end
        );
        bytes32 licenseId = e.licenses.deriveLicenseId(
            rightId, licensee, scopeHash, keccak256("LOCAL/TERMS"), start, end, true
        );
        e.licenses.grantLicense(
            licenseId, rightId, licensee, scopeHash, keccak256("LOCAL/TERMS"), start, end, true
        );
        require(e.router.canUse(licenseId, licensee, scopeHash), "smoke use");

        e.registry.deprecateService(RIGHTS_SERVICE_ID);
        (bool staleOk,) = address(e.registry).call(abi.encodeWithSelector(e.registry.resolveActive.selector, RIGHTS_SERVICE_ID));
        require(!staleOk, "deprecated service resolved");

        e.registry.publishRegisteredService(
            RIGHTS_SERVICE_ID,
            address(e.router),
            METADATA_HASH,
            2,
            true,
            ProtocolRegistry.ComponentType.SERVICE,
            MANIFEST_HASH,
            e.dependencyRoot,
            INTERFACE_HASH
        );
        (address resolved, uint32 version) = e.registry.resolveActive(RIGHTS_SERVICE_ID);
        require(resolved == address(e.router) && version == 2, "recovery publication");
    }
}
