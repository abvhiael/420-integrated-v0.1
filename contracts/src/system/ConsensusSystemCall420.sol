// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./SystemAccess.sol";
import "../interfaces/I420System.sol";

/// @notice Single execution-layer gateway for consensus-authored state transitions.
/// @dev node420 invokes this predeploy from Geth's native SystemAddress outside the ordinary tx pool.
/// Downstream system contracts bind their consensusSystemCaller to this gateway, never to an EOA.
contract ConsensusSystemCall420 is SystemAccess, I420System {
    // go-ethereum params.SystemAddress (also used by EIP-4788/EIP-2935 system calls).
    address public constant NATIVE_SYSTEM_ORIGIN = 0xfffffffffffffffffffffffffffffffffffffffe;
    address public constant REWARD_CONTROLLER = 0x0000000000000000000000000000000000000420;
    address public constant VALIDATOR_REGISTRY = 0x0000000000000000000000000000000000000423;

    bytes32 public constant DOMAIN = keccak256("420/CONSENSUS_SYSTEM_CALL/V1");
    bytes32 public constant ACTION_VALIDATOR_STATE = keccak256("420/SYSCALL/VALIDATOR_STATE/V1");
    bytes32 public constant ACTION_VALIDATOR_EXIT_NOTICE = keccak256("420/SYSCALL/VALIDATOR_EXIT_NOTICE/V1");
    bytes32 public constant ACTION_VALIDATOR_SLASH = keccak256("420/SYSCALL/VALIDATOR_SLASH/V1");
    bytes32 public constant ACTION_ROTATION_SNAPSHOT = keccak256("420/SYSCALL/ROTATION_SNAPSHOT/V1");
    bytes32 public constant ACTION_REWARD = keccak256("420/SYSCALL/REWARD/V1");

    bytes4 private constant SEL_VALIDATOR_STATE = bytes4(keccak256("applyConsensusState(bytes32,uint8,uint64,uint64,uint64,uint64)"));
    bytes4 private constant SEL_EXIT_NOTICE = bytes4(keccak256("applyExitNotice(bytes32,uint64)"));
    bytes4 private constant SEL_SLASH = bytes4(keccak256("applySlash(bytes32,uint8,uint8,uint256,uint256,bytes32,uint8)"));
    bytes4 private constant SEL_ROTATION = bytes4(keccak256("applyRotationSnapshot(uint64,uint256)"));
    bytes4 private constant SEL_REWARD = bytes4(keccak256("applyConsensusReward(uint64,address,address[],uint256,uint256,uint256,uint256)"));

    uint64 public lastSequence;
    bytes32 public lastCallHash;

    event ConsensusSystemCallApplied(uint64 indexed sequence,uint64 indexed executionBlock,bytes32 indexed action,address target,bytes32 payloadHash,bytes32 callHash);

    error NotNativeSystemOrigin(); error InvalidChainId(); error InvalidExecutionBlock(); error InvalidParentHash();
    error InvalidSequence(); error InvalidAction(); error InvalidTarget(); error InvalidSelector(); error EmptyPayload();
    error DownstreamCallFailed(bytes revertData);

    constructor(address timelock_) SystemAccess(timelock_) {}

    function systemName() external pure returns (string memory) { return "ConsensusSystemCall420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function execute(uint64 sequence,uint64 executionBlock,bytes32 parentHash,uint256 chainId,bytes32 action,address target,bytes calldata payload)
        external returns (bytes32 callHash)
    {
        if (msg.sender != NATIVE_SYSTEM_ORIGIN) revert NotNativeSystemOrigin();
        if (chainId != block.chainid) revert InvalidChainId();
        if (executionBlock != block.number) revert InvalidExecutionBlock();
        if (block.number == 0 || parentHash != blockhash(block.number - 1)) revert InvalidParentHash();
        if (sequence != lastSequence + 1) revert InvalidSequence();
        if (payload.length < 4) revert EmptyPayload();

        bytes4 selector;
        assembly { selector := calldataload(payload.offset) }
        _validateRoute(action, target, selector);

        bytes32 payloadHash = keccak256(payload);
        callHash = keccak256(abi.encode(DOMAIN, block.chainid, sequence, executionBlock, parentHash, action, target, payloadHash));
        lastSequence = sequence;
        lastCallHash = callHash;

        (bool ok, bytes memory returndata) = target.call(payload);
        if (!ok) revert DownstreamCallFailed(returndata);
        emit ConsensusSystemCallApplied(sequence, executionBlock, action, target, payloadHash, callHash);
    }

    function computeCallHash(uint64 sequence,uint64 executionBlock,bytes32 parentHash,uint256 chainId,bytes32 action,address target,bytes32 payloadHash)
        external pure returns (bytes32)
    {
        return keccak256(abi.encode(DOMAIN, chainId, sequence, executionBlock, parentHash, action, target, payloadHash));
    }

    function route(bytes32 action) external pure returns (address target, bytes4 selector) { return _route(action); }

    function _validateRoute(bytes32 action, address target, bytes4 selector) private pure {
        (address expectedTarget, bytes4 expectedSelector) = _route(action);
        if (target != expectedTarget) revert InvalidTarget();
        if (selector != expectedSelector) revert InvalidSelector();
    }

    function _route(bytes32 action) private pure returns (address target, bytes4 selector) {
        if (action == ACTION_VALIDATOR_STATE) return (VALIDATOR_REGISTRY, SEL_VALIDATOR_STATE);
        if (action == ACTION_VALIDATOR_EXIT_NOTICE) return (VALIDATOR_REGISTRY, SEL_EXIT_NOTICE);
        if (action == ACTION_VALIDATOR_SLASH) return (VALIDATOR_REGISTRY, SEL_SLASH);
        if (action == ACTION_ROTATION_SNAPSHOT) return (VALIDATOR_REGISTRY, SEL_ROTATION);
        if (action == ACTION_REWARD) return (REWARD_CONTROLLER, SEL_REWARD);
        revert InvalidAction();
    }
}
