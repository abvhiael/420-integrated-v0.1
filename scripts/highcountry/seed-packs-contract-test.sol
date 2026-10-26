// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import { SeedRegistry } from "../../contracts/src/highcountry/genetics/SeedRegistry.sol";
import { GenomeRegistry } from "../../contracts/src/highcountry/genetics/GenomeRegistry.sol";
import { GenesisRegistry } from "../../contracts/src/highcountry/genesis/GenesisRegistry.sol";
import { HighCountryAuthorization } from "../../contracts/src/highcountry/auth/HighCountryAuthorization.sol";
import { MockCapabilityRegistry } from "../../contracts/test/highcountry/mocks/MockCapabilityRegistry.sol";
import { ICapabilityRegistry420 } from "../../contracts/src/interfaces/genesis/ICapabilityRegistry420.sol";
import { GenesisRoots } from "../../contracts/src/highcountry/types/HighCountryTypes.sol";
import { ActionIds } from "../../contracts/src/highcountry/constants/ActionIds.sol";
import { ModuleIds } from "../../contracts/src/highcountry/constants/ModuleIds.sol";

// Disposable capability issuer only; all registry and authorization logic is unmodified production code.
contract SeedPackIssuanceTest {
    MockCapabilityRegistry private caps;
    SeedRegistry private seeds;
    bytes32 private constant G = keccak256("HC.SEED07.TEST.ONLY.GENOME");
    bytes32 private constant M = keccak256("HC.SEED07.TEST.ONLY.PACK.METADATA");
    address private constant OWNER = address(0xA11CE);

    function _grant(
        bytes32 module,
        bytes32 action,
        bytes32 scope,
        uint256 amount
    ) private returns (bytes32 key) {
        key = keccak256(abi.encode(module, action, scope));
        caps.setGrant(
            key,
            ICapabilityRegistry420.CapabilityGrant(
                address(this), module, action, scope, amount, 0, 0, 0, uint64(block.timestamp + 1 days), false
            ),
            amount
        );
    }

    function setUp() public {
        caps = new MockCapabilityRegistry();
        HighCountryAuthorization auth = new HighCountryAuthorization(address(caps));
        GenesisRegistry genesis = new GenesisRegistry(address(auth));
        GenomeRegistry genomes = new GenomeRegistry(address(auth), address(genesis));
        _grant(ModuleIds.GENESIS_REGISTRY, ActionIds.GENESIS_SET_ROOTS, genesis.ADMIN_SCOPE(), 0);
        _grant(ModuleIds.GENESIS_REGISTRY, ActionIds.GENESIS_FINALIZE, genesis.ADMIN_SCOPE(), 0);
        bytes32 root = keccak256("DISPOSABLE GENESIS NOT LIVE");
        genesis.setRoots(GenesisRoots(root, root, root, root, root, root));
        genesis.finalizeGenesis();
        _grant(ModuleIds.GENOME_REGISTRY, ActionIds.GENOME_REGISTER, G, 0);
        bytes32[28] memory loci;
        for (uint256 i; i < 28; i++) {
            loci[i] = keccak256(abi.encode("test", i));
        }
        genomes.registerGenome(G, keccak256("test-line"), keccak256("test-metadata"), loci);
        seeds = new SeedRegistry(address(auth), address(genomes));
    }

    function _register(
        uint64 id,
        bytes32 genome,
        uint32 quantity
    ) private returns (bool) {
        (bool ok,) = address(seeds).call(abi.encodeCall(seeds.registerSeedLot, (id, genome, 0, OWNER, quantity, M)));
        return ok;
    }

    function testAuthorizedThreeSeedLotPreservesExactIntent() public {
        _grant(ModuleIds.SEED_REGISTRY, ActionIds.SEED_REGISTER, bytes32(uint256(17)), 3);
        require(_register(17, G, 3), "registration failed");
        SeedRegistry.SeedLot memory lot = seeds.getSeedLot(17);
        require(
            lot.id == 17 && lot.genomeId == G && lot.owner == OWNER && lot.quantity == 3 && lot.breedingEventId == 0
                && lot.metadataHash == M && lot.exists,
            "intent mismatch"
        );
        require(seeds.remainingQuantity(17) == 3, "usable seeds mismatch");
    }

    function testNoCapabilityCannotIssue() public {
        require(!_register(17, G, 3), "unauthorized mint");
    }

    function testWrongScopeCannotIssue() public {
        _grant(ModuleIds.SEED_REGISTRY, ActionIds.SEED_REGISTER, bytes32(uint256(18)), 3);
        require(!_register(17, G, 3), "wrong scope mint");
    }

    function testQuantityAboveCapabilityCannotIssue() public {
        _grant(ModuleIds.SEED_REGISTRY, ActionIds.SEED_REGISTER, bytes32(uint256(17)), 3);
        require(!_register(17, G, 4), "excess mint");
    }

    function testUnknownGenomeCannotIssue() public {
        _grant(ModuleIds.SEED_REGISTRY, ActionIds.SEED_REGISTER, bytes32(uint256(17)), 3);
        require(!_register(17, keccak256("unknown"), 3), "invented genome");
    }

    function testReplayCannotIssueOrRewrite() public {
        _grant(ModuleIds.SEED_REGISTRY, ActionIds.SEED_REGISTER, bytes32(uint256(17)), 3);
        require(_register(17, G, 3), "first failed");
        require(!_register(17, G, 3), "duplicate mint");
        require(seeds.remainingQuantity(17) == 3, "replay added seeds");
    }

    function testRevokedCapabilityCannotIssue() public {
        bytes32 key = _grant(ModuleIds.SEED_REGISTRY, ActionIds.SEED_REGISTER, bytes32(uint256(17)), 3);
        caps.setRevoked(key, true);
        require(!_register(17, G, 3), "revoked mint");
    }
}
