// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";

interface IStakeWorkerCollateralRC420 {
    function exitPolicies() external view returns (address);
    function slashPolicies() external view returns (address);
    function slashAuthorization() external view returns (address);
    function workerRegistry() external view returns (address);
    function vault() external view returns (address);
}

interface IStakeVerifierCollateralRC420 {
    function exitPolicies() external view returns (address);
    function slashPolicies() external view returns (address);
    function slashAuthorization() external view returns (address);
    function disputeStakeHold() external view returns (address);
    function verifiers() external view returns (address);
    function vault() external view returns (address);
}

interface IStakeSlashAuthorizationRC420 {
    function policies() external view returns (address);
    function workerCollateral() external view returns (address);
    function verifierCollateral() external view returns (address);
    function distributionPolicies() external view returns (address);
    function distributionExecutor() external view returns (address);
}

interface IStakeDistributionRC420 {
    function authorizer() external view returns (address);
    function policies() external view returns (address);
}

interface IStakeRewardAccountingRC420 {
    function policies() external view returns (address);
    function rewardVault() external view returns (address);
    function workerCollateral() external view returns (address);
    function verifierCollateral() external view returns (address);
}

interface IVerifierDisputeStakeEvidenceRC420 {
    function disputes() external view returns (address);
}

interface IVerifierDisputeStakeIntegrationRC420 {
    function disputes() external view returns (address);
    function slashAuthorizer() external view returns (address);
}

interface IVerifierDisputeSlashResolverRC420 {
    function disputes() external view returns (address);
    function verifierEvidenceAdapter() external view returns (address);
    function canonicalEntitlements() external view returns (address);
    function canonicalEntitlementsCodeHash() external view returns (bytes32);
}

interface IWorkerStakeRC420 {
    struct SourceBinding {
        address source;
        address workerRegistry;
        bytes32 sourceCodeHash;
        uint32 revision;
        bool active;
        bool exists;
    }
    function workers() external view returns (address);
    function currentSourceBinding() external view returns (SourceBinding memory);
}

