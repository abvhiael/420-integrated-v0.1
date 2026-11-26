// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "../interfaces/genesis/ICapabilityRegistryExtended420.sol";
import "./ResourceIds420.sol";
import "./StorageIds420.sol";
import "./StorageProofIds420.sol";

contract ResourceAuthorization420 is I420System {
    ICapabilityRegistry420 public immutable capabilityRegistry;
    error ZeroAddress();

    constructor(address capabilityRegistry_) {
        if (capabilityRegistry_ == address(0) || capabilityRegistry_.code.length == 0) revert ZeroAddress();
        capabilityRegistry = ICapabilityRegistry420(capabilityRegistry_);
    }

    function systemName() external pure returns (string memory) { return "ResourceAuthorization420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function scopeProvider(bytes32 providerId) public pure returns (bytes32) {
        return keccak256(abi.encode("420/RESOURCE/PROVIDER/SCOPE/V1", providerId));
    }
    function scopeNode(bytes32 providerId, bytes32 nodeId) public pure returns (bytes32) {
        return keccak256(abi.encode("420/RESOURCE/NODE/SCOPE/V1", providerId, nodeId));
    }
    function scopeSession(bytes32 sessionId) public pure returns (bytes32) {
        return keccak256(abi.encode("420/RESOURCE/SESSION/SCOPE/V1", sessionId));
    }
    function scopeProofScheme(bytes32 proofSchemeId) public pure returns (bytes32) {
        return keccak256(abi.encode("420/STORAGE/PROOF_SCHEME/SCOPE/V1", proofSchemeId));
    }
    function isProviderAuthorized(address p, bytes32 providerId, bytes32 actionId) external view returns (bool) {
        if (providerId == 0 || (actionId != ResourceIds420.ACTION_REGISTER_PROVIDER
            && actionId != ResourceIds420.ACTION_UPDATE_PROVIDER && actionId != ResourceIds420.ACTION_SET_PROVIDER_STATE)) return false;
        return _authorized(p, actionId, scopeProvider(providerId), 0);
    }
    function isNodeAuthorized(address p, bytes32 providerId, bytes32 nodeId, bytes32 actionId) external view returns (bool) {
        if (providerId == 0 || nodeId == 0 || (actionId != ResourceIds420.ACTION_REGISTER_NODE
            && actionId != ResourceIds420.ACTION_UPDATE_NODE && actionId != ResourceIds420.ACTION_SET_NODE_STATE
            && actionId != ResourceIds420.ACTION_PUBLISH_OFFER && actionId != ResourceIds420.ACTION_SUBMIT_RECEIPT
            && actionId != StorageIds420.ACTION_CONFIGURE_STORAGE_CAPACITY && actionId != StorageIds420.ACTION_RESERVE_STORAGE_CAPACITY
            && actionId != StorageProofIds420.ACTION_REGISTER_STORAGE_COMMITMENT
            && actionId != StorageProofIds420.ACTION_ACCEPT_STORAGE_AGREEMENT)) return false;
        return _authorized(p, actionId, scopeNode(providerId, nodeId), 0);
    }
    function isSessionAuthorized(address p, bytes32 sessionId, bytes32 actionId, uint256 amount) external view returns (bool) {
        if (sessionId == 0 || actionId != ResourceIds420.ACTION_SETTLE) return false;
        // A session-scoped grant can be used once because the registry transitions
        // CLOSED -> SETTLED atomically. Period quotas are not consumable by this
        // read-only adapter; deny them rather than claim metering is enforced.
        if (!_authorized(p, actionId, scopeSession(sessionId), amount)) return false;
        ICapabilityRegistryExtended420 caps = ICapabilityRegistryExtended420(address(capabilityRegistry));
        try caps.activeGrantId(p, ResourceIds420.COMPONENT_RESOURCE, actionId, scopeSession(sessionId)) returns (bytes32 grantId) {
            if (grantId == 0) return false;
            try caps.grant(grantId) returns (ICapabilityRegistry420.CapabilityGrant memory g) {
                return g.principal == p && g.componentId == ResourceIds420.COMPONENT_RESOURCE
                    && g.capabilityId == actionId && g.scopeHash == scopeSession(sessionId)
                    && !g.revoked && g.periodLimit == 0 && g.periodSeconds == 0;
            } catch { return false; }
        } catch { return false; }
    }
    function isProofSchemeAuthorized(address p, bytes32 proofSchemeId, bytes32 actionId) external view returns (bool) {
        if (proofSchemeId == 0 || (actionId != StorageProofIds420.ACTION_REGISTER_PROOF_SCHEME
            && actionId != StorageProofIds420.ACTION_SET_PROOF_SCHEME_STATE)) return false;
        return _authorized(p, actionId, scopeProofScheme(proofSchemeId), 0);
    }
    function _authorized(address p, bytes32 actionId, bytes32 scope, uint256 amount) private view returns (bool) {
        if (p == address(0)) return false;
        try capabilityRegistry.isAuthorized(p, ResourceIds420.COMPONENT_RESOURCE, actionId, scope, amount) returns (bool ok) {
            return ok;
        } catch { return false; }
    }
}
