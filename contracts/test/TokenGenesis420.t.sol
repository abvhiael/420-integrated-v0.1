// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../src/apps/ProtocolRegistry.sol";
import "../src/token/TokenIds420.sol";
import "../src/token/TokenTemplateRegistry420.sol";
import "../src/token/TokenFactory420.sol";
import "../src/token/ERC20Template420.sol";
import "../src/token/ERC721Template420.sol";
import "../src/token/ERC1155Template420.sol";
interface Vm420Token { function deal(address,uint256) external; function prank(address) external; function expectRevert(bytes4) external; }
contract TokenGenesis420Test {
    Vm420Token constant vm=Vm420Token(address(uint160(uint256(keccak256("hevm cheat code"))))); address constant ALICE=address(0xA11CE); address payable constant FEES=payable(address(0xFEE)); TokenTemplateRegistry420 registry; TokenFactory420 factory;
    function setUp() public {registry=new TokenTemplateRegistry420(address(this));factory=new TokenFactory420(address(registry),FEES);vm.deal(ALICE,500 ether);}
    function testCanonicalCatalogIncludesToken() public {ProtocolRegistry p=new ProtocolRegistry(address(this));require(p.isGenesisCanonicalServiceId(keccak256("420/service/token/v1")),"token service missing");}
    function testFeeIsExactly42AndForwarded() public {uint256 beforeBal=FEES.balance;vm.prank(ALICE);address t=factory.createERC20{value:42 ether}(TokenIds420.ERC20_FIXED,"Alice","ALC",1_000 ether,0,bytes32("one"));require(t!=address(0),"no token");require(FEES.balance==beforeBal+42 ether,"fee not forwarded");require(factory.isFactoryDeployment(t),"not recorded");}
    function testWrongFeeFails() public {vm.prank(ALICE);vm.expectRevert(TokenFactory420.IncorrectFee.selector);factory.createERC20{value:41 ether}(TokenIds420.ERC20_FIXED,"Alice","ALC",1 ether,0,bytes32("two"));}
    function testFixedCannotMint() public {vm.prank(ALICE);address t=factory.createERC20{value:42 ether}(TokenIds420.ERC20_FIXED,"Fixed","FIX",100 ether,0,bytes32("three"));vm.prank(ALICE);vm.expectRevert(ERC20Template420.FeatureDisabled.selector);ERC20Template420(t).mint(ALICE,1 ether);}
    function testCappedMintEnforced() public {vm.prank(ALICE);address t=factory.createERC20{value:42 ether}(TokenIds420.ERC20_CAPPED,"Cap","CAP",100 ether,110 ether,bytes32("four"));vm.prank(ALICE);ERC20Template420(t).mint(ALICE,10 ether);vm.prank(ALICE);vm.expectRevert(ERC20Template420.CapExceeded.selector);ERC20Template420(t).mint(ALICE,1);}
    function testERC721And1155Ownership() public {vm.prank(ALICE);address n=factory.createERC721{value:42 ether}("NFT","NFT","ipfs://",bytes32("five"));require(ERC721Template420(n).owner()==ALICE,"721 owner");vm.prank(ALICE);address m=factory.createERC1155{value:42 ether}("ipfs://{id}",bytes32("six"));require(ERC1155Template420(m).owner()==ALICE,"1155 owner");}
}
