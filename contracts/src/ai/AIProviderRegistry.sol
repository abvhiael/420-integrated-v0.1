
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../system/SystemAccess.sol";
import "../interfaces/I420System.sol";

contract AIProviderRegistry is SystemAccess, I420System {
    struct Provider {
        address owner;
        bytes32 metadataHash;
        uint256 bond;
        bool active;
    }

    mapping(bytes32 => Provider) public providers;

    event ProviderRegistered(bytes32 indexed providerId, address indexed owner, bytes32 metadataHash);
    event ProviderStatus(bytes32 indexed providerId, bool active);

    constructor(address timelock_) SystemAccess(timelock_) {}

    function systemName() external pure returns (string memory) { return "AIProviderRegistry"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function register(bytes32 providerId, address owner, bytes32 metadataHash, uint256 bond)
        external
        onlyGovernance
    {
        require(providerId != bytes32(0) && owner != address(0), "invalid");
        require(providers[providerId].owner == address(0), "exists");
        providers[providerId] = Provider(owner, metadataHash, bond, true);
        emit ProviderRegistered(providerId, owner, metadataHash);
    }

    function setActive(bytes32 providerId, bool active) external onlyGovernance {
        require(providers[providerId].owner != address(0), "unknown");
        providers[providerId].active = active;
        emit ProviderStatus(providerId, active);
    }
}
