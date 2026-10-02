// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/compute/ComputeStakeReleaseCandidateWiring420.sol";

contract RCComponent420 {}

contract RCEntitlements420 {
    address public vault;
    constructor(address vault_) {
        vault = vault_;
    }
}

contract RCCollateral420 {
    address public exitPolicies;
    address public slashPolicies;
    address public slashAuthorization;
    address public workerRegistry;
    address public verifiers;
    address public disputeStakeHold;
    address public vault;

    constructor(
        address exitPolicy_,
        address slashPolicy_,
        address registry_,
        address vault_
    ) {
        exitPolicies = exitPolicy_;
        slashPolicies = slashPolicy_;
        workerRegistry = registry_;
        verifiers = registry_;
        vault = vault_;
    }

    function setSlashAuthorization(address value) external {
        slashAuthorization = value;
    }

    function setDisputeStakeHold(address value) external {
        disputeStakeHold = value;
    }
}

contract RCSlashAuthorization420 {
    address public policies;
    address public workerCollateral;
    address public verifierCollateral;
    address public distributionPolicies;
    address public distributionExecutor;

    constructor(
        address policies_,
        address worker_,
        address verifier_,
        address distributionPolicies_
    ) {
        policies = policies_;
        workerCollateral = worker_;
        verifierCollateral = verifier_;
        distributionPolicies = distributionPolicies_;
    }

    function setDistributionExecutor(address value) external {
        distributionExecutor = value;
    }
}

contract RCDistribution420 {
    address public authorizer;
    address public policies;

    constructor(address authorizer_, address policies_) {
        authorizer = authorizer_;
        policies = policies_;
    }
}

contract RCRewardAccounting420 {
    address public policies;
    address public rewardVault;
    address public workerCollateral;
    address public verifierCollateral;

    constructor(
        address policies_,
        address rewardVault_,
        address worker_,
        address verifier_
    ) {
        policies = policies_;
        rewardVault = rewardVault_;
        workerCollateral = worker_;
        verifierCollateral = verifier_;
    }
}

contract RCDisputeEvidence420 {
    address public disputes;
    constructor(address disputes_) {
        disputes = disputes_;
    }
}

contract RCDisputeIntegration420 {
    address public disputes;
    address public slashAuthorizer;

    constructor(address disputes_, address authorizer_) {
        disputes = disputes_;
        slashAuthorizer = authorizer_;
    }
}

contract RCSlashResolver420 {
    address public disputes;
    address public verifierEvidenceAdapter;
    address public canonicalEntitlements;
    bytes32 public canonicalEntitlementsCodeHash;

    constructor(address disputes_, address evidence_, address entitlements_) {
        disputes = disputes_;
        verifierEvidenceAdapter = evidence_;
        canonicalEntitlements = entitlements_;
        canonicalEntitlementsCodeHash = entitlements_.codehash;
    }
}

contract RCWorkerStake420 {
    address public workers;
    IWorkerStakeRC420.SourceBinding private _binding;

    constructor(
        address workers_,
        address source_,
        bytes32 sourceCodeHash_
    ) {
        workers = workers_;
        _binding = IWorkerStakeRC420.SourceBinding({
            source: source_,
            workerRegistry: workers_,
            sourceCodeHash: sourceCodeHash_,
            revision: 1,
            active: true,
            exists: true
        });
    }

    function currentSourceBinding()
        external
        view
        returns (IWorkerStakeRC420.SourceBinding memory)
    {
        return _binding;
    }
}

