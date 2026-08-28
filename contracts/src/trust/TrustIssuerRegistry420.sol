// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../system/SystemAccess.sol";
import "../interfaces/I420System.sol";

contract TrustIssuerRegistry420 is SystemAccess, I420System {
    struct Issuer {
        address operator;
        bytes32 metadataHash;
        uint32 epoch;
        bool active;
        bool exists;
    }

    mapping(bytes32 => Issuer) private _issuers;

    error InvalidIssuerId();
    error InvalidOperator();
    error IssuerNotFound();

    event IssuerConfigured(
        bytes32 indexed issuerId,
        address indexed operator,
        bytes32 metadataHash,
        uint32 epoch,
        bool active
    );

    constructor(address timelock_) SystemAccess(timelock_) {}

    function systemName() external pure returns (string memory) { return "TrustIssuerRegistry420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function setIssuer(bytes32 issuerId, address operator, bytes32 metadataHash, bool active)
        external
        onlyGovernance
    {
        if (issuerId == bytes32(0)) revert InvalidIssuerId();
        if (operator == address(0)) revert InvalidOperator();

        Issuer storage issuer = _issuers[issuerId];
        uint32 epoch = issuer.exists ? issuer.epoch : 0;
        if (!issuer.exists || issuer.operator != operator || issuer.active != active) {
            epoch += 1;
        }

        issuer.operator = operator;
        issuer.metadataHash = metadataHash;
        issuer.epoch = epoch;
        issuer.active = active;
        issuer.exists = true;

        emit IssuerConfigured(issuerId, operator, metadataHash, epoch, active);
    }

    function getIssuer(bytes32 issuerId) external view returns (Issuer memory issuer) {
        issuer = _issuers[issuerId];
        if (!issuer.exists) revert IssuerNotFound();
    }

    function isAuthorized(bytes32 issuerId, address operator) external view returns (bool) {
        Issuer storage issuer = _issuers[issuerId];
        return issuer.exists && issuer.active && issuer.operator == operator;
    }

    function isOperator(bytes32 issuerId, address operator) external view returns (bool) {
        Issuer storage issuer = _issuers[issuerId];
        return issuer.exists && issuer.operator == operator;
    }

    function issuerEpoch(bytes32 issuerId) external view returns (uint32) {
        Issuer storage issuer = _issuers[issuerId];
        if (!issuer.exists) revert IssuerNotFound();
        return issuer.epoch;
    }
}
