// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/apps/ProtocolRegistry.sol";
import "../src/interfaces/genesis/Types420.sol";
import "../src/system/CapabilityRegistry420.sol";
import "../src/launchpad/LaunchpadIds420.sol";
import "../src/launchpad/LaunchpadAuthorization420.sol";
import "../src/launchpad/LaunchpadProjectRegistry420.sol";
import "../src/launchpad/LaunchpadSaleRegistry420.sol";
import "../src/launchpad/LaunchpadAllocationRegistry420.sol";
import "../src/launchpad/LaunchpadCrowdfundingIntegration420.sol";
import "../src/launchpad/LaunchpadRouter420.sol";

contract LPDep420 {}
contract LPRulings420 { address public immutable cases; constructor(address c){cases=c;} }

contract LaunchpadDeploymentBinding420Test {
    bytes32 constant SID=keccak256("420/service/launchpad/v1");
    bytes32 constant META=keccak256("420/LAUNCHPAD/RELEASE/METADATA/V1");
    bytes32 constant MANIFEST=keccak256("420/LAUNCHPAD/AUDIT-4/RELEASE-MATERIALIZATION/V1");
    bytes32 constant IFACE=keccak256("420/LAUNCHPAD/LAUNCHPAD_ROUTER/INTERFACE/V1");

    event DeploymentAddress(string name,address implementation);
    event RuntimeCodeHash(string name,bytes32 codeHash);
    event ReleaseCommitment(string name,bytes32 value);

    struct Env {
        CapabilityRegistry420 caps;
        ProtocolRegistry registry;
        LPDep420 pay;
        LPDep420 identity;
        LPDep420 cases;
        LPRulings420 rulings;
        LaunchpadAuthorization420 auth;
        LaunchpadProjectRegistry420 projects;
        LaunchpadSaleRegistry420 sales;
        LaunchpadAllocationRegistry420 allocations;
        LaunchpadCrowdfundingIntegration420 crowdfunding;
        LaunchpadRouter420 router;
        bytes32 dependencyRoot;
    }

    function _deploy() internal returns(Env memory e){
        e.caps=new CapabilityRegistry420();
        e.registry=new ProtocolRegistry(address(this));
        e.pay=new LPDep420();
        e.identity=new LPDep420();
        e.cases=new LPDep420();
        e.rulings=new LPRulings420(address(e.cases));
        e.auth=new LaunchpadAuthorization420(address(e.caps));
        e.projects=new LaunchpadProjectRegistry420(address(this));
        e.sales=new LaunchpadSaleRegistry420(address(this),address(e.projects));
        e.allocations=new LaunchpadAllocationRegistry420(address(e.auth),address(e.sales));
        e.sales.setController(address(e.allocations));
        e.crowdfunding=new LaunchpadCrowdfundingIntegration420(
            address(e.allocations),address(e.pay),address(e.identity),address(e.cases),address(e.rulings)
        );
        e.allocations.setCrowdfundingIntegration(address(e.crowdfunding));
        e.router=new LaunchpadRouter420(address(e.sales),address(e.allocations));
        e.caps.registerProtocolComponent(LaunchpadIds420.COMPONENT_LAUNCHPAD,address(this));
        e.dependencyRoot=keccak256(abi.encode(
            address(e.caps),address(e.pay),address(e.identity),address(e.cases),address(e.rulings),
            address(e.auth),address(e.projects),address(e.sales),address(e.allocations),address(e.crowdfunding),address(e.router),
            address(e.auth).codehash,address(e.projects).codehash,address(e.sales).codehash,
            address(e.allocations).codehash,address(e.crowdfunding).codehash,address(e.router).codehash
        ));
        e.registry.registerComponent(
            LaunchpadIds420.COMPONENT_LAUNCHPAD,address(e.router),
            Types420.Version({major:1,minor:0,patch:0}),Types420.Lifecycle.ACTIVE
        );
        e.registry.publishRegisteredService(
            SID,address(e.router),META,1,true,ProtocolRegistry.ComponentType.SERVICE,
            MANIFEST,e.dependencyRoot,IFACE
        );
        emit DeploymentAddress("LaunchpadAuthorization420",address(e.auth));
        emit DeploymentAddress("LaunchpadProjectRegistry420",address(e.projects));
        emit DeploymentAddress("LaunchpadSaleRegistry420",address(e.sales));
        emit DeploymentAddress("LaunchpadAllocationRegistry420",address(e.allocations));
        emit DeploymentAddress("LaunchpadCrowdfundingIntegration420",address(e.crowdfunding));
        emit DeploymentAddress("LaunchpadRouter420",address(e.router));
        emit RuntimeCodeHash("LaunchpadAuthorization420",address(e.auth).codehash);
        emit RuntimeCodeHash("LaunchpadProjectRegistry420",address(e.projects).codehash);
        emit RuntimeCodeHash("LaunchpadSaleRegistry420",address(e.sales).codehash);
        emit RuntimeCodeHash("LaunchpadAllocationRegistry420",address(e.allocations).codehash);
        emit RuntimeCodeHash("LaunchpadCrowdfundingIntegration420",address(e.crowdfunding).codehash);
        emit RuntimeCodeHash("LaunchpadRouter420",address(e.router).codehash);
        emit ReleaseCommitment("dependencyRoot",e.dependencyRoot);
        emit ReleaseCommitment("manifestHash",MANIFEST);
        emit ReleaseCommitment("interfaceHash",IFACE);
    }

    function testDeploymentBindingsAndOneShotWiring() public {
        Env memory e=_deploy();
        require(address(e.auth.capabilityRegistry())==address(e.caps),"auth/caps");
        require(address(e.sales.projects())==address(e.projects),"sales/projects");
        require(address(e.allocations.authorization())==address(e.auth),"alloc/auth");
        require(address(e.allocations.sales())==address(e.sales),"alloc/sales");
        require(e.sales.controller()==address(e.allocations),"controller");
        require(e.allocations.crowdfundingIntegration()==address(e.crowdfunding),"crowdfunding");
        require(address(e.crowdfunding.allocations())==address(e.allocations),"crowd/alloc");
        require(address(e.crowdfunding.paymentRegistry())==address(e.pay),"crowd/pay");
        require(address(e.crowdfunding.identity())==address(e.identity),"crowd/identity");
        require(address(e.crowdfunding.arbitrationCases())==address(e.cases),"crowd/cases");
        require(address(e.crowdfunding.arbitrationRulings())==address(e.rulings),"crowd/rulings");
        require(address(e.router.sales())==address(e.sales),"router/sales");
        require(address(e.router.allocations())==address(e.allocations),"router/alloc");
        (bool a,)=address(e.sales).call(abi.encodeWithSelector(e.sales.setController.selector,address(1)));
        (bool b,)=address(e.allocations).call(
            abi.encodeWithSelector(e.allocations.setCrowdfundingIntegration.selector,address(e.router))
        );
        require(!a&&!b,"one-shot wiring");
    }

    function testRegistryPublicationAndCodeHash() public {
        Env memory e=_deploy();
        ProtocolRegistry.Service memory s=e.registry.getService(SID);
        require(s.implementation==address(e.router)&&s.codeHash==address(e.router).codehash,"service");
        require(s.metadataHash==META&&s.version==1&&s.active,"service metadata");
        ProtocolRegistry.RegistrationProfile memory p=e.registry.getRegistrationProfile(SID,1);
        require(p.componentType==ProtocolRegistry.ComponentType.SERVICE,"type");
        require(p.manifestHash==MANIFEST&&p.dependencyRoot==e.dependencyRoot&&p.interfaceHash==IFACE,"profile");
        (address resolved,uint32 version)=e.registry.resolveActive(SID);
        require(resolved==address(e.router)&&version==1,"resolve");
        Types420.ContractRef memory c=e.registry.component(LaunchpadIds420.COMPONENT_LAUNCHPAD);
        require(c.implementation==address(e.router)&&c.runtimeCodeHash==address(e.router).codehash,"component");
    }

    function testRouterSmokeAndWrongRouterVisibility() public {
        Env memory e=_deploy();
        bytes32 pid=e.projects.canonicalId(address(this),address(0x7001),keccak256("m"),keccak256("i"));
        e.projects.registerProject(pid,address(this),address(0x7001),keccak256("m"),keccak256("i"));
        bytes32 sale=e.sales.canonicalId(
            pid,address(0x420),address(0xBEEF),100,1000,250,10000,10,20,30,keccak256("elig"),bytes32(0)
        );
        e.sales.createSale(sale,pid,address(0x420),address(0xBEEF),100,1000,250,10000,10,20,30,keccak256("elig"),bytes32(0));
        require(e.router.remainingSaleCapacity(sale)==1000,"sale cap");
        require(e.router.remainingWalletCapacity(sale,address(0xA11CE))==250,"wallet cap");
        LaunchpadRouter420 wrong=new LaunchpadRouter420(address(e.sales),address(e.allocations));
        require(e.registry.getService(SID).implementation!=address(wrong),"wrong router");
        require(e.registry.resolve(LaunchpadIds420.COMPONENT_LAUNCHPAD)==address(e.router),"component resolve");
    }
}