contract ComputeStakeReleaseCandidateWiring420 is I420System {
    struct Component {
        address implementation;
        bytes32 runtimeCodeHash;
    }

    struct Graph {
        uint256 chainId;
        Component workerRegistry;
        Component verifierRegistry;
        Component disputeEngine;
        Component canonicalEntitlements;
        Component workerCollateralVault;
        Component verifierCollateralVault;
        Component rewardVault;
        Component workerCollateral;
        Component verifierCollateral;
        Component exitPolicy;
        Component slashPolicy;
        Component slashAuthorization;
        Component distributionPolicy;
        Component distribution;
        Component rewardPolicy;
        Component rewardAccounting;
        Component disputeEvidence;
        Component disputeIntegration;
        Component workerStake;
        Component slashRecipientResolver;
    }

    Graph private _graph;
    bytes32 public immutable releaseGraphHash;

    error InvalidReleaseGraph();

    constructor(Graph memory g) {
        if (g.chainId != block.chainid) revert InvalidReleaseGraph();
        _requireComponent(g.workerRegistry);
        _requireComponent(g.verifierRegistry);
        _requireComponent(g.disputeEngine.implementation);
        _requireComponent(g.canonicalEntitlements.implementation);
        _requireComponent(g.workerCollateralVault);
        _requireComponent(g.verifierCollateralVault);
        _requireComponent(g.rewardVault);
        _requireComponent(g.workerCollateral);
        _requireComponent(g.verifierCollateral);
        _requireComponent(g.exitPolicy);
        _requireComponent(g.slashPolicy);
        _requireComponent(g.slashAuthorization);
        _requireComponent(g.distributionPolicy);
        _requireComponent(g.distribution);
        _requireComponent(g.rewardPolicy);
        _requireComponent(g.rewardAccounting);
        _requireComponent(g.disputeEvidence);
        _requireComponent(g.disputeIntegration);
        _requireComponent(g.workerStake);
        _requireComponent(g.slashRecipientResolver);
        if (
            g.rewardVault.implementation == g.workerCollateralVault.implementation
                || g.rewardVault.implementation == g.verifierCollateralVault.implementation
        ) revert InvalidReleaseGraph();

        _graph = g;
        releaseGraphHash = keccak256(abi.encode(g));
        _validate();
    }

    function systemName() external pure returns (string memory) {
        return "ComputeStakeReleaseCandidateWiring420";
    }

    function protocolVersion() external pure returns (uint32) {
        return 1;
    }

    function graph() external view returns (Graph memory) {
        return _graph;
    }

    function validate() external view returns (bytes32) {
        _validate();
        return releaseGraphHash;
    }

    function _validate() private view {
        Graph memory g = _graph;
        if (g.chainId != block.chainid) revert InvalidReleaseGraph();

        _checkComponent(g.workerRegistry);
        _checkComponent(g.verifierRegistry);
        _checkComponent(g.disputeEngine.implementation);
        _checkComponent(g.canonicalEntitlements.implementation);
        _checkComponent(g.workerCollateralVault);
        _checkComponent(g.verifierCollateralVault);
        _checkComponent(g.rewardVault);
        _checkComponent(g.workerCollateral);
        _checkComponent(g.verifierCollateral);
        _checkComponent(g.exitPolicy);
        _checkComponent(g.slashPolicy);
        _checkComponent(g.slashAuthorization);
        _checkComponent(g.distributionPolicy);
        _checkComponent(g.distribution);
        _checkComponent(g.rewardPolicy);
        _checkComponent(g.rewardAccounting);
        _checkComponent(g.disputeEvidence);
        _checkComponent(g.disputeIntegration);
        _checkComponent(g.workerStake);
        _checkComponent(g.slashRecipientResolver);

        IStakeWorkerCollateralRC420 wc = IStakeWorkerCollateralRC420(g.workerCollateral.implementation);
        IStakeVerifierCollateralRC420 vc = IStakeVerifierCollateralRC420(g.verifierCollateral.implementation);
        IStakeSlashAuthorizationRC420 auth = IStakeSlashAuthorizationRC420(g.slashAuthorization.implementation);
        IStakeDistributionRC420 dist = IStakeDistributionRC420(g.distribution.implementation);
        IStakeRewardAccountingRC420 rewards = IStakeRewardAccountingRC420(g.rewardAccounting.implementation);
        IVerifierDisputeStakeEvidenceRC420 evidence =
            IVerifierDisputeStakeEvidenceRC420(g.disputeEvidence.implementation);
        IVerifierDisputeStakeIntegrationRC420 integration =
            IVerifierDisputeStakeIntegrationRC420(g.disputeIntegration.implementation);
        IVerifierDisputeSlashResolverRC420 resolver =
            IVerifierDisputeSlashResolverRC420(g.slashRecipientResolver.implementation);
        IWorkerStakeRC420 workerStake = IWorkerStakeRC420(g.workerStake.implementation);
        IWorkerStakeRC420.SourceBinding memory sourceBinding = workerStake.currentSourceBinding();

        if (
            wc.exitPolicies() != g.exitPolicy.implementation
                || vc.exitPolicies() != g.exitPolicy.implementation
                || wc.slashPolicies() != g.slashPolicy.implementation
                || vc.slashPolicies() != g.slashPolicy.implementation
                || wc.slashAuthorization() != g.slashAuthorization.implementation
                || vc.slashAuthorization() != g.slashAuthorization.implementation
                || wc.workerRegistry() != g.workerRegistry.implementation
                || vc.verifiers() != g.verifierRegistry.implementation
                || wc.vault() != g.workerCollateralVault.implementation
                || vc.vault() != g.verifierCollateralVault.implementation
        ) revert InvalidReleaseGraph();

        if (
            auth.policies() != g.slashPolicy.implementation
                || auth.workerCollateral() != g.workerCollateral.implementation
                || auth.verifierCollateral() != g.verifierCollateral.implementation
                || auth.distributionPolicies() != g.distributionPolicy.implementation
                || auth.distributionExecutor() != g.distribution.implementation
                || dist.authorizer() != g.slashAuthorization.implementation
                || dist.policies() != g.distributionPolicy.implementation
        ) revert InvalidReleaseGraph();

        if (
            rewards.policies() != g.rewardPolicy.implementation
                || rewards.rewardVault() != g.rewardVault.implementation
                || rewards.workerCollateral() != g.workerCollateral.implementation
                || rewards.verifierCollateral() != g.verifierCollateral.implementation
                || g.rewardVault.implementation == g.workerCollateralVault.implementation
                || g.rewardVault.implementation == g.verifierCollateralVault.implementation
        ) revert InvalidReleaseGraph();

        if (
            evidence.disputes() != g.disputeEngine.implementation
                || integration.disputes() != g.disputeEngine.implementation
                || integration.slashAuthorizer() != g.slashAuthorization.implementation
                || vc.disputeStakeHold() != g.disputeEngine.implementation
        ) revert InvalidReleaseGraph();

        if (
            resolver.disputes() != g.disputeEngine.implementation
                || resolver.verifierEvidenceAdapter() != g.disputeEvidence.implementation
                || resolver.canonicalEntitlements() != g.canonicalEntitlements.implementation
                || resolver.canonicalEntitlementsCodeHash() != g.canonicalEntitlements.runtimeCodeHash
        ) revert InvalidReleaseGraph();

        if (
            !sourceBinding.exists
                || !sourceBinding.active
                || sourceBinding.source != g.workerCollateral.implementation
                || sourceBinding.sourceCodeHash != g.workerCollateral.runtimeCodeHash
                || sourceBinding.workerRegistry != g.workerRegistry.implementation
                || workerStake.workers() != g.workerRegistry.implementation
        ) revert InvalidReleaseGraph();
    }

    function _requireComponent(Component memory c) private view {
        if (
            c.implementation == address(0)
                || c.implementation.code.length == 0
                || c.runtimeCodeHash == bytes32(0)
                || c.implementation.codehash != c.runtimeCodeHash
        ) revert InvalidReleaseGraph();
    }

    function _checkComponent(Component memory c) private view {
        if (
            c.implementation.code.length == 0
                || c.implementation.codehash != c.runtimeCodeHash
        ) revert InvalidReleaseGraph();
    }
}
