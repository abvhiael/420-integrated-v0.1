// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/governance/GovernanceTimelock.sol";
import "../src/governance/CivicMerkleElectorateSource420.sol";
import "../src/treasury/TreasuryPolicyRegistry420.sol";
import "../src/treasury/TreasuryBudgetRegistry420.sol";
import "../src/vault/VaultPolicyRegistry420.sol";
import "../src/vault/VaultIds420.sol";

interface VmGovernanceAudit7 {
    function warp(
        uint256
    ) external;
    function roll(
        uint256
    ) external;
}

contract GovernanceAudit7Integration420Test {
    VmGovernanceAudit7 private constant vm =
        VmGovernanceAudit7(address(uint160(uint256(keccak256("hevm cheat code")))));

    GovernanceTimelock private timelock;
    uint256 private nonce;

    function setUp() public {
        timelock = new GovernanceTimelock(address(this));
    }

    function _execute(
        address target,
        bytes memory data
    ) private {
        bytes32 id = keccak256(abi.encode("GOV-AUDIT-7", ++nonce, target, data));
        timelock.schedule(id, target, 0, data, GovernanceTimelock.Class.G1);
        vm.warp(block.timestamp + timelock.G1_DELAY() + 1);
        timelock.execute(id);
    }

    function testTreasuryAndVaultRemainGovernedTargetsWithoutBecomingGovernanceAuthority() public {
        TreasuryPolicyRegistry420 treasuryPolicy = new TreasuryPolicyRegistry420(address(timelock));
        TreasuryBudgetRegistry420 budgets = new TreasuryBudgetRegistry420(address(timelock), address(treasuryPolicy));
        VaultPolicyRegistry420 vaultPolicy = new VaultPolicyRegistry420(address(timelock));

        require(treasuryPolicy.governanceTimelock() == address(timelock), "treasury timelock");
        require(budgets.governanceTimelock() == address(timelock), "budget timelock");
        require(vaultPolicy.governanceTimelock() == address(timelock), "vault timelock");

        address asset = address(0xCAFE);
        (bool directTreasury,) = address(treasuryPolicy)
            .call(
                abi.encodeCall(
                    TreasuryPolicyRegistry420.setAssetPolicy, (asset, true, uint128(100), uint128(1000), uint64(1 days))
                )
            );
        require(!directTreasury, "direct Treasury governance mutation accepted");

        _execute(
            address(treasuryPolicy),
            abi.encodeCall(
                TreasuryPolicyRegistry420.setAssetPolicy, (asset, true, uint128(100), uint128(1000), uint64(1 days))
            )
        );
        require(treasuryPolicy.isAllowed(asset, 100), "Treasury policy not applied by Timelock");

        bytes32 budgetId = keccak256("GOV7-BUDGET");
        bytes32 vaultId = keccak256("GOV7-VAULT");
        bytes32 category = keccak256("GOV7-CATEGORY");
        bytes32 civicActionHash = keccak256("GOV7-CIVIC-ACTION");
        bytes32 metadataHash = keccak256("GOV7-METADATA");
        uint64 validFrom = uint64(block.timestamp);
        uint64 validUntil = uint64(block.timestamp + 100 days);

        (bool directBudget,) = address(budgets)
            .call(
                abi.encodeCall(
                    TreasuryBudgetRegistry420.createBudget,
                    (
                        budgetId,
                        vaultId,
                        category,
                        asset,
                        uint128(100),
                        validFrom,
                        validUntil,
                        civicActionHash,
                        metadataHash
                    )
                )
            );
        require(!directBudget, "direct budget creation accepted");

        _execute(
            address(budgets),
            abi.encodeCall(
                TreasuryBudgetRegistry420.createBudget,
                (budgetId, vaultId, category, asset, uint128(100), validFrom, validUntil, civicActionHash, metadataHash)
            )
        );
        TreasuryBudgetRegistry420.Budget memory budget = budgets.budget(budgetId);
        require(budget.civicActionHash == civicActionHash, "Civic action commitment lost");
        require(budget.ceiling == 100, "budget mismatch");

        bytes32 policyId = keccak256("GOV7-VAULT-POLICY");
        bytes32 semanticsHash = keccak256("GOV7-VAULT-SEMANTICS");
        bytes32 vaultMetadata = keccak256("GOV7-VAULT-METADATA");

        (bool directVault,) = address(vaultPolicy)
            .call(
                abi.encodeCall(
                    VaultPolicyRegistry420.setPolicy,
                    (policyId, VaultIds420.POLICY_AUTHORIZATION, semanticsHash, vaultMetadata, true)
                )
            );
        require(!directVault, "direct Vault policy mutation accepted");

        _execute(
            address(vaultPolicy),
            abi.encodeCall(
                VaultPolicyRegistry420.setPolicy,
                (policyId, VaultIds420.POLICY_AUTHORIZATION, semanticsHash, vaultMetadata, true)
            )
        );
        require(vaultPolicy.isActiveOfType(policyId, VaultIds420.POLICY_AUTHORIZATION), "Vault policy not governed");
    }

    function testValidatorElectorateIsMembershipWeightedNotStakeWeighted() public {
        CivicMerkleElectorateSource420 source = new CivicMerkleElectorateSource420(
            address(timelock), keccak256("420CIVIC_VALIDATOR_EQUAL_WEIGHT_MERKLE_V1")
        );

        require(source.governanceTimelock() == address(timelock), "electorate timelock");
        require(source.sourceType() == keccak256("420CIVIC_VALIDATOR_EQUAL_WEIGHT_MERKLE_V1"), "validator source type");

        address validatorOwner = address(0xBEEF);
        bytes32 root = keccak256(abi.encode(validatorOwner));
        uint64 effectiveBlock = uint64(block.number + 1);
        _execute(
            address(source),
            abi.encodeCall(CivicMerkleElectorateSource420.publishCheckpoint, (effectiveBlock, root, uint256(1)))
        );
        vm.roll(effectiveBlock);

        (bytes32 snapRoot, uint256 totalWeight) = source.snapshotAt(effectiveBlock);
        require(snapRoot == root && totalWeight == 1, "validator electorate snapshot");
        bytes32[] memory proof = new bytes32[](0);
        require(source.votingWeight(root, validatorOwner, abi.encode(proof)) == 1, "validator weight not unitary");

        // Stake/bond/delegation inputs are deliberately absent from this canonical adapter.
        // The repository-level GOV-AUDIT-7 verifier separately proves the Civic runtime graph has
        // no ValidatorRegistry/Stake dependency; this executable assertion proves each valid member
        // receives exactly one vote.
    }
}
