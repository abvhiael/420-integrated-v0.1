// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./EthereumCustodyRelease420.t.sol";
interface SourceTokenVm420 {function etch(address,bytes calldata) external;}
contract SourceBalanceToken420 {
 uint8 public constant decimals=18;mapping(address=>uint256) public balanceOf;mapping(address=>mapping(address=>uint256)) public allowance;bool public fail;
 function mint(address to,uint256 n) external {balanceOf[to]+=n;}function setFail(bool b) external {fail=b;}
 function approve(address to,uint256 n) external returns(bool){allowance[msg.sender][to]=n;return true;}
 function transferFrom(address from,address to,uint256 n) external returns(bool){require(!fail);allowance[from][msg.sender]-=n;balanceOf[from]-=n;balanceOf[to]+=n;return true;}
 function transfer(address to,uint256 n) external returns(bool){require(!fail);balanceOf[msg.sender]-=n;balanceOf[to]+=n;return true;}
}
contract EthereumTokenCustodyRelease420Test is EthereumCustodyRelease420Test {
 function tokenSetup() internal returns(SourceBalanceToken420 t){
  address source=0x18aAA7115705e8be94bfFEBDE57Af9BFc265B998;SourceTokenVm420(address(svm)).etch(source,address(new SourceBalanceToken420()).code);t=SourceBalanceToken420(source);
  escrow_.setToken(source,true);SupportedTokenRoutes420.Profile memory p=SupportedTokenRoutes420.profile(keccak256("420/BRIDGE/ETHEREUM/MAINNET/V12.5.4"),bytes32(uint256(uint160(source))));escrow_.setWithdrawalRoute(p.sourceAsset,p.assetId,p.routeId);
  request.ethereumAsset=p.sourceAsset;request.assetId=p.assetId;request.routeId=p.routeId;request.localAmount=100;request.ethereumAmount=100;
  BridgeVerifierRegistry420 q=BridgeQualificationFixture420.registry(f.env);BridgeVerifierRegistry420.Registration memory r=abi.decode(q.registration(q.currentApproval(address(escrow_))),(BridgeVerifierRegistry420.Registration));r.dependencies=new BridgeVerifierRegistry420.Identity[](1);r.dependencies[0]=q.identity(source,BridgeVerifierRegistry420.ProxyKind.DIRECT);r.probes[1].expectedResultHash=BridgeQualificationFixture420.resultHash(address(escrow_),r.probes[1].data);q.record(r,q.currentApproval(address(escrow_)),true);
  t.mint(address(this),100);t.approve(address(escrow_),100);escrow_.deposit(source,100,420,request.sourceRouter,p.routeId,request.recipient);escrow_.setSettlementActive(true);backing.set(escrow_.backingCommitment(request,false));
 }
 function testSourceERC20ReleaseUsesActualCustodiedTokens() public {SourceBalanceToken420 t=tokenSetup();escrow_.settleEthereumWithdrawal(request,abi.encode(bytes32(uint256(1))));require(t.balanceOf(request.recipient)==100&&t.balanceOf(address(escrow_))==0);}
 function testSourceERC20TransferFailureLeavesEscrowAndReplayUntouched() public {SourceBalanceToken420 t=tokenSetup();t.setFail(true);(bool ok,)=address(escrow_).call(abi.encodeCall(escrow_.settleEthereumWithdrawal,(request,abi.encode(bytes32(uint256(1))))));require(!ok&&t.balanceOf(address(escrow_))==100&&escrow_.withdrawalStatus(request.messageId)==0);t.setFail(false);escrow_.settleEthereumWithdrawal(request,abi.encode(bytes32(uint256(1))));require(t.balanceOf(request.recipient)==100);}
}
