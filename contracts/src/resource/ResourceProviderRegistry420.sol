// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./ResourceAuthorization420.sol";
import "./ResourceIds420.sol";

interface IResourceProviderCollateral420 {
    function providers() external view returns (address);
    function reserveExposure(bytes32 providerId, bytes32 obligationRef, uint256 exposure) external returns (bytes32);
    function releaseExposure(bytes32 key) external;
    function outstandingReservations(bytes32 position) external view returns (uint256);
    function eligible(bytes32 providerId, bytes32 referenceId, address operator, uint256 minimum) external view returns (bool);
}

contract ResourceProviderRegistry420 is I420System {
    enum State {
        NONE,
        REGISTERED,
        ACTIVE,
        SUSPENDED,
        RETIRED
    }

    struct Provider {
        address operatorAccount;
        bytes32 metadataHash;
        bytes32 stakeRef;
        uint32 revision;
        State state;
        bool exists;
    }

    ResourceAuthorization420 public immutable authorization;
    mapping(bytes32 => Provider) private _providers;
    address public immutable governanceTimelock;
    IResourceProviderCollateral420 public collateral;
    bytes32 public collateralCodeHash;
    struct CollateralPolicy {
        uint256 minimumCollateral;
        uint256 minimumSlashable;
        uint64 withdrawalDelay;
        uint32 coverageBps;
        bool acceptingNew;
        bytes32 evidenceHash;
    }
    uint32 public collateralPolicyRevision;
    mapping(uint32 => CollateralPolicy) private _collateralPolicies;
    bool public admissionSuspended;
    event CollateralPolicyPublished(uint32 indexed revision, bytes32 indexed commitment, bytes32 evidenceHash);
    event AdmissionSuspensionChanged(bool suspended);
    mapping(bytes32 => bool) public disciplinarySuspension;
    mapping(bytes32 => address) public collateralSponsor;
    event CollateralAuthorityBound(address indexed authority, bytes32 codeHash);
    event ProviderDisciplineChanged(bytes32 indexed providerId, bool suspended);
    event CollateralSponsorChanged(bytes32 indexed providerId, address indexed sponsor);

    error InvalidProvider();
    error ProviderExists();
    error ProviderNotFound();
    error Unauthorized();
    error InvalidState();
    error StakeRequired();

    event ProviderRegistered(bytes32 indexed providerId, address indexed operatorAccount, bytes32 stakeRef);
    event ProviderUpdated(bytes32 indexed providerId, bytes32 metadataHash, bytes32 stakeRef, uint32 revision);
    event ProviderStateChanged(bytes32 indexed providerId, State state);

    constructor(
        address authorization_, address governanceTimelock_
    ) {
        require(authorization_ != address(0) && governanceTimelock_ != address(0), "dependency");
        governanceTimelock = governanceTimelock_;
        authorization = ResourceAuthorization420(authorization_);
    }

    function bindCollateral(address authority) external {
        if (msg.sender != governanceTimelock) revert Unauthorized();
        if (address(collateral) != address(0) || authority.code.length == 0
            || IResourceProviderCollateral420(authority).providers() != address(this)) revert InvalidProvider();
        collateral = IResourceProviderCollateral420(authority);
        collateralCodeHash = authority.codehash;
        emit CollateralAuthorityBound(authority, collateralCodeHash);
    }

    function publishCollateralPolicy(
        uint256 minimum, uint256 slashable, uint64 delaySeconds, uint32 coverageBps,
        bool acceptingNew, bytes32 evidenceHash
    ) external returns (uint32 revision) {
        if (msg.sender != governanceTimelock) revert Unauthorized();
        if (minimum == 0 || slashable == 0 || slashable > minimum || delaySeconds == 0
            || coverageBps == 0 || evidenceHash == bytes32(0)) revert InvalidProvider();
        revision = ++collateralPolicyRevision;
        _collateralPolicies[revision] = CollateralPolicy(minimum, slashable, delaySeconds, coverageBps, acceptingNew, evidenceHash);
        emit CollateralPolicyPublished(revision, collateralPolicyCommitment(revision), evidenceHash);
    }

    function collateralPolicy(uint32 revision) public view returns (CollateralPolicy memory) {
        if (revision == 0 || revision > collateralPolicyRevision) revert InvalidProvider();
        return _collateralPolicies[revision];
    }

    function collateralPolicyCommitment(uint32 revision) public view returns (bytes32) {
        return keccak256(abi.encode("420/RESOURCE/COLLATERAL/POLICY/V1", block.chainid, address(this), revision, collateralPolicy(revision)));
    }

    function minimumCollateral() external view returns (uint256) {
        return _collateralPolicies[collateralPolicyRevision].minimumCollateral;
    }

    function setAdmissionSuspended(bool suspended) external {
        if (msg.sender != governanceTimelock) revert Unauthorized();
        admissionSuspended = suspended;
        emit AdmissionSuspensionChanged(suspended);
    }

    /// @notice Required slashable backing for a given aggregate native-420 exposure, rounded up.
    function requiredSlashable(uint256 exposure) public view returns (uint256) {
        CollateralPolicy memory policy = collateralPolicy(collateralPolicyRevision);
        uint256 covered = (exposure / 10000) * policy.coverageBps;
        uint256 remainder = (exposure % 10000) * policy.coverageBps;
        covered += (remainder + 9999) / 10000;
        return covered > policy.minimumSlashable ? covered : policy.minimumSlashable;
    }

    function setCollateralSponsor(bytes32 providerId, address sponsor) external {
        Provider storage p = _get(providerId);
        if (msg.sender != p.operatorAccount) revert Unauthorized();
        collateralSponsor[providerId] = sponsor;
        emit CollateralSponsorChanged(providerId, sponsor);
    }

    function setDisciplinarySuspension(bytes32 providerId, bool suspended) external {
        if (msg.sender != governanceTimelock) revert Unauthorized();
        Provider storage p = _get(providerId);
        disciplinarySuspension[providerId] = suspended;
        if (suspended && p.state == State.ACTIVE) {
            p.state = State.SUSPENDED;
            p.revision++;
            emit ProviderStateChanged(providerId, State.SUSPENDED);
        }
        emit ProviderDisciplineChanged(providerId, suspended);
    }

    function systemName() external pure returns (string memory) {
        return "ResourceProviderRegistry420";
    }

    function protocolVersion() external pure returns (uint32) {
        return 1;
    }

    function registerProvider(
        bytes32 providerId,
        address operatorAccount,
        bytes32 metadataHash,
        bytes32 stakeRef
    ) external {
        if (providerId == 0 || operatorAccount == address(0)) revert InvalidProvider();
        if (_providers[providerId].exists) revert ProviderExists();
        if (
            msg.sender != operatorAccount
                && !authorization.isProviderAuthorized(msg.sender, providerId, ResourceIds420.ACTION_REGISTER_PROVIDER)
        ) revert Unauthorized();

        _providers[providerId] = Provider(operatorAccount, metadataHash, stakeRef, 1, State.REGISTERED, true);
        emit ProviderRegistered(providerId, operatorAccount, stakeRef);
    }

    function setState(
        bytes32 providerId,
        State next
    ) external {
        Provider storage p = _get(providerId);
        if (
            msg.sender != p.operatorAccount
                && !authorization.isProviderAuthorized(msg.sender, providerId, ResourceIds420.ACTION_SET_PROVIDER_STATE)
        ) revert Unauthorized();

        State old = p.state;
        bool ok = (old == State.REGISTERED && (next == State.ACTIVE || next == State.RETIRED))
            || (old == State.ACTIVE && (next == State.SUSPENDED || next == State.RETIRED))
            || (old == State.SUSPENDED && (next == State.ACTIVE || next == State.RETIRED));
        if (!ok) revert InvalidState();
        if (next == State.ACTIVE && !_eligible(providerId, p)) revert StakeRequired();

        p.state = next;
        p.revision++;
        emit ProviderStateChanged(providerId, next);
    }

    function updateProvider(
        bytes32 providerId,
        bytes32 metadataHash,
        bytes32 stakeRef
    ) external {
        Provider storage p = _get(providerId);
        if (p.state == State.ACTIVE || p.state == State.RETIRED) revert InvalidState();
        if (
            msg.sender != p.operatorAccount
                && !authorization.isProviderAuthorized(msg.sender, providerId, ResourceIds420.ACTION_UPDATE_PROVIDER)
        ) revert Unauthorized();

        p.metadataHash = metadataHash;
        p.stakeRef = stakeRef;
        p.revision++;
        emit ProviderUpdated(providerId, metadataHash, stakeRef, p.revision);
    }

    function getProvider(
        bytes32 providerId
    ) external view returns (Provider memory) {
        return _get(providerId);
    }

    function isActive(
        bytes32 providerId
    ) external view returns (bool) {
        Provider storage p = _providers[providerId];
        return p.exists && p.state == State.ACTIVE && _eligible(providerId, p);
    }

    function _eligible(bytes32 providerId, Provider storage p) private view returns (bool) {
        CollateralPolicy storage policy = _collateralPolicies[collateralPolicyRevision];
        if (disciplinarySuspension[providerId] || admissionSuspended || !policy.acceptingNew || policy.minimumCollateral == 0 || address(collateral) == address(0)
            || address(collateral).codehash != collateralCodeHash || p.stakeRef == bytes32(0)) return false;
        try collateral.eligible(providerId, p.stakeRef, p.operatorAccount, policy.minimumCollateral) returns (bool ok) {
            return ok;
        } catch { return false; }
    }

    function _get(
        bytes32 id
    ) private view returns (Provider storage p) {
        p = _providers[id];
        if (!p.exists) revert ProviderNotFound();
    }
}
