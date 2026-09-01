// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "../interfaces/genesis/ICapabilityRegistry420.sol";
import "./BetIds420.sol";
import "./BetTypes420.sol";

contract BetAuthorization420 is I420System {
    ICapabilityRegistry420 public immutable capabilityRegistry;

    error ZeroAddress();

    constructor(address capabilityRegistry_) {
        if (capabilityRegistry_ == address(0)) revert ZeroAddress();
        capabilityRegistry = ICapabilityRegistry420(capabilityRegistry_);
    }

    function systemName() external pure returns (string memory) { return "BetAuthorization420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function scopeGlobal() public pure returns (bytes32) { return keccak256("420.BET.SCOPE.GLOBAL"); }
    function scopeForModule(bytes32 moduleId, bytes32 moduleVersionId) public pure returns (bytes32) {
        return keccak256(abi.encode("420.BET.SCOPE.MODULE", moduleId, moduleVersionId));
    }
    function scopeForGame(bytes32 gameId, bytes32 gameVersionId) public pure returns (bytes32) {
        return keccak256(abi.encode("420.BET.SCOPE.GAME", gameId, gameVersionId));
    }
    function scopeForProfile(bytes32 profileId) public pure returns (bytes32) {
        return keccak256(abi.encode("420.BET.SCOPE.PROFILE", profileId));
    }
    function scopeForOperator(bytes32 operatorId) public pure returns (bytes32) {
        return keccak256(abi.encode("420.BET.SCOPE.OPERATOR", operatorId));
    }
    function scopeForVault(bytes32 vaultId) public pure returns (bytes32) {
        return keccak256(abi.encode("420.BET.SCOPE.VAULT", vaultId));
    }
    function scopeForWager(bytes32 wagerId) public pure returns (bytes32) {
        return keccak256(abi.encode("420.BET.SCOPE.WAGER", wagerId));
    }
    function scopeForPlayer(address player) public pure returns (bytes32) {
        return keccak256(abi.encode("420.BET.SCOPE.PLAYER", player));
    }
    function scopeForMarket(bytes32 marketId) public pure returns (bytes32) {
        return keccak256(abi.encode("420.BET.SCOPE.MARKET", marketId));
    }
    function scopeForContest(bytes32 contestId) public pure returns (bytes32) {
        return keccak256(abi.encode("420.BET.SCOPE.CONTEST", contestId));
    }
    function scopeForTable(bytes32 tableId) public pure returns (bytes32) {
        return keccak256(abi.encode("420.BET.SCOPE.TABLE", tableId));
    }
    function scopeForAsset(address asset) public pure returns (bytes32) {
        return keccak256(abi.encode("420.BET.SCOPE.ASSET", asset));
    }
    function scopeForEmergency(BetTypes420.EmergencyDomain domain, bytes32 subject) public pure returns (bytes32) {
        return keccak256(abi.encode("420.BET.SCOPE.EMERGENCY", domain, subject));
    }

    function isAuthorized(address principal, bytes32 actionId, bytes32 scopeHash, uint256 amount)
        external view returns (bool)
    {
        return capabilityRegistry.isAuthorized(principal, BetIds420.COMPONENT_BET, actionId, scopeHash, amount);
    }

    function isGameAuthorized(
        address principal,
        bytes32 actionId,
        bytes32 gameId,
        bytes32 gameVersionId,
        uint256 amount
    ) external view returns (bool) {
        return capabilityRegistry.isAuthorized(
            principal,
            BetIds420.COMPONENT_BET,
            actionId,
            scopeForGame(gameId, gameVersionId),
            amount
        );
    }
}
