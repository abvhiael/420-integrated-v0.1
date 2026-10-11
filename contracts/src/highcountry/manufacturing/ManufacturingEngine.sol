// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { InventoryRegistry } from "../inventory/InventoryRegistry.sol";
import { HCInvalidState, HCZeroAddress } from "../errors/HighCountryErrors.sol";

/// @notice R04.3 recipe-pinned, bounded manufacturing with atomic inventory reservations.
/// @dev Operator grants in InventoryRegistry and issuer grants are independently revocable.
///      Processing uses block timestamps only, never caller-provided completion evidence.
contract ManufacturingEngine {
    enum Status {
        NONE,
        ACTIVE,
        COMPLETED,
        CANCELLED
    }

    struct Recipe {
        bytes32 version;
        bytes32[2] inputs;
        uint256[2] inputAmounts;
        bytes32[2] outputs;
        uint256[2] outputAmounts;
        uint16 cancelLossBps;
        uint64 duration;
        bool active;
        bool exists;
    }

    struct Job {
        bytes32 recipeId;
        address owner;
        uint64 startedAt;
        Status status;
    }

    InventoryRegistry public immutable inventory;
    address public immutable administrator;
    uint16 public immutable maxJobsPerOwner;
    uint64 public constant MAX_DURATION = 365 days;
    mapping(bytes32 => Recipe) private _recipes;
    mapping(bytes32 => Job) private _jobs;
    mapping(address => uint256) public nonceOf;
    mapping(address => uint256) public activeJobs;
    bool private entered;

    event RecipeRegistered(bytes32 indexed recipeId, bytes32 indexed version);
    event RecipeStatusSet(bytes32 indexed recipeId, bool active);
    event ManufacturingStarted(
        bytes32 indexed jobId, bytes32 indexed recipeId, address indexed owner, uint64 startedAt
    );
    event ManufacturingCompleted(bytes32 indexed jobId, address indexed owner);
    event ManufacturingCancelled(bytes32 indexed jobId, address indexed owner, uint16 lossBps);

    modifier guarded() {
        if (entered) revert HCInvalidState();
        entered = true;
        _;
        entered = false;
    }

    modifier onlyAdmin() {
        if (msg.sender != administrator) revert HCInvalidState();
        _;
    }

    constructor(
        address inventory_,
        uint16 maxJobsPerOwner_
    ) {
        if (inventory_ == address(0) || inventory_.code.length == 0) revert HCZeroAddress();
        if (maxJobsPerOwner_ == 0 || maxJobsPerOwner_ > 32) revert HCInvalidState();
        inventory = InventoryRegistry(inventory_);
        administrator = msg.sender;
        maxJobsPerOwner = maxJobsPerOwner_;
    }

    /// @notice A recipe is forever immutable; version changes require a new identifier.
    /// @dev At least one input and output must exist. Each resource must be distinct within its side.
    function registerRecipe(
        bytes32 recipeId,
        bytes32 version,
        bytes32[2] calldata inputs,
        uint256[2] calldata inputAmounts,
        bytes32[2] calldata outputs,
        uint256[2] calldata outputAmounts,
        uint64 duration,
        uint16 cancelLossBps
    ) external onlyAdmin {
        if (
            recipeId == bytes32(0) || version == bytes32(0) || _recipes[recipeId].exists || duration == 0
                || duration > MAX_DURATION || cancelLossBps > 10000 || inputs[0] == bytes32(0) || inputAmounts[0] == 0
                || outputs[0] == bytes32(0) || outputAmounts[0] == 0
        ) revert HCInvalidState();
        for (uint256 i; i < 2; ++i) {
            if (
                (inputs[i] == bytes32(0)) != (inputAmounts[i] == 0)
                    || (outputs[i] == bytes32(0)) != (outputAmounts[i] == 0)
            ) revert HCInvalidState();
        }
        if (
            (inputs[1] != bytes32(0) && inputs[1] == inputs[0])
                || (outputs[1] != bytes32(0) && outputs[1] == outputs[0])
        ) revert HCInvalidState();
        _recipes[recipeId] =
            Recipe(version, inputs, inputAmounts, outputs, outputAmounts, cancelLossBps, duration, true, true);
        emit RecipeRegistered(recipeId, version);
    }

    function setRecipeActive(
        bytes32 recipeId,
        bool active
    ) external onlyAdmin {
        if (!_recipes[recipeId].exists) revert HCInvalidState();
        _recipes[recipeId].active = active;
        emit RecipeStatusSet(recipeId, active);
    }

    function recipe(
        bytes32 recipeId
    ) external view returns (Recipe memory) {
        Recipe memory r = _recipes[recipeId];
        if (!r.exists) revert HCInvalidState();
        return r;
    }

    function job(
        bytes32 jobId
    ) external view returns (Job memory) {
        Job memory j = _jobs[jobId];
        if (j.status == Status.NONE) revert HCInvalidState();
        return j;
    }

    function _operation(
        bytes32 jobId,
        bytes32 phase,
        uint256 index
    ) private pure returns (bytes32) {
        return keccak256(abi.encode("HC.MANUFACTURING.OP.V1", jobId, phase, index));
    }

    function start(
        bytes32 recipeId
    ) external guarded returns (bytes32 jobId) {
        Recipe storage r = _recipes[recipeId];
        if (!r.exists || !r.active || activeJobs[msg.sender] >= maxJobsPerOwner) revert HCInvalidState();
        uint256 nonce = ++nonceOf[msg.sender];
        jobId = keccak256(abi.encode("HC.MANUFACTURING.JOB.V1", block.chainid, address(this), msg.sender, nonce));
        if (_jobs[jobId].status != Status.NONE) revert HCInvalidState();
        _jobs[jobId] = Job(recipeId, msg.sender, uint64(block.timestamp), Status.ACTIVE);
        ++activeJobs[msg.sender];
        for (uint256 i; i < 2; ++i) {
            if (r.inputs[i] != bytes32(0)) {
                inventory.reserveFor(
                    _operation(jobId, bytes32("RESERVE"), i), r.inputs[i], msg.sender, r.inputAmounts[i]
                );
            }
        }
        emit ManufacturingStarted(jobId, recipeId, msg.sender, uint64(block.timestamp));
    }

    function complete(
        bytes32 jobId
    ) external guarded {
        Job storage j = _jobs[jobId];
        if (j.status != Status.ACTIVE || j.owner != msg.sender) revert HCInvalidState();
        Recipe storage r = _recipes[j.recipeId];
        if (block.timestamp < uint256(j.startedAt) + r.duration) revert HCInvalidState();
        j.status = Status.COMPLETED;
        --activeJobs[msg.sender];
        for (uint256 i; i < 2; ++i) {
            if (r.inputs[i] != bytes32(0)) {
                inventory.consumeReservedFor(
                    _operation(jobId, bytes32("CONSUME"), i), r.inputs[i], msg.sender, r.inputAmounts[i]
                );
            }
            if (r.outputs[i] != bytes32(0)) {
                inventory.acquire(_operation(jobId, bytes32("OUTPUT"), i), r.outputs[i], msg.sender, r.outputAmounts[i]);
            }
        }
        emit ManufacturingCompleted(jobId, msg.sender);
    }

    /// @notice Cancelled input loss is floor(input * lossBps / 10000), remaining reserved input refunded.
    function cancel(
        bytes32 jobId
    ) external guarded {
        Job storage j = _jobs[jobId];
        if (j.status != Status.ACTIVE || j.owner != msg.sender) revert HCInvalidState();
        Recipe storage r = _recipes[j.recipeId];
        j.status = Status.CANCELLED;
        --activeJobs[msg.sender];
        for (uint256 i; i < 2; ++i) {
            if (r.inputs[i] == bytes32(0)) continue;
            uint256 loss =
                r.inputAmounts[i] / 10000 * r.cancelLossBps + (r.inputAmounts[i] % 10000) * r.cancelLossBps / 10000;
            if (loss != 0) {
                inventory.consumeReservedFor(_operation(jobId, bytes32("LOSS"), i), r.inputs[i], msg.sender, loss);
            }
            if (r.inputAmounts[i] > loss) {
                inventory.releaseFor(
                    _operation(jobId, bytes32("REFUND"), i), r.inputs[i], msg.sender, r.inputAmounts[i] - loss
                );
            }
        }
        emit ManufacturingCancelled(jobId, msg.sender, r.cancelLossBps);
    }
}
