// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../src/bet/PokerTableRegistry420.sol";

interface VmTable52 { function prank(address actor) external; function expectRevert(bytes4 selector) external; }

contract MockTableCapability52 {
    mapping(bytes32 => bool) internal grants;
    function grant(address actor, bytes32 action, bytes32 scope, bool allowed) external {
        grants[keccak256(abi.encode(actor, action, scope))] = allowed;
    }
    function isAuthorized(address actor, bytes32, bytes32 action, bytes32 scope, uint256) external view returns (bool) {
        return grants[keccak256(abi.encode(actor, action, scope))];
    }
}
contract MockTableOperators52 {
    mapping(bytes32 => bool) public active;
    function setActive(bytes32 id, bool value) external { active[id]=value; }
    function isActive(bytes32 id) external view returns (bool) { return active[id]; }
}
contract MockTableEmergency52 {
    bool public halted;
    function setHalted(bool value) external { halted = value; }
    function isHalted(BetTypes420.EmergencyDomain, bytes32) external view returns (bool) { return halted; }
}
contract BetPokerTableRegistry52Test {
    VmTable52 constant vm = VmTable52(address(uint160(uint256(keccak256("hevm cheat code")))));
    bytes32 constant TABLE = keccak256("poker table 52");
    bytes32 constant OP = keccak256("operator 52");
    address constant ADMIN = address(0xA11CE);
    address constant OTHER = address(0xBAD);
    MockTableCapability52 cap;
    MockTableOperators52 ops;
    MockTableEmergency52 emergency;
    BetAuthorization420 auth;
    PokerTableRegistry420 registry;
    constructor() {
        cap = new MockTableCapability52();
        ops = new MockTableOperators52();
        emergency = new MockTableEmergency52();
        auth = new BetAuthorization420(address(cap));
        registry = new PokerTableRegistry420(address(auth),address(ops),address(emergency));
        ops.setActive(OP,true);
        _grant(registry.ACTION_CREATE(),true);
        _grant(registry.ACTION_APPROVE(),true);
        _grant(registry.ACTION_OPEN(),true);
        _grant(registry.ACTION_PAUSE(),true);
        _grant(registry.ACTION_CLOSE(),true);
    }
    function _grant(bytes32 action,bool allow) internal {
        cap.grant(ADMIN,action,auth.scopeForTable(TABLE),allow);
    }
    function _config() internal pure returns (PokerTableRegistry420.Configuration memory c) {
        c = PokerTableRegistry420.Configuration({
            tableId:TABLE,gameVersionId:keccak256("NLHE V1"),
            rulesetId:keccak256("420.BET.POKER.NLHE.CASH.V1"),
            operatorId:OP,vaultId:keccak256("vault"),
            rakePolicyHash:keccak256("rake"),trustPolicyHash:keccak256("trust"),
            asset:address(0xCAFE),seats:6,smallBlind:10,bigBlind:20,
            minBuyIn:400,maxBuyIn:2000,maxRakeBps:500
        });
    }
    function _register() internal {
        vm.prank(ADMIN);
        registry.register(_config(),ADMIN);
    }
    function _approve() internal {
        _register();
        vm.prank(ADMIN);
        registry.approve(TABLE);
    }
    function testCanonicalConfigurationAndImmutableCommitment() public {
        _register();
        PokerTableRegistry420.Table memory t = registry.getTable(TABLE);
        require(t.status==PokerTableRegistry420.Status.REGISTERED, "registered");
        require(t.configHash==registry.hashConfiguration(_config()),"digest");
        require(t.controller==ADMIN && t.config.seats==6 && t.config.bigBlind==20,"rules");
        vm.expectRevert(PokerTableRegistry420.AlreadyExists.selector);
        vm.prank(ADMIN);
        registry.register(_config(),ADMIN);
    }
    function testCompleteLifecycleAndTerminalClosure() public {
        _approve();
        vm.prank(ADMIN); registry.open(TABLE);
        vm.prank(ADMIN); registry.pause(TABLE);
        vm.prank(ADMIN); registry.resume(TABLE);
        vm.prank(ADMIN); registry.close(TABLE);
        require(registry.getTable(TABLE).status==PokerTableRegistry420.Status.CLOSED,"closed");
        vm.expectRevert(PokerTableRegistry420.InvalidTransition.selector);
        registry.resume(TABLE);
    }
    function testUnauthorizedAndCapabilityRevocation() public {
        vm.expectRevert(PokerTableRegistry420.Unauthorized.selector);
        vm.prank(OTHER); registry.register(_config(),ADMIN);
        _register();
        _grant(registry.ACTION_APPROVE(),false);
        vm.expectRevert(PokerTableRegistry420.Unauthorized.selector);
        vm.prank(ADMIN); registry.approve(TABLE);
    }
    function testEmergencyBlocksNewTablesAndReopeningButAllowsClose() public {
        emergency.setHalted(true);
        vm.expectRevert(PokerTableRegistry420.EmergencyHalt.selector);
        vm.prank(ADMIN); registry.register(_config(),ADMIN);
        emergency.setHalted(false);
        _approve();
        emergency.setHalted(true);
        vm.expectRevert(PokerTableRegistry420.EmergencyHalt.selector);
        vm.prank(ADMIN); registry.open(TABLE);
        vm.prank(ADMIN); registry.close(TABLE);
    }
    function testOperatorSuspendFailsClosed() public {
        _approve(); ops.setActive(OP,false);
        vm.expectRevert(PokerTableRegistry420.OperatorInactive.selector);
        vm.prank(ADMIN); registry.open(TABLE);
    }
    function testRejectInvalidConfigurationAndUnauthorizedVersionSubstitution() public {
        PokerTableRegistry420.Configuration memory c=_config();
        c.seats=10;
        vm.expectRevert(PokerTableRegistry420.InvalidConfiguration.selector);
        vm.prank(ADMIN); registry.register(c,ADMIN);
        c=_config(); c.rulesetId=keccak256("different game");
        vm.expectRevert(PokerTableRegistry420.InvalidConfiguration.selector);
        vm.prank(ADMIN); registry.register(c,ADMIN);
        c=_config();c.bigBlind=11;
        vm.expectRevert(PokerTableRegistry420.InvalidConfiguration.selector);
        vm.prank(ADMIN); registry.register(c,ADMIN);
        c=_config();c.tableId=keccak256("other table");
        vm.expectRevert(PokerTableRegistry420.Unauthorized.selector);
        vm.prank(ADMIN); registry.register(c,ADMIN);
    }
    function testNoPrematureOpenAndNoUnauthorizedResume() public {
        _register();
        vm.expectRevert(PokerTableRegistry420.InvalidTransition.selector);
        vm.prank(ADMIN); registry.open(TABLE);
        vm.prank(ADMIN); registry.approve(TABLE);
        vm.prank(ADMIN); registry.open(TABLE);
        vm.prank(ADMIN); registry.pause(TABLE);
        vm.expectRevert(PokerTableRegistry420.Unauthorized.selector);
        vm.prank(OTHER); registry.resume(TABLE);
    }
}
