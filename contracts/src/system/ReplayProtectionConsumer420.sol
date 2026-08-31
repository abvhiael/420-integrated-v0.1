// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./GenesisResidentAccess420.sol";
import "../interfaces/genesis/IReplayProtection420.sol";
import "../interfaces/genesis/IReplayConsumer420.sol";
import "../interfaces/genesis/Types420.sol";
import "../interfaces/genesis/ISystemSafety420.sol";

/// @notice Canonical mutable replay-protection companion for Genesis applications.
/// @dev Keeps IReplayProtection420 frozen/read-only while adding a domain-bound consumption path.
/// Governance binds exactly one consumer per replay domain so arbitrary callers cannot grief IDs.
contract ReplayProtectionConsumer420 is GenesisResidentAccess420, IReplayProtection420, IReplayConsumer420 {
    bytes32 public constant COMPONENT_ID = keccak256("420/GENESIS/REPLAY_PROTECTION/V1");
    bytes32 public constant ACTION_CONFIGURE_CONSUMER = keccak256("420/GENESIS/REPLAY/CONFIGURE_CONSUMER/V1");
    bytes32 public constant ACTION_CONSUME = keccak256("420/GENESIS/REPLAY/CONSUME/V1");

    mapping(bytes32 => bool) private _consumed;
    mapping(bytes32 => bytes32) private _domain;
    mapping(address => mapping(bytes32 => uint256)) private _nonce;
    mapping(bytes32 => address) public domainConsumer;

    event ReplayDomainConsumerSet(bytes32 indexed domain, address indexed consumer);
    event ReplayConsumed(bytes32 indexed objectId, bytes32 indexed domain, address indexed consumer);

    constructor(address timelock_, address registry_, bytes32 genesisConfigHash_)
        GenesisResidentAccess420(timelock_, registry_, genesisConfigHash_)
    {}

    function componentId() public pure override returns (bytes32) { return COMPONENT_ID; }

    function setDomainConsumer(bytes32 domain, address consumer) external {
        _requireGenesisGovernance(ACTION_CONFIGURE_CONSUMER);
        require(domain != bytes32(0) && consumer != address(0) && consumer.code.length != 0, "consumer");
        domainConsumer[domain] = consumer;
        emit ReplayDomainConsumerSet(domain, consumer);
    }

    function nonce(address actor, bytes32 domain) external view returns (uint256) {
        return _nonce[actor][domain];
    }

    function isConsumed(bytes32 objectId) external view returns (bool) {
        return _consumed[objectId];
    }

    function objectDomain(bytes32 objectId) external view returns (bytes32) {
        return _domain[objectId];
    }

    function consume(bytes32 objectId, bytes32 domain) external {
        _requireOperational(ACTION_CONSUME, ISystemSafety420.ActionClass.NORMAL_ONLY, Types420.Direction.NONE);
        require(objectId != bytes32(0) && domain != bytes32(0), "replay input");
        require(domainConsumer[domain] == msg.sender, "replay consumer");
        require(!_consumed[objectId], "replay consumed");
        _consumed[objectId] = true;
        _domain[objectId] = domain;
        unchecked { ++_nonce[msg.sender][domain]; }
        emit ReplayConsumed(objectId, domain, msg.sender);
    }
}
