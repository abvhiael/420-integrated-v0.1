// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../vault/AssetVault420.sol";
import "../vault/VaultRegistry420.sol";
import "../vault/VaultAccounting420.sol";
import "../vault/VaultIds420.sol";

interface IFoundingTreasurySweepState420 {
    function retired() external view returns (bool);
    function vaultRegistry() external view returns (VaultRegistry420);
    function operationsVaultId() external view returns (bytes32);
    function contingencyVaultId() external view returns (bytes32);
    function operationsReleased() external view returns (uint256);
    function contingencyReleased() external view returns (uint256);
    function operationsCommitted() external view returns (uint256);
    function contingencyCommitted() external view returns (uint256);
    function outstandingFoundingCommitments() external view returns (bool);
    function OPERATIONS_ALLOCATION() external view returns (uint128);
    function CONTINGENCY_ALLOCATION() external view returns (uint128);
}

/// @notice Permissionless, destination-fixed post-retirement movement of actual UNENCUMBERED
/// native $420 from two dedicated founding Treasury Vaults into a registered Community Vault.
/// @dev The Vault's own route-scoped capability grant is mandatory; neither the founding
/// administrator nor this contract may grant withdrawal capability.
interface IExactRetirementToken420 {
    function balanceOf(
        address who
    ) external view returns (uint256);
    function approve(
        address spender,
        uint256 amount
    ) external returns (bool);
    function allowance(
        address from,
        address spender
    ) external view returns (uint256);
}

