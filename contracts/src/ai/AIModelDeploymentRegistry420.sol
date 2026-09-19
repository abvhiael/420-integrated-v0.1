// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./AIAuthorization420.sol";
import "./AIIds420.sol";
import "./AIProviderRegistry.sol";
import "./AIModelRegistry.sol";

contract AIModelDeploymentRegistry420 is I420System {
    enum State { NONE, REGISTERED, ACTIVE, SUSPENDED, RETIRED }

    struct Deployment {
        bytes32 providerId;
        bytes32 modelVersionId;
        bytes32 computeOfferRef;
        bytes32 servicePricingPolicyId;
        bytes32 endpointManifestHash;
        uint64 endpointExpiry;
        bytes32 regionPolicyHash;
        bytes32 slaPolicyId;
        uint64 createdAt;
        uint32 revision;
        State state;
        bool exists;
    }

    AIAuthorization420 public immutable authorization;
    AIProviderRegistry public immutable providers;
    AIModelRegistry public immutable models;
    mapping(bytes32 => Deployment) private _deployments;

    error InvalidDeployment();
    error DeploymentExists();
    error DeploymentNotFound();
    error Unauthorized();
    error InvalidState();

    event DeploymentRegistered(
        bytes32 indexed deploymentId,
        bytes32 indexed providerId,
        bytes32 indexed modelVersionId,
        bytes32 computeOfferRef
    );
    event DeploymentUpdated(bytes32 indexed deploymentId, bytes32 endpointManifestHash, uint32 revision);
    event DeploymentStateChanged(bytes32 indexed deploymentId, State previousState, State newState, uint32 revision);

    constructor(address authorization_, address providers_, address models_) {
        if (authorization_ == address(0) || providers_ == address(0) || models_ == address(0)) {
            revert InvalidDeployment();
        }
        authorization = AIAuthorization420(authorization_);
        providers = AIProviderRegistry(providers_);
        models = AIModelRegistry(models_);
    }

    function systemName() external pure returns (string memory) { return "AIModelDeploymentRegistry420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function registerDeployment(
        bytes32 deploymentId,
        bytes32 providerId,
        bytes32 modelVersionId,
        bytes32 computeOfferRef,
        bytes32 servicePricingPolicyId,
        bytes32 endpointManifestHash,
        uint64 endpointExpiry,
        bytes32 regionPolicyHash,
        bytes32 slaPolicyId
    ) external {
        if (
            deploymentId == bytes32(0) || providerId == bytes32(0) || modelVersionId == bytes32(0)
                || computeOfferRef == bytes32(0) || servicePricingPolicyId == bytes32(0)
                || endpointManifestHash == bytes32(0) || slaPolicyId == bytes32(0)
                || (endpointExpiry != 0 && endpointExpiry <= block.timestamp)
                || !providers.isOperational(providerId) || !models.isVersionOperational(modelVersionId)
        ) revert InvalidDeployment();
        if (_deployments[deploymentId].exists) revert DeploymentExists();

        AIProviderRegistry.Provider memory p = providers.getProvider(providerId);
        if (
            msg.sender != p.operatorAccount
                && !authorization.isDeploymentAuthorized(
                    msg.sender, deploymentId, AIIds420.ACTION_REGISTER_DEPLOYMENT
                )
        ) revert Unauthorized();

        _deployments[deploymentId] = Deployment({
            providerId: providerId,
            modelVersionId: modelVersionId,
            computeOfferRef: computeOfferRef,
            servicePricingPolicyId: servicePricingPolicyId,
            endpointManifestHash: endpointManifestHash,
            endpointExpiry: endpointExpiry,
            regionPolicyHash: regionPolicyHash,
            slaPolicyId: slaPolicyId,
            createdAt: uint64(block.timestamp),
            revision: 1,
            state: State.REGISTERED,
            exists: true
        });
        emit DeploymentRegistered(deploymentId, providerId, modelVersionId, computeOfferRef);
    }

    function updateDeployment(
        bytes32 deploymentId,
        bytes32 computeOfferRef,
        bytes32 servicePricingPolicyId,
        bytes32 endpointManifestHash,
        uint64 endpointExpiry,
        bytes32 regionPolicyHash,
        bytes32 slaPolicyId
    ) external {
        Deployment storage d = _get(deploymentId);
        if (d.state == State.ACTIVE || d.state == State.RETIRED) revert InvalidState();
        if (
            computeOfferRef == bytes32(0) || servicePricingPolicyId == bytes32(0)
                || endpointManifestHash == bytes32(0) || slaPolicyId == bytes32(0)
                || (endpointExpiry != 0 && endpointExpiry <= block.timestamp)
        ) revert InvalidDeployment();
        AIProviderRegistry.Provider memory p = providers.getProvider(d.providerId);
        if (
            msg.sender != p.operatorAccount
                && !authorization.isDeploymentAuthorized(
                    msg.sender, deploymentId, AIIds420.ACTION_UPDATE_DEPLOYMENT
                )
        ) revert Unauthorized();

        d.computeOfferRef = computeOfferRef;
        d.servicePricingPolicyId = servicePricingPolicyId;
        d.endpointManifestHash = endpointManifestHash;
        d.endpointExpiry = endpointExpiry;
        d.regionPolicyHash = regionPolicyHash;
        d.slaPolicyId = slaPolicyId;
        d.revision += 1;
        emit DeploymentUpdated(deploymentId, endpointManifestHash, d.revision);
    }

    function setState(bytes32 deploymentId, State next) external {
        Deployment storage d = _get(deploymentId);
        AIProviderRegistry.Provider memory p = providers.getProvider(d.providerId);
        if (
            msg.sender != p.operatorAccount
                && !authorization.isDeploymentAuthorized(
                    msg.sender, deploymentId, AIIds420.ACTION_SET_DEPLOYMENT_STATE
                )
        ) revert Unauthorized();

        State previous = d.state;
        bool ok = (previous == State.REGISTERED && (next == State.ACTIVE || next == State.RETIRED))
            || (previous == State.ACTIVE && (next == State.SUSPENDED || next == State.RETIRED))
            || (previous == State.SUSPENDED && (next == State.ACTIVE || next == State.RETIRED));
        if (!ok) revert InvalidState();
        if (
            next == State.ACTIVE
                && (
                    !providers.isOperational(d.providerId) || !models.isVersionOperational(d.modelVersionId)
                        || (d.endpointExpiry != 0 && block.timestamp > d.endpointExpiry)
                )
        ) revert InvalidState();

        d.state = next;
        d.revision += 1;
        emit DeploymentStateChanged(deploymentId, previous, next, d.revision);
    }

    function getDeployment(bytes32 deploymentId) external view returns (Deployment memory) {
        return _get(deploymentId);
    }

    function isOperational(bytes32 deploymentId) external view returns (bool) {
        Deployment memory d = _deployments[deploymentId];
        return d.exists && d.state == State.ACTIVE && providers.isOperational(d.providerId)
            && models.isVersionOperational(d.modelVersionId)
            && (d.endpointExpiry == 0 || block.timestamp <= d.endpointExpiry);
    }

    function _get(bytes32 deploymentId) private view returns (Deployment storage d) {
        d = _deployments[deploymentId];
        if (!d.exists) revert DeploymentNotFound();
    }
}
