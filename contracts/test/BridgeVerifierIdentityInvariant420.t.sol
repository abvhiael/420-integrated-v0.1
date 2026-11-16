// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./BridgeVerifierIdentity420.t.sol";
contract V19IdentityHandler is V19Fixture {
    bytes32 public expectedState;bytes32 public lastRevoked;
    constructor(){setUp();qualify();}
    function state() public view returns(bytes32){V19Verifier v=V19Verifier(consumer.verifier());return keccak256(abi.encode(address(v),address(v).codehash,v.trustedRoot(),v.configuration(),v.revision()));}
    function qualify() public {verifier=V19Verifier(consumer.verifier());approved();expectedState=state();}
    function mutate(bytes32 root,bytes32 config) external {V19Verifier(consumer.verifier()).configure(root,config);}
    function replace(bool qualifyReplacement) external {consumer.setVerifier(address(new V19Verifier()));if(qualifyReplacement)qualify();}
    function revoke() external {bytes32 id=q.currentApproval(address(consumer));if(id!=0){q.revoke(id,keccak256("invariant revocation"));lastRevoked=id;}}
    function check() external view {if(q.isCurrent(address(consumer)))require(state()==expectedState,"unqualified state inherited approval");if(lastRevoked!=0)require(q.approval(lastRevoked).status==BridgeVerifierRegistry420.Status.REVOKED,"revocation resurrected");}
}
contract BridgeVerifierIdentityInvariant420Test {
    V19IdentityHandler private handler;
    struct FuzzSelector {address addr;bytes4[] selectors;}
    function setUp() public {handler=new V19IdentityHandler();}
    function targetContracts() public view returns(address[] memory values){values=new address[](1);values[0]=address(handler);}
    function targetSelectors() public view returns(FuzzSelector[] memory values){bytes4[] memory selectors=new bytes4[](4);selectors[0]=handler.qualify.selector;selectors[1]=handler.mutate.selector;selectors[2]=handler.replace.selector;selectors[3]=handler.revoke.selector;values=new FuzzSelector[](1);values[0]=FuzzSelector(address(handler),selectors);}
    function invariantOnlyCurrentQualifiedStateCanBeUsedAndRevocationIsPermanent() public view {handler.check();}
}
