// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

error HCZeroAddress();
error HCInvalidId();
error HCInvalidRegion(uint16 regionId);
error HCInvalidState();
error HCAlreadyExists();
error HCNotFound();
error HCUnauthorized(address principal, bytes32 moduleId, bytes32 actionId);
error HCGenesisAlreadyFinalized();
error HCGenesisNotFinalized();
error HCGenesisAuthorityDisabled();
error HCInvalidGenesisRoot(bytes32 rootName);
error HCInvalidProof();
error HCCapacityExceeded(uint256 requested, uint256 available);
error HCOccupancyConflict();
error HCRulesetAlreadyRegistered(bytes32 rulesetId);
error HCRulesetNotFound(bytes32 rulesetId);
error HCModuleAlreadyRegistered(bytes32 moduleId);
error HCModuleNotFound(bytes32 moduleId);
error HCModuleNotActive(bytes32 moduleId);
error HCEmergencyDomainNotAllowed(bytes32 domain);
error HCEmergencyRestrictionActive(bytes32 domain);
error HCImmutableState();
