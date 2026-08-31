// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../../interfaces/genesis/ICapabilityRegistry420.sol";

/// @dev Local-development capability registry only. Never deploy to a promoted shared network.
contract DiceLocalCapabilityRegistry420 is ICapabilityRegistry420 {
    address public immutable owner;
    mapping(bytes32 => CapabilityGrant) private _grants;
    mapping(bytes32 => bool) private _allowed;

    error NotOwner();

    constructor(address owner_) {
        owner = owner_;
    }

    function setAllowed(address principal, bytes32 componentId, bytes32 capabilityId, bytes32 scopeHash, bool value) external {
        if (msg.sender != owner) revert NotOwner();
        _allowed[keccak256(abi.encode(principal, componentId, capabilityId, scopeHash))] = value;
    }

    function grant(bytes32 grantId) external view returns (CapabilityGrant memory) {
        return _grants[grantId];
    }

    function isAuthorized(address principal, bytes32 componentId, bytes32 capabilityId, bytes32 scopeHash, uint256)
        external view returns (bool)
    {
        return _allowed[keccak256(abi.encode(principal, componentId, capabilityId, scopeHash))];
    }
}

/// @dev Minimal local ERC-20-like stake token used only by the local Dice harness.
contract DiceLocalToken420 {
    string public constant name = "Local 420Bet Test Asset";
    string public constant symbol = "L420";
    uint8 public constant decimals = 18;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        if (balanceOf[msg.sender] < amount) return false;
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        if (balanceOf[from] < amount || allowance[from][msg.sender] < amount) return false;
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}
