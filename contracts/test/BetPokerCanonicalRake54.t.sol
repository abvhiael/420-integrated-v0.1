// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./BetPokerTableRegistry52.t.sol";
import "../src/bet/PokerCanonicalRake420.sol";
contract PokerCanonicalRake54Test is BetPokerTableRegistry52Test {
    PokerCanonicalRake420 policy;
    constructor(){policy=new PokerCanonicalRake420(address(registry));}
    function _configured() internal returns(PokerCanonicalRake420.Policy memory p){
        p=PokerCanonicalRake420.Policy(500,20,true,true);
        PokerTableRegistry420.Configuration memory c=_config();
        c.rakePolicyHash=keccak256(abi.encode(policy.POLICY_DOMAIN(),p.rakeBps,p.cap,
            p.noFlopNoDrop,p.noRakeOnUncontested));
        vm.prank(ADMIN);registry.register(c,ADMIN);
    }
    function testOnlyImmutableTablePolicyMatches() public {
        PokerCanonicalRake420.Policy memory p=_configured();
        require(policy.verify(TABLE,p),"valid config");
        require(policy.rake(TABLE,p,1000,true,false)==20,"cap");
        require(policy.rake(TABLE,p,1000,false,false)==0,"no flop");
        require(policy.rake(TABLE,p,1000,true,true)==0,"uncontested");
        p.cap=21;
        vm.expectRevert(PokerCanonicalRake420.InvalidPolicy.selector);
        policy.rake(TABLE,p,1000,true,false);
    }
    function testRakeNeverExceedsVersionedMaximum() public {
        PokerCanonicalRake420.Policy memory p=_configured();
        p.rakeBps=501;
        require(!policy.verify(TABLE,p),"upper bound");
    }
}
