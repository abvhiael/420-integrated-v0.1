// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import { EmergencyState } from "../security/EmergencyState.sol";

/// @notice Native $420 receipts for HC.SEED.PACKS.V1. No randomness or seed minting.
contract SeedPackPayments {
    uint256 public constant PRICE = 1 ether;
    bytes32 public immutable gameId;
    bytes32 public immutable policyHash;
    address public immutable treasury;
    address public immutable quoteSigner;
    EmergencyState public immutable emergencyState;
    uint256 public treasuryCredit;

    struct Receipt {
        address buyer;
        bytes32 commitment;
        uint8 pool;
        uint8 status;
    }
    mapping(bytes32 => Receipt) private _receipts;
    event PackPaid(bytes32 indexed purchaseId, address indexed buyer, bytes32 commitment, uint8 pool, uint256 amount);
    event PackCancelled(bytes32 indexed purchaseId, address indexed buyer);
    error InvalidPayment();

    constructor(
        bytes32 game,
        bytes32 policy,
        address destination,
        address emergency,
        address signer
    ) {
        if (game == 0 || policy == 0 || destination == address(0) || emergency == address(0) || signer == address(0)) {
            revert InvalidPayment();
        }
        gameId = game;
        policyHash = policy;
        treasury = destination;
        quoteSigner = signer;
        emergencyState = EmergencyState(emergency);
    }

    function purchaseId(
        address buyer,
        bytes32 key
    ) public view returns (bytes32) {
        return keccak256(abi.encode(gameId, buyer, key));
    }

    function receipt(
        bytes32 id
    ) external view returns (Receipt memory) {
        return _receipts[id];
    }

    function quoteDigest(
        address buyer,
        bytes32 key,
        bytes32 commitment,
        uint8 pool
    ) public view returns (bytes32) {
        return keccak256(
            abi.encode(
                keccak256("HC.SEED.PAYMENT.QUOTE.V1"),
                block.chainid,
                address(this),
                gameId,
                policyHash,
                buyer,
                key,
                commitment,
                pool,
                PRICE
            )
        );
    }

    function quoteValid(
        address buyer,
        bytes32 key,
        bytes32 commitment,
        uint8 pool,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public view returns (bool) {
        if (
            (v != 27 && v != 28) || uint256(s) == 0
                || uint256(s) > 0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0
        ) return false;
        bytes32 digest =
            keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", quoteDigest(buyer, key, commitment, pool)));
        return ecrecover(digest, v, r, s) == quoteSigner;
    }

    function pay(
        bytes32 key,
        bytes32 commitment,
        uint8 pool,
        uint8 v,
        bytes32 r,
        bytes32 sigS
    ) external payable {
        if (emergencyState.isRestricted(keccak256("HC.EMERGENCY.MARKET"))) revert InvalidPayment();
        bytes32 id = purchaseId(msg.sender, key);
        if (
            !quoteValid(msg.sender, key, commitment, pool, v, r, sigS) || key == 0 || commitment == 0 || pool > 3
                || msg.value != PRICE || _receipts[id].status != 0
        ) {
            revert InvalidPayment();
        }
        _receipts[id] = Receipt(msg.sender, commitment, pool, 1);
        treasuryCredit += msg.value;
        emit PackPaid(id, msg.sender, commitment, pool, msg.value);
    }

    /// @notice Permanently closes this buyer's unpaid key. A paid key cannot be refunded or redrawn.
    function cancel(
        bytes32 key
    ) external {
        bytes32 id = purchaseId(msg.sender, key);
        if (key == 0 || _receipts[id].status == 1) revert InvalidPayment();
        if (_receipts[id].status == 2) return;
        _receipts[id] = Receipt(msg.sender, bytes32(0), 0, 2);
        emit PackCancelled(id, msg.sender);
    }

    function withdraw() external {
        if (msg.sender != treasury) revert InvalidPayment();
        uint256 amount = treasuryCredit;
        treasuryCredit = 0;
        (bool ok,) = treasury.call{ value: amount }("");
        if (!ok) revert InvalidPayment();
    }
}
