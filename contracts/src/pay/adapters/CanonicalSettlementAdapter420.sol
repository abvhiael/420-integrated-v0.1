// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../../system/GenesisResidentAccess420.sol";
import "../../interfaces/genesis/Types420.sol";
import "../../interfaces/genesis/ISystemSafety420.sol";
import "../../interfaces/ICanonicalSettlement420.sol";
import "../PayIds420.sol";

/// @notice Policy wrapper around the canonical 420Swap executor.
/// @dev Health and asset eligibility are consumed from the frozen shared interface layer.
contract CanonicalSettlementAdapter420 is GenesisResidentAccess420, ICanonicalSettlement420 {
    uint64 public constant QUOTE_LIFETIME = 42 seconds;

    address public swapExecutor;
    mapping(bytes32 => bool) public consumedQuote;

    event SwapExecutorSet(address indexed executor);
    event SettlementExecuted(
        bytes32 indexed quoteId,
        address indexed payer,
        address indexed recipient,
        uint256 inputSpent,
        uint256 delivered
    );

    constructor(
        address timelock_,
        address registry_,
        bytes32 genesisConfigHash_,
        address executor_
    ) GenesisResidentAccess420(timelock_, registry_, genesisConfigHash_) {
        require(executor_ != address(0) && executor_.code.length != 0, "executor");
        swapExecutor = executor_;
    }

    function componentId() public pure override returns (bytes32) { return PayIds420.SETTLEMENT_ADAPTER; }

    function setSwapExecutor(address executor_) external {
        _requireGenesisGovernance(PayIds420.ACTION_CONFIGURE);
        require(executor_ != address(0) && executor_.code.length != 0, "executor");
        swapExecutor = executor_;
        emit SwapExecutorSet(executor_);
    }

    function quote(bytes32, address, address, uint256) external pure returns (Quote memory) {
        revert("quote produced by canonical quote engine");
    }

    function execute(
        Quote calldata q,
        address payer,
        address recipient,
        uint256 exactSettlementAmount
    ) external payable returns (uint256 inputSpent, uint256 settlementDelivered) {
        _requireOperational(
            PayIds420.ACTION_SETTLE,
            ISystemSafety420.ActionClass.NORMAL_ONLY,
            Types420.Direction.OUTBOUND
        );
        require(msg.sender.code.length != 0, "router caller");
        require(payer != address(0) && recipient != address(0), "party");
        require(exactSettlementAmount > 0, "amount");
        require(!consumedQuote[q.quoteId], "quote replay");
        require(q.quoteId != bytes32(0), "quote id");
        require(block.timestamp <= uint256(q.quotedAt) + QUOTE_LIFETIME, "stale quote");
        _canonicalSettlementAsset(q.settlementAsset);
        _requireHealthyMarket(q.marketId);
        require(q.quotedSettlementAmount >= exactSettlementAmount, "under settlement");
        require(q.minimumSettlementAmount >= exactSettlementAmount, "minimum below invoice");

        consumedQuote[q.quoteId] = true;
        (bool ok, bytes memory data) = swapExecutor.call{ value: msg.value }(
            abi.encodeWithSignature(
                "executeCanonicalSwap(bytes32,address,address,address,address,uint256,uint256)",
                q.marketId,
                payer,
                recipient,
                q.inputAsset,
                q.settlementAsset,
                q.inputAmount,
                exactSettlementAmount
            )
        );
        require(ok, "atomic swap failed");
        require(data.length == 64, "swap return");
        (inputSpent, settlementDelivered) = abi.decode(data, (uint256, uint256));
        require(inputSpent <= q.inputAmount, "input overspend");
        require(settlementDelivered >= exactSettlementAmount, "merchant underpaid");
        emit SettlementExecuted(q.quoteId, payer, recipient, inputSpent, settlementDelivered);
    }
}
