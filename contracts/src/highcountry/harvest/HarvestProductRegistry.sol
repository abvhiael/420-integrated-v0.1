// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { HarvestEngine } from "./HarvestEngine.sol";
import { HarvestScoring } from "./HarvestScoring.sol";
import { HCInvalidId, HCInvalidState, HCZeroAddress } from "../errors/HighCountryErrors.sol";

/// @notice R03.3 harvest-only inventory issuance ledger; general inventory/resources are R04.1.
/// @dev Immutable harvest provenance is copied from the authoritative HarvestEngine; no caller
///      can supply a quantity, grade, owner or provenance. No transfers, burns or custody.
contract HarvestProductRegistry {
    struct Product {
        bytes32 productId;
        uint64 plantId;
        bytes32 genomeId;
        bytes32 expressionHash;
        bytes32 rulesetId;
        bytes32 rulesetContentHash;
        address grower;
        uint64 parcelId;
        uint64 publicPlotId;
        uint64 harvestAcceptedAt;
        uint32 quantityGrams;
        uint16 qualityBps;
        uint16 geneticBps;
        HarvestScoring.Grade grade;
        bool registered;
    }

    HarvestEngine public immutable harvestEngine;
    mapping(uint64 => bytes32) public productOfPlant;
    mapping(bytes32 => uint256) public registeredBlock;
    mapping(bytes32 => Product) private _products;
    mapping(address => uint256) public issuedGramsByGrower;
    uint256 public totalIssuedGrams;
    uint64 public totalRegisteredProducts;

    event HarvestProductRegistered(
        bytes32 indexed productId,
        uint64 indexed plantId,
        address indexed grower,
        uint32 quantityGrams,
        uint16 qualityBps,
        HarvestScoring.Grade grade
    );

    constructor(
        address harvestEngine_
    ) {
        if (harvestEngine_ == address(0)) revert HCZeroAddress();
        if (harvestEngine_.code.length == 0) revert HCInvalidState();
        harvestEngine = HarvestEngine(harvestEngine_);
    }

    /// @notice Exactly one canonical issuance per previously accepted harvest.
    /// @dev Anybody can relay an accepted harvest: the owner and quantity always come
    ///      from immutable on-chain harvest records, never the relayer.
    function registerHarvestProduct(
        uint64 plantId
    ) external returns (bytes32 productId) {
        if (plantId == 0) revert HCInvalidId();
        if (productOfPlant[plantId] != bytes32(0)) revert HCInvalidState();
        HarvestEngine.HarvestAcceptance memory h = harvestEngine.getHarvest(plantId);
        HarvestScoring.Result memory score = harvestEngine.getHarvestScore(plantId);
        if (
            !h.accepted || h.plantId != plantId || h.grower == address(0) || h.genomeId == bytes32(0)
                || h.expressionHash == bytes32(0) || h.rulesetId == bytes32(0) || h.rulesetContentHash == bytes32(0)
                || h.parcelId == 0 || score.qualityBps > 10_000 || score.yieldGrams > 1_000
        ) revert HCInvalidState();

        productId = keccak256(abi.encode("HC.HARVEST.PRODUCT.V1", block.chainid, address(harvestEngine), plantId));
        if (productId == bytes32(0) || _products[productId].registered) revert HCInvalidState();

        _products[productId] = Product({
            productId: productId,
            plantId: plantId,
            genomeId: h.genomeId,
            expressionHash: h.expressionHash,
            rulesetId: h.rulesetId,
            rulesetContentHash: h.rulesetContentHash,
            grower: h.grower,
            parcelId: h.parcelId,
            publicPlotId: h.publicPlotId,
            harvestAcceptedAt: h.acceptedAt,
            quantityGrams: score.yieldGrams,
            qualityBps: score.qualityBps,
            geneticBps: score.geneticBps,
            grade: score.grade,
            registered: true
        });
        productOfPlant[plantId] = productId;
        registeredBlock[productId] = block.number;
        issuedGramsByGrower[h.grower] += score.yieldGrams;
        totalIssuedGrams += score.yieldGrams;
        totalRegisteredProducts += 1;
        emit HarvestProductRegistered(productId, plantId, h.grower, score.yieldGrams, score.qualityBps, score.grade);
    }

    function getProduct(
        bytes32 productId
    ) external view returns (Product memory p) {
        p = _products[productId];
        if (!p.registered) revert HCInvalidState();
    }
}

