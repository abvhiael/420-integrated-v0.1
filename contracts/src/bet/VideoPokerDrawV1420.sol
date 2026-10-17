// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./VideoPokerDealV1420.sol";
import "./VideoPokerJacksOrBetter420.sol";

/// @notice Video Poker E3.3 protected replacement-card commit/hold/reveal lifecycle.
/// @dev A separately authorized provider commits to entropy *before* any hold decision.
///      No later-player-correctable draw or unrestricted payable settlement authority.
contract VideoPokerDrawV1420 {
    bytes32 public constant REPLACEMENT_COMMIT_DOMAIN = keccak256("420.BET.VIDEO_POKER.V1.REPLACEMENT.COMMIT");
    bytes32 public constant REPLACEMENT_SAMPLE_DOMAIN = keccak256("420.BET.VIDEO_POKER.V1.REPLACEMENT.SAMPLE");

    struct Session {
        bytes32 seedCommitment;
        bytes32 dealCommitment;
        bytes32 seedRevealHash;
        uint8 heldMask;
        uint8[5] finalCards;
        bool committed;
        bool held;
        bool revealed;
        bool timedOut;
    }

    VideoPokerDealV1420 public immutable dealer;
    VideoPokerV1420 public immutable poker;
    address public immutable replacementProvider;
    mapping(bytes32 => Session) private _sessions;

    error ZeroAddress();
    error Unauthorized();
    error InvalidCommitment();
    error AlreadyCommitted();
    error AlreadyHeld();
    error NotCommitted();
    error NotHeld();
    error AlreadyResolved();
    error WagerExpired();
    error InvalidMask();
    error WrongDeal();
    error InvalidReveal();
    error ProviderNotIndependent();
    error UnapprovedPaytable();
    error InsufficientLiability();
    error SessionNotExpired();

    event ReplacementSeedCommitted(bytes32 indexed wagerId, bytes32 indexed commitment);
    event HoldCommitted(bytes32 indexed wagerId, address indexed player, uint8 heldMask, bytes32 dealCommitment);
    event DrawCompleted(bytes32 indexed wagerId, uint8[5] finalCards, bytes32 seedRevealHash);
    event ReplacementSeedWithheld(bytes32 indexed wagerId);

    constructor(address dealer_, address provider_) {
        if (dealer_ == address(0) || provider_ == address(0)) revert ZeroAddress();
        dealer = VideoPokerDealV1420(dealer_);
        poker = dealer.videoPoker();
        replacementProvider = provider_;
    }

    function seedCommitmentFor(bytes32 wagerId, bytes32 seed) public view returns (bytes32) {
        if (wagerId == bytes32(0) || seed == bytes32(0)) revert InvalidCommitment();
        return keccak256(abi.encode(REPLACEMENT_COMMIT_DOMAIN, block.chainid, address(this),
            wagerId, poker.gameVersionId(), poker.rulesetId(), seed));
    }

    /// @dev The provider must not be the player or the primary/fallback randomness provider.
    ///      Independent operational/key control remains an external authorization gate.
    function commitReplacement(bytes32 wagerId, bytes32 commitment, VideoPokerV1420.Params calldata params) external {
        if (msg.sender != replacementProvider) revert Unauthorized();
        if (commitment == bytes32(0)) revert InvalidCommitment();
        Session storage s = _sessions[wagerId];
        if (s.committed) revert AlreadyCommitted();
        BetTypes420.Wager memory wager = poker.validateWager(wagerId, params);
        if (params.paytableId != VideoPokerJacksOrBetter420.PAYTABLE_ID) revert UnapprovedPaytable();
        if (wager.maxGrossPayout < VideoPokerJacksOrBetter420.maximumGross(wager.stake, params.credits))
            revert InsufficientLiability();
        if (wager.status != BetTypes420.WagerStatus.ACCEPTED &&
            wager.status != BetTypes420.WagerStatus.OUTCOME_READY) revert WrongDeal();
        if (wager.gameVersionId != poker.gameVersionId() || wager.rulesetId != poker.rulesetId() ||
            wager.gameId != poker.gameId()) revert WrongDeal();
        if (block.timestamp >= wager.deadline) revert WagerExpired();
        if (replacementProvider == wager.player) revert ProviderNotIndependent();
        RandomnessRouter420.RandomnessProfile memory profile = dealer.randomnessRouter().getProfile(wager.randomnessProfileId);
        if (!profile.exists || replacementProvider == profile.primaryProvider ||
            replacementProvider == profile.fallbackProvider) revert ProviderNotIndependent();
        // Fail closed when a dealing session already exists: seed must be committed before the deal.
        bool alreadyDealt;
        try dealer.initialDeal(wagerId) returns (VideoPokerDealV1420.InitialDeal memory existingDeal) {
            alreadyDealt = existingDeal.exists;
        } catch (bytes memory reason) {
            bytes4 selector;
            if (reason.length >= 4) {
                assembly { selector := mload(add(reason, 32)) }
            }
            if (selector != VideoPokerDealV1420.DealMissing.selector) {
                // Solidity custom errors can ABI-encode a selector in 4 bytes.
                revert WrongDeal();
            }
        }
        if (alreadyDealt) revert AlreadyHeld();
        s.seedCommitment = commitment;
        s.committed = true;
        emit ReplacementSeedCommitted(wagerId, commitment);
    }

    /// @notice The hold mask (bits 0-4) is committed on-chain before entropy revelation.
    function commitHold(bytes32 wagerId, uint8 heldMask) external {
        if (heldMask > 31) revert InvalidMask();
        Session storage s = _sessions[wagerId];
        if (!s.committed) revert NotCommitted();
        if (s.held) revert AlreadyHeld();
        if (s.revealed || s.timedOut) revert AlreadyResolved();
        VideoPokerDealV1420.InitialDeal memory deal = dealer.initialDeal(wagerId);
        if (msg.sender != deal.player) revert Unauthorized();
        BetTypes420.Wager memory wager = poker.wagerRegistry().getWager(wagerId);
        if (block.timestamp >= wager.deadline) revert WagerExpired();
        if (wager.status != BetTypes420.WagerStatus.ACCEPTED &&
            wager.status != BetTypes420.WagerStatus.OUTCOME_READY) revert WrongDeal();
        s.dealCommitment = deal.deckCommitment;
        s.heldMask = heldMask;
        s.held = true;
        emit HoldCommitted(wagerId, msg.sender, heldMask, deal.deckCommitment);
    }

    /// @dev Samples without replacement from the 47 cards not in the initial hand.
    ///      No public pre-hold root is used to select replacement cards.
    function revealAndDraw(bytes32 wagerId, bytes32 seed) external returns (uint8[5] memory result) {
        if (msg.sender != replacementProvider) revert Unauthorized();
        Session storage s = _sessions[wagerId];
        if (!s.held) revert NotHeld();
        if (s.revealed || s.timedOut) revert AlreadyResolved();
        BetTypes420.Wager memory wager = poker.wagerRegistry().getWager(wagerId);
        if (block.timestamp >= wager.deadline) revert WagerExpired();
        if (seedCommitmentFor(wagerId, seed) != s.seedCommitment) revert InvalidReveal();
        VideoPokerDealV1420.InitialDeal memory deal = dealer.initialDeal(wagerId);
        if (deal.deckCommitment != s.dealCommitment) revert WrongDeal();
        uint8[47] memory remaining;
        uint256 count;
        uint256 used;
        for (uint256 i; i < 5; ++i) used |= uint256(1) << deal.cards[i];
        for (uint8 card; card < 52; ++card) {
            if ((used & (uint256(1) << card)) == 0) remaining[count++] = card;
        }
        uint256 nonce;
        uint256 next = 47;
        for (uint256 i; i < 5; ++i) {
            if ((s.heldMask & (uint8(1) << uint8(i))) != 0) {
                result[i] = deal.cards[i];
            } else {
                uint256 ceiling = type(uint256).max - ((type(uint256).max % next + 1) % next);
                uint256 sample;
                do {
                    sample = uint256(keccak256(abi.encode(REPLACEMENT_SAMPLE_DOMAIN, block.chainid,
                        address(this), wagerId, s.dealCommitment, s.heldMask, seed, nonce++)));
                } while (sample >= ceiling);
                uint256 chosen = sample % next;
                result[i] = remaining[chosen];
                remaining[chosen] = remaining[--next];
            }
        }
        s.finalCards = result;
        s.seedRevealHash = keccak256(abi.encode(seed));
        s.revealed = true;
        emit DrawCompleted(wagerId, result, s.seedRevealHash);
    }

    function recordWithheldEntropy(bytes32 wagerId) external {
        Session storage s = _sessions[wagerId];
        if (!s.committed || s.revealed || s.timedOut) revert AlreadyResolved();
        BetTypes420.Wager memory wager = poker.wagerRegistry().getWager(wagerId);
        if (block.timestamp < wager.deadline) revert SessionNotExpired();
        s.timedOut = true;
        emit ReplacementSeedWithheld(wagerId);
        // Caller must use SettlementEngine420.voidExpired for canonical stake refund.
    }

    function getSession(bytes32 wagerId) external view returns (Session memory) { return _sessions[wagerId]; }
}
