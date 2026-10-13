// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import {PublicPlantCapacityFixture} from "./PublicPlantCapacity.t.sol";
import {CultivationEngine} from "../../../src/highcountry/cultivation/CultivationEngine.sol";
import {HarvestEngine} from "../../../src/highcountry/harvest/HarvestEngine.sol";
import {HarvestProductRegistry} from "../../../src/highcountry/harvest/HarvestProductRegistry.sol";
import {InventoryRegistry} from "../../../src/highcountry/inventory/InventoryRegistry.sol";
import {ResourceLedger} from "../../../src/highcountry/inventory/ResourceLedger.sol";
import {EquipmentRegistry} from "../../../src/highcountry/equipment/EquipmentRegistry.sol";
import {EquipmentLifecycleEngine} from "../../../src/highcountry/equipment/EquipmentLifecycleEngine.sol";
import {EquipmentCultivationBridge} from "../../../src/highcountry/equipment/EquipmentCultivationBridge.sol";
import {ManufacturingEngine} from "../../../src/highcountry/manufacturing/ManufacturingEngine.sol";
import {CanonicalMarketEscrow} from "../../../src/highcountry/market/CanonicalMarketEscrow.sol";
import {RightsRegistry} from "../../../src/highcountry/rights/RightsRegistry.sol";
import {LeaseRegistry} from "../../../src/highcountry/rights/LeaseRegistry.sol";
import {LicenseRegistry} from "../../../src/highcountry/rights/LicenseRegistry.sol";
import {OrganizationRegistry} from "../../../src/highcountry/organization/OrganizationRegistry.sol";
import {OrganizationAuthority} from "../../../src/highcountry/organization/OrganizationAuthority.sol";
import {OrganizationTreasuryPermissions} from "../../../src/highcountry/organization/OrganizationTreasuryPermissions.sol";
import {CooperativeRegistry} from "../../../src/highcountry/cooperative/CooperativeRegistry.sol";
import {CooperativeGovernance} from "../../../src/highcountry/cooperative/CooperativeGovernance.sol";
import {GovernanceExecutor} from "../../../src/highcountry/cooperative/GovernanceExecutor.sol";
import {MissionEngine} from "../../../src/highcountry/missions/MissionEngine.sol";
import {CompetitionEngine} from "../../../src/highcountry/competition/CompetitionEngine.sol";
import {CanonicalCompetitionEvidence} from "../../../src/highcountry/competition/CanonicalCompetitionEvidence.sol";
import {SeasonRegistry} from "../../../src/highcountry/competition/SeasonRegistry.sol";
import {CompetitionTemplateRegistry} from "../../../src/highcountry/competition/CompetitionTemplateRegistry.sol";
import {Global420Cup} from "../../../src/highcountry/cup/Global420Cup.sol";
import {R04EmergencyConsumer} from "../../../src/highcountry/security/R04EmergencyConsumer.sol";
import {EmergencyDomains} from "../../../src/highcountry/constants/EmergencyDomains.sol";
import {ActionIds} from "../../../src/highcountry/constants/ActionIds.sol";
import {ModuleIds} from "../../../src/highcountry/constants/ModuleIds.sol";
contract R04EquipmentEmergencyTest is PublicPlantCapacityFixture {
    InventoryRegistry inventory;
    ManufacturingEngine manufacturing;
    EquipmentRegistry equipment;
    EquipmentLifecycleEngine lifecycle;
    EquipmentCultivationBridge bridge;
    CultivationEngine cultivation;
    HarvestProductRegistry products;
    bytes32 constant RAW=keccak256("raw");
    bytes32 constant REPAIR=keccak256("repair");
    bytes32 constant SCRAP=keccak256("scrap");
    bytes32 constant TYPE=keccak256("type");
    bytes32 constant ITEM=keccak256("earned-item");
    bytes32 constant RECIPE=keccak256("recipe");
    function bind(R04EmergencyConsumer c) internal {
        _grant(address(this),ModuleIds.EMERGENCY_STATE,c.R04_BIND_ACTION(),c.emergencyBindingScope(address(emergency)));
        c.bindR04Emergency(address(emergency));
    }
    function restrict(bytes32 domain) internal {
        _grant(address(this),ModuleIds.EMERGENCY_STATE,ActionIds.EMERGENCY_RESTRICT,domain);
        emergency.setRestricted(domain,true);
    }
    function denied(address target,bytes memory data,bytes32 domain) internal {
        restrict(domain);(bool ok,bytes memory reason)=target.call(data);
        require(!ok&&reason.length>=4&&bytes4(reason)==R04EmergencyConsumer.R04Restricted.selector,"restriction not enforced");
    }
    function setUp() public override {
        super.setUp();_private(1);
        caps.registerProtocolComponent(ModuleIds.CULTIVATION_ENGINE,address(this));
        cultivation=new CultivationEngine(address(auth),address(plants));
        _grant(address(this),ModuleIds.CULTIVATION_ENGINE,ActionIds.CULTIVATION_BIND_EMERGENCY,cultivation.EMERGENCY_BIND_SCOPE());
        cultivation.bindEmergencyState(address(emergency));
        HarvestEngine harvest=new HarvestEngine(address(auth),address(plants),address(cultivation));
        products=new HarvestProductRegistry(address(harvest));inventory=new InventoryRegistry(address(products));
        inventory.registerResource(RAW,InventoryRegistry.Unit.COUNT);inventory.registerResource(REPAIR,InventoryRegistry.Unit.COUNT);
        inventory.registerResource(SCRAP,InventoryRegistry.Unit.COUNT);inventory.setIssuer(address(this),true);
        inventory.acquire(keccak256("earned-raw"),RAW,address(this),20);
        equipment=new EquipmentRegistry(address(land));bind(equipment);
        int16[6] memory effects;effects[0]=50;equipment.registerType(TYPE,keccak256("catalogue"),1,effects);
        equipment.setIssuer(address(this),true);equipment.issue(ITEM,TYPE,address(this),keccak256("earned-proof"));
        lifecycle=new EquipmentLifecycleEngine(address(equipment),address(inventory));bind(lifecycle);
        equipment.bindLifecycleController(address(lifecycle));inventory.setIssuer(address(lifecycle),true);
        inventory.setInventoryOperator(address(lifecycle),true);
        lifecycle.registerPolicy(TYPE,keccak256("catalogue"),2,1,1,REPAIR,2,2,SCRAP,3);
        bridge=new EquipmentCultivationBridge(address(equipment),address(lifecycle),address(cultivation),address(plants));bind(bridge);
        lifecycle.setUseVerifier(address(bridge),true);
        _grant(address(bridge),ModuleIds.CULTIVATION_ENGINE,ActionIds.CULTIVATION_UPDATE,bytes32(uint256(1)));
        equipment.place(ITEM,1);
        manufacturing=new ManufacturingEngine(address(inventory),2);bind(manufacturing);
        inventory.setInventoryOperator(address(manufacturing),true);inventory.setIssuer(address(manufacturing),true);
        bytes32[2] memory ins;bytes32[2] memory outs;uint256[2] memory amounts;uint256[2] memory produced;
        ins[0]=RAW;amounts[0]=10;outs[0]=REPAIR;produced[0]=2;
        manufacturing.registerRecipe(RECIPE,keccak256("catalogue"),ins,amounts,outs,produced,1,0);
    }
    function environment() internal pure returns(CultivationEngine.EnvironmentSnapshot memory) {
        return CultivationEngine.EnvironmentSnapshot(2400,6000,7000,6000,6500,5000);
    }
    function testManufacturedRepairResourcesActualLandAndCultivationEffects() public {
        bytes32 job=manufacturing.start(RECIPE);vm.warp(block.timestamp+1);manufacturing.complete(job);
        bridge.applyEnvironment(1,ITEM,environment());
        require(cultivation.getState(1).environment.temperature==2450,"equipment not applied");
        bridge.applyEnvironment(1,ITEM,environment());
        require(equipment.disabled(ITEM)&&cultivation.getState(1).environment.temperature==2400,"broken effects survived");
        lifecycle.repair(ITEM);
        require(inventory.ledger().balance(REPAIR,address(this)).consumed==2,"repair bypassed manufacturing resource");
        require(inventory.ledger().balance(RAW,address(this)).consumed==10,"raw input unconserved");
        lifecycle.retire(ITEM);lifecycle.recycle(ITEM);
        require(equipment.occupiedSlots(1)==0&&inventory.ledger().balance(SCRAP,address(this)).available==3,"recovery unconserved");
        (bool replay,)=address(lifecycle).call(abi.encodeCall(lifecycle.recycle,(ITEM)));require(!replay,"recycle replay");
    }
    function testRestrictedManufacturingRefundAndEscrowCancellationRemainSafe() public {
        bytes32 job=manufacturing.start(RECIPE);restrict(EmergencyDomains.MANUFACTURING);
        (bool completed,)=address(manufacturing).call(abi.encodeCall(manufacturing.complete,(job)));
        require(!completed,"restricted completion");manufacturing.cancel(job);
        ResourceLedger.Balance memory b=inventory.ledger().balance(RAW,address(this));
        require(b.available==20&&b.reserved==0&&b.consumed==0,"cancel lost raw resources");
        lifecycle.retire(ITEM);lifecycle.recycle(ITEM);
        require(inventory.ledger().balance(SCRAP,address(this)).available==3,"restricted recovery lost");
        CanonicalMarketEscrow market=new CanonicalMarketEscrow(address(inventory),address(this));bind(market);
        inventory.setInventoryOperator(address(market),true);inventory.setMarketTransferOperator(address(market),true);
        market.list(keccak256("listing"),RAW,5,uint64(block.timestamp+100));restrict(EmergencyDomains.MARKET);
        (bool sold,)=address(market).call(abi.encodeCall(market.settle,(keccak256("listing"),ALICE)));
        require(!sold,"restricted trade");market.cancel(keccak256("listing"));
        b=inventory.ledger().balance(RAW,address(this));require(b.available==20&&b.reserved==0,"escrow cancel lost inventory");
    }
    function testRemainingR04FamiliesEnforceCanonicalDomainRestrictions() public {
        RightsRegistry rights=new RightsRegistry();bind(rights);
        LeaseRegistry leases=new LeaseRegistry(address(rights));bind(leases);
        LicenseRegistry licenses=new LicenseRegistry(address(rights));bind(licenses);
        OrganizationRegistry org=new OrganizationRegistry();bind(org);
        OrganizationAuthority authority=new OrganizationAuthority(address(org));bind(authority);
        OrganizationTreasuryPermissions financial=new OrganizationTreasuryPermissions(address(org),address(this),ALICE);bind(financial);
        CooperativeRegistry coops=new CooperativeRegistry(address(org));bind(coops);
        CooperativeGovernance governance=new CooperativeGovernance(address(coops));bind(governance);
        GovernanceExecutor executor=new GovernanceExecutor(address(governance));bind(executor);
        MissionEngine missions=new MissionEngine();bind(missions);
        CanonicalCompetitionEvidence evidence=new CanonicalCompetitionEvidence(address(products),address(this),address(this),1);
        CompetitionEngine competition=new CompetitionEngine(address(new SeasonRegistry()),address(new CompetitionTemplateRegistry()),address(evidence),address(0),address(this));bind(competition);
        Global420Cup cup=new Global420Cup(address(competition));bind(cup);
        denied(address(rights),abi.encodeCall(rights.registerAsset,(TYPE,address(this))),EmergencyDomains.RIGHTS);
        denied(address(licenses),abi.encodeCall(licenses.issue,(TYPE,TYPE,ALICE,uint32(1),uint64(1),uint64(100),uint256(0))),EmergencyDomains.LICENSE);
        denied(address(leases),abi.encodeCall(leases.create,(TYPE,TYPE,ALICE,uint64(1),uint64(100),uint256(1),uint256(0))),EmergencyDomains.LEASE);
        denied(address(org),abi.encodeCall(org.create,(TYPE)),EmergencyDomains.ORGANIZATION_GOVERNANCE);
        denied(address(authority),abi.encodeWithSignature("consume(bytes32,bytes32,bytes32)",TYPE,TYPE,TYPE),EmergencyDomains.ORGANIZATION_GOVERNANCE);
        denied(address(financial),abi.encodeCall(financial.propose,(TYPE,ALICE,TYPE,TYPE,uint64(100),uint256(1))),EmergencyDomains.ORGANIZATION_GOVERNANCE);
        denied(address(coops),abi.encodeWithSignature("enroll(bytes32)",TYPE),EmergencyDomains.COOPERATIVE_GOVERNANCE);
        denied(address(governance),abi.encodeCall(governance.vote,(TYPE,true)),EmergencyDomains.COOPERATIVE_GOVERNANCE);
        denied(address(executor),abi.encodeCall(executor.execute,(TYPE)),EmergencyDomains.COOPERATIVE_GOVERNANCE);
        denied(address(missions),abi.encodeCall(missions.activate,(TYPE)),EmergencyDomains.MISSION_ACTIVATION);
        denied(address(competition),abi.encodeCall(competition.enter,(TYPE)),EmergencyDomains.COMPETITION_ENTRY);
        denied(address(cup),abi.encodeCall(cup.issueCrossGame,(TYPE)),EmergencyDomains.COMPETITION_ENTRY);
    }
    function testUnboundAndWrongBindingScopeFailClosedAndLandHandoffRevokesEffects() public {
        MissionEngine m=new MissionEngine();
        (bool unbound,)=address(m).call(abi.encodeCall(m.activate,(TYPE)));require(!unbound,"unbound ingress");
        (bool noGrant,)=address(m).call(abi.encodeCall(m.bindR04Emergency,(address(emergency))));require(!noGrant,"unscoped binding");
        bind(m);(bool rebind,)=address(m).call(abi.encodeCall(m.bindR04Emergency,(address(emergency))));require(!rebind,"replacement binding");
        _grant(address(this),ModuleIds.LAND_REGISTRY,ActionIds.LAND_TRANSFER,bytes32(uint256(1)));land.transferOwner(1,ALICE);
        (bool stale,)=address(bridge).call(abi.encodeCall(bridge.applyEnvironment,(uint64(1),ITEM,environment())));
        require(!stale,"stale land operator");equipment.remove(ITEM);require(equipment.occupiedSlots(1)==0,"owner recovery denied");
    }
}
