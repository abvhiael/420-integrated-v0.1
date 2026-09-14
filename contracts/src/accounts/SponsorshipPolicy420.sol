// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @notice Deterministic sponsorship policy commitments for 420Gas.
/// @dev A policy may narrow whether an already-authorized operation is sponsored. It never grants account authority.
contract SponsorshipPolicy420 {
    bytes32 public constant POLICY_DOMAIN = keccak256("420/GAS/SPONSORSHIP_POLICY/V1");

    struct Policy {
        address account;
        address target;
        bytes4 selector;
        uint256 maxValueWei;
        uint256 maxCostWei;
        uint48 validAfter;
        uint48 validUntil;
        bytes32 capabilityCommitment;
        bytes32 sessionCommitment;
    }

    struct Evaluation {
        address account;
        address target;
        bytes4 selector;
        uint256 valueWei;
        uint256 maxCostWei;
        uint48 timestamp;
        bytes32 capabilityCommitment;
        bytes32 sessionCommitment;
    }

    address public immutable owner;
    mapping(bytes32 => Policy) private _policies;
    mapping(bytes32 => bool) private _registered;
    mapping(bytes32 => bool) private _enabled;

    event PolicyRegistered(bytes32 indexed policyId, address indexed account, address indexed target, bytes4 selector);
    event PolicyEnabled(bytes32 indexed policyId, bool enabled);

    error NotOwner();
    error InvalidPolicy();
    error PolicyAlreadyRegistered(bytes32 policyId);
    error UnknownPolicy(bytes32 policyId);

    constructor(address owner_) {
        if (owner_ == address(0)) revert InvalidPolicy();
        owner = owner_;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    function policyId(Policy memory policy) public pure returns (bytes32) {
        return keccak256(
            abi.encode(
                POLICY_DOMAIN,
                policy.account,
                policy.target,
                policy.selector,
                policy.maxValueWei,
                policy.maxCostWei,
                policy.validAfter,
                policy.validUntil,
                policy.capabilityCommitment,
                policy.sessionCommitment
            )
        );
    }

    function registerPolicy(Policy calldata policy) external onlyOwner returns (bytes32 id) {
        _validatePolicy(policy);
        Policy memory copy = policy;
        id = policyId(copy);
        if (_registered[id]) revert PolicyAlreadyRegistered(id);

        _policies[id] = copy;
        _registered[id] = true;
        _enabled[id] = true;
        emit PolicyRegistered(id, policy.account, policy.target, policy.selector);
        emit PolicyEnabled(id, true);
    }

    function setPolicyEnabled(bytes32 id, bool enabled) external onlyOwner {
        if (!_registered[id]) revert UnknownPolicy(id);
        _enabled[id] = enabled;
        emit PolicyEnabled(id, enabled);
    }

    function registered(bytes32 id) external view returns (bool) {
        return _registered[id];
    }

    function enabled(bytes32 id) external view returns (bool) {
        return _registered[id] && _enabled[id];
    }

    function getPolicy(bytes32 id) external view returns (Policy memory) {
        if (!_registered[id]) revert UnknownPolicy(id);
        return _policies[id];
    }

    function evaluate(bytes32 id, Evaluation calldata evaluation) external view returns (bool) {
        if (!_registered[id] || !_enabled[id]) return false;
        Policy storage policy = _policies[id];

        if (evaluation.account != policy.account) return false;
        if (evaluation.target != policy.target) return false;
        if (evaluation.selector != policy.selector) return false;
        if (evaluation.valueWei > policy.maxValueWei) return false;
        if (evaluation.maxCostWei > policy.maxCostWei) return false;
        if (evaluation.timestamp < policy.validAfter || evaluation.timestamp > policy.validUntil) return false;

        if (
            policy.capabilityCommitment != bytes32(0)
                && evaluation.capabilityCommitment != policy.capabilityCommitment
        ) return false;
        if (policy.sessionCommitment != bytes32(0) && evaluation.sessionCommitment != policy.sessionCommitment) {
            return false;
        }

        return true;
    }

    function _validatePolicy(Policy calldata policy) private pure {
        if (policy.account == address(0) || policy.target == address(0) || policy.selector == bytes4(0)) {
            revert InvalidPolicy();
        }
        if (policy.maxCostWei == 0 || policy.validUntil == 0 || policy.validUntil <= policy.validAfter) {
            revert InvalidPolicy();
        }
    }
}
