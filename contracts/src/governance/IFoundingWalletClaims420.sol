// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

interface IFoundingWalletClaims420 {
    function administrator() external view returns (address);
    function andrew() external view returns (address);
    function janet() external view returns (address);
    function genesisPlanCommitment() external view returns (bytes32);
    function claimed(address founder) external view returns (bool);
    function allFoundersClaimed() external view returns (bool);
}
