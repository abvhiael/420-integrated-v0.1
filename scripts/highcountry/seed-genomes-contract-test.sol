// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { GenomeRegistry } from "../../contracts/src/highcountry/genetics/GenomeRegistry.sol";
import { FoundingGenetics } from "../../contracts/src/highcountry/genetics/FoundingGenetics.sol";
import { GenesisRegistry } from "../../contracts/src/highcountry/genesis/GenesisRegistry.sol";
import { HighCountryAuthorization } from "../../contracts/src/highcountry/auth/HighCountryAuthorization.sol";
import { MockCapabilityRegistry } from "../../contracts/test/highcountry/mocks/MockCapabilityRegistry.sol";
import { ICapabilityRegistry420 } from "../../contracts/src/interfaces/genesis/ICapabilityRegistry420.sol";
import { ActionIds } from "../../contracts/src/highcountry/constants/ActionIds.sol";
import { ModuleIds } from "../../contracts/src/highcountry/constants/ModuleIds.sol";
import { GenesisRoots } from "../../contracts/src/highcountry/types/HighCountryTypes.sol";
import {
    HCGenesisNotFinalized,
    HCUnauthorized,
    HCAlreadyExists,
    HCInvalidId
} from "../../contracts/src/highcountry/errors/HighCountryErrors.sol";

interface SeedGenomeVm {
    function readFile(
        string calldata path
    ) external view returns (string memory);
    function parseJsonBytes32(
        string calldata json,
        string calldata key
    ) external pure returns (bytes32);
    function parseJsonBytes32Array(
        string calldata json,
        string calldata key
    ) external pure returns (bytes32[] memory);
    function parseJsonString(
        string calldata json,
        string calldata key
    ) external pure returns (string memory);
    function parseJsonBool(
        string calldata json,
        string calldata key
    ) external pure returns (bool);
    function toString(
        uint256 value
    ) external pure returns (string memory);
}

