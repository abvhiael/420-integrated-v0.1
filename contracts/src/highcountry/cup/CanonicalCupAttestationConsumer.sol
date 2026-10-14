// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import { HighCountryGamingBridge420 } from "../player/HighCountryGamingBridge420.sol";
import { Global420Cup } from "./Global420Cup.sol";
import { HighCountryCrossGame420 } from "../player/HighCountryCrossGame420.sol";

/// @notice The shared attestation and live canonical Cup must independently agree; neither grants financial/stat authority.
contract CanonicalCupAttestationConsumer {
    Global420Cup public immutable cup;
    HighCountryCrossGame420 public immutable crossGame;
    error InvalidSource();

    constructor(
        address cup_,
        address crossGame_
    ) {
        if (cup_.code.length == 0 || crossGame_.code.length == 0) revert InvalidSource();
        cup = Global420Cup(cup_);
        crossGame = HighCountryCrossGame420(crossGame_);
    }

    function payload(
        bytes32 id,
        bytes32 scope
    ) public view returns (bytes32) {
        return keccak256(
            abi.encode(
                "HC.CUP.SCOPED.CONSUMER.V1", block.chainid, address(cup), id, scope, cup.finalResultCommitment(id)
            )
        );
    }

    function eligible(
        uint64 grower,
        address player,
        bytes32 id,
        bytes32 scope,
        bytes32 attestation
    ) external view returns (bool) {
        if (!cup.isIssued(id, player, scope)) return false;
        HighCountryGamingBridge420 bridge = HighCountryGamingBridge420(address(crossGame.gamingBridge()));
        if (bridge.growerProfiles().getProfile(grower).account != player) return false;
        // Canonical bridge mapping cannot be replaced by caller-supplied shared profiles.
        return
            crossGame.hasScopedAttestation(grower, attestation, crossGame.global420CupSubject(), id, payload(id, scope));
    }
}