contract FoundingCommunityRetirementSweep420 {
    IFoundingTreasurySweepState420 public immutable founding;
    VaultRegistry420 public immutable registry;
    bytes32 public immutable operationsId;
    bytes32 public immutable contingencyId;
    bytes32 public immutable communityId;

    uint256 public operationsSwept;
    uint256 public contingencySwept;
    uint256 public nextOperationNonce;
    uint256 private _entered;
    mapping(bytes32 => mapping(address => uint256)) public tokenSwept;

    error InvalidVaultGraph();
    error NotRetired();
    error InvalidAmount();
    error ExceedsUnspentAllocation();
    error RouteNotAuthorized();
    error IncorrectCustodyDelta();
    error ReentrantSweep();
    error UnsettledFoundingCommitment();
    error TokenTransferUnsupported();

    event FoundingBalanceTransferred(
        bytes32 indexed sourceVaultId, bytes32 indexed communityVaultId, bytes32 indexed operationId, uint256 amount
    );
    event FoundingTokenTransferred(
        bytes32 indexed sourceVaultId,
        bytes32 indexed communityVaultId,
        bytes32 indexed operationId,
        address token,
        uint256 amount
    );

    constructor(
        address foundingAuthority,
        bytes32 communityVaultId
    ) {
        if (foundingAuthority.code.length == 0 || communityVaultId == bytes32(0)) revert InvalidVaultGraph();
        founding = IFoundingTreasurySweepState420(foundingAuthority);
        registry = founding.vaultRegistry();
        operationsId = founding.operationsVaultId();
        contingencyId = founding.contingencyVaultId();
        communityId = communityVaultId;
        if (
            address(registry).code.length == 0 || operationsId == contingencyId || operationsId == communityId
                || contingencyId == communityId
        ) revert InvalidVaultGraph();
        _validateGraph();
    }

    modifier nonReentrant() {
        if (_entered != 0) revert ReentrantSweep();
        _entered = 1;
        _;
        _entered = 0;
    }

    function sweep(
        bool contingency,
        uint256 amount
    ) external nonReentrant returns (bytes32 operationId) {
        if (!founding.retired()) revert NotRetired();
        if (amount == 0) revert InvalidAmount();
        _requireNoUnsettledFoundingCommitments();

        (AssetVault420 source, AssetVault420 destination, VaultAccounting420 accounting, bytes32 sourceId) =
            _validateGraphFor(contingency);

        uint256 allocation = contingency ? founding.CONTINGENCY_ALLOCATION() : founding.OPERATIONS_ALLOCATION();
        uint256 released = contingency ? founding.contingencyReleased() : founding.operationsReleased();
        uint256 swept = contingency ? contingencySwept : operationsSwept;
        if (released + swept + amount > allocation) revert ExceedsUnspentAllocation();
        if (accounting.freeBalance(sourceId, address(0)) < amount) revert InvalidAmount();
        if (!source.authorization()
                .isRouteAuthorized(
                    address(this), sourceId, VaultIds420.ACTION_WITHDRAW, address(0), address(destination), amount
                )) revert RouteNotAuthorized();

        operationId = keccak256(
            abi.encode(
                "420/FOUNDING/RETIREMENT/COMMUNITY-SWEEP/V1",
                block.chainid,
                address(this),
                sourceId,
                ++nextOperationNonce,
                amount
            )
        );
        uint256 beforeSource = address(source).balance;
        uint256 beforeCommunity = address(destination).balance;
        VaultAccounting420.AssetAccounting memory beforeAccounting = accounting.getAccounting(sourceId, address(0));
        VaultAccounting420.AssetAccounting memory beforeDestination = accounting.getAccounting(communityId, address(0));

        if (contingency) contingencySwept += amount;
        else operationsSwept += amount;

        source.withdraw(operationId, address(0), address(destination), amount);
        VaultAccounting420.AssetAccounting memory afterAccounting = accounting.getAccounting(sourceId, address(0));
        if (
            address(source).balance + amount != beforeSource || address(destination).balance != beforeCommunity + amount
                || beforeAccounting.recordedBalance != afterAccounting.recordedBalance + amount
                || afterAccounting.released != beforeAccounting.released + amount
                || afterAccounting.reserved != beforeAccounting.reserved
                || afterAccounting.claimable != beforeAccounting.claimable
                || accounting.getAccounting(communityId, address(0)).recordedBalance
                    != beforeDestination.recordedBalance + amount || !source.executedOperation(operationId)
        ) revert IncorrectCustodyDelta();
        emit FoundingBalanceTransferred(sourceId, communityId, operationId, amount);
    }

    /// @notice Atomic ERC-20 custody migration for any *recorded* source-Vault token.
    /// @dev An explicitly authorized source->sweeper route is required because ERC-20s
    /// have no receive hook; they are immediately deposited using the canonical
    /// destination's transferFrom path. Exact source, escrow, destination and accounting
    /// balance deltas all revert together on token fee, callback or failure.
    function sweepToken(
        bool contingency,
        address token,
        uint256 amount
    ) external nonReentrant returns (bytes32 operationId) {
        if (!founding.retired()) revert NotRetired();
        _requireNoUnsettledFoundingCommitments();
        if (token == address(0) || token.code.length == 0 || amount == 0) revert InvalidAmount();
        (AssetVault420 source, AssetVault420 destination, VaultAccounting420 accounting, bytes32 sourceId) =
            _validateGraphFor(contingency);
        if (accounting.freeBalance(sourceId, token) < amount) revert InvalidAmount();
        // The only authorized token release recipient is this fixed, noncustodial
        // atomic forwarder; its route grant is separate from the native community path.
        if (!source.authorization()
                .isRouteAuthorized(address(this), sourceId, VaultIds420.ACTION_WITHDRAW, token, address(this), amount)) revert RouteNotAuthorized();

        IExactRetirementToken420 asset = IExactRetirementToken420(token);
        uint256 beforeSource = asset.balanceOf(address(source));
        uint256 beforeDestination = asset.balanceOf(address(destination));
        if (asset.balanceOf(address(this)) != 0 || asset.allowance(address(this), address(destination)) != 0) {
            revert TokenTransferUnsupported();
        }
        VaultAccounting420.AssetAccounting memory beforeAccounting = accounting.getAccounting(sourceId, token);
        VaultAccounting420.AssetAccounting memory beforeCommunity = accounting.getAccounting(communityId, token);

        operationId = keccak256(
            abi.encode(
                "420/FOUNDING/RETIREMENT/COMMUNITY-TOKEN-SWEEP/V1",
                block.chainid,
                address(this),
                sourceId,
                ++nextOperationNonce,
                token,
                amount
            )
        );
        tokenSwept[sourceId][token] += amount;
        source.withdraw(operationId, token, address(this), amount);
        if (asset.balanceOf(address(this)) != amount || !asset.approve(address(destination), amount)) {
            revert TokenTransferUnsupported();
        }
        destination.depositToken(token, amount);
        if (
            asset.balanceOf(address(this)) != 0 || asset.allowance(address(this), address(destination)) != 0
                || asset.balanceOf(address(source)) + amount != beforeSource
                || asset.balanceOf(address(destination)) != beforeDestination + amount
        ) {
            revert IncorrectCustodyDelta();
        }

        VaultAccounting420.AssetAccounting memory afterAccounting = accounting.getAccounting(sourceId, token);
        VaultAccounting420.AssetAccounting memory afterCommunity = accounting.getAccounting(communityId, token);
        if (
            beforeAccounting.recordedBalance != afterAccounting.recordedBalance + amount
                || afterAccounting.released != beforeAccounting.released + amount
                || afterAccounting.reserved != beforeAccounting.reserved
                || afterAccounting.claimable != beforeAccounting.claimable
                || afterCommunity.recordedBalance != beforeCommunity.recordedBalance + amount
                || afterCommunity.reserved != beforeCommunity.reserved
                || afterCommunity.claimable != beforeCommunity.claimable || !source.executedOperation(operationId)
        ) revert IncorrectCustodyDelta();
        emit FoundingTokenTransferred(sourceId, communityId, operationId, token, amount);
    }

    function remainingSweepable(
        bool contingency
    ) external view returns (uint256) {
        (,, VaultAccounting420 accounting, bytes32 sourceId) = _validateGraphFor(contingency);
        if (!founding.retired() || !_noUnsettledFoundingCommitments()) return 0;
        uint256 total = contingency ? founding.CONTINGENCY_ALLOCATION() : founding.OPERATIONS_ALLOCATION();
        uint256 out = contingency
            ? founding.contingencyReleased() + contingencySwept
            : founding.operationsReleased() + operationsSwept;
        if (out >= total) return 0;
        uint256 free = accounting.freeBalance(sourceId, address(0));
        return free < total - out ? free : total - out;
    }

    /// @notice A retirement flag is not a custody transfer. Only actual source-vault
    /// closure with zero outstanding obligations proves the handoff is complete.
    function custodyHandoffComplete() external view returns (bool) {
        if (!founding.retired() || !_noUnsettledFoundingCommitments()) return false;
        (AssetVault420 ops,,,) = _validateGraphFor(false);
        (AssetVault420 cont,,,) = _validateGraphFor(true);
        return ops.canClose() && cont.canClose() && address(ops).balance == 0 && address(cont).balance == 0;
    }

    function _noUnsettledFoundingCommitments() private view returns (bool) {
        return !founding.outstandingFoundingCommitments();
    }

    function _requireNoUnsettledFoundingCommitments() private view {
        if (!_noUnsettledFoundingCommitments()) revert UnsettledFoundingCommitment();
    }

    function _validateGraph() private view {
        _validateGraphFor(false);
        _validateGraphFor(true);
    }

    function _validateGraphFor(
        bool contingency
    )
        private
        view
        returns (AssetVault420 source, AssetVault420 destination, VaultAccounting420 accounting, bytes32 sourceId)
    {
        sourceId = contingency ? contingencyId : operationsId;
        VaultRegistry420.Vault memory src = registry.getVault(sourceId);
        VaultRegistry420.Vault memory dest = registry.getVault(communityId);
        if (
            !src.exists || !dest.exists || src.vaultAddress == dest.vaultAddress || src.vaultAddress.code.length == 0
                || dest.vaultAddress.code.length == 0 || src.vaultType != VaultIds420.VAULT_TREASURY
                || dest.vaultType != VaultIds420.VAULT_COMMUNITY || src.state != VaultRegistry420.VaultState.ACTIVE
                || dest.state != VaultRegistry420.VaultState.ACTIVE
        ) revert InvalidVaultGraph();
        source = AssetVault420(payable(src.vaultAddress));
        destination = AssetVault420(payable(dest.vaultAddress));
        if (
            source.vaultId() != sourceId || destination.vaultId() != communityId
                || address(source.registry()) != address(registry)
                || address(destination.registry()) != address(registry)
                || address(source.accounting()) != address(destination.accounting())
        ) revert InvalidVaultGraph();
        accounting = source.accounting();
    }
}
