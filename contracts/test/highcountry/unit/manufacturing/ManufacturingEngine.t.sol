// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import { bindRetainedR04Emergency, retainedR04AuthorizationRoot } from "../../mocks/R04EmergencyFixture.sol";

import { InventoryRegistry } from "../../../../src/highcountry/inventory/InventoryRegistry.sol";
import { ManufacturingEngine } from "../../../../src/highcountry/manufacturing/ManufacturingEngine.sol";
import { HarvestProductRegistry } from "../../../../src/highcountry/harvest/HarvestProductRegistry.sol";
import { ResourceLedger } from "../../../../src/highcountry/inventory/ResourceLedger.sol";

interface VmR043 {
    function warp(
        uint256 timestamp
    ) external;
}

contract R043Source {
    function getProduct(
        bytes32
    ) external pure returns (HarvestProductRegistry.Product memory) {
        revert("not used");
    }
}

contract R043Actor {
    function enable(
        InventoryRegistry inv,
        address module
    ) external {
        inv.setInventoryOperator(module, true);
    }

    function start(
        ManufacturingEngine engine,
        bytes32 recipeId
    ) external returns (bytes32) {
        return engine.start(recipeId);
    }

    function complete(
        ManufacturingEngine engine,
        bytes32 id
    ) external {
        engine.complete(id);
    }

    function cancel(
        ManufacturingEngine engine,
        bytes32 id
    ) external {
        engine.cancel(id);
    }

    function startRequest(
        ManufacturingEngine engine,
        bytes32 recipeId,
        bytes32 requestId
    ) external returns (bytes32) {
        return engine.startWithRequest(recipeId, requestId);
    }

    function finishRetry(
        ManufacturingEngine engine,
        bytes32 id
    ) external {
        engine.completeIdempotent(id);
    }
}

