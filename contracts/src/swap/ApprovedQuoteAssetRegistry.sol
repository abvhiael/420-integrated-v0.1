// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../system/GenesisResidentAccess420.sol";
import "./SwapIds420.sol";

contract ApprovedQuoteAssetRegistry is GenesisResidentAccess420 {
    enum Status { NONE, APPROVED, CANONICAL }
    struct QuoteAsset { Status status; bytes3 currency; bytes32 metadataHash; }

    mapping(address => QuoteAsset) public quoteAssets;
    mapping(bytes3 => address) public canonicalForCurrency;

    event QuoteAssetSet(address indexed asset, bytes3 indexed currency, Status status, bytes32 metadataHash);
    event CanonicalQuoteSet(bytes3 indexed currency, address indexed asset);

    constructor(address timelock_, address registry_, bytes32 genesisConfigHash_)
        GenesisResidentAccess420(timelock_, registry_, genesisConfigHash_)
    {}

    function componentId() public pure override returns (bytes32) { return SwapIds420.APPROVED_QUOTE_ASSET_REGISTRY; }

    function setApproved(address asset, bytes3 currency, Status status, bytes32 metadataHash) external {
        _requireGenesisGovernance(SwapIds420.ACTION_CONFIGURE);
        bytes32 assetId = _canonicalSettlementAsset(asset);
        assetId;
        require(status != Status.NONE, "status");
        quoteAssets[asset] = QuoteAsset(status, currency, metadataHash);
        emit QuoteAssetSet(asset, currency, status, metadataHash);
    }

    function setCanonical(bytes3 currency, address asset) external {
        _requireGenesisGovernance(SwapIds420.ACTION_CONFIGURE);
        _canonicalSettlementAsset(asset);
        QuoteAsset storage q = quoteAssets[asset];
        require(q.status == Status.APPROVED || q.status == Status.CANONICAL, "not approved");
        require(q.currency == currency, "currency");
        address prior = canonicalForCurrency[currency];
        if (prior != address(0)) quoteAssets[prior].status = Status.APPROVED;
        q.status = Status.CANONICAL;
        canonicalForCurrency[currency] = asset;
        emit CanonicalQuoteSet(currency, asset);
    }

    function removeCanonical(bytes3 currency) external {
        _requireGenesisGovernance(SwapIds420.ACTION_CONFIGURE);
        address prior = canonicalForCurrency[currency];
        if (prior != address(0)) quoteAssets[prior].status = Status.APPROVED;
        canonicalForCurrency[currency] = address(0);
        emit CanonicalQuoteSet(currency, address(0));
    }
}
