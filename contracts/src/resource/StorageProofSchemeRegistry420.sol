// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./ResourceAuthorization420.sol";
import "./StorageProofIds420.sol";

contract StorageProofSchemeRegistry420 is I420System {
    struct Scheme { address verifier; bytes32 proofClass; bytes32 specHash; uint64 maxProofDelay; bool active; bool exists; }
    ResourceAuthorization420 public immutable authorization;
    mapping(bytes32 => Scheme) private _schemes;
    error ZeroAddress(); error InvalidScheme(); error SchemeExists(); error SchemeNotFound(); error Unauthorized(); error NoChange();
    event StorageProofSchemeRegistered(bytes32 indexed proofSchemeId, address indexed verifier, bytes32 indexed proofClass, bytes32 specHash, uint64 maxProofDelay);
    event StorageProofSchemeStateChanged(bytes32 indexed proofSchemeId, bool active);
    constructor(address authorization_) { if (authorization_ == address(0)) revert ZeroAddress(); authorization = ResourceAuthorization420(authorization_); }
    function systemName() external pure returns (string memory) { return "StorageProofSchemeRegistry420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }
    function registerScheme(bytes32 proofSchemeId, address verifier, bytes32 proofClass, bytes32 specHash, uint64 maxProofDelay) external {
        if (proofSchemeId == bytes32(0) || verifier == address(0) || specHash == bytes32(0) || maxProofDelay == 0 || !StorageProofIds420.validProofClass(proofClass)) revert InvalidScheme();
        if (_schemes[proofSchemeId].exists) revert SchemeExists();
        if (!authorization.isProofSchemeAuthorized(msg.sender, proofSchemeId, StorageProofIds420.ACTION_REGISTER_PROOF_SCHEME)) revert Unauthorized();
        _schemes[proofSchemeId] = Scheme(verifier, proofClass, specHash, maxProofDelay, true, true);
        emit StorageProofSchemeRegistered(proofSchemeId, verifier, proofClass, specHash, maxProofDelay);
    }
    function setSchemeActive(bytes32 proofSchemeId, bool active) external {
        Scheme storage scheme = _get(proofSchemeId);
        if (scheme.active == active) revert NoChange();
        if (!authorization.isProofSchemeAuthorized(msg.sender, proofSchemeId, StorageProofIds420.ACTION_SET_PROOF_SCHEME_STATE)) revert Unauthorized();
        scheme.active = active;
        emit StorageProofSchemeStateChanged(proofSchemeId, active);
    }
    function getScheme(bytes32 proofSchemeId) external view returns (Scheme memory) { return _get(proofSchemeId); }
    function isActive(bytes32 proofSchemeId) external view returns (bool) { return _schemes[proofSchemeId].exists && _schemes[proofSchemeId].active; }
    function _get(bytes32 proofSchemeId) private view returns (Scheme storage scheme) { scheme = _schemes[proofSchemeId]; if (!scheme.exists) revert SchemeNotFound(); }
}
