// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./SwapGenesisIntegration420.t.sol";

interface VmSwap420 { function targetContract(address) external; }

contract SwapInvariantHandler420 {
    CanonicalSwapExecutor420 public immutable executor;
    MockCanonicalPoolExecution420 public immutable pool;
    bytes32 public immutable marketId;
    address public immutable inputAsset;
    address public immutable settlementAsset;
    uint256 public lastAcceptedInput;
    uint256 public lastAcceptedExact;
    uint256 public lastAcceptedSpent;
    uint256 public lastAcceptedDelivered;

    constructor(CanonicalSwapExecutor420 executor_, MockCanonicalPoolExecution420 pool_, bytes32 marketId_, address input_, address settlement_) {
        executor = executor_; pool = pool_; marketId = marketId_; inputAsset = input_; settlementAsset = settlement_;
    }

    function step(uint96 rawInput, uint96 rawSpent, uint96 rawExact, uint96 rawDelivered) external {
        uint256 input = uint256(rawInput) + 1;
        uint256 spent = uint256(rawSpent) + 1;
        uint256 exact = uint256(rawExact) + 1;
        uint256 delivered = uint256(rawDelivered) + 1;
        pool.setResult(spent, delivered, false);
        (bool ok, bytes memory data) = address(executor).call(abi.encodeWithSelector(
            executor.executeCanonicalSwap.selector,
            marketId, address(this), address(0xB0B), inputAsset, settlementAsset, input, exact
        ));
        if (ok) {
            (uint256 acceptedSpent, uint256 acceptedDelivered) = abi.decode(data, (uint256,uint256));
            lastAcceptedInput = input;
            lastAcceptedExact = exact;
            lastAcceptedSpent = acceptedSpent;
            lastAcceptedDelivered = acceptedDelivered;
        }
    }
}

contract SwapInvariant420Test {
    VmSwap420 constant vm = VmSwap420(address(uint160(uint256(keccak256("hevm cheat code")))));
    SwapInvariantHandler420 internal handler;

    function setUp() public {
        bytes32 marketId = keccak256("CADC/420");
        address input = address(0x420);
        address settlement = address(0xCA420);
        GenesisMockEnvironment420 env = new GenesisMockEnvironment420();
        CanonicalMarketRegistry markets = new CanonicalMarketRegistry(address(this), address(env.registry()), keccak256("m"));
        CanonicalSwapExecutor420 executor = new CanonicalSwapExecutor420(address(this), address(env.registry()), keccak256("e"));
        MockCanonicalPoolExecution420 pool = new MockCanonicalPoolExecution420();
        env.registerResident(address(markets), markets.componentId());
        env.registerResident(address(executor), executor.componentId());
        env.setSettlementAsset(settlement, keccak256("CADC"), true);
        env.health().setMarket(marketId, true);
        markets.setMarket(marketId, address(pool), input, settlement, CanonicalMarketRegistry.Role.CANONICAL_CAD, bytes32(0), true);
        handler = new SwapInvariantHandler420(executor, pool, marketId, input, settlement);
        executor.setTrustedCaller(address(handler), true);
        vm.targetContract(address(handler));
    }

    function invariant_NoAcceptedOverspend() public view {
        if (handler.lastAcceptedInput() != 0) require(handler.lastAcceptedSpent() <= handler.lastAcceptedInput(), "accepted overspend");
    }

    function invariant_NoAcceptedUnderSettlement() public view {
        if (handler.lastAcceptedExact() != 0) require(handler.lastAcceptedDelivered() >= handler.lastAcceptedExact(), "accepted under settlement");
    }
}
