// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./BetAuthorization420.sol";
import "./BetIds420.sol";
import "./ReferenceSlotV1420.sol";
import "./BetSlotArtifactRegistry420.sol";

/// @notice An immutable, version-bound admission gate for independently reviewed
///         reel, symbol, paytable, RTP and maximum-liability artifacts.
/// @dev The artifact registry's hashes alone do NOT establish statistical RTP
///      validity: approval and reproducible mathematics are separate release gates.
contract ReferenceSlotTermsAuthority420 {
    BetAuthorization420 public immutable authorization;
    BetSlotArtifactRegistry420 public immutable artifacts;
    bytes32 public immutable gameVersionId;
    bytes32 public immutable rulesetId;
    bytes32 public immutable termsHash;
    bytes32 public immutable reelSetHash;
    bytes32 public immutable paytableHash;
    bytes32 public immutable rtpArtifactHash;
    bytes32 public immutable liabilityArtifactHash;
    uint256 public immutable maxMultiplierBps;
    bool public activated;
    error InvalidTerms();
    error Unauthorized();
    error AlreadyActivated();
    error NotActivated();
    constructor(address authorization_, address artifacts_, bytes32 gameVersionId_, bytes32 rulesetId_,
        bytes32 termsHash_, bytes32 reelSetHash_, bytes32 paytableHash_,
        bytes32 rtpArtifactHash_, bytes32 liabilityArtifactHash_, uint256 maxMultiplierBps_) {
        if (authorization_ == address(0) || artifacts_ == address(0) ||
            gameVersionId_ == 0 || rulesetId_ == 0 || termsHash_ == 0 ||
            reelSetHash_ == 0 || paytableHash_ == 0 || rtpArtifactHash_ == 0 ||
            liabilityArtifactHash_ == 0 || maxMultiplierBps_ == 0) revert InvalidTerms();
        authorization = BetAuthorization420(authorization_);
        artifacts = BetSlotArtifactRegistry420(artifacts_);
        gameVersionId = gameVersionId_;
        rulesetId = rulesetId_;
        termsHash = termsHash_;
        reelSetHash = reelSetHash_;
        paytableHash = paytableHash_;
        rtpArtifactHash = rtpArtifactHash_;
        liabilityArtifactHash = liabilityArtifactHash_;
        maxMultiplierBps = maxMultiplierBps_;
    }
    function activate() external {
        if (activated) revert AlreadyActivated();
        BetSlotArtifactRegistry420.SlotArtifacts memory a = artifacts.getSlotArtifacts(gameVersionId);
        if (!a.exists || a.reelSetHash != reelSetHash || a.paytableHash != paytableHash ||
            a.rtpArtifactHash != rtpArtifactHash || a.liabilityArtifactHash != liabilityArtifactHash ||
            a.maxMultiplier != maxMultiplierBps) revert InvalidTerms();
        if (!authorization.isAuthorized(msg.sender, BetIds420.ACTION_GAME_ACTIVATE,
            authorization.scopeForGame(keccak256("420BET.GAME.SLOT"), gameVersionId), 0)) revert Unauthorized();
        activated = true;
    }
    function verify(uint256 stake, uint256 maxGross, bytes32 requestedHash,
        ReferenceSlotV1420.Params calldata params, address resolver) external view {
        if (!activated) revert NotActivated();
        ReferenceSlotV1420 s = ReferenceSlotV1420(resolver);
        if (stake == 0 || s.gameId() != keccak256("420BET.GAME.SLOT") ||
            s.gameVersionId() != gameVersionId || s.rulesetId() != rulesetId ||
            address(s.wagerRegistry()) == address(0) ||
            requestedHash != termsHash || s.hashParams(params) != termsHash ||
            maxGross != s.requiredMaxGrossPayout(stake, params) ||
            maxGross > stake * maxMultiplierBps / 10_000) revert InvalidTerms();
    }
}
