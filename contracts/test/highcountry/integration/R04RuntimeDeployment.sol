// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
// Disposable local-chain integration fixture only. Never include it in a production deployment manifest.
import {CapabilityRegistry420} from "../../../src/system/CapabilityRegistry420.sol";
import {HighCountryAuthorization} from "../../../src/highcountry/auth/HighCountryAuthorization.sol";
import {GenesisRegistry} from "../../../src/highcountry/genesis/GenesisRegistry.sol";
import {RegionRegistry} from "../../../src/highcountry/world/RegionRegistry.sol";
import {GenomeRegistry} from "../../../src/highcountry/genetics/GenomeRegistry.sol";
import {SeedRegistry} from "../../../src/highcountry/genetics/SeedRegistry.sol";
import {MotherRegistry} from "../../../src/highcountry/genetics/MotherRegistry.sol";
import {CloneRegistry} from "../../../src/highcountry/genetics/CloneRegistry.sol";
import {LandRegistry} from "../../../src/highcountry/land/LandRegistry.sol";
import {PublicCultivationAccess} from "../../../src/highcountry/land/PublicCultivationAccess.sol";
import {PlantRegistry} from "../../../src/highcountry/cultivation/PlantRegistry.sol";
import {CultivationEngine} from "../../../src/highcountry/cultivation/CultivationEngine.sol";
import {HarvestEngine} from "../../../src/highcountry/harvest/HarvestEngine.sol";
import {HarvestProductRegistry} from "../../../src/highcountry/harvest/HarvestProductRegistry.sol";
import {InventoryRegistry} from "../../../src/highcountry/inventory/InventoryRegistry.sol";
import {CanonicalMarketEscrow} from "../../../src/highcountry/market/CanonicalMarketEscrow.sol";
import {MissionEngine} from "../../../src/highcountry/missions/MissionEngine.sol";
import {EmergencyState} from "../../../src/highcountry/security/EmergencyState.sol";
import {R04EmergencyConsumer} from "../../../src/highcountry/security/R04EmergencyConsumer.sol";
import {ModuleIds} from "../../../src/highcountry/constants/ModuleIds.sol";
import {ActionIds} from "../../../src/highcountry/constants/ActionIds.sol";
import {EmergencyDomains} from "../../../src/highcountry/constants/EmergencyDomains.sol";
import {GameRegistry420} from "../../../src/gaming/GameRegistry420.sol";
import {GameIdentity420} from "../../../src/gaming/GameIdentity420.sol";
import {GamingAuthorization420} from "../../../src/gaming/GamingAuthorization420.sol";
import {GamingIds420} from "../../../src/gaming/GamingIds420.sol";
contract R04RuntimeDeployment {
    address public operator;
    bytes32 public constant GAME=keccak256("420/GAMING/GAME/HIGH_COUNTRY/V1");
    bytes32 public constant MISSION=keccak256("runtime-mission-fixture");
    bytes32 public constant RESOURCE=keccak256("runtime-resource-fixture");
    GameRegistry420 public games;
    GameIdentity420 public identity;
    MissionEngine public mission;
    EmergencyState public emergency;
    InventoryRegistry public inventory;
    CanonicalMarketEscrow public escrow;
    CapabilityRegistry420 private caps;
    uint256 private serial;
    function initialize(address operator_) external {
        require(operator == address(0) && msg.sender == operator_, "fixture initialization");
        operator=operator_;caps=new CapabilityRegistry420();
        HighCountryAuthorization auth=new HighCountryAuthorization(address(caps));
        emergency=new EmergencyState(address(auth));
        caps.registerProtocolComponent(ModuleIds.EMERGENCY_STATE,address(this));
        GamingAuthorization420 gaming=new GamingAuthorization420(address(caps));
        caps.registerProtocolComponent(GamingIds420.COMPONENT_GAMING,address(this));
        grant(address(this),GamingIds420.COMPONENT_GAMING,GamingIds420.ACTION_REGISTER_GAME,gaming.scopeForGame(GAME));
        games=new GameRegistry420(address(gaming));games.registerGame(GAME,address(this),keccak256("local-ci-only"));
        identity=new GameIdentity420(address(games));
        mission=new MissionEngine(address(auth));bind(mission);
        mission.registerTemplate(MISSION,keccak256("test-version"),keccak256("test-objective"),bytes32(0),1 days,1,100);
        mission.setVerifier(address(this),true);
        GenesisRegistry genesis=new GenesisRegistry(address(auth));
        RegionRegistry regions=new RegionRegistry(address(auth),address(genesis));
        GenomeRegistry genomes=new GenomeRegistry(address(auth),address(genesis));
        LandRegistry land=new LandRegistry(address(auth),address(regions),address(genesis));
        PublicCultivationAccess access=new PublicCultivationAccess(address(auth),address(land));
        SeedRegistry seeds=new SeedRegistry(address(auth),address(genomes));
        MotherRegistry mothers=new MotherRegistry(address(auth),address(genomes));
        CloneRegistry clones=new CloneRegistry(address(auth),address(genomes),address(mothers));
        PlantRegistry plants=new PlantRegistry(address(auth),address(genomes),address(land),address(access),address(seeds),address(clones));
        CultivationEngine cultivation=new CultivationEngine(address(auth),address(plants));
        HarvestEngine harvest=new HarvestEngine(address(auth),address(plants),address(cultivation));
        HarvestProductRegistry products=new HarvestProductRegistry(address(harvest));
        inventory=new InventoryRegistry(address(products));inventory.registerResource(RESOURCE,InventoryRegistry.Unit.COUNT);
        inventory.setIssuer(address(this),true);
        escrow=new CanonicalMarketEscrow(address(auth), address(inventory),operator_);bind(escrow);
        grant(operator_,ModuleIds.EMERGENCY_STATE,ActionIds.EMERGENCY_RESTRICT,EmergencyDomains.MARKET);
        grant(operator_,ModuleIds.EMERGENCY_STATE,ActionIds.EMERGENCY_RELEASE,EmergencyDomains.MARKET);
    }
    function grant(address principal,bytes32 module,bytes32 action,bytes32 scope) internal {
        caps.createGrant(keccak256(abi.encode(++serial)),principal,module,action,scope,0,0,0,0,0);
    }
    function bind(R04EmergencyConsumer c) internal {
        grant(address(this),ModuleIds.EMERGENCY_STATE,c.R04_BIND_ACTION(),c.emergencyBindingScope(address(emergency)));
        c.bindR04Emergency(address(emergency));
    }
    function verifyTestMission(address player) external {
        require(msg.sender==operator,"fixture operator");
        mission.attest(player,MISSION,keccak256(abi.encode("ci-proof",player)),1);
    }
    function mintTestResource(address player) external {
        require(msg.sender==operator,"fixture operator");
        inventory.acquire(keccak256(abi.encode("ci-resource",player)),RESOURCE,player,3);
    }
}