contract ManufacturingEngineR043Test {
    VmR043 constant vm = VmR043(address(uint160(uint256(keccak256("hevm cheat code")))));
    bytes32 constant RAW = keccak256("HC.RAW");
    bytes32 constant FINISHED = keccak256("HC.FINISHED");
    bytes32 constant RECIPE = keccak256("HC.RECIPE.V1");
    InventoryRegistry inventory;
    ManufacturingEngine engine;
    ResourceLedger ledger;
    R043Actor alice;
    R043Actor bob;

    function setUp() public {
        R043Source source = new R043Source();
        inventory = new InventoryRegistry(address(source));
        inventory.registerResource(RAW, InventoryRegistry.Unit.COUNT);
        inventory.registerResource(FINISHED, InventoryRegistry.Unit.COUNT);
        alice = new R043Actor();
        bob = new R043Actor();
        engine = new ManufacturingEngine(retainedR04AuthorizationRoot(), address(inventory), 1);
        bindRetainedR04Emergency(address(engine));
        ledger = inventory.ledger();
        inventory.setIssuer(address(this), true);
        inventory.setIssuer(address(engine), true);
        alice.enable(inventory, address(engine));
        bytes32[2] memory ins;
        uint256[2] memory amounts;
        bytes32[2] memory outs;
        uint256[2] memory produced;
        ins[0] = RAW;
        amounts[0] = 10;
        outs[0] = FINISHED;
        produced[0] = 3;
        engine.registerRecipe(RECIPE, bytes32(uint256(1)), ins, amounts, outs, produced, 100, 1000);
        inventory.acquire(bytes32(uint256(111)), RAW, address(alice), 30);
    }

    function testStartCompleteConservationAndReplay() public {
        bytes32 id = alice.start(engine, RECIPE);
        ResourceLedger.Balance memory b = ledger.balance(RAW, address(alice));
        require(b.available == 20 && b.reserved == 10, "not reserved");
        (bool doubleQueue,) = address(alice).call(abi.encodeCall(alice.start, (engine, RECIPE)));
        require(!doubleQueue, "queue bound");
        (bool early,) = address(alice).call(abi.encodeCall(alice.complete, (engine, id)));
        require(!early, "early completion");
        vm.warp(block.timestamp + 100);
        alice.complete(engine, id);
        b = ledger.balance(RAW, address(alice));
        require(b.available == 20 && b.reserved == 0 && b.consumed == 10, "input conservation");
        b = ledger.balance(FINISHED, address(alice));
        require(b.available == 3 && b.reserved == 0, "exact output");
        (bool replay,) = address(alice).call(abi.encodeCall(alice.complete, (engine, id)));
        require(!replay, "double completion");
        require(engine.activeJobs(address(alice)) == 0, "queue not released");
        require(ledger.reconciles(RAW) && ledger.reconciles(FINISHED), "manufacturing supply mismatch");
        require(ledger.availableTotal(RAW) == 20 && ledger.reservedTotal(RAW) == 0, "input totals mismatch");
        require(ledger.availableTotal(FINISHED) == 3, "output totals mismatch");
    }

    function testCancelLossAndRefund() public {
        bytes32 id = alice.start(engine, RECIPE);
        alice.cancel(engine, id);
        ResourceLedger.Balance memory b = ledger.balance(RAW, address(alice));
        require(b.available == 29 && b.reserved == 0 && b.consumed == 1, "cancel loss");
        require(ledger.balance(FINISHED, address(alice)).available == 0, "output on cancel");
        require(ledger.availableTotal(RAW) == 29 && ledger.reservedTotal(RAW) == 0, "cancel supply mismatch");
        require(ledger.reconciles(RAW) && ledger.reconciles(FINISHED), "cancel conservation mismatch");
        (bool twice,) = address(alice).call(abi.encodeCall(alice.cancel, (engine, id)));
        require(!twice, "duplicate cancel");
    }

    function testUnauthorizedOwnerAndMissingGrant() public {
        (bool unapproved,) = address(bob).call(abi.encodeCall(bob.start, (engine, RECIPE)));
        require(!unapproved, "unapproved start");
        bytes32 id = alice.start(engine, RECIPE);
        vm.warp(block.timestamp + 101);
        (bool theft,) = address(bob).call(abi.encodeCall(bob.complete, (engine, id)));
        require(!theft, "cross-account settlement");
        alice.complete(engine, id);
    }

    function testRecipeImmutableAndMissingIssuerRollsBack() public {
        bytes32[2] memory ins;
        uint256[2] memory amounts;
        bytes32[2] memory outs;
        uint256[2] memory produced;
        ins[0] = RAW;
        amounts[0] = 10;
        outs[0] = FINISHED;
        produced[0] = 3;
        (bool overrideRecipe,) = address(engine)
            .call(
                abi.encodeCall(
                    engine.registerRecipe,
                    (RECIPE, bytes32(uint256(2)), ins, amounts, outs, produced, uint64(100), uint16(0))
                )
            );
        require(!overrideRecipe, "mutable recipe");
        inventory.setIssuer(address(engine), false);
        bytes32 id = alice.start(engine, RECIPE);
        vm.warp(block.timestamp + 101);
        (bool unpaid,) = address(alice).call(abi.encodeCall(alice.complete, (engine, id)));
        require(!unpaid, "unfunded output");
        require(engine.activeJobs(address(alice)) == 1, "job failed to rollback");
        require(ledger.balance(RAW, address(alice)).reserved == 10, "reserved inputs lost");
        inventory.setIssuer(address(engine), true);
        alice.complete(engine, id);
    }

    function testRetrySafeStartAndCompleteSurviveReplayedRequests() public {
        bytes32 requestId = keccak256("client-request-1");
        bytes32 id = alice.startRequest(engine, RECIPE, requestId);
        require(alice.startRequest(engine, RECIPE, requestId) == id, "duplicate start produced new job");
        require(engine.nonceOf(address(alice)) == 1, "duplicate start advanced nonce");
        require(engine.activeJobs(address(alice)) == 1, "duplicate start used queue");
        require(ledger.balance(RAW, address(alice)).reserved == 10, "duplicate reserve");
        (bool crossRecipe,) =
            address(alice).call(abi.encodeCall(alice.startRequest, (engine, bytes32(uint256(99)), requestId)));
        require(!crossRecipe, "request reused across recipes");
        vm.warp(block.timestamp + 100);
        alice.finishRetry(engine, id);
        alice.finishRetry(engine, id);
        require(ledger.balance(RAW, address(alice)).consumed == 10, "replay double consumed");
        require(ledger.balance(FINISHED, address(alice)).available == 3, "replay double issued");
        require(engine.activeJobs(address(alice)) == 0, "completion did not release queue");
        require(alice.startRequest(engine, RECIPE, requestId) == id, "terminal retry started new job");
        require(engine.nonceOf(address(alice)) == 1, "terminal replay changed nonce");
        (bool wrongOwner,) = address(bob).call(abi.encodeCall(bob.finishRetry, (engine, id)));
        require(!wrongOwner, "foreign client replay allowed");
    }

    function testOutputIssuanceFailureRecoveryWithRequestIdentity() public {
        bytes32 requestId = keccak256("client-request-recovery");
        bytes32 id = alice.startRequest(engine, RECIPE, requestId);
        inventory.setIssuer(address(engine), false);
        vm.warp(block.timestamp + 100);
        (bool rejected,) = address(alice).call(abi.encodeCall(alice.finishRetry, (engine, id)));
        require(!rejected, "failed downstream issuance accepted");
        require(engine.job(id).status == ManufacturingEngine.Status.ACTIVE, "failed job went terminal");
        require(engine.activeJobs(address(alice)) == 1, "failed settlement freed queue");
        require(ledger.balance(RAW, address(alice)).reserved == 10, "failed settle lost reservation");
        require(ledger.balance(RAW, address(alice)).consumed == 0, "failed settle consumed inputs");
        require(ledger.balance(FINISHED, address(alice)).available == 0, "failed settle issued outputs");
        require(alice.startRequest(engine, RECIPE, requestId) == id, "recovery lost request identity");
        inventory.setIssuer(address(engine), true);
        alice.finishRetry(engine, id);
        alice.finishRetry(engine, id);
        require(ledger.balance(RAW, address(alice)).consumed == 10, "recovery input nonconservation");
        require(ledger.balance(FINISHED, address(alice)).available == 3, "recovery duplicate output");
        require(engine.activeJobs(address(alice)) == 0, "recovery queue leak");
    }
}
