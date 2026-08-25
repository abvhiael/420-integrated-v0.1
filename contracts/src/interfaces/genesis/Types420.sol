// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
library Types420 {
    enum Lifecycle { NONE, PROPOSED, ACTIVE, PAUSED, SUSPENDED, DEPRECATED, WITHDRAWAL_ONLY, RETIRED }
    enum Health { UNKNOWN, HEALTHY, DEGRADED, UNHEALTHY, HALTED }
    enum Direction { NONE, INBOUND, OUTBOUND, BOTH }
    enum MerchantStatus { UNVERIFIED, REGISTERED, CREDENTIALED, REGULATED }
    enum IdentityAssurance { NONE, SELF_ASSERTED, ATTESTED, CREDENTIALED, REGULATED }
    enum GovernanceClass { G1_ROUTINE, G2_PARAMETER, G3_SECURITY, G4_CONSTITUTIONAL }
    enum FinalityRequirement { INCLUDED, CERTIFIED, FINALIZED, HIGH_VALUE }
    struct Version { uint16 major; uint16 minor; uint16 patch; }
    struct AssetRef { bytes32 assetId; address token; uint8 decimals; bytes3 currency; bool canonical; }
    struct ContractRef {
        bytes32 componentId; address implementation; bytes32 runtimeCodeHash;
        Version version; Lifecycle lifecycle;
    }
}
