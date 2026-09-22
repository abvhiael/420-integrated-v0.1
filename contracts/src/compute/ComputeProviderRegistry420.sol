// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "../system/SystemAccess.sol";

/// @notice Provider identity foundation. This registry holds no stake or funds and does not certify hardware.
/// @dev Only a provider's authenticated operator can update its future-facing metadata. A match must
///      snapshot its beneficiary: changing settlementAccount here NEVER changes a previous entitlement.
contract ComputeProviderRegistry420 is I420System, SystemAccess {
    bytes32 public constant IDENTITY_DOMAIN_V1 = keccak256("420Integrated.ComputeMarket.Identity.v1");
    bytes32 public constant PROVIDER_TAG = keccak256("PROVIDER");
    enum Status { NONE, REGISTERED, ACTIVE, SUSPENDED, RETIRED }
    struct Provider {
        address registrant;
        address operator;
        address settlementAccount;
        bytes32 manifestHash;
        bytes32 securityReference;
        uint64 createdAt;
        uint64 revision;
        Status status;
    }
    uint64 public nextSerial;
    mapping(bytes32 => Provider) private _current;
    mapping(bytes32 => mapping(uint64 => Provider)) private _history;
    error InvalidIdentity();
    error InvalidState();
    error UnauthorizedOperator();
    error SerialExhausted();
    event ProviderRegistered(bytes32 indexed providerId, address indexed registrant, uint64 serial);
    event ProviderRevised(bytes32 indexed providerId, uint64 oldRevision, uint64 newRevision, bytes32 oldCommitment, bytes32 newCommitment);

    constructor(address timelock_) SystemAccess(timelock_) {}
    function systemName() external pure returns (string memory) { return "ComputeProviderRegistry420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }
    function deriveId(uint64 serial) public view returns (bytes32) {
        if (block.chainid == 0 || serial == 0) revert InvalidIdentity();
        return keccak256(abi.encode(IDENTITY_DOMAIN_V1, block.chainid, address(this), PROVIDER_TAG, serial));
    }
    function provider(bytes32 id) public view returns (Provider memory p) {
        p = _current[id];
        if (p.status == Status.NONE) revert InvalidIdentity();
    }
    function revision(bytes32 id, uint64 version) external view returns (Provider memory p) {
        p = _history[id][version];
        if (p.status == Status.NONE) revert InvalidIdentity();
    }
    function isActive(bytes32 id) external view returns (bool) { return _current[id].status == Status.ACTIVE; }
    function isOperator(bytes32 id, address actor) external view returns (bool) {
        Provider storage p = _current[id];
        return actor != address(0) && p.status == Status.ACTIVE && p.operator == actor;
    }
    function register(bytes32 manifestHash, bytes32 securityReference, address settlementAccount) external returns (bytes32 id) {
        if (msg.sender == address(0) || settlementAccount == address(0) || manifestHash == bytes32(0)
            || securityReference == bytes32(0) || block.chainid == 0) revert InvalidIdentity();
        if (nextSerial == type(uint64).max) revert SerialExhausted();
        uint64 serial = ++nextSerial;
        id = deriveId(serial);
        if (_current[id].status != Status.NONE) revert InvalidIdentity();
        Provider memory p = Provider(msg.sender, msg.sender, settlementAccount, manifestHash,
            securityReference, uint64(block.timestamp), 1, Status.REGISTERED);
        _current[id] = p;
        _history[id][1] = p;
        emit ProviderRegistered(id, msg.sender, serial);
    }
    /// @dev Governance confirmation is an administrative gate, NOT evidence that stake is actually escrowed.
    function activate(bytes32 id) external onlyGovernance {
        Provider memory p = provider(id);
        if (p.status != Status.REGISTERED && p.status != Status.SUSPENDED) revert InvalidState();
        p.status = Status.ACTIVE;
        _commit(id, p);
    }
    function suspend(bytes32 id) external {
        Provider memory p = provider(id);
        if (msg.sender != p.operator && msg.sender != governanceTimelock) revert UnauthorizedOperator();
        if (p.status != Status.ACTIVE) revert InvalidState();
        p.status = Status.SUSPENDED;
        _commit(id, p);
    }
    function retire(bytes32 id) external onlyGovernance {
        Provider memory p = provider(id);
        if (p.status == Status.RETIRED) revert InvalidState();
        p.status = Status.RETIRED;
        _commit(id, p);
    }
    function update(bytes32 id, bytes32 manifestHash, bytes32 securityReference, address settlementAccount) external {
        Provider memory p = provider(id);
        if (msg.sender != p.operator) revert UnauthorizedOperator();
        if (p.status == Status.RETIRED || manifestHash == bytes32(0) || securityReference == bytes32(0)
            || settlementAccount == address(0)) revert InvalidState();
        p.manifestHash = manifestHash;
        p.securityReference = securityReference;
        p.settlementAccount = settlementAccount;
        // Any material security/beneficiary change requires fresh governance activation.
        p.status = Status.SUSPENDED;
        _commit(id, p);
    }
    function _commit(bytes32 id, Provider memory p) private {
        Provider memory old = _current[id];
        if (old.revision == type(uint64).max) revert SerialExhausted();
        p.revision = old.revision + 1;
        bytes32 oldHash = keccak256(abi.encode(old));
        bytes32 newHash = keccak256(abi.encode(p));
        _current[id] = p;
        _history[id][p.revision] = p;
        emit ProviderRevised(id, old.revision, p.revision, oldHash, newHash);
    }
}
