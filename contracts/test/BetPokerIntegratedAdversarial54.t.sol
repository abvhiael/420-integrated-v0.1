// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/bet/PokerVerifierVersions420.sol";
import "../src/bet/PokerGnarkElGamalAdapters420.sol";

/// @notice WS8 production-verifier integration owner.
///
/// SECURITY STATUS: INCOMPLETE. These tests validate production registry behavior,
/// NOT a successfully settled proof-admitted funded hand. The milestone workflow
/// must remain fail-closed until the historical proof artifacts are bound to the
/// same hand context in production deal, shuffle, delivery, reveal and ledger paths.
///
/// Do not inherit the mock-backed BetPokerNLHEBetting54 fixture here.
contract BetPokerIntegratedAdversarial54Test {
    PokerVerifierVersions420 internal versions;

    constructor() {
        versions = new PokerVerifierVersions420(address(this));
    }

    /// @dev A registry controls verifier identity and pins its runtime code hash.
    /// This control does NOT replace a genuine Groth16 proof.
    function testProductionRegistryPinsRuntimeCodeHash() public {
        bytes32 version = keccak256("WS8.REGISTRY.INVARIANT");
        bytes32 vk = keccak256("WS8.DISTINCT.VK");
        bytes32 circuit = keccak256("WS8.DISTINCT.CIRCUIT");
        bytes32 schema = keccak256("WS8.DISTINCT.PUBLIC.INPUTS");

        // A real production verifier must be obtained from the qualified proof
        // artifacts; using this registry's own runtime here only tests registry
        // mechanics, and MUST NOT be used for poker proof admission.
        versions.register(version, address(this), vk, circuit, schema);
        PokerVerifierVersions420.Version memory record = versions.get(version);
        require(record.exists, "version not registered");
        require(record.verifier == address(this), "verifier address changed");
        require(record.verifierCodeHash == address(this).codehash, "runtime not pinned");
        require(record.verifyingKeyHash == vk, "verifying key id changed");
        require(record.circuitHash == circuit, "circuit identity changed");
        require(record.publicInputSchemaHash == schema, "schema identity changed");
        require(versions.matches(version,address(this),vk,circuit,schema), "valid registration rejected");
        require(!versions.matches(version,address(this),keccak256("wrong"),circuit,schema),
            "wrong verifying key accepted");
        require(!versions.matches(version,address(this),vk,keccak256("wrong"),schema),
            "wrong circuit accepted");
        require(!versions.matches(version,address(this),vk,circuit,keccak256("wrong")),
            "wrong schema accepted");
    }

    /// @dev An unauthorized entity cannot install a verifier identity.
    function testUnauthorizedVerifierRegistrationReverts() public {
        PokerVerifierVersions420 other = new PokerVerifierVersions420(address(0xBEEF));
        (bool ok,) = address(other).call(abi.encodeCall(
            PokerVerifierVersions420.register,
            (keccak256("unauthorized"), address(this), keccak256("vk"),
             keccak256("circuit"), keccak256("schema"))
        ));
        require(!ok, "unauthorized registration accepted");
    }


    /// @dev A second registration cannot substitute a different verifier/VK
    /// for an already registered circuit version.
    function testRegisteredVerifierVersionCannotBeOverwritten() public {
        bytes32 id = keccak256("WS8.IMMUTABLE.VK.VERSION");
        bytes32 vk = keccak256("WS8.ORIGINAL.VK");
        bytes32 circuit = keccak256("WS8.ORIGINAL.CIRCUIT");
        bytes32 schema = keccak256("WS8.ORIGINAL.SCHEMA");
        versions.register(id, address(this), vk, circuit, schema);
        (bool ok,) = address(versions).call(abi.encodeCall(
            PokerVerifierVersions420.register,
            (id, address(this), keccak256("ATTACKER.VK"), circuit, schema)
        ));
        require(!ok, "verifier version overwritten");
        require(versions.matches(id,address(this),vk,circuit,schema),
            "previous verified identity changed");
    }

    /// @dev Invalid/undeployed verifiers cannot become trusted identities.
    function testUncontractedVerifierCannotBeRegistered() public {
        bytes32 id = keccak256("WS8.NONCONTRACT.VERIFIER");
        (bool ok,) = address(versions).call(abi.encodeCall(
            PokerVerifierVersions420.register,
            (id, address(0x123456), keccak256("VK"),keccak256("CIRCUIT"),keccak256("SCHEMA"))
        ));
        require(!ok, "uncontracted verifier registered");
        require(!versions.get(id).exists, "bad verifier persisted");
    }

    /// @dev Required full-hand legitimate control is deliberately absent:
    /// no success or security milestone may be inferred from the registry tests.
    /// TODO (blocking): implement testLegitimateFundedHandSettlement using
    /// generated WS1/WS2/WS3/WS4 verifiers and SAME funded hand context.
    ///
    /// TODO (blocking): implement testColludingDealers, testForgedRecipient,
    /// testCiphertextSubstitution, testRevokedKeys, testCrossHandReplay,
    /// testPrematureReveal, testSelectiveWithholding, testDisputeAbuse,
    /// testDoubleSettlement and testReentrancy on that same fixture.
}
