// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

type GrowerProfileId is uint64;
type ModuleId is bytes32;
type RegionId is uint16;
type LandParcelId is uint64;
type PublicPlotId is uint64;
type GenomeId is bytes32;
type BreedingEventId is uint64;
type SeedLotId is uint64;
type CloneId is uint64;
type MotherId is uint64;
type PhenotypeId is bytes32;
type PlantId is uint64;
type HarvestId is uint64;
type EquipmentId is uint64;
type EquipmentTypeId is uint32;
type RecipeId is uint32;
type ManufacturingJobId is uint64;
type OrganizationId is uint64;
type CooperativeId is uint16;
type ProposalId is uint64;
type ListingId is uint64;
type LicenseId is uint64;
type LeaseId is uint64;
type RightId is uint64;
type SeasonId is uint32;
type CompetitionTemplateId is bytes32;
type CompetitionId is uint64;
type CompetitionScore is uint128;
type RulesetId is bytes32;
type RandomRequestId is bytes32;
type MissionId is bytes32;
type ResearchNodeId is uint32;
type ResearchProgress is uint32;
type DiscoveryId is uint64;
type SkillTrackId is uint8;
type AchievementId is uint32;

type BasisPoints is uint16;
type PPM is uint32;
type Wad is uint256;
type Normalized1e4 is uint16;
type ProbabilityPpm is uint32;
type Multiplier1e4 is uint32;
type QualityScore is uint16;
type MassMg is uint64;
type VolumeMl is uint64;
type PowerW is uint32;
type EnergyWh is uint64;
type TemperatureMilliC is int32;
type RelativeHumidityBps is uint16;
type LightPpfd is uint32;
type Co2Ppm is uint32;
type PhMilli is uint16;
type EC is uint32;

struct GenesisRoots {
    bytes32 manifestRoot;
    bytes32 parameterRoot;
    bytes32 rulesetRoot;
    bytes32 landRoot;
    bytes32 randomnessRoot;
    bytes32 qualificationRoot;
}

struct AuthorizationRequest {
    address principal;
    bytes32 moduleId;
    bytes32 actionId;
    bytes32 scopeHash;
    uint256 amount;
}
