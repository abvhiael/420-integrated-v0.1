// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "../interfaces/genesis/ICapabilityRegistry420.sol";

/// @notice Read-only, fail-closed ComputeMarket capability checks. No custody or grant administration.
/// @dev Components must be separately registered by the shared CapabilityRegistry registrar;
///      this adapter does not register components, issue grants, consume allowances or verify signatures.
contract ComputeAuthorization420 is I420System {
    ICapabilityRegistry420 public immutable capabilityRegistry;

    bytes32 public constant COMPONENT_COMPUTE = keccak256("420/COMPUTE/COMPONENT/V1");
    bytes32 public constant ACTION_REGISTER_PROVIDER = keccak256("420/COMPUTE/ACTION/REGISTER_PROVIDER/V1");
    bytes32 public constant ACTION_MANAGE_NODE = keccak256("420/COMPUTE/ACTION/MANAGE_NODE/V1");
    bytes32 public constant ACTION_MANAGE_RESOURCE = keccak256("420/COMPUTE/ACTION/MANAGE_RESOURCE/V1");
    bytes32 public constant ACTION_PUBLISH_OFFER = keccak256("420/COMPUTE/ACTION/PUBLISH_OFFER/V1");
    bytes32 public constant ACTION_CREATE_REQUEST = keccak256("420/COMPUTE/ACTION/CREATE_REQUEST/V1");
    bytes32 public constant ACTION_AUTHORIZE_FUNDING = keccak256("420/COMPUTE/ACTION/AUTHORIZE_FUNDING/V1");
    bytes32 public constant ACTION_ACCEPT_MATCH = keccak256("420/COMPUTE/ACTION/ACCEPT_MATCH/V1");
    bytes32 public constant ACTION_EXECUTE_ATTEMPT = keccak256("420/COMPUTE/ACTION/EXECUTE_ATTEMPT/V1");
    bytes32 public constant ACTION_SUBMIT_RECEIPT = keccak256("420/COMPUTE/ACTION/SUBMIT_RECEIPT/V1");
    bytes32 public constant ACTION_VERIFY_RESULT = keccak256("420/COMPUTE/ACTION/VERIFY_RESULT/V1");
    bytes32 public constant ACTION_CHALLENGE = keccak256("420/COMPUTE/ACTION/CHALLENGE/V1");
    bytes32 public constant ACTION_SETTLE = keccak256("420/COMPUTE/ACTION/SETTLE/V1");

    bytes32 private constant _SCOPE_DOMAIN = keccak256("420/COMPUTE/CAPABILITY/SCOPE/V1");
    bytes32 private constant _PROVIDER = keccak256("420/COMPUTE/SCOPE/PROVIDER/V1");
    bytes32 private constant _NODE = keccak256("420/COMPUTE/SCOPE/NODE/V1");
    bytes32 private constant _RESOURCE = keccak256("420/COMPUTE/SCOPE/RESOURCE/V1");
    bytes32 private constant _REQUEST = keccak256("420/COMPUTE/SCOPE/REQUEST/V1");
    bytes32 private constant _MATCH = keccak256("420/COMPUTE/SCOPE/MATCH/V1");
    bytes32 private constant _ATTEMPT = keccak256("420/COMPUTE/SCOPE/ATTEMPT/V1");
    bytes32 private constant _JOB = keccak256("420/COMPUTE/SCOPE/JOB/V1");

    error InvalidRegistry();
    error InvalidScope();
    error UnknownAction();
    error Unauthorized();

    constructor(address registry_) {
        if (registry_ == address(0) || registry_.code.length == 0) revert InvalidRegistry();
        capabilityRegistry = ICapabilityRegistry420(registry_);
    }

    function systemName() external pure returns (string memory) { return "ComputeAuthorization420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function scopeProvider(bytes32 providerId) public pure returns (bytes32) {
        return _scope(_PROVIDER, providerId, bytes32(0), bytes32(0));
    }
    function scopeNode(bytes32 providerId, bytes32 nodeId) public pure returns (bytes32) {
        return _scope(_NODE, providerId, nodeId, bytes32(0));
    }
    function scopeResource(bytes32 providerId, bytes32 nodeId, bytes32 resourceId) public pure returns (bytes32) {
        return _scope(_RESOURCE, providerId, nodeId, resourceId);
    }
    function scopeRequest(bytes32 requestId) public pure returns (bytes32) {
        return _scope(_REQUEST, requestId, bytes32(0), bytes32(0));
    }
    function scopeMatch(bytes32 matchId) public pure returns (bytes32) {
        return _scope(_MATCH, matchId, bytes32(0), bytes32(0));
    }
    function scopeAttempt(bytes32 jobId, bytes32 unitId, bytes32 attemptId) public pure returns (bytes32) {
        return _scope(_ATTEMPT, jobId, unitId, attemptId);
    }
    function scopeJob(bytes32 jobId) public pure returns (bytes32) {
        return _scope(_JOB, jobId, bytes32(0), bytes32(0));
    }

    function isAuthorized(address principal, bytes32 actionId, bytes32 scopeHash, uint256 amount)
        public view returns (bool)
    {
        if (principal == address(0) || scopeHash == bytes32(0) || !_knownAction(actionId)) return false;
        try capabilityRegistry.isAuthorized(principal, COMPONENT_COMPUTE, actionId, scopeHash, amount)
            returns (bool allowed) { return allowed; }
        catch { return false; }
    }

    function requireAuthorized(address principal, bytes32 actionId, bytes32 scopeHash, uint256 amount)
        external view
    {
        if (!_knownAction(actionId)) revert UnknownAction();
        if (!isAuthorized(principal, actionId, scopeHash, amount)) revert Unauthorized();
    }

    /// @dev Caller must separately verify canonical parentage, accepted terms, and signer identity;
    ///      neither this pure scope hash nor a view permission proves ownership or consumes period quotas.
    function _scope(bytes32 kind, bytes32 first, bytes32 second, bytes32 third)
        private pure returns (bytes32)
    {
        if (first == bytes32(0) || ((kind == _NODE || kind == _RESOURCE || kind == _ATTEMPT) && second == bytes32(0))
            || ((kind == _RESOURCE || kind == _ATTEMPT) && third == bytes32(0))) revert InvalidScope();
        return keccak256(abi.encode(_SCOPE_DOMAIN, kind, first, second, third));
    }

    function _knownAction(bytes32 actionId) private pure returns (bool) {
        return actionId == ACTION_REGISTER_PROVIDER || actionId == ACTION_MANAGE_NODE
            || actionId == ACTION_MANAGE_RESOURCE || actionId == ACTION_PUBLISH_OFFER
            || actionId == ACTION_CREATE_REQUEST || actionId == ACTION_AUTHORIZE_FUNDING
            || actionId == ACTION_ACCEPT_MATCH || actionId == ACTION_EXECUTE_ATTEMPT
            || actionId == ACTION_SUBMIT_RECEIPT || actionId == ACTION_VERIFY_RESULT
            || actionId == ACTION_CHALLENGE || actionId == ACTION_SETTLE;
    }
}
