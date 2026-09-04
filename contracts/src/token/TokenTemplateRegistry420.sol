// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "../system/SystemAccess.sol";
import "./TokenIds420.sol";

contract TokenTemplateRegistry420 is I420System, SystemAccess {
    struct Template { uint32 version; bytes32 standard; bytes32 profileHash; bool enabled; bool exists; }
    mapping(bytes32 => Template) private _templates;
    error UnknownTemplate();
    event TemplateStatus(bytes32 indexed templateId, bool enabled);

    constructor(address timelock_) SystemAccess(timelock_) {
        _add(TokenIds420.ERC20_FIXED, "ERC20", keccak256("ERC20_FIXED_SUPPLY_V1"));
        _add(TokenIds420.ERC20_MINTABLE, "ERC20", keccak256("ERC20_OWNER_MINTABLE_V1"));
        _add(TokenIds420.ERC20_CAPPED, "ERC20", keccak256("ERC20_OWNER_MINTABLE_CAPPED_V1"));
        _add(TokenIds420.ERC20_BURNABLE, "ERC20", keccak256("ERC20_FIXED_BURNABLE_V1"));
        _add(TokenIds420.ERC20_PERMIT, "ERC20", keccak256("ERC20_FIXED_EIP2612_PERMIT_V1"));
        _add(TokenIds420.ERC20_VOTES, "ERC20", keccak256("ERC20_FIXED_PERMIT_VOTES_CHECKPOINTS_V1"));
        _add(TokenIds420.ERC721_COLLECTION, "ERC721", keccak256("ERC721_OWNER_MINTABLE_COLLECTION_V1"));
        _add(TokenIds420.ERC1155_MULTI, "ERC1155", keccak256("ERC1155_OWNER_MINTABLE_MULTI_V1"));
    }

    function _add(bytes32 id, bytes32 standard, bytes32 profileHash) private { _templates[id] = Template(1, standard, profileHash, true, true); }
    function setEnabled(bytes32 id, bool enabled_) external onlyGovernance { if (!_templates[id].exists) revert UnknownTemplate(); _templates[id].enabled = enabled_; emit TemplateStatus(id, enabled_); }
    function template(bytes32 id) external view returns (Template memory) { Template memory t = _templates[id]; if (!t.exists) revert UnknownTemplate(); return t; }
    function enabled(bytes32 id) external view returns (bool) { return _templates[id].exists && _templates[id].enabled; }
    function systemName() external pure returns (string memory) { return "420TokenTemplateRegistry"; }
    function protocolVersion() external pure returns (uint32) { return 1; }
}
