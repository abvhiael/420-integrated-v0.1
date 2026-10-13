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
        emit TemplateRegistered(id, version, rulesHash, entitlementScope);
    }
}