contract ComputeStakeReleaseCandidateWiring420Test {
    RCComponent420 private exitPolicy;
    RCComponent420 private slashPolicy;
    RCComponent420 private distributionPolicy;
    RCComponent420 private rewardPolicy;
    RCComponent420 private workerRegistry;
    RCComponent420 private verifierRegistry;
    RCComponent420 private disputeEngine;
    RCEntitlements420 private entitlements;
    RCComponent420 private payerEscrowVault;
    RCComponent420 private workerCollateralVault;
    RCComponent420 private verifierCollateralVault;
    RCComponent420 private rewardVault;

    RCCollateral420 private workerCollateral;
    RCCollateral420 private verifierCollateral;
    RCSlashAuthorization420 private authorizer;
    RCDistribution420 private distribution;
    RCRewardAccounting420 private rewardAccounting;
    RCDisputeEvidence420 private evidence;
    RCDisputeIntegration420 private integration;
    RCSlashResolver420 private resolver;
    RCWorkerStake420 private workerStake;

    function setUp() public {
        exitPolicy = new RCComponent420();
        slashPolicy = new RCComponent420();
        distributionPolicy = new RCComponent420();
        rewardPolicy = new RCComponent420();
        workerRegistry = new RCComponent420();
        verifierRegistry = new RCComponent420();
        disputeEngine = new RCComponent420();
        payerEscrowVault = new RCComponent420();
        entitlements = new RCEntitlements420(address(payerEscrowVault));
        workerCollateralVault = new RCComponent420();
        verifierCollateralVault = new RCComponent420();
        rewardVault = new RCComponent420();

        workerCollateral = new RCCollateral420(
            address(exitPolicy),
            address(slashPolicy),
            address(workerRegistry),
            address(workerCollateralVault)
        );
        verifierCollateral = new RCCollateral420(
            address(exitPolicy),
            address(slashPolicy),
            address(verifierRegistry),
            address(verifierCollateralVault)
        );

        authorizer = new RCSlashAuthorization420(
            address(slashPolicy),
            address(workerCollateral),
            address(verifierCollateral),
            address(distributionPolicy)
        );
        distribution = new RCDistribution420(
            address(authorizer),
            address(distributionPolicy)
        );
        authorizer.setDistributionExecutor(address(distribution));

        workerCollateral.setSlashAuthorization(address(authorizer));
        verifierCollateral.setSlashAuthorization(address(authorizer));
        verifierCollateral.setDisputeStakeHold(address(disputeEngine));

        rewardAccounting = new RCRewardAccounting420(
            address(rewardPolicy),
            address(rewardVault),
            address(workerCollateral),
            address(verifierCollateral)
        );
        evidence = new RCDisputeEvidence420(address(disputeEngine));
        integration = new RCDisputeIntegration420(
            address(disputeEngine),
            address(authorizer)
        );
        resolver = new RCSlashResolver420(
            address(disputeEngine),
            address(evidence),
            address(entitlements)
        );
        workerStake = new RCWorkerStake420(
            address(workerRegistry),
            address(workerCollateral),
            address(workerCollateral).codehash
        );
    }

    function testExactReleaseGraphIsAccepted() public {
        ComputeStakeReleaseCandidateWiring420 rc =
            new ComputeStakeReleaseCandidateWiring420(_graph());
        require(rc.validate() == rc.releaseGraphHash(), "release graph hash");
        require(rc.releaseGraphHash() != bytes32(0), "missing graph hash");
    }

    function testWrongRuntimeCodeHashFailsClosed() public {
        ComputeStakeReleaseCandidateWiring420.Graph memory g = _graph();
        g.workerCollateral.runtimeCodeHash = keccak256("wrong-runtime");

        bool reverted;
        try new ComputeStakeReleaseCandidateWiring420(g) returns (
            ComputeStakeReleaseCandidateWiring420
        ) {
        } catch {
            reverted = true;
        }
        require(reverted, "wrong runtime accepted");
    }

    function testMismatchedDistributionExecutorFailsClosed() public {
        authorizer.setDistributionExecutor(address(0xBEEF));
        bool reverted;
        try new ComputeStakeReleaseCandidateWiring420(_graph()) returns (
            ComputeStakeReleaseCandidateWiring420
        ) {
        } catch {
            reverted = true;
        }
        require(reverted, "mismatched distribution accepted");
    }

    function testWorkerStakeCrossRegistryBindingFailsClosed() public {
        RCComponent420 otherRegistry = new RCComponent420();
        workerStake = new RCWorkerStake420(
            address(otherRegistry),
            address(workerCollateral),
            address(workerCollateral).codehash
        );

        bool reverted;
        try new ComputeStakeReleaseCandidateWiring420(_graph()) returns (
            ComputeStakeReleaseCandidateWiring420
        ) {
        } catch {
            reverted = true;
        }
        require(reverted, "cross-registry stake source accepted");
    }

    function testPayerEscrowVaultCannotAliasStakeOrRewardVault() public {
        ComputeStakeReleaseCandidateWiring420.Graph memory g = _graph();
        g.payerEscrowVault = g.workerCollateralVault;

        bool reverted;
        try new ComputeStakeReleaseCandidateWiring420(g) returns (
            ComputeStakeReleaseCandidateWiring420
        ) {
        } catch {
            reverted = true;
        }
        require(reverted, "payer escrow reused collateral vault");
    }

    function testRewardVaultCannotAliasCollateralVault() public {
        ComputeStakeReleaseCandidateWiring420.Graph memory g = _graph();
        g.rewardVault = g.workerCollateralVault;

        bool reverted;
        try new ComputeStakeReleaseCandidateWiring420(g) returns (
            ComputeStakeReleaseCandidateWiring420
        ) {
        } catch {
            reverted = true;
        }
        require(reverted, "reward backing reused collateral vault");
    }

    function _graph()
        private
        view
        returns (ComputeStakeReleaseCandidateWiring420.Graph memory g)
    {
        g.chainId = block.chainid;
        g.workerRegistry = _component(address(workerRegistry));
        g.verifierRegistry = _component(address(verifierRegistry));
        g.disputeEngine = _component(address(disputeEngine));
        g.canonicalEntitlements = _component(address(entitlements));
        g.payerEscrowVault = _component(address(payerEscrowVault));
        g.workerCollateralVault = _component(address(workerCollateralVault));
        g.verifierCollateralVault = _component(address(verifierCollateralVault));
        g.rewardVault = _component(address(rewardVault));
        g.workerCollateral = _component(address(workerCollateral));
        g.verifierCollateral = _component(address(verifierCollateral));
        g.exitPolicy = _component(address(exitPolicy));
        g.slashPolicy = _component(address(slashPolicy));
        g.slashAuthorization = _component(address(authorizer));
        g.distributionPolicy = _component(address(distributionPolicy));
        g.distribution = _component(address(distribution));
        g.rewardPolicy = _component(address(rewardPolicy));
        g.rewardAccounting = _component(address(rewardAccounting));
        g.disputeEvidence = _component(address(evidence));
        g.disputeIntegration = _component(address(integration));
        g.workerStake = _component(address(workerStake));
        g.slashRecipientResolver = _component(address(resolver));
    }

    function _component(address implementation)
        private
        view
        returns (ComputeStakeReleaseCandidateWiring420.Component memory)
    {
        return ComputeStakeReleaseCandidateWiring420.Component({
            implementation: implementation,
            runtimeCodeHash: implementation.codehash
        });
    }
}
