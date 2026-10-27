// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @notice Immutable verified FLOWER exhibition template; no wallet/stat multiplier.
contract CompetitionTemplateRegistry {
    error Invalid();
    error Unauthorized();
    address public immutable registrar = msg.sender;

    struct Template {
        bytes32 rulesHash;
        bytes32 entitlementScope;
        uint32 version;
        bool exists;
    }
    mapping(bytes32 => Template) public templates;
    mapping(bytes32 => bytes32) public categoryOf;
    mapping(bytes32 => mapping(uint32 => bytes32)) public categoryVersionTemplate;
    event CategoryVersionRegistered(bytes32 indexed category, uint32 indexed version, bytes32 indexed templateId);
    event TemplateRegistered(bytes32 indexed id, uint32 version, bytes32 rulesHash, bytes32 entitlementScope);

    function register(
        bytes32 id,
        uint32 version,
        bytes32 rulesHash,
        bytes32 entitlementScope
    ) external {
        if (msg.sender != registrar) revert Unauthorized();
        if (id == bytes32(0) || rulesHash == bytes32(0) || version != 1 || templates[id].exists) revert Invalid();
        templates[id] = Template(rulesHash, entitlementScope, version, true);
        categoryOf[id] = id;
        categoryVersionTemplate[id][version] = id;
        emit TemplateRegistered(id, version, rulesHash, entitlementScope);
    }
    /// @notice New revisions receive fresh immutable IDs; existing events retain their policy.
    function registerCategoryVersion(
        bytes32 id,
        bytes32 category,
        uint32 version,
        bytes32 rulesHash,
        bytes32 entitlementScope
    ) external {
        if (msg.sender != registrar) revert Unauthorized();
        if (id == bytes32(0) || category == bytes32(0) || rulesHash == bytes32(0) || version == 0
            || templates[id].exists || categoryVersionTemplate[category][version] != bytes32(0)) revert Invalid();
        templates[id] = Template(rulesHash, entitlementScope, version, true);
        categoryOf[id] = category;
        categoryVersionTemplate[category][version] = id;
        emit TemplateRegistered(id, version, rulesHash, entitlementScope);
        emit CategoryVersionRegistered(category, version, id);
    }
}
