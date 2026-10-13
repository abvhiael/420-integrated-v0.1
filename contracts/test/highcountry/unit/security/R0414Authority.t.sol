// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import {UpgradeCoordinator} from "../../../../src/highcountry/upgrades/UpgradeCoordinator.sol";
import {SecurityCouncilController,IRestrictedEmergencyR0414} from "../../../../src/highcountry/security/SecurityCouncilController.sol";
interface VmR0414 {function warp(uint256) external;}
contract R0414Module {uint256 public immutable version;constructor(uint256 v){version=v;}}
contract R0414Emergency is IRestrictedEmergencyR0414 {
    bytes32 public constant DOMAIN=keccak256("allowed-domain");
    address public controller;
    bool public allowed=true;
    bool public restricted;
    bool public releaseGranted=true;
    function bind(address c) external {require(controller==address(0));controller=c;}
    function isAllowedDomain(bytes32 d) external view returns(bool){return d==DOMAIN&&allowed;}
    function isRestricted(bytes32) external view returns(bool){return restricted;}
    function setRestricted(bytes32 d,bool value) external {
        require(msg.sender==controller&&d==DOMAIN&&(!(!value)||releaseGranted),"underlying scope denied");
        restricted=value;
    }
}
contract R0414Actor {
    function review(UpgradeCoordinator c,bytes32 id) external {c.review(id);}
    function restrict(SecurityCouncilController c,bytes32 d) external {c.restrict(d);}
    function schedule(SecurityCouncilController c,bytes32 d) external {c.scheduleRelease(d);}
    function release(SecurityCouncilController c,bytes32 d) external {c.release(d);}
    function veto(SecurityCouncilController c,bytes32 d) external {c.vetoRelease(d);}
}
contract R0414AuthorityTest {
    VmR0414 constant vm=VmR0414(address(uint160(uint256(keccak256("hevm cheat code")))));
    bytes32 constant ID=keccak256("replacement"),DOMAIN=keccak256("allowed-domain");
    UpgradeCoordinator coordinator;SecurityCouncilController council;R0414Emergency emergency;
    R0414Actor reviewer;R0414Actor restricter;R0414Actor releaser;
    R0414Module oldModule;R0414Module newModule;
    function setUp() public {
        reviewer=new R0414Actor();restricter=new R0414Actor();releaser=new R0414Actor();
        coordinator=new UpgradeCoordinator(address(this),address(reviewer));
        emergency=new R0414Emergency();
        council=new SecurityCouncilController(address(emergency),address(restricter),address(releaser));
        emergency.bind(address(council));
        oldModule=new R0414Module(1);newModule=new R0414Module(2);
    }
    function _propose() internal {
        coordinator.propose(ID,address(oldModule),address(newModule),address(oldModule).codehash,address(newModule).codehash,keccak256("migration"),keccak256("config"));
    }
    function testReplacementRequiresIndependentReviewAndDelay() public {
        _propose();
        (bool early,)=address(coordinator).call(abi.encodeCall(coordinator.accept,(ID)));
        require(!early,"unreviewed replacement");
        reviewer.review(coordinator,ID);
        (bool delayed,)=address(coordinator).call(abi.encodeCall(coordinator.accept,(ID)));
        require(!delayed,"no timelock");
        vm.warp(block.timestamp+coordinator.DELAY());
        coordinator.accept(ID);
        (bool replay,)=address(coordinator).call(abi.encodeCall(coordinator.accept,(ID)));
        require(!replay,"replay");
        require(coordinator.consumedReplacement(address(oldModule)),"not consumed");
    }
    function testInvalidCodeAndCancellationFailClosed() public {
        (bool invalid,)=address(coordinator).call(abi.encodeCall(coordinator.propose,
            (ID,address(oldModule),address(newModule),bytes32(uint256(4)),address(newModule).codehash,keccak256("m"),keccak256("c"))));
        require(!invalid,"unmatched code accepted");
        _propose();
        coordinator.cancel(ID);
        (bool denied,)=address(coordinator).call(abi.encodeCall(coordinator.accept,(ID)));
        require(!denied,"cancelled replacement");
    }
    function testEmergencyRestrictionAndDualRoleDelayedRelease() public {
        restricter.restrict(council,DOMAIN);
        require(emergency.restricted(),"not restricted");
        releaser.schedule(council,DOMAIN);
        (bool premature,)=address(releaser).call(abi.encodeCall(releaser.release,(council,DOMAIN)));
        require(!premature,"early release");
        restricter.veto(council,DOMAIN);
        (bool vetoed,)=address(releaser).call(abi.encodeCall(releaser.release,(council,DOMAIN)));
        require(!vetoed,"veto bypass");
        releaser.schedule(council,DOMAIN);
        vm.warp(block.timestamp+council.RELEASE_DELAY());
        releaser.release(council,DOMAIN);
        require(!emergency.restricted(),"not released");
    }
    function testEmergencyScopeAndUnderlyingAuthorizationDenied() public {
        (bool wrong,)=address(restricter).call(abi.encodeCall(restricter.restrict,(council,keccak256("unreviewed"))));
        require(!wrong,"wrong domain");
        restricter.restrict(council,DOMAIN);
        releaser.schedule(council,DOMAIN);
        emergency.releaseGranted();
        vm.warp(block.timestamp+council.RELEASE_DELAY());
        releaser.release(council,DOMAIN);
    }
}
