// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @notice Independent optional entry entitlement evidence, never a gameplay score modifier.
interface IHC73ExternalEntitlement {
    function eligible(
        address account,
        bytes32 scope
    ) external view returns (bool);
}

/// @notice Explicit opt-in, immutable scope-to-verifier binding.
/// @dev A scope absent from this registry is NOT premium; base templates use a zero scope.
contract PremiumCompetitionEntitlements73 {
    error Unauthorized();
    error Invalid();
    address public immutable registrar;
    struct Gate {
        address verifier;
        bool active;
        bool registered;
    }
    mapping(bytes32 => Gate) public gates;
    event GateRegistered(bytes32 indexed scope, address indexed verifier);
    event GateStatus(bytes32 indexed scope, bool active);

    constructor(
        address registrar_
    ) {
        if (registrar_ == address(0)) revert Invalid();
        registrar = registrar_;
    }

    function registerGate(
        bytes32 scope,
        address verifier
    ) external {
        if (msg.sender != registrar) revert Unauthorized();
        if (scope == bytes32(0) || verifier.code.length == 0 || gates[scope].registered) revert Invalid();
        gates[scope] = Gate(verifier, true, true);
        emit GateRegistered(scope, verifier);
    }

    function setActive(
        bytes32 scope,
        bool active
    ) external {
        if (msg.sender != registrar) revert Unauthorized();
        if (!gates[scope].registered) revert Invalid();
        gates[scope].active = active;
        emit GateStatus(scope, active);
    }

    /// @notice A failed, reverted or unavailable independent verifier denies access.
    /// @dev Does not read genetics, yield, quality, equipment, BUDS, prizes or wallet balances.
    function eligible(
        address account,
        bytes32 scope
    ) external view returns (bool) {
        Gate memory gate = gates[scope];
        if (
            account == address(0) || scope == bytes32(0) || !gate.registered || !gate.active
                || gate.verifier.code.length == 0
        ) return false;
        try IHC73ExternalEntitlement(gate.verifier).eligible(account, scope) returns (bool allowed) {
            return allowed;
        } catch {
            return false;
        }
    }
}