contract SeedCommonGenomeRegistrationTest {
    SeedGenomeVm private constant vm = SeedGenomeVm(address(uint160(uint256(keccak256("hevm cheat code")))));
    MockCapabilityRegistry private capabilities;
    HighCountryAuthorization private authorization;
    GenesisRegistry private genesis;
    GenomeRegistry private genomes;
    string private manifest;

    function setUp() public {
        capabilities = new MockCapabilityRegistry();
        authorization = new HighCountryAuthorization(address(capabilities));
        genesis = new GenesisRegistry(address(authorization));
        genomes = new GenomeRegistry(address(authorization), address(genesis));
        manifest = vm.readFile("deployments/highcountry/common-reference-genomes.v1.json");
    }

    function _key(
        uint256 index,
        string memory field
    ) private pure returns (string memory) {
        return string.concat(".genomes[", vm.toString(index), "]", field);
    }

    function _record(
        uint256 index
    ) private view returns (GenomeRegistry.GenomeRecord memory e) {
        e.id = vm.parseJsonBytes32(manifest, _key(index, ".genomeId"));
        e.lineId = vm.parseJsonBytes32(manifest, _key(index, ".lineId"));
        e.metadataHash = vm.parseJsonBytes32(manifest, _key(index, ".metadataHash"));
        bytes32[] memory loci = vm.parseJsonBytes32Array(manifest, _key(index, ".loci"));
        require(loci.length == 28, "manifest locus count");
        for (uint256 i; i < 28; ++i) {
            e.loci[i] = loci[i];
        }
        require(!vm.parseJsonBool(manifest, _key(index, ".founding")), "common marked founding");
    }

    function _grant(
        bytes32 module,
        bytes32 action,
        bytes32 scope
    ) private returns (bytes32 grantId) {
        grantId = keccak256(abi.encode(module, action, scope));
        capabilities.setGrant(
            grantId,
            ICapabilityRegistry420.CapabilityGrant({
                principal: address(this),
                componentId: module,
                capabilityId: action,
                scopeHash: scope,
                perCallLimit: 0,
                periodLimit: 0,
                periodSeconds: 0,
                validFrom: 0,
                validUntil: uint64(block.timestamp + 1 days),
                revoked: false
            }),
            0
        );
    }

    function _finalize() private {
        _grant(ModuleIds.GENESIS_REGISTRY, ActionIds.GENESIS_SET_ROOTS, genesis.ADMIN_SCOPE());
        _grant(ModuleIds.GENESIS_REGISTRY, ActionIds.GENESIS_FINALIZE, genesis.ADMIN_SCOPE());
        bytes32 root = keccak256("HC.SEED.03.DISPOSABLE.TEST.ROOT.NOT.LIVE.GENESIS");
        genesis.setRoots(GenesisRoots(root, root, root, root, root, root));
        genesis.finalizeGenesis();
    }

    function _register(
        GenomeRegistry.GenomeRecord memory e
    ) private {
        genomes.registerGenome(e.id, e.lineId, e.metadataHash, e.loci);
    }

    function _reject(
        GenomeRegistry.GenomeRecord memory e,
        bytes4 selector
    ) private {
        uint64 count = genomes.genomeCount();
        (bool ok, bytes memory data) =
            address(genomes).call(abi.encodeCall(genomes.registerGenome, (e.id, e.lineId, e.metadataHash, e.loci)));
        require(!ok && data.length >= 4 && bytes4(data) == selector, "wrong rejection");
        require(genomes.genomeCount() == count, "failed call changed registry");
    }

    function _assertRecord(
        GenomeRegistry.GenomeRecord memory expected
    ) private view {
        GenomeRegistry.GenomeRecord memory actual = genomes.getGenome(expected.id);
        require(actual.exists && !actual.founding, "nonfounding identity");
        require(actual.id == expected.id && actual.lineId == expected.lineId, "identity mismatch");
        require(actual.metadataHash == expected.metadataHash, "metadata mismatch");
        require(keccak256(abi.encode(actual.loci)) == keccak256(abi.encode(expected.loci)), "loci mismatch");
    }

    function testAll23ReferencesRegisterExactlyAfterGenesis() public {
        _finalize();
        for (uint256 i; i < 23; ++i) {
            GenomeRegistry.GenomeRecord memory e = _record(i);
            for (uint8 f = 1; f <= 16; ++f) {
                require(e.lineId != FoundingGenetics.lineId(f), "founder collision");
            }
            _grant(ModuleIds.GENOME_REGISTRY, ActionIds.GENOME_REGISTER, e.id);
            _register(e);
            _assertRecord(e);
        }
        require(genomes.genomeCount() == 23 && genomes.foundingGenomeCount() == 0, "counts");
    }

    function testAll23ReferencesRejectBeforeGenesis() public {
        for (uint256 i; i < 23; ++i) {
            GenomeRegistry.GenomeRecord memory e = _record(i);
            _grant(ModuleIds.GENOME_REGISTRY, ActionIds.GENOME_REGISTER, e.id);
            _reject(e, HCGenesisNotFinalized.selector);
        }
    }

    function testAll23ReferencesRejectWithoutCapabilities() public {
        _finalize();
        for (uint256 i; i < 23; ++i) {
            _reject(_record(i), HCUnauthorized.selector);
        }
    }

    function testWrongGenomeScopeRejects() public {
        _finalize();
        _grant(ModuleIds.GENOME_REGISTRY, ActionIds.GENOME_REGISTER, _record(0).id);
        _reject(_record(1), HCUnauthorized.selector);
    }

    function testRevokedGrantRejects() public {
        _finalize();
        GenomeRegistry.GenomeRecord memory e = _record(0);
        bytes32 grantId = _grant(ModuleIds.GENOME_REGISTRY, ActionIds.GENOME_REGISTER, e.id);
        capabilities.setRevoked(grantId, true);
        _reject(e, HCUnauthorized.selector);
    }

    function testDuplicateCannotRewriteMetadataOrLoci() public {
        _finalize();
        GenomeRegistry.GenomeRecord memory e = _record(0);
        _grant(ModuleIds.GENOME_REGISTRY, ActionIds.GENOME_REGISTER, e.id);
        _register(e);
        GenomeRegistry.GenomeRecord memory changed = _record(0);
        changed.metadataHash = keccak256("tampered metadata");
        changed.loci[0] = keccak256("tampered locus");
        _reject(changed, HCAlreadyExists.selector);
        _assertRecord(e);
    }

    function testZeroRegistrationFieldsReject() public {
        _finalize();
        GenomeRegistry.GenomeRecord memory e = _record(0);
        _grant(ModuleIds.GENOME_REGISTRY, ActionIds.GENOME_REGISTER, e.id);
        e.lineId = bytes32(0);
        _reject(e, HCInvalidId.selector);
        e = _record(0);
        e.metadataHash = bytes32(0);
        _reject(e, HCInvalidId.selector);
        e = _record(0);
        e.id = bytes32(0);
        _grant(ModuleIds.GENOME_REGISTRY, ActionIds.GENOME_REGISTER, e.id);
        _reject(e, HCInvalidId.selector);
    }

    function testExistingSixteenFoundersRemainUnchanged() public {
        for (uint8 i = 1; i <= 16; ++i) {
            bytes32 id = keccak256(abi.encode("test-only founder", i));
            bytes32[28] memory loci;
            loci[0] = keccak256(abi.encode("test-only founding locus", i));
            _grant(ModuleIds.GENOME_REGISTRY, ActionIds.FOUNDING_GENOME_REGISTER, id);
            genomes.registerFoundingGenome(i, id, keccak256("test-only metadata"), loci);
        }
        _finalize();
        for (uint256 i; i < 23; ++i) {
            GenomeRegistry.GenomeRecord memory e = _record(i);
            _grant(ModuleIds.GENOME_REGISTRY, ActionIds.GENOME_REGISTER, e.id);
            _register(e);
        }
        require(genomes.genomeCount() == 39 && genomes.foundingGenomeCount() == 16, "founder counts changed");
        require(genomes.foundingSetComplete(), "founder completeness changed");
        for (uint8 i = 1; i <= 16; ++i) {
            bytes32 id = keccak256(abi.encode("test-only founder", i));
            GenomeRegistry.GenomeRecord memory f = genomes.getGenome(id);
            require(f.founding && f.lineId == FoundingGenetics.lineId(i), "founder changed");
            require(genomes.foundingGenomeOfLine(f.lineId) == id, "founder mapping changed");
            require(f.loci[0] == keccak256(abi.encode("test-only founding locus", i)), "founder locus changed");
        }
    }

    function testPythonLocusCommitmentsMatchEthereumKeccakInSolidity() public view {
        for (uint256 n; n < 23; ++n) {
            GenomeRegistry.GenomeRecord memory e = _record(n);
            string memory cid = vm.parseJsonString(manifest, _key(n, ".cultivarId"));
            string memory rh = vm.parseJsonString(manifest, _key(n, ".metadata.researchEntryHash"));
            for (uint256 i; i < 28; ++i) {
                bytes32 expected = keccak256(
                    bytes(string.concat('["HC.COMMON.LOCUS.V1","', cid, '",1,', vm.toString(i), ',"', rh, '"]'))
                );
                require(e.loci[i] == expected, "cross-language locus mismatch");
            }
        }
    }
}
