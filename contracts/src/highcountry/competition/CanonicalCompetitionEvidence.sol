// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import {HarvestProductRegistry} from "../harvest/HarvestProductRegistry.sol";
import {ICompetitionEvidenceR0412} from "./CompetitionEngine.sol";

/// @notice Canonical immutable harvest facts plus independently attested registration-block confirmation.
/// @dev Chain reorgs roll back both source and attestation; deployed finality policy requires separate acceptance.
contract CanonicalCompetitionEvidence is ICompetitionEvidenceR0412 {
    error InvalidEvidence();
    HarvestProductRegistry public immutable products;
    address public immutable finalityVerifier;
    address public immutable adjudicator;
    uint16 public immutable confirmations;
    mapping(bytes32 => bytes32) public confirmedProductHash;
    mapping(bytes32 => bool) public revoked;
    event Confirmed(bytes32 indexed product, bytes32 indexed sourceBlockHash, bytes32 productHash);
    event Revoked(bytes32 indexed product);
    constructor(address products_, address verifier_, address adjudicator_, uint16 confirmations_) {
        if (products_.code.length == 0 || verifier_ == address(0) || adjudicator_ == address(0)
            || confirmations_ == 0 || confirmations_ > 255) revert InvalidEvidence();
        products = HarvestProductRegistry(products_);
        finalityVerifier = verifier_;
        adjudicator = adjudicator_;
        confirmations = confirmations_;
    }
    function confirm(bytes32 id, bytes32 sourceBlockHash) external {
        if (msg.sender != finalityVerifier || confirmedProductHash[id] != bytes32(0) || revoked[id])
            revert InvalidEvidence();
        HarvestProductRegistry.Product memory p = products.getProduct(id);
        uint256 registered = products.registeredBlock(id);
        if (registered == 0 || block.number < registered + confirmations || block.number > registered + 256
            || sourceBlockHash == bytes32(0) || blockhash(registered) != sourceBlockHash) revert InvalidEvidence();
        bytes32 h = keccak256(abi.encode(block.chainid, address(products), p));
        confirmedProductHash[id] = h;
        emit Confirmed(id, sourceBlockHash, h);
    }
    function revoke(bytes32 id) external {
        if (msg.sender != adjudicator || revoked[id]) revert InvalidEvidence();
        products.getProduct(id);
        revoked[id] = true;
        emit Revoked(id);
    }
    function verifiedFlower(bytes32 id, address player, uint16 quality, uint64 acceptedAt)
        external view returns (bool) {
        if (revoked[id] || confirmedProductHash[id] == bytes32(0)) return false;
        try products.getProduct(id) returns (HarvestProductRegistry.Product memory p) {
            return p.registered && p.productId == id && p.grower == player && p.qualityBps == quality
                && p.harvestAcceptedAt == acceptedAt && quality <= 10000
                && confirmedProductHash[id] == keccak256(abi.encode(block.chainid, address(products), p));
        } catch { return false; }
    }
}
