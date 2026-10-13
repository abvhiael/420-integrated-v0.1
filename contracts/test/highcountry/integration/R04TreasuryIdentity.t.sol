// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import {PublicPlantCapacityFixture} from "./PublicPlantCapacity.t.sol";
import {OrganizationRegistry} from "../../../src/highcountry/organization/OrganizationRegistry.sol";
import {OrganizationTreasuryPermissions} from "../../../src/highcountry/organization/OrganizationTreasuryPermissions.sol";
import {CanonicalOrganizationTreasuryGateway} from "../../../src/highcountry/organization/CanonicalOrganizationTreasuryGateway.sol";
import {R04EmergencyConsumer} from "../../../src/highcountry/security/R04EmergencyConsumer.sol";
import {ModuleIds} from "../../../src/highcountry/constants/ModuleIds.sol";
import {ActionIds} from "../../../src/highcountry/constants/ActionIds.sol";
import {EmergencyDomains} from "../../../src/highcountry/constants/EmergencyDomains.sol";
import {GameRegistry420} from "../../../src/gaming/GameRegistry420.sol";
import {GameIdentity420} from "../../../src/gaming/GameIdentity420.sol";
import {GamingAuthorization420} from "../../../src/gaming/GamingAuthorization420.sol";
import {GamingIds420} from "../../../src/gaming/GamingIds420.sol";
import {TreasuryAuthorization420} from "../../../src/treasury/TreasuryAuthorization420.sol";
import {TreasuryPolicyRegistry420} from "../../../src/treasury/TreasuryPolicyRegistry420.sol";
import {TreasuryBudgetRegistry420} from "../../../src/treasury/TreasuryBudgetRegistry420.sol";
import {TreasuryDisbursementRegistry420} from "../../../src/treasury/TreasuryDisbursementRegistry420.sol";
import {TreasuryRouter420} from "../../../src/treasury/TreasuryRouter420.sol";
import {TreasuryIds420} from "../../../src/treasury/TreasuryIds420.sol";
contract R04TreasuryIdentityTest is PublicPlantCapacityFixture {
    bytes32 constant GAME=keccak256("420/GAMING/GAME/HIGH_COUNTRY/V1");
    bytes32 constant ORG=keccak256("org");
    bytes32 constant BUDGET=keccak256("budget");
    bytes32 constant CIVIC=keccak256("civic");
    TreasuryBudgetRegistry420 budget;
    TreasuryDisbursementRegistry420 disbursements;
    TreasuryAuthorization420 treasuryAuth;
    CanonicalOrganizationTreasuryGateway gateway;
    OrganizationTreasuryPermissions permissions;
    bytes32 disbursement;
    bytes32 permission;
    function bind(R04EmergencyConsumer c) internal {
        _grant(address(this),ModuleIds.EMERGENCY_STATE,c.R04_BIND_ACTION(),c.emergencyBindingScope(address(emergency)));
        c.bindR04Emergency(address(emergency));
    }
    function setUp() public override {
        super.setUp();
        caps.registerProtocolComponent(GamingIds420.COMPONENT_GAMING,address(this));
        GamingAuthorization420 gamingAuth=new GamingAuthorization420(address(caps));
        GameRegistry420 games=new GameRegistry420(address(gamingAuth));
        _grant(address(this),GamingIds420.COMPONENT_GAMING,GamingIds420.ACTION_REGISTER_GAME,gamingAuth.scopeForGame(GAME));
        games.registerGame(GAME,address(this),keccak256("hc"));
        GameIdentity420 identity=new GameIdentity420(address(games));
        vm.prank(ALICE);identity.createProfile(GAME,keccak256("account"));
        TreasuryPolicyRegistry420 policy=new TreasuryPolicyRegistry420(address(this));
        policy.setAssetPolicy(address(0x420),true,1000,10000,1 days);
        budget=new TreasuryBudgetRegistry420(address(this),address(policy));
        treasuryAuth=new TreasuryAuthorization420(address(caps));
        disbursements=new TreasuryDisbursementRegistry420(address(this),address(treasuryAuth),address(policy),address(budget));
        budget.setController(address(disbursements));
        budget.createBudget(BUDGET,keccak256("vault"),keccak256("category"),address(0x420),1000,
            uint64(block.timestamp),uint64(block.timestamp+1000),CIVIC,keccak256("metadata"));
        uint64 notBefore=uint64(block.timestamp+1);uint64 expires=uint64(block.timestamp+900);
        disbursement=disbursements.canonicalId(BUDGET,ALICE,100,notBefore,expires,CIVIC,keccak256("purpose"));
        disbursements.schedule(disbursement,BUDGET,ALICE,100,notBefore,expires,CIVIC,keccak256("purpose"));
        TreasuryRouter420 router=new TreasuryRouter420(address(budget),address(disbursements));
        gateway=new CanonicalOrganizationTreasuryGateway(address(auth), address(router),address(identity),address(this));bind(gateway);
        OrganizationRegistry org=new OrganizationRegistry(address(auth));bind(org);
        org.create(ORG);org.invite(ORG,ALICE);vm.prank(ALICE);org.join(ORG);
        permissions=new OrganizationTreasuryPermissions(address(auth), address(org),address(gateway),BOB);bind(permissions);
        gateway.bindPermissions(address(permissions));
        permission=permissions.propose(ORG,ALICE,keccak256("HC.ORG.TREASURY"),disbursement,uint64(block.timestamp+900),100);
        vm.prank(BOB);permissions.approve(permission);
        caps.registerProtocolComponent(TreasuryIds420.COMPONENT_TREASURY,address(this));
        vm.warp(block.timestamp+2);
    }
    function grantExecution() internal returns(bytes32 id) {
        id=keccak256(abi.encode("treasury-execution",++serial));
        caps.createGrant(id,address(gateway),TreasuryIds420.COMPONENT_TREASURY,TreasuryIds420.ACTION_EXECUTE_DISBURSEMENT,
            treasuryAuth.scopeForDisbursement(disbursement),100,0,0,0,0);
    }
    function testRealTreasuryRequiresIndependentCapabilityAndRollsBackPermission() public {
        (bool failed,)=address(gateway).call(abi.encodeCall(gateway.execute,(disbursement,permission,keccak256("vault-receipt"))));
        require(!failed,"missing treasury grant bypass");
        (,,,,,,,uint256 remaining,,)=permissions.permissions(permission);require(remaining==100,"permission not rolled back");
        grantExecution();gateway.execute(disbursement,permission,keccak256("vault-receipt"));
        require(budget.budget(BUDGET).executed==100,"canonical budget not settled");
        require(disbursements.disbursement(disbursement).state==TreasuryDisbursementRegistry420.State.EXECUTED,"canonical receipt missing");
        (bool replay,)=address(gateway).call(abi.encodeCall(gateway.execute,(disbursement,permission,keccak256("vault-receipt"))));
        require(!replay,"treasury replay");
    }
    function testRevokedGrantAndEmergencyDoNotConsumeFinancialPermission() public {
        bytes32 g=grantExecution();caps.revokeGrant(g);
        (bool denied,)=address(gateway).call(abi.encodeCall(gateway.execute,(disbursement,permission,keccak256("receipt"))));
        require(!denied,"revoked capability bypass");
        grantExecution();
        _grant(address(this),ModuleIds.EMERGENCY_STATE,ActionIds.EMERGENCY_RESTRICT,EmergencyDomains.ORGANIZATION_GOVERNANCE);
        emergency.setRestricted(EmergencyDomains.ORGANIZATION_GOVERNANCE,true);
        (denied,)=address(gateway).call(abi.encodeCall(gateway.execute,(disbursement,permission,keccak256("receipt"))));
        require(!denied,"emergency financial bypass");
        require(budget.budget(BUDGET).executed==0,"unauthorized budget spent");
        permissions.revoke(permission);
        (,,,,,,,uint256 remaining,,)=permissions.permissions(permission);require(remaining==100,"revocation lost amount");
    }
}
