// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "../interfaces/IComputeVerifierStakeSource420.sol";
import "../interfaces/IComputeSlashableCollateral420.sol";
import "../interfaces/IComputeSlashHold420.sol";
import "../vault/AssetVault420.sol";
import "../vault/VaultAccounting420.sol";
import "../vault/VaultIds420.sol";
import "../vault/VaultRegistry420.sol";
import "./ComputeVerifierRegistry420.sol";
import "./ComputeStakeExitPolicy420.sol";
import "./ComputeStakeSlashPolicy420.sol";

/// @notice CMP-1.5.2 verifier collateral source backed by canonical 420Vault obligations.
/// @dev This step implements verifier deposits/current-position reads only. Minimum-policy
/// enforcement, exit, unstake, slashing, rewards and dispute integration remain later steps.
contract ComputeStakeVerifierCollateral420 is I420System, IComputeVerifierStakeSource420, IComputeSlashableCollateral420 {
    bytes32 public constant SOURCE_ID =
        keccak256("420Integrated.ComputeMarket.ComputeVerifierStakeSource.v1");
    bytes32 public constant POSITION_DOMAIN =
        keccak256("420Integrated.ComputeMarket.VerifierCollateralPosition.v1");
    bytes32 public constant TRANCHE_DOMAIN =
        keccak256("420Integrated.ComputeMarket.VerifierCollateralTranche.v1");
    bytes32 public constant VERIFIER_COLLATERAL_TYPE =
        keccak256("420/CMP/VERIFIER-COLLATERAL/V1");
    bytes32 public constant EXIT_RELEASE_DOMAIN =
        keccak256("420Integrated.ComputeMarket.VerifierCollateralExitRelease.v1");
    bytes32 public constant EXIT_CLAIM_DOMAIN =
        keccak256("420Integrated.ComputeMarket.VerifierCollateralExitClaim.v1");

    struct Position {
        bytes32 positionId;
        bytes32 verifierId;
        bytes32 stakePolicyId;
        address authority;
        uint64 openedAt;
        uint64 openedAtVerifierRevision;
        uint64 latestVerifierRevision;
        uint64 revision;
        uint64 trancheCount;
        uint64 withdrawalCursor;
        uint32 exitPolicyRevision;
        bytes32 exitPolicyCommitment;
        uint256 activeAmount;
        uint256 slashableAmount;
        bool active;
        bool exiting;
        uint64 withdrawableAt;
        bool exists;
    }

    struct Tranche {
        bytes32 trancheId;
        bytes32 obligationId;
        uint64 positionRevision;
        uint64 verifierRevision;
        uint256 amount;
        uint64 createdAt;
        bool exists;
    }

    ComputeVerifierRegistry420 public immutable verifiers;
    ComputeStakeExitPolicy420 public immutable exitPolicies;
    ComputeStakeSlashPolicy420 public immutable slashPolicies;
    AssetVault420 public immutable vault;
    VaultRegistry420 public immutable vaultRegistry;
    VaultAccounting420 public immutable accounting;
    bytes32 public immutable vaultId;
    address public immutable slashBindingAdmin;
    address public slashAuthorization;

    mapping(bytes32 => Position) private _positions;
    mapping(bytes32 => mapping(uint64 => Tranche)) private _tranches;

    bool private entered;

    error InvalidConfiguration();
    error InvalidStake();
    error UnauthorizedVerifierAuthority();
    error PositionNotFound();
    error TrancheNotFound();
    error RevisionExhausted();
    error ExitNotReady();
    error InvalidExit();
    error UnauthorizedSlashBinding();

    event SlashAuthorizationBound(address indexed slashAuthorization);
    event VerifierCollateralStaked(
        bytes32 indexed positionId,
        bytes32 indexed verifierId,
        bytes32 indexed stakePolicyId,
        address authority,
        uint64 verifierRevision,
        uint64 positionRevision,
        uint64 trancheIndex,
        bytes32 trancheId,
        bytes32 obligationId,
        uint256 amount,
        uint256 activeAmount
    );
    event VerifierCollateralExitRequested(
        bytes32 indexed positionId,
        address indexed authority,
        uint32 indexed exitPolicyRevision,
        bytes32 exitPolicyCommitment,
        uint64 withdrawableAt,
        uint64 positionRevision
    );
    event VerifierCollateralWithdrawn(
        bytes32 indexed positionId,
        address indexed authority,
        uint64 fromTranche,
        uint64 throughTranche,
        uint256 amount,
        uint256 remainingActiveAmount,
        uint64 positionRevision
    );

    constructor(address verifierRegistry_, address collateralVault_, address exitPolicy_, address slashPolicy_) {
        if (
            verifierRegistry_.code.length == 0
                || collateralVault_.code.length == 0
                || exitPolicy_.code.length == 0
                || slashPolicy_.code.length == 0
        ) {
            revert InvalidConfiguration();
        }

        verifiers = ComputeVerifierRegistry420(verifierRegistry_);
        slashBindingAdmin = msg.sender;
        exitPolicies = ComputeStakeExitPolicy420(exitPolicy_);
        slashPolicies = ComputeStakeSlashPolicy420(slashPolicy_);
        vault = AssetVault420(payable(collateralVault_));
        vaultRegistry = vault.registry();
        accounting = vault.accounting();
        vaultId = vault.vaultId();

        VaultRegistry420.Vault memory registration = vaultRegistry.getVault(vaultId);
        if (
            registration.vaultAddress != collateralVault_
                || registration.vaultType != VaultIds420.VAULT_COLLATERAL
                || address(vault.registry()) != address(vaultRegistry)
                || address(vault.accounting()) != address(accounting)
        ) revert InvalidConfiguration();
    }

    function bindSlashAuthorization(address slashAuthorization_) external {
        if (
            msg.sender != slashBindingAdmin
                || slashAuthorization != address(0)
                || slashAuthorization_.code.length == 0
        ) revert UnauthorizedSlashBinding();
        slashAuthorization = slashAuthorization_;
        emit SlashAuthorizationBound(slashAuthorization_);
    }

    function systemName() external pure returns (string memory) {
        return "ComputeStakeVerifierCollateral420";
    }

    function protocolVersion() external pure returns (uint32) {
        return 1;
    }

    function computeVerifierStakeSourceId() external pure returns (bytes32) {
        return SOURCE_ID;
    }

    function positionId(
        bytes32 verifierId,
        address authority,
        bytes32 stakePolicyId
    ) public view returns (bytes32) {
        if (verifierId == bytes32(0) || authority == address(0) || stakePolicyId == bytes32(0)) {
            revert InvalidStake();
        }
        return keccak256(
            abi.encode(POSITION_DOMAIN, block.chainid, address(this), verifierId, authority, stakePolicyId)
        );
    }

    function currentPositionId(bytes32 verifierId, bytes32 stakePolicyId)
        public
        view
        returns (bytes32)
    {
        ComputeVerifierRegistry420.Verifier memory verifier = verifiers.verifier(verifierId);
        return positionId(verifierId, verifier.authority, stakePolicyId);
    }

    function stake(bytes32 verifierId, bytes32 stakePolicyId)
        external
        payable
        returns (bytes32 id, uint64 revision)
    {
        if (entered || msg.value == 0 || stakePolicyId == bytes32(0)) revert InvalidStake();
        entered = true;

        ComputeVerifierRegistry420.Verifier memory verifier = verifiers.verifier(verifierId);
        if (
            msg.sender != verifier.authority
                || verifier.status == ComputeVerifierRegistry420.Status.RETIRED
        ) revert UnauthorizedVerifierAuthority();

        _requireVaultActive();

        id = positionId(verifierId, verifier.authority, stakePolicyId);
        Position storage p = _positions[id];

        if (!p.exists) {
            p.positionId = id;
            p.verifierId = verifierId;
            p.stakePolicyId = stakePolicyId;
            p.authority = verifier.authority;
            p.openedAt = uint64(block.timestamp);
            uint32 frozenSlashPolicyRevision =
                slashPolicies.latestRevision(p.stakePolicyId, 2);
            if (frozenSlashPolicyRevision == 0) revert InvalidStake();
            p.slashPolicyRevision = frozenSlashPolicyRevision;
            p.slashPolicyCommitment =
                slashPolicies.commitment(p.stakePolicyId, 2, frozenSlashPolicyRevision);
            p.openedAtVerifierRevision = verifier.revision;
            p.latestVerifierRevision = verifier.revision;
            p.active = true;
            p.exists = true;
        } else if (
            p.verifierId != verifierId
                || p.stakePolicyId != stakePolicyId
                || p.authority != verifier.authority
                || !p.active
                || p.exiting
                || slashPolicies.latestRevision(stakePolicyId, 2) != p.slashPolicyRevision
                || slashPolicies.commitment(stakePolicyId, 2, p.slashPolicyRevision)
                    != p.slashPolicyCommitment
        ) {
            revert InvalidStake();
        }

        if (p.revision == type(uint64).max || p.trancheCount == type(uint64).max) {
            revert RevisionExhausted();
        }

        revision = p.revision + 1;
        uint64 trancheIndex = p.trancheCount + 1;

        bytes32 trancheId = keccak256(
            abi.encode(
                TRANCHE_DOMAIN,
                block.chainid,
                address(this),
                id,
                verifier.revision,
                trancheIndex,
                revision
            )
        );
        bytes32 obligationId = keccak256(
            abi.encode(
                TRANCHE_DOMAIN,
                block.chainid,
                address(this),
                address(vault),
                vaultId,
                trancheId
            )
        );

        uint256 oldVaultBalance = address(vault).balance;
        VaultAccounting420.AssetAccounting memory oldA =
            accounting.getAccounting(vaultId, address(0));

        vault.depositNative{value: msg.value}();
        vault.createObligation(
            keccak256(abi.encode(TRANCHE_DOMAIN, trancheId, uint8(1))),
            obligationId,
            address(0),
            p.authority,
            msg.value,
            VERIFIER_COLLATERAL_TYPE,
            id
        );

        VaultAccounting420.AssetAccounting memory newA =
            accounting.getAccounting(vaultId, address(0));
        VaultAccounting420.Obligation memory obligation = accounting.getObligation(obligationId);

        if (
            address(vault).balance != oldVaultBalance + msg.value
                || newA.recordedBalance != oldA.recordedBalance + msg.value
                || newA.reserved != oldA.reserved + msg.value
                || newA.claimable != oldA.claimable
                || !obligation.exists
                || obligation.state != 1
                || obligation.vaultId != vaultId
                || obligation.asset != address(0)
                || obligation.beneficiary != p.authority
                || obligation.amount != msg.value
                || obligation.obligationType != VERIFIER_COLLATERAL_TYPE
                || obligation.sourceRef != id
        ) revert InvalidStake();

        p.latestVerifierRevision = verifier.revision;
        p.revision = revision;
        p.trancheCount = trancheIndex;
        p.activeAmount += msg.value;
        p.slashableAmount += msg.value;

        _tranches[id][trancheIndex] = Tranche({
            trancheId: trancheId,
            obligationId: obligationId,
            positionRevision: revision,
            verifierRevision: verifier.revision,
            amount: msg.value,
            createdAt: uint64(block.timestamp),
            exists: true
        });

        emit VerifierCollateralStaked(
            id,
            verifierId,
            stakePolicyId,
            verifier.authority,
            verifier.revision,
            revision,
            trancheIndex,
            trancheId,
            obligationId,
            msg.value,
            p.activeAmount
        );

        entered = false;
    }

    function requestExit(bytes32 id) external returns (uint64 withdrawableAt) {
        if (entered) revert InvalidExit();
        Position storage p = _positions[id];
        if (!p.exists || !p.active || p.exiting || msg.sender != p.authority) revert InvalidExit();

        (ComputeStakeExitPolicy420.Policy memory exitPolicy, bytes32 exactCommitment) =
            exitPolicies.currentPolicy(p.stakePolicyId);

        uint256 maturity = block.timestamp + exitPolicy.withdrawalDelaySeconds;
        if (maturity > type(uint64).max || p.revision == type(uint64).max) {
            revert RevisionExhausted();
        }

        p.exiting = true;
        p.withdrawableAt = uint64(maturity);
        p.exitPolicyRevision = exitPolicy.revision;
        p.exitPolicyCommitment = exactCommitment;
        p.revision += 1;

        emit VerifierCollateralExitRequested(
            id,
            p.authority,
            exitPolicy.revision,
            exactCommitment,
            p.withdrawableAt,
            p.revision
        );
        return p.withdrawableAt;
    }

    function withdraw(bytes32 id, uint64 maxTranches)
        external
        returns (uint256 amount, uint64 throughTranche)
    {
        if (entered || maxTranches == 0) revert InvalidExit();
        if (
            slashAuthorization != address(0)
                && IComputeSlashHold420(slashAuthorization).outstandingSlash(id) != 0
        ) revert InvalidExit();
        entered = true;

        Position storage p = _positions[id];
        if (
            !p.exists
                || !p.active
                || !p.exiting
                || msg.sender != p.authority
                || block.timestamp < p.withdrawableAt
        ) revert ExitNotReady();

        uint64 start = p.withdrawalCursor + 1;
        uint64 cursor = p.withdrawalCursor;
        uint64 processed;

        while (cursor < p.trancheCount && processed < maxTranches) {
            uint64 index = cursor + 1;
            Tranche storage t = _tranches[id][index];
            if (!t.exists) revert TrancheNotFound();

            VaultAccounting420.Obligation memory obligation =
                accounting.getObligation(t.obligationId);
            if (
                obligation.state != 1
                    || obligation.beneficiary != p.authority
                    || obligation.amount != t.amount
                    || obligation.sourceRef != id
                    || obligation.obligationType != VERIFIER_COLLATERAL_TYPE
            ) revert InvalidExit();

            vault.releaseObligation(
                keccak256(abi.encode(EXIT_RELEASE_DOMAIN, block.chainid, address(this), id, index)),
                t.obligationId
            );
            vault.claim(
                keccak256(abi.encode(EXIT_CLAIM_DOMAIN, block.chainid, address(this), id, index)),
                t.obligationId
            );

            amount += t.amount;
            p.activeAmount -= t.amount;
            p.slashableAmount -= t.amount;
            cursor = index;
            processed += 1;
        }

        if (processed == 0 || p.revision == type(uint64).max) revert InvalidExit();

        p.withdrawalCursor = cursor;
        p.revision += 1;
        throughTranche = cursor;

        if (cursor == p.trancheCount) {
            if (p.activeAmount != 0 || p.slashableAmount != 0) revert InvalidExit();
            p.active = false;
            p.exiting = false;
        }

        emit VerifierCollateralWithdrawn(
            id,
            p.authority,
            start,
            throughTranche,
            amount,
            p.activeAmount,
            p.revision
        );

        entered = false;
    }

    function readVerifierPosition(bytes32 verifierId, bytes32 stakePolicyId)
        external
        view
        returns (PositionRead memory out)
    {
        ComputeVerifierRegistry420.Verifier memory verifier = verifiers.verifier(verifierId);
        bytes32 id = positionId(verifierId, verifier.authority, stakePolicyId);
        Position storage p = _positions[id];
        if (!p.exists) return out;

        out = PositionRead({
            positionId: p.positionId,
            positionRevision: p.revision,
            authority: p.authority,
            verifierRevision: p.latestVerifierRevision,
            activeAmount: p.activeAmount,
            slashableAmount: p.slashableAmount,
            active: p.active,
            exiting: p.exiting,
            withdrawableAt: p.withdrawableAt
        });
    }

    function slashSnapshot(bytes32 id) external view returns (
        uint8 subjectKind,
        bytes32 subjectRef,
        address beneficiary,
        bytes32 stakePolicyId,
        uint64 positionRevision,
        uint64 openedAt,
        uint32 slashPolicyRevision,
        bytes32 slashPolicyCommitment,
        uint256 slashableAmount,
        bool active,
        bool exiting,
        bool exists
    ) {
        Position storage p = _positions[id];
        return (
            2,
            bytes32(uint256(uint160(p.authority))),
            p.authority,
            p.stakePolicyId,
            p.revision,
            p.openedAt,
            p.slashPolicyRevision,
            p.slashPolicyCommitment,
            p.slashableAmount,
            p.active,
            p.exiting,
            p.exists
        );
    }

    function position(bytes32 id) external view returns (Position memory p) {
        p = _positions[id];
        if (!p.exists) revert PositionNotFound();
    }

    function tranche(bytes32 id, uint64 index) external view returns (Tranche memory t) {
        t = _tranches[id][index];
        if (!t.exists) revert TrancheNotFound();
    }

    function _requireVaultActive() private view {
        VaultRegistry420.Vault memory registration = vaultRegistry.getVault(vaultId);
        if (
            registration.vaultAddress != address(vault)
                || registration.vaultType != VaultIds420.VAULT_COLLATERAL
                || vaultRegistry.vaultState(vaultId) != VaultRegistry420.VaultState.ACTIVE
        ) revert InvalidStake();
    }

    receive() external payable { revert InvalidStake(); }
    fallback() external payable { revert InvalidStake(); }
}
