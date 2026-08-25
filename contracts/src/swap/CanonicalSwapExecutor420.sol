// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../system/GenesisResidentAccess420.sol";
import "../interfaces/genesis/Types420.sol";
import "../interfaces/genesis/ISystemSafety420.sol";
import "./SwapIds420.sol";

interface ICanonicalMarketRegistryExecutorView420 {
    function markets(bytes32 marketId) external view returns (
        address pool,
        address asset0,
        address asset1,
        uint8 role,
        bytes32 metadataHash,
        bool active
    );
}

/// @notice Canonical 420Swap execution boundary consumed by 420Pay.
/// @dev Pool economics remain in the registered pool implementation; this contract enforces
/// canonical-market identity, shared health, asset eligibility, caller policy, and postconditions.
contract CanonicalSwapExecutor420 is GenesisResidentAccess420 {
    struct PoolExecution {
        address payer;
        address recipient;
        address inputAsset;
        address settlementAsset;
        uint256 inputAmount;
        uint256 exactSettlementAmount;
    }

    mapping(address => bool) public trustedCaller;

    event TrustedCallerSet(address indexed caller, bool trusted);
    event CanonicalSwapExecuted(
        bytes32 indexed marketId,
        address indexed payer,
        address indexed recipient,
        uint256 inputSpent,
        uint256 settlementDelivered
    );

    constructor(address timelock_, address registry_, bytes32 genesisConfigHash_)
        GenesisResidentAccess420(timelock_, registry_, genesisConfigHash_)
    {}

    function componentId() public pure override returns (bytes32) { return SwapIds420.CANONICAL_SWAP_EXECUTOR; }

    function setTrustedCaller(address caller, bool trusted) external {
        _requireGenesisGovernance(SwapIds420.ACTION_CONFIGURE);
        require(caller != address(0) && caller.code.length != 0, "caller");
        trustedCaller[caller] = trusted;
        emit TrustedCallerSet(caller, trusted);
    }

    function _canonicalPoolFor(bytes32 marketId, address inputAsset, address settlementAsset)
        internal
        view
        returns (address pool)
    {
        address marketRegistry = _resolveRequired(SwapIds420.CANONICAL_MARKET_REGISTRY);
        address asset0;
        address asset1;
        bool active;
        (pool, asset0, asset1,,, active) = ICanonicalMarketRegistryExecutorView420(marketRegistry).markets(marketId);
        require(active && pool != address(0) && pool.code.length != 0, "market");
        bool pairMatches =
            (asset0 == inputAsset && asset1 == settlementAsset) || (asset1 == inputAsset && asset0 == settlementAsset);
        require(pairMatches, "pair mismatch");
    }

    function _executePool(address pool, PoolExecution memory request)
        internal
        returns (uint256 inputSpent, uint256 settlementDelivered)
    {
        (bool ok, bytes memory data) = pool.call{ value: msg.value }(
            abi.encodeWithSignature(
                "executeCanonicalSwap(address,address,address,address,uint256,uint256)",
                request.payer,
                request.recipient,
                request.inputAsset,
                request.settlementAsset,
                request.inputAmount,
                request.exactSettlementAmount
            )
        );
        require(ok && data.length == 64, "pool execution");
        (inputSpent, settlementDelivered) = abi.decode(data, (uint256, uint256));
    }

    function executeCanonicalSwap(
        bytes32 marketId,
        address payer,
        address recipient,
        address inputAsset,
        address settlementAsset,
        uint256 inputAmount,
        uint256 exactSettlementAmount
    ) external payable returns (uint256 inputSpent, uint256 settlementDelivered) {
        _requireOperational(
            SwapIds420.ACTION_EXECUTE_SWAP,
            ISystemSafety420.ActionClass.NORMAL_ONLY,
            Types420.Direction.OUTBOUND
        );
        require(trustedCaller[msg.sender], "untrusted caller");
        require(payer != address(0) && recipient != address(0), "party");
        require(inputAmount > 0 && exactSettlementAmount > 0, "amount");
        _canonicalSettlementAsset(settlementAsset);
        _requireHealthyMarket(marketId);

        address pool = _canonicalPoolFor(marketId, inputAsset, settlementAsset);
        PoolExecution memory request = PoolExecution({
            payer: payer,
            recipient: recipient,
            inputAsset: inputAsset,
            settlementAsset: settlementAsset,
            inputAmount: inputAmount,
            exactSettlementAmount: exactSettlementAmount
        });
        (inputSpent, settlementDelivered) = _executePool(pool, request);

        require(inputSpent <= inputAmount, "input overspend");
        require(settlementDelivered >= exactSettlementAmount, "under settlement");
        emit CanonicalSwapExecuted(marketId, payer, recipient, inputSpent, settlementDelivered);
    }
}
