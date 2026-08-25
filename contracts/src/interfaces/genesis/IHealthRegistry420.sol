// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./Types420.sol";
interface IHealthRegistry420 {
    event HealthChanged(bytes32 indexed subjectId,Types420.Health health,bytes32 evidenceHash,uint64 observedAt);
    function health(bytes32 subjectId) external view returns (Types420.Health);
    function isHealthy(bytes32 subjectId) external view returns (bool);
    function observedAt(bytes32 subjectId) external view returns (uint64);
}
