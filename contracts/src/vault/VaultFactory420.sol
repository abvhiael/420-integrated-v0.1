// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./AssetVault420.sol";

contract VaultFactory420 is I420System {
    address public immutable registry;
    address public immutable authorization;
    address public immutable accounting;

    error ZeroAddress();
    event VaultDeployed(bytes32 indexed vaultId,address indexed vaultAddress,address indexed requester);

    constructor(address registry_,address authorization_,address accounting_){ if(registry_==address(0)||authorization_==address(0)||accounting_==address(0)) revert ZeroAddress(); registry=registry_; authorization=authorization_; accounting=accounting_; }
    function systemName() external pure returns(string memory){return "VaultFactory420";} function protocolVersion() external pure returns(uint32){return 1;}

    function deployVault(bytes32 vaultId,bytes32 salt) external returns(address vaultAddress){
        AssetVault420 vault=new AssetVault420{salt:keccak256(abi.encode(msg.sender,vaultId,salt))}(vaultId,registry,authorization,accounting);
        vaultAddress=address(vault);
        emit VaultDeployed(vaultId,vaultAddress,msg.sender);
    }
}