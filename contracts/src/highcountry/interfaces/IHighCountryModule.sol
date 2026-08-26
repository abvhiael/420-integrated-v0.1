// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

interface IHighCountryModule {
    function moduleId() external pure returns (bytes32);
    function moduleVersion() external pure returns (uint32);
}
