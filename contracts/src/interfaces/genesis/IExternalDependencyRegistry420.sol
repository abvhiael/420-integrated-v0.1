// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./Types420.sol";

interface IExternalDependencyRegistry420 {
    struct Dependency {
        bytes32 dependencyId;
        uint256 chainId;
        address endpoint;
        bytes32 codeHash;
        bytes32 configurationHash;
        Types420.Lifecycle lifecycle;
    }

    function dependency(bytes32 dependencyId) external view returns(Dependency memory);
    function isUsable(bytes32 dependencyId) external view returns(bool);
}
