// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/apps/ProtocolRegistry.sol";
import "../src/interfaces/genesis/Types420.sol";
import "../src/token/TokenIds420.sol";
import "../src/token/TokenTemplateRegistry420.sol";
import "../src/token/TokenFactory420.sol";

contract TokenDeploymentTreasury420 {
    bytes32 public immutable vaultId = TokenIds420.COMMUNITY_TOKEN_REVENUE_VAULT;
    uint256 public totalDeposited;

    function depositNative() external payable {
        totalDeposited += msg.value;
    }
}

contract TokenDeploymentBinding420Test {
    bytes32 constant SID = keccak256("420/service/token/v1");
    bytes32 constant METADATA_HASH = keccak256("420/TOKEN/RELEASE/METADATA/V1");
    bytes32 constant MANIFEST_HASH = keccak256("420/TOKEN/AUDIT-4/RELEASE-MATERIALIZATION/V1");
    bytes32 constant INTERFACE_HASH = keccak256("420/TOKEN/FACTORY/INTERFACE/V1");

    function testRegistryResolvedDeploymentAndPublication() public {
        ProtocolRegistry protocolRegistry = new ProtocolRegistry(address(this));
        TokenTemplateRegistry420 templates = new TokenTemplateRegistry420(address(this));
        TokenDeploymentTreasury420 vault = new TokenDeploymentTreasury420();
        TokenFactory420 factory = new TokenFactory420(address(templates), address(vault));

        bytes32 dependencyRoot = keccak256(
            abi.encode(
                address(templates),
                address(vault),
                address(templates).codehash,
                address(vault).codehash,
                TokenIds420.COMMUNITY_TOKEN_REVENUE_VAULT
            )
        );

        protocolRegistry.registerComponent(
            TokenIds420.COMPONENT_TOKEN,
            address(factory),
            Types420.Version({ major: 1, minor: 0, patch: 0 }),
            Types420.Lifecycle.ACTIVE
        );
        protocolRegistry.publishRegisteredService(
            SID,
            address(factory),
            METADATA_HASH,
            1,
            true,
            ProtocolRegistry.ComponentType.SERVICE,
            MANIFEST_HASH,
            dependencyRoot,
            INTERFACE_HASH
        );

        require(templates.governanceTimelock() == address(this), "template governance");
        require(address(factory.templates()) == address(templates), "template binding");
        require(address(factory.communityTreasuryVault()) == address(vault), "vault binding");

        ProtocolRegistry.Service memory service = protocolRegistry.getService(SID);
        require(service.implementation == address(factory), "service implementation");
        require(service.codeHash == address(factory).codehash, "service code hash");
        ProtocolRegistry.RegistrationProfile memory profile = protocolRegistry.getRegistrationProfile(SID, 1);
        require(profile.dependencyRoot == dependencyRoot, "dependency root");
        require(profile.manifestHash == MANIFEST_HASH && profile.interfaceHash == INTERFACE_HASH, "release commitments");

        (address resolved, uint32 version) = protocolRegistry.resolveActive(SID);
        require(resolved == address(factory) && version == 1, "active resolution");
    }
}
