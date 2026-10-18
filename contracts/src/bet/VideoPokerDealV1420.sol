// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./VideoPokerV1420.sol";
import "./RandomnessRouter420.sol";

/// @notice E3.2: 52-card deck derivation and one-time initial five-card deal.
/// @dev No custody/settlement authority. Draw lifecycle and secrecy require separate E3 qualification.
contract VideoPokerDealV1420 {
    bytes32 public constant DECK_DOMAIN = keccak256("420.BET.VIDEO_POKER.V1.DECK");
    uint8 public constant DECK_SIZE = 52;
    uint8 public constant HAND_SIZE = 5;

    struct InitialDeal {
        address player;
        bytes32 randomnessRoot;
        bytes32 deckCommitment;
        RandomnessRouter420.Source source;
        uint8[5] cards;
        bool exists;
    }

    VideoPokerV1420 public immutable videoPoker;
    RandomnessRouter420 public immutable randomnessRouter;
    mapping(bytes32 => InitialDeal) private _deals;

    error ZeroAddress();
    error AlreadyDealt();
    error DealMissing();
    error NotPlayer();
    error Expired();
    error InvalidWagerStatus();
    error RandomnessNotReady();
    error RandomnessMismatch();

    event InitialHandDealt(bytes32 indexed wagerId, address indexed player, bytes32 deckCommitment, bytes32 randomnessRoot, uint8[5] cards);

    constructor(address videoPoker_, address randomnessRouter_) {
        if (videoPoker_ == address(0) || randomnessRouter_ == address(0)) revert ZeroAddress();
        videoPoker = VideoPokerV1420(videoPoker_);
        randomnessRouter = RandomnessRouter420(randomnessRouter_);
    }

    /// @notice Card encoding: 0-12 clubs, 13-25 diamonds, 26-38 hearts, 39-51 spades;
    /// rank card%13 (0=ace, 1=two, ..., 12=king).
    /// @dev Rejection-sampled Fisher-Yates; draws are isolated by wager/version/ruleset/root/source.
    function deriveDeck(bytes32 wagerId, bytes32 root, RandomnessRouter420.Source source)
        public view returns (uint8[52] memory cards)
    {
        if (wagerId == bytes32(0) || root == bytes32(0) || source == RandomnessRouter420.Source.NONE) {
            revert RandomnessNotReady();
        }
        for (uint8 i = 0; i < DECK_SIZE; ++i) cards[i] = i;
        uint256 nonce;
        for (uint256 end = DECK_SIZE; end > 1; --end) {
            uint256 ceiling = type(uint256).max - ((type(uint256).max % end + 1) % end);
            uint256 sample;
            do {
                sample = uint256(keccak256(abi.encode(
                    DECK_DOMAIN, block.chainid, address(this), wagerId,
                    videoPoker.gameVersionId(), videoPoker.rulesetId(), root, source, nonce
                )));
                ++nonce;
            } while (sample >= ceiling);
            uint256 index = sample % end;
            uint8 previous = cards[end - 1];
            cards[end - 1] = cards[index];
            cards[index] = previous;
        }
    }

    function startInitialDeal(bytes32 wagerId, VideoPokerV1420.Params calldata params)
        external returns (uint8[5] memory cards)
    {
        if (_deals[wagerId].exists) revert AlreadyDealt();
        BetTypes420.Wager memory wager = videoPoker.validateWager(wagerId, params);
        if (msg.sender != wager.player) revert NotPlayer();
        if (wager.status != BetTypes420.WagerStatus.ACCEPTED &&
            wager.status != BetTypes420.WagerStatus.OUTCOME_READY) revert InvalidWagerStatus();
        if (block.timestamp >= wager.deadline) revert Expired();

        RandomnessRouter420.RandomnessRequest memory request = randomnessRouter.getRequest(wagerId);
        if (!request.fulfilled || request.root == bytes32(0) ||
            (request.source != RandomnessRouter420.Source.PRIMARY &&
             request.source != RandomnessRouter420.Source.FALLBACK)) revert RandomnessNotReady();
        if (request.wagerId != wagerId ||
            request.profileId != wager.randomnessProfileId ||
            request.gameVersionId != wager.gameVersionId ||
            request.paramsHash != wager.paramsHash ||
            request.contextHash == bytes32(0)) revert RandomnessMismatch();

        uint8[52] memory deck = deriveDeck(wagerId, request.root, request.source);
        for (uint256 i = 0; i < HAND_SIZE; ++i) cards[i] = deck[i];
        bytes32 commitment = keccak256(abi.encode(DECK_DOMAIN, wagerId, request.root, request.source, deck));
        _deals[wagerId] = InitialDeal(wager.player, request.root, commitment, request.source, cards, true);
        emit InitialHandDealt(wagerId, wager.player, commitment, request.root, cards);
    }

    function initialDeal(bytes32 wagerId) external view returns (InitialDeal memory deal) {
        deal = _deals[wagerId];
        if (!deal.exists) revert DealMissing();
    }
}
