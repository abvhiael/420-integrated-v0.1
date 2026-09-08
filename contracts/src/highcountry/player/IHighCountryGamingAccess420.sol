// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

interface IHighCountryGamingAccess420 {
    function hasScopedEntitlement(
        uint64 growerProfileId,
        bytes32 entitlementId,
        bytes32 expectedType,
        bytes32 expectedContentId
    ) external view returns (bool);

    function requireScopedEntitlement(
        uint64 growerProfileId,
        bytes32 entitlementId,
        bytes32 expectedType,
        bytes32 expectedContentId
    ) external view;

    function hasBonusRegion(uint64 growerProfileId, bytes32 entitlementId, bytes32 regionContentId)
        external
        view
        returns (bool);

    function hasCosmetic(uint64 growerProfileId, bytes32 entitlementId, bytes32 cosmeticContentId)
        external
        view
        returns (bool);

    function hasCompetitionAccess(uint64 growerProfileId, bytes32 entitlementId, bytes32 competitionContentId)
        external
        view
        returns (bool);

    function hasGeneticsAccess(uint64 growerProfileId, bytes32 entitlementId, bytes32 geneticsContentId)
        external
        view
        returns (bool);
}
