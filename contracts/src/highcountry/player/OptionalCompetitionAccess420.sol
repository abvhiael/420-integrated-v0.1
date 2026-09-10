// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { ActionIds } from "../constants/ActionIds.sol";
import { ModuleIds } from "../constants/ModuleIds.sol";
import { HCAlreadyExists, HCNotFound, HCZeroAddress } from "../errors/HighCountryErrors.sol";
import { IHighCountryAuthorization } from "../interfaces/IHighCountryAuthorization.sol";
import { AuthorizationRequest } from "../types/HighCountryTypes.sol";
import { IHighCountryGamingAccess420 } from "./IHighCountryGamingAccess420.sol";

/// @notice Optional competition-entry gate backed by 420 Gaming Protocol entitlements.
/// @dev Core/base competitions remain outside this registry and therefore wallet-free.
contract OptionalCompetitionAccess420 {
    struct OptionalCompetition {
        bytes32 competitionId;
        bytes32 entitlementId;
        bytes32 contentId;
        bool active;
        bool exists;
    }

    IHighCountryAuthorization public immutable authorization;
    IHighCountryGamingAccess420 public immutable gamingAccess;

    mapping(bytes32 => OptionalCompetition) private _competitions;

    error CompetitionInactive(bytes32 competitionId);
    error CompetitionEntitlementRequired(bytes32 competitionId, uint64 growerProfileId);

    event OptionalCompetitionRegistered(
        bytes32 indexed competitionId,
        bytes32 indexed entitlementId,
        bytes32 indexed contentId
    );
    event OptionalCompetitionStatusChanged(bytes32 indexed competitionId, bool active);

    constructor(address authorization_, address gamingAccess_) {
        if (authorization_ == address(0) || gamingAccess_ == address(0)) revert HCZeroAddress();
        authorization = IHighCountryAuthorization(authorization_);
        gamingAccess = IHighCountryGamingAccess420(gamingAccess_);
    }

    function registerOptionalCompetition(bytes32 competitionId, bytes32 entitlementId, bytes32 contentId) external {
        if (competitionId == bytes32(0) || entitlementId == bytes32(0) || contentId == bytes32(0)) revert HCNotFound();
        if (_competitions[competitionId].exists) revert HCAlreadyExists();
        _requireAuthorized(ActionIds.OPTIONAL_COMPETITION_REGISTER, competitionId);

        _competitions[competitionId] = OptionalCompetition({
            competitionId: competitionId,
            entitlementId: entitlementId,
            contentId: contentId,
            active: true,
            exists: true
        });
        emit OptionalCompetitionRegistered(competitionId, entitlementId, contentId);
    }

    function setOptionalCompetitionStatus(bytes32 competitionId, bool active) external {
        OptionalCompetition storage record = _competitions[competitionId];
        if (!record.exists) revert HCNotFound();
        _requireAuthorized(ActionIds.OPTIONAL_COMPETITION_SET_STATUS, competitionId);
        record.active = active;
        emit OptionalCompetitionStatusChanged(competitionId, active);
    }

    function optionalCompetition(bytes32 competitionId) external view returns (OptionalCompetition memory) {
        OptionalCompetition memory record = _competitions[competitionId];
        if (!record.exists) revert HCNotFound();
        return record;
    }

    function hasAccess(uint64 growerProfileId, bytes32 competitionId) public view returns (bool) {
        OptionalCompetition memory record = _competitions[competitionId];
        if (!record.exists || !record.active) return false;
        return gamingAccess.hasCompetitionAccess(growerProfileId, record.entitlementId, record.contentId);
    }

    function requireAccess(uint64 growerProfileId, bytes32 competitionId) external view {
        OptionalCompetition memory record = _competitions[competitionId];
        if (!record.exists) revert HCNotFound();
        if (!record.active) revert CompetitionInactive(competitionId);
        if (!gamingAccess.hasCompetitionAccess(growerProfileId, record.entitlementId, record.contentId)) {
            revert CompetitionEntitlementRequired(competitionId, growerProfileId);
        }
    }

    function _requireAuthorized(bytes32 actionId, bytes32 competitionId) private view {
        authorization.requireAuthorized(
            AuthorizationRequest({
                principal: msg.sender,
                moduleId: ModuleIds.COMPETITION_ENGINE,
                actionId: actionId,
                scopeHash: competitionId,
                amount: 0
            })
        );
    }
}
