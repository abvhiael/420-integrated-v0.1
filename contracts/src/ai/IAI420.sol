// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
interface IAI420 {
    function componentGraphHash() external view returns(bytes32);
    function providerRegistry() external view returns(address); function modelRegistry() external view returns(address);
    function jobManager() external view returns(address); function authorization() external view returns(address);
    function policyRegistry() external view returns(address); function deploymentRegistry() external view returns(address);
    function requestRegistry() external view returns(address); function resultRegistry() external view returns(address);
    function computeAdapter() external view returns(address);
    function canUseDeployment(bytes32 deploymentId) external view returns(bool);
    function isProviderOperational(bytes32 providerId) external view returns(bool);
    function isModelVersionOperational(bytes32 modelVersionId) external view returns(bool);
}
