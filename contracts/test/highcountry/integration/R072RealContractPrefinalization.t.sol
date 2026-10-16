// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import {ICapabilityRegistry420} from "../../../src/interfaces/genesis/ICapabilityRegistry420.sol";
import {HighCountryAuthorization} from "../../../src/highcountry/auth/HighCountryAuthorization.sol";
import {GenesisRegistry} from "../../../src/highcountry/genesis/GenesisRegistry.sol";
import {RegionRegistry} from "../../../src/highcountry/world/RegionRegistry.sol";
import {WorldGenesisReadiness} from "../../../src/highcountry/world/WorldGenesisReadiness.sol";
import {GenomeRegistry} from "../../../src/highcountry/genetics/GenomeRegistry.sol";
import {LandRegistry} from "../../../src/highcountry/land/LandRegistry.sol";
import {ActionIds} from "../../../src/highcountry/constants/ActionIds.sol";
import {ModuleIds} from "../../../src/highcountry/constants/ModuleIds.sol";
import {GenesisRoots} from "../../../src/highcountry/types/HighCountryTypes.sol";
import {MockCapabilityRegistry} from "../mocks/MockCapabilityRegistry.sol";

/// @notice An actual-contract *offline development rehearsal*. Does not approve founding data.
contract R072RealContractPrefinalizationTest {
    MockCapabilityRegistry caps;
    GenesisRegistry genesis;
    RegionRegistry regions;
    GenomeRegistry genomes;
    LandRegistry land;
    WorldGenesisReadiness readiness;
    constructor() {
        caps = new MockCapabilityRegistry();
        HighCountryAuthorization auth = new HighCountryAuthorization(address(caps));
        genesis = new GenesisRegistry(address(auth));
        regions = new RegionRegistry(address(auth), address(genesis));
        genomes = new GenomeRegistry(address(auth), address(genesis));
        land = new LandRegistry(address(auth), address(regions), address(genesis));
        readiness = new WorldGenesisReadiness(address(genesis), address(regions));
        _grant(ModuleIds.GENESIS_REGISTRY, ActionIds.GENESIS_SET_ROOTS, genesis.ADMIN_SCOPE(), bytes32(uint256(1)), 0);
        for (uint16 i = 1; i <= 3; ++i) {
            _grant(ModuleIds.REGION_REGISTRY, ActionIds.REGION_REGISTER, bytes32(uint256(i)), bytes32(uint256(20+i)), 0);
            _grant(ModuleIds.LAND_REGISTRY, ActionIds.LAND_GENESIS_REGISTER, bytes32(uint256(i)), bytes32(uint256(30+i)), 4);
        }
        for (uint8 i = 1; i <= 16; ++i) {
            _grant(ModuleIds.GENOME_REGISTRY, ActionIds.FOUNDING_GENOME_REGISTER, bytes32(uint256(100+i)), bytes32(uint256(200+i)), 0);
        }
    }
    function _grant(bytes32 moduleId,bytes32 actionId,bytes32 scope,bytes32 id,uint256 amount) internal {
        ICapabilityRegistry420.CapabilityGrant memory g=ICapabilityRegistry420.CapabilityGrant({
            principal:address(this),componentId:moduleId,capabilityId:actionId,scopeHash:scope,
            perCallLimit:0,periodLimit:0,periodSeconds:0,validFrom:0,
            validUntil:uint64(block.timestamp+1 days),revoked:false
        });
        caps.setGrant(id,g,amount);
    }
    function _pair(bytes32 a,bytes32 b) internal pure returns(bytes32) {
        return a<=b?keccak256(abi.encodePacked(a,b)):keccak256(abi.encodePacked(b,a));
    }
    function _leaf(uint64 id) internal view returns(bytes32) {
        return land.genesisLeaf(id,uint16(id),address(this),4,bytes32(uint256(50+id)),bytes32(uint256(60+id)));
    }
    function _proof(uint64 id,bytes32 a,bytes32 b,bytes32 c) internal pure returns(bytes32[] memory p) {
        if(id==3){p=new bytes32[](1);p[0]=_pair(a,b);}
        else {p=new bytes32[](2);p[0]=id==1?b:a;p[1]=c;}
    }
    function testAllFoundersRegionsParcelsAndSixRootsBeforeFinalization() public {
        bytes32 a=_leaf(1);bytes32 b=_leaf(2);bytes32 c=_leaf(3);
        bytes32 root=_pair(_pair(a,b),c);
        genesis.setRoots(GenesisRoots({
            manifestRoot:keccak256("HC.R07.2.DEV.MANIFEST"),parameterRoot:keccak256("HC.R07.2.DEV.PARAMETER"),
            rulesetRoot:keccak256("HC.R07.2.DEV.RULESET"),landRoot:root,
            randomnessRoot:keccak256("HC.R07.2.DEV.RANDOMNESS"),
            qualificationRoot:keccak256("HC.R07.2.DEV.QUALIFICATION")
        }));
        for(uint16 i=1;i<=3;++i){
            regions.registerFoundingRegion(i,bytes32(uint256(i)),bytes32(uint256(i+3)),bytes32(uint256(i+6)));
            bytes32[] memory proof=_proof(uint64(i),a,b,c);
            land.registerGenesisParcel(uint64(i),i,address(this),4,bytes32(uint256(50+i)),bytes32(uint256(60+i)),proof);
            require(land.exists(uint64(i)),"founding parcel absent");
        }
        for(uint8 i=1;i<=16;++i){
            bytes32[28] memory loci;
            for(uint256 j=0;j<28;++j)loci[j]=bytes32(uint256(i)*100+j+1);
            bytes32 genomeId=bytes32(uint256(100+i));
            genomes.registerFoundingGenome(i,genomeId,bytes32(uint256(29+i)),loci);
            require(genomes.exists(genomeId),"founder absent");
        }
        require(regions.foundingRegionsReady(),"regions incomplete");
        require(genomes.foundingSetComplete(),"founders incomplete");
        require(!genesis.finalized()&&!readiness.worldReady(),"irreversible finalization occurred");
        bytes32[] memory forged=new bytes32[](1);forged[0]=bytes32(uint256(999));
        (bool ok,)=address(land).call(abi.encodeWithSelector(land.registerGenesisParcel.selector,uint64(4),uint16(1),address(this),uint32(4),bytes32(uint256(54)),bytes32(uint256(64)),forged));
        require(!ok,"forged proof accepted");
    }
}
