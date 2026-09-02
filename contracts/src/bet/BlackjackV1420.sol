// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./BetAuthorization420.sol";
import "./BetIds420.sol";
import "./BetRegistry420.sol";
import "./BetTypes420.sol";
import "./RandomnessRouter420.sol";

/// @notice First-party bounded European-no-hole-card blackjack for 420Bet.
/// @dev Future cards are hidden behind a provider hash chain committed before the canonical
///      randomness root is fulfilled. Each revealed preimage is mixed with the canonical root,
///      wager identity and draw index to produce one deterministic card from a six-deck shoe.
///      The module never moves funds or settles wagers.
contract BlackjackV1420 is I420System {
    bytes32 public constant PARAMS_DOMAIN = keccak256("420.BET.BLACKJACK.V1.PARAMS");
    bytes32 public constant CARD_DOMAIN = keccak256("420.BET.BLACKJACK.V1.CARD");
    uint16 public constant SHOE_CARDS = 312; // six standard decks
    uint8 public constant MAX_HAND_CARDS = 12;
    uint8 public constant MAX_STREAM_DRAWS = 24;

    enum Phase { NONE, AWAITING_INITIAL, PLAYER_TURN, AWAITING_PLAYER_HIT, DEALER_TURN, TERMINAL }
    enum DrawPurpose { NONE, PLAYER, DEALER }

    struct Params {
        uint8 rulesVersion;
    }

    struct StreamCommitment {
        bytes32 head;
        bytes32 current;
        uint8 maxDraws;
        uint8 revealed;
        bool exists;
    }

    struct HandState {
        Phase phase;
        RandomnessRouter420.Source source;
        uint8 initialStep;
        DrawPurpose pendingPurpose;
        uint8 playerCount;
        uint8 dealerCount;
        uint16[MAX_HAND_CARDS] playerCards;
        uint16[MAX_HAND_CARDS] dealerCards;
        BetTypes420.TerminalOutcome outcome;
        uint256 grossPayout;
        bool exists;
    }

    BetRegistry420 public immutable wagerRegistry;
    RandomnessRouter420 public immutable randomnessRouter;
    BetAuthorization420 public immutable authorization;
    bytes32 public immutable gameId;
    bytes32 public immutable gameVersionId;
    bytes32 public immutable rulesetId;

    mapping(bytes32 => mapping(uint8 => StreamCommitment)) private _streams;
    mapping(bytes32 => HandState) private _hands;
    mapping(bytes32 => mapping(uint16 => bool)) private _usedCard;

    error ZeroAddress();
    error InvalidId();
    error InvalidParams();
    error WrongGame();
    error WrongRuleset();
    error InvalidWagerStatus();
    error ParamsMismatch();
    error InvalidPayout();
    error InvalidSource();
    error WrongProvider();
    error Unauthorized();
    error StreamAlreadyCommitted();
    error StreamMissing();
    error StreamExhausted();
    error InvalidReveal();
    error RandomnessNotReady();
    error RandomnessAlreadyReady();
    error HandAlreadyStarted();
    error InvalidPhase();
    error NotPlayer();
    error HandTooLong();

    event DrawStreamCommitted(bytes32 indexed wagerId, RandomnessRouter420.Source indexed source, bytes32 head, uint8 maxDraws);
    event HandStarted(bytes32 indexed wagerId, RandomnessRouter420.Source indexed source, bytes32 randomnessRoot);
    event CardRevealed(bytes32 indexed wagerId, uint8 indexed drawIndex, DrawPurpose purpose, uint16 cardId, uint8 rank);
    event PlayerHit(bytes32 indexed wagerId);
    event PlayerStand(bytes32 indexed wagerId);
    event HandTerminal(bytes32 indexed wagerId, BetTypes420.TerminalOutcome outcome, uint256 grossPayout, uint8 playerTotal, uint8 dealerTotal);

    constructor(address wagerRegistry_, address randomnessRouter_, bytes32 gameId_, bytes32 gameVersionId_, bytes32 rulesetId_) {
        if (wagerRegistry_ == address(0) || randomnessRouter_ == address(0)) revert ZeroAddress();
        if (gameId_ == bytes32(0) || gameVersionId_ == bytes32(0) || rulesetId_ == bytes32(0)) revert InvalidId();
        wagerRegistry = BetRegistry420(wagerRegistry_);
        randomnessRouter = RandomnessRouter420(randomnessRouter_);
        authorization = randomnessRouter.authorization();
        gameId = gameId_;
        gameVersionId = gameVersionId_;
        rulesetId = rulesetId_;
    }

    function systemName() external pure returns (string memory) { return "BlackjackV1420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function hashParams(Params memory params) public view returns (bytes32) {
        if (params.rulesVersion != 1) revert InvalidParams();
        return keccak256(abi.encode(PARAMS_DOMAIN, gameVersionId, rulesetId, params.rulesVersion));
    }

    function requiredMaxGrossPayout(uint256 stake) public pure returns (uint256) {
        // V1 pays an exact 3:2 natural-blackjack profit. Odd base units cannot represent
        // stake + 3/2 profit without silently rounding, so they are not valid V1 stakes.
        if (stake == 0 || stake % 2 != 0) revert InvalidPayout();
        return (stake * 5) / 2;
    }

    /// @notice Commit a future-card hash chain before canonical randomness fulfillment.
    /// @dev Reveal order is s1, s2, ... where keccak256(s1)=head and keccak256(sN)=s(N-1).
    function commitDrawStream(bytes32 wagerId, RandomnessRouter420.Source source, bytes32 head, uint8 maxDraws) external {
        if (source != RandomnessRouter420.Source.PRIMARY && source != RandomnessRouter420.Source.FALLBACK) revert InvalidSource();
        if (head == bytes32(0) || maxDraws < 4 || maxDraws > MAX_STREAM_DRAWS) revert InvalidParams();
        RandomnessRouter420.RandomnessRequest memory request = randomnessRouter.getRequest(wagerId);
        if (request.fulfilled) revert RandomnessAlreadyReady();
        RandomnessRouter420.RandomnessProfile memory profile = randomnessRouter.getProfile(request.profileId);
        address expected = source == RandomnessRouter420.Source.PRIMARY ? profile.primaryProvider : profile.fallbackProvider;
        if (expected == address(0) || msg.sender != expected) revert WrongProvider();
        if (!authorization.isAuthorized(msg.sender, BetIds420.ACTION_RANDOMNESS_FULFILL, authorization.scopeForWager(wagerId), 0)) {
            revert Unauthorized();
        }
        StreamCommitment storage stream = _streams[wagerId][uint8(source)];
        if (stream.exists) revert StreamAlreadyCommitted();
        stream.head = head;
        stream.current = head;
        stream.maxDraws = maxDraws;
        stream.exists = true;
        emit DrawStreamCommitted(wagerId, source, head, maxDraws);
    }

    function startHand(bytes32 wagerId, Params calldata params) external {
        HandState storage hand = _hands[wagerId];
        if (hand.exists) revert HandAlreadyStarted();
        BetTypes420.Wager memory wager = wagerRegistry.getWager(wagerId);
        _validateWager(wager, params);
        RandomnessRouter420.RandomnessRequest memory request = randomnessRouter.getRequest(wagerId);
        if (!request.fulfilled) revert RandomnessNotReady();
        StreamCommitment storage stream = _streams[wagerId][uint8(request.source)];
        if (!stream.exists) revert StreamMissing();

        hand.exists = true;
        hand.phase = Phase.AWAITING_INITIAL;
        hand.source = request.source;
        hand.pendingPurpose = DrawPurpose.PLAYER;
        emit HandStarted(wagerId, request.source, request.root);
    }

    /// @notice Reveal the next committed draw. Provider may only reveal when the game has armed one.
    function revealNext(bytes32 wagerId, bytes32 secret) external returns (uint16 cardId) {
        HandState storage hand = _hands[wagerId];
        if (!hand.exists || hand.phase == Phase.NONE || hand.phase == Phase.TERMINAL || hand.pendingPurpose == DrawPurpose.NONE) revert InvalidPhase();
        RandomnessRouter420.RandomnessRequest memory request = randomnessRouter.getRequest(wagerId);
        if (!request.fulfilled || request.source != hand.source) revert RandomnessNotReady();
        RandomnessRouter420.RandomnessProfile memory profile = randomnessRouter.getProfile(request.profileId);
        address expected = hand.source == RandomnessRouter420.Source.PRIMARY ? profile.primaryProvider : profile.fallbackProvider;
        if (msg.sender != expected) revert WrongProvider();
        if (!authorization.isAuthorized(msg.sender, BetIds420.ACTION_RANDOMNESS_FULFILL, authorization.scopeForWager(wagerId), 0)) {
            revert Unauthorized();
        }

        StreamCommitment storage stream = _streams[wagerId][uint8(hand.source)];
        if (!stream.exists) revert StreamMissing();
        if (stream.revealed >= stream.maxDraws) revert StreamExhausted();
        if (secret == bytes32(0) || keccak256(abi.encode(secret)) != stream.current) revert InvalidReveal();
        stream.current = secret;
        stream.revealed += 1;

        cardId = _deriveUnusedCard(wagerId, request.root, stream.revealed, secret);
        DrawPurpose purpose = hand.pendingPurpose;
        hand.pendingPurpose = DrawPurpose.NONE;
        _appendCard(hand, purpose, cardId);
        emit CardRevealed(wagerId, stream.revealed, purpose, cardId, _rank(cardId));
        _afterReveal(wagerId, hand);
    }

    function hit(bytes32 wagerId) external {
        HandState storage hand = _hands[wagerId];
        if (!hand.exists || hand.phase != Phase.PLAYER_TURN || hand.pendingPurpose != DrawPurpose.NONE) revert InvalidPhase();
        if (msg.sender != wagerRegistry.getWager(wagerId).player) revert NotPlayer();
        if (hand.playerCount >= MAX_HAND_CARDS) revert HandTooLong();
        hand.phase = Phase.AWAITING_PLAYER_HIT;
        hand.pendingPurpose = DrawPurpose.PLAYER;
        emit PlayerHit(wagerId);
    }

    function stand(bytes32 wagerId) external {
        HandState storage hand = _hands[wagerId];
        if (!hand.exists || hand.phase != Phase.PLAYER_TURN || hand.pendingPurpose != DrawPurpose.NONE) revert InvalidPhase();
        if (msg.sender != wagerRegistry.getWager(wagerId).player) revert NotPlayer();
        emit PlayerStand(wagerId);
        _enterDealerTurn(wagerId, hand);
    }

    function getHand(bytes32 wagerId) external view returns (HandState memory hand) {
        hand = _hands[wagerId];
        if (!hand.exists) revert InvalidPhase();
    }

    function getStream(bytes32 wagerId, RandomnessRouter420.Source source) external view returns (StreamCommitment memory stream) {
        stream = _streams[wagerId][uint8(source)];
        if (!stream.exists) revert StreamMissing();
    }

    function handValue(bytes32 wagerId, bool player) external view returns (uint8 total, bool soft) {
        HandState storage hand = _hands[wagerId];
        if (!hand.exists) revert InvalidPhase();
        return player ? _score(hand.playerCards, hand.playerCount) : _score(hand.dealerCards, hand.dealerCount);
    }

    function _validateWager(BetTypes420.Wager memory wager, Params memory params) private view {
        if (wager.gameId != gameId || wager.gameVersionId != gameVersionId) revert WrongGame();
        if (wager.rulesetId != rulesetId) revert WrongRuleset();
        if (wager.status != BetTypes420.WagerStatus.ACCEPTED && wager.status != BetTypes420.WagerStatus.OUTCOME_READY) revert InvalidWagerStatus();
        if (hashParams(params) != wager.paramsHash) revert ParamsMismatch();
        if (wager.maxGrossPayout != requiredMaxGrossPayout(wager.stake)) revert InvalidPayout();
    }

    function _deriveUnusedCard(bytes32 wagerId, bytes32 root, uint8 drawIndex, bytes32 secret) private returns (uint16 cardId) {
        for (uint16 nonce = 0; nonce < SHOE_CARDS; ++nonce) {
            cardId = uint16(uint256(keccak256(abi.encode(CARD_DOMAIN, wagerId, gameVersionId, rulesetId, root, drawIndex, secret, nonce))) % SHOE_CARDS);
            if (!_usedCard[wagerId][cardId]) {
                _usedCard[wagerId][cardId] = true;
                return cardId;
            }
        }
        revert StreamExhausted();
    }

    function _appendCard(HandState storage hand, DrawPurpose purpose, uint16 cardId) private {
        if (purpose == DrawPurpose.PLAYER) {
            if (hand.playerCount >= MAX_HAND_CARDS) revert HandTooLong();
            hand.playerCards[hand.playerCount] = cardId;
            hand.playerCount += 1;
        } else if (purpose == DrawPurpose.DEALER) {
            if (hand.dealerCount >= MAX_HAND_CARDS) revert HandTooLong();
            hand.dealerCards[hand.dealerCount] = cardId;
            hand.dealerCount += 1;
        } else {
            revert InvalidPhase();
        }
    }

    function _afterReveal(bytes32 wagerId, HandState storage hand) private {
        if (hand.phase == Phase.AWAITING_INITIAL) {
            hand.initialStep += 1;
            if (hand.initialStep == 1) hand.pendingPurpose = DrawPurpose.DEALER;
            else if (hand.initialStep == 2) hand.pendingPurpose = DrawPurpose.PLAYER;
            else {
                (uint8 playerTotal,) = _score(hand.playerCards, hand.playerCount);
                if (playerTotal == 21 && hand.playerCount == 2) _enterDealerTurn(wagerId, hand);
                else hand.phase = Phase.PLAYER_TURN;
            }
            return;
        }

        if (hand.phase == Phase.AWAITING_PLAYER_HIT) {
            (uint8 playerTotal,) = _score(hand.playerCards, hand.playerCount);
            if (playerTotal > 21) _finish(wagerId, hand, BetTypes420.TerminalOutcome.LOSS, 0);
            else if (playerTotal == 21) _enterDealerTurn(wagerId, hand);
            else hand.phase = Phase.PLAYER_TURN;
            return;
        }

        if (hand.phase == Phase.DEALER_TURN) {
            _continueDealer(wagerId, hand);
            return;
        }

        revert InvalidPhase();
    }

    function _enterDealerTurn(bytes32 wagerId, HandState storage hand) private {
        hand.phase = Phase.DEALER_TURN;
        _continueDealer(wagerId, hand);
    }

    function _continueDealer(bytes32 wagerId, HandState storage hand) private {
        (uint8 dealerTotal,) = _score(hand.dealerCards, hand.dealerCount);
        if (dealerTotal < 17 || hand.dealerCount < 2) {
            if (hand.dealerCount >= MAX_HAND_CARDS) revert HandTooLong();
            hand.pendingPurpose = DrawPurpose.DEALER;
            return;
        }
        _resolveTerminal(wagerId, hand);
    }

    function _resolveTerminal(bytes32 wagerId, HandState storage hand) private {
        BetTypes420.Wager memory wager = wagerRegistry.getWager(wagerId);
        (uint8 playerTotal,) = _score(hand.playerCards, hand.playerCount);
        (uint8 dealerTotal,) = _score(hand.dealerCards, hand.dealerCount);
        bool playerBlackjack = hand.playerCount == 2 && playerTotal == 21;
        bool dealerBlackjack = hand.dealerCount == 2 && dealerTotal == 21;

        if (dealerTotal > 21) {
            _finish(wagerId, hand, BetTypes420.TerminalOutcome.WIN, playerBlackjack ? requiredMaxGrossPayout(wager.stake) : wager.stake * 2);
        } else if (playerBlackjack && dealerBlackjack) {
            _finish(wagerId, hand, BetTypes420.TerminalOutcome.PUSH, wager.stake);
        } else if (dealerBlackjack) {
            _finish(wagerId, hand, BetTypes420.TerminalOutcome.LOSS, 0);
        } else if (playerBlackjack) {
            _finish(wagerId, hand, BetTypes420.TerminalOutcome.WIN, requiredMaxGrossPayout(wager.stake));
        } else if (playerTotal > dealerTotal) {
            _finish(wagerId, hand, BetTypes420.TerminalOutcome.WIN, wager.stake * 2);
        } else if (playerTotal == dealerTotal) {
            _finish(wagerId, hand, BetTypes420.TerminalOutcome.PUSH, wager.stake);
        } else {
            _finish(wagerId, hand, BetTypes420.TerminalOutcome.LOSS, 0);
        }
    }

    function _finish(bytes32 wagerId, HandState storage hand, BetTypes420.TerminalOutcome outcome, uint256 grossPayout) private {
        hand.phase = Phase.TERMINAL;
        hand.pendingPurpose = DrawPurpose.NONE;
        hand.outcome = outcome;
        hand.grossPayout = grossPayout;
        (uint8 playerTotal,) = _score(hand.playerCards, hand.playerCount);
        (uint8 dealerTotal,) = _score(hand.dealerCards, hand.dealerCount);
        emit HandTerminal(wagerId, outcome, grossPayout, playerTotal, dealerTotal);
    }

    function _score(uint16[MAX_HAND_CARDS] storage cards, uint8 count) private view returns (uint8 total, bool soft) {
        uint8 aces;
        for (uint8 i = 0; i < count; ++i) {
            uint8 rank = _rank(cards[i]);
            if (rank == 1) {
                total += 1;
                aces += 1;
            } else {
                total += rank >= 10 ? 10 : rank;
            }
        }
        if (aces > 0 && total + 10 <= 21) {
            total += 10;
            soft = true;
        }
    }

    function _rank(uint16 cardId) private pure returns (uint8) {
        return uint8((cardId % 52) % 13) + 1;
    }
}
