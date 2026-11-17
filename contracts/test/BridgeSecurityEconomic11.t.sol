// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./BridgeGenesisIntegration420.t.sol";
import "./helpers/ValueCustodyFixture420.sol";

/// Hostile ERC-20 behavior is controlled test input, never a source authority.
contract Security11CallbackToken420 {
 uint8 public constant decimals=18;uint256 public totalSupply;
 mapping(address=>uint256)public balanceOf;mapping(address=>mapping(address=>uint256))public allowance;
 address public custody;address public target;bytes public payload;bool public nestedSucceeded;
 uint8 public attack;
 function configure(address c)external{require(custody==address(0));custody=c;}
 function arm(uint8 mode,address t,bytes calldata p)external{attack=mode;target=t;payload=p;nestedSucceeded=false;}
 function approve(address spender,uint256 amount)external returns(bool){allowance[msg.sender][spender]=amount;return true;}
 function hook()private{if(target!=address(0)){(bool ok,)=target.call(payload);nestedSucceeded=ok;}}
 function bridgeMint(address to,uint256 n)external{require(msg.sender==custody);uint256 minted=n+(attack==1?1:0);totalSupply+=minted;balanceOf[to]+=minted;hook();}
 function bridgeBurnFrom(address from,uint256 n)external{require(msg.sender==custody);allowance[from][msg.sender]-=n;uint256 burned=attack==2?n-1:n;totalSupply-=burned;balanceOf[from]-=burned;hook();}
 function transferFrom(address from,address to,uint256 n)external returns(bool){allowance[from][msg.sender]-=n;return move(from,to,n);}
 function transfer(address to,uint256 n)external returns(bool){return move(msg.sender,to,n);}
 function move(address from,address to,uint256 n)private returns(bool){balanceOf[from]-=n;uint256 net=attack==3?n-1:n;balanceOf[to]+=net;totalSupply-=n-net;hook();return attack!=4;}
 function seed(address to,uint256 n)external{totalSupply+=n;balanceOf[to]+=n;}
}
abstract contract Security11Fixture420 is BridgeGenesisFixture420 {
 Fixture internal f;BridgeValueCustody420 internal custody;Security11CallbackToken420 internal token;ValueOutcome420 internal outcome;
 function setupHostile(bool liquidity)internal{
  f=_setup();token=new Security11CallbackToken420();outcome=new ValueOutcome420();f.env.setSettlementAsset(address(token),ASSET_ID,true);
  custody=new BridgeValueCustody420(address(this),address(f.env.registry()),keccak256("security11 controlled custody"),outcome);f.env.registerResident(address(custody),custody.componentId());token.configure(address(custody));
  BridgeRouteRegistry.Route memory r;(r.assetId,r.sourceChainId,r.destinationChainId,r.sourceAsset,r.destinationAsset,r.adapterId,r.verifierConfigHash,r.version,r.status,r.inboundEnabled,r.outboundEnabled)=f.routes.routes(ROUTE_ID);
  r.destinationAsset=bytes32(uint256(uint160(address(token))));r.status=BridgeRouteRegistry.Status.APPROVED_INACTIVE;f.routes.setRoute(ROUTE_ID,r);
  BridgeQualificationFixture420.approveRoute(f.env,f.routes,ROUTE_ID,address(f.adapter),address(f.adapter),0,abi.encodeWithSignature("adapterId()"),abi.encodeWithSignature("adapterId()"),true);
  custody.configure(ASSET_ID,address(token),liquidity?BridgeValueCustody420.Mode.LOCK_RELEASE:BridgeValueCustody420.Mode.MINT_BURN);
  ValueCustodyFixture420.approve(f.env,custody,address(token),address(outcome),abi.encodeWithSignature("root()"),EXTERNAL_CHAIN,LOCAL_CHAIN);
 }
 function deposit(uint256 amount)internal returns(bytes32){f.adapter.setInbound(_inbound(amount));return f.router.acceptInboundAndSettle(ADAPTER_ID,ProofEnvelopeFixture420.mock(f.router,ADAPTER_ID,hex"09"));}
 function outbound(uint256 amount)internal returns(bytes32 id){vm.prank(address(0xB0B));token.approve(address(custody),amount);vm.prank(address(0xB0B));bytes32 message=f.router.initiateOutbound(ADAPTER_ID,ROUTE_ID,ASSET_ID,hex"0102",amount,"");return f.transfers.deriveOutboundTransferId(ROUTE_ID,ASSET_ID,address(0xB0B),keccak256(hex"0102"),amount,message);}
 function outcomeProof(bytes32 id,bool paid)internal view returns(bytes memory){(bytes32 route,bytes32 asset,address sender,,uint256 n,,bytes32 message,,,)=f.transfers.transfers(id);return abi.encode(IBridgeWithdrawalOutcome420.Receipt(id,message,route,asset,sender,f.transfers.externalRecipientHash(id),n,keccak256("controlled transaction"),keccak256(abi.encode(id,paid)),paid,f.transfers.transferQualification(id)));}
 function checkClaims(uint256 expected)internal view{require(token.totalSupply()==custody.managedSupply(ASSET_ID),"unbacked token delta");require(token.totalSupply()+custody.pendingAmount(ASSET_ID)==expected,"economic claim drift");(uint256 route,uint256 asset)=f.risk.outstanding(ROUTE_ID,ASSET_ID);require(route==expected&&asset==expected,"risk accounting drift");}
}
contract BridgeSecurityEconomic11Test is Security11Fixture420 {
 function setUp()public{setupHostile(false);}
 function testSecurity11MintCallbackCannotReenterSettlementOrCreditTwice()public{
  f.adapter.setInbound(_inbound(100));bytes memory proof=ProofEnvelopeFixture420.mock(f.router,ADAPTER_ID,hex"09");token.arm(0,address(f.router),abi.encodeCall(f.router.acceptInboundAndSettle,(ADAPTER_ID,proof)));
  bytes32 id=f.router.acceptInboundAndSettle(ADAPTER_ID,proof);require(!token.nestedSucceeded()&&custody.delivered(id));checkClaims(100);
 }
 function testSecurity11BurnCallbackCannotCreateSecondFundedWithdrawal()public{
  deposit(100);token.arm(0,address(f.router),abi.encodeCall(f.router.initiateOutbound,(ADAPTER_ID,ROUTE_ID,ASSET_ID,hex"0102",uint256(1),bytes(""))));outbound(40);require(!token.nestedSucceeded());checkClaims(100);require(token.totalSupply()==60&&custody.pendingAmount(ASSET_ID)==40);
 }
 function testSecurity11ExcessMintRollsBackProofReplayAndExposure()public{
  token.arm(1,address(0),"");f.adapter.setInbound(_inbound(100));bytes memory proof=ProofEnvelopeFixture420.mock(f.router,ADAPTER_ID,hex"09");(bool ok,)=address(f.router).call(abi.encodeCall(f.router.acceptInboundAndSettle,(ADAPTER_ID,proof)));require(!ok&&token.totalSupply()==0);checkClaims(0);
  token.arm(0,address(0),"");f.router.acceptInboundAndSettle(ADAPTER_ID,proof);checkClaims(100);
 }
 function testSecurity11PartialBurnCannotCreateUnderfundedClaim()public{
  deposit(100);token.arm(2,address(0),"");vm.prank(address(0xB0B));token.approve(address(custody),40);vm.prank(address(0xB0B));(bool ok,)=address(f.router).call(abi.encodeCall(f.router.initiateOutbound,(ADAPTER_ID,ROUTE_ID,ASSET_ID,hex"0102",uint256(40),bytes(""))));require(!ok);checkClaims(100);require(token.balanceOf(address(0xB0B))==100);
 }
 function testSecurity11RefundCallbackCannotResolveTwice()public{
  deposit(100);bytes32 id=outbound(40);f.transfers.disputeTransfer(id,keccak256("test cancellation"));bytes memory proof=outcomeProof(id,false);token.arm(0,address(f.router),abi.encodeCall(f.router.resolveFundedOutbound,(id,proof)));f.router.resolveFundedOutbound(id,proof);require(!token.nestedSucceeded());checkClaims(100);require(token.balanceOf(address(0xB0B))==100);
 }
 function testFuzzSecurity11MaliciousMintBurnAndRefundRollback(uint96 raw,uint8 mode)public{
  uint256 n=uint256(raw)%100+1;deposit(100);token.arm(mode%2==0?2:0,address(0),"");
  vm.prank(address(0xB0B));token.approve(address(custody),n);vm.prank(address(0xB0B));(bool ok,)=address(f.router).call(abi.encodeCall(f.router.initiateOutbound,(ADAPTER_ID,ROUTE_ID,ASSET_ID,hex"0102",n,bytes(""))));require(ok==(mode%2!=0),"malicious burn acceptance");checkClaims(100);
  if(ok){bytes32 message=f.adapter.nextOutboundId();bytes32 id=f.transfers.deriveOutboundTransferId(ROUTE_ID,ASSET_ID,address(0xB0B),keccak256(hex"0102"),n,message);f.transfers.disputeTransfer(id,keccak256("cancel"));token.arm(1,address(0),"");(ok,)=address(f.router).call(abi.encodeCall(f.router.resolveFundedOutbound,(id,outcomeProof(id,false))));require(!ok&&custody.pendingAmount(ASSET_ID)==n);checkClaims(100);token.arm(0,address(0),"");f.router.resolveFundedOutbound(id,outcomeProof(id,false));checkClaims(100);}
 }
}
contract BridgeSecurityLiquidity11Test is Security11Fixture420{
 function setUp()public{setupHostile(true);token.seed(address(this),100);token.approve(address(custody),100);}
 function testSecurity11TaxedAndFalseReturningFundingRollBackEscrow()public{
  for(uint8 mode=3;mode<=4;++mode){token.arm(mode,address(0),"");(bool ok,)=address(custody).call(abi.encodeCall(custody.fund,(ASSET_ID,uint256(100))));require(!ok&&token.balanceOf(address(this))==100&&token.balanceOf(address(custody))==0&&custody.escrow(ASSET_ID)==0,"invalid liquidity accepted");}
  token.arm(0,address(0),"");custody.fund(ASSET_ID,100);require(custody.escrow(ASSET_ID)==100);
 }
 function testSecurity11TaxedDestinationReleaseRollsBackSourceReservation()public{
  custody.fund(ASSET_ID,100);token.arm(3,address(0),"");f.adapter.setInbound(_inbound(40));bytes memory proof=ProofEnvelopeFixture420.mock(f.router,ADAPTER_ID,hex"09");(bool ok,)=address(f.router).call(abi.encodeCall(f.router.acceptInboundAndSettle,(ADAPTER_ID,proof)));require(!ok&&custody.escrow(ASSET_ID)==100&&token.balanceOf(address(0xB0B))==0);(uint256 route,)=f.risk.outstanding(ROUTE_ID,ASSET_ID);require(route==0);
 }
}
contract Security11EconomicHandler420 is Security11Fixture420{
 bool private initialized;bool public started;bool public resolved;uint256 public claimed=100;uint256 public paid;uint256 public amount;bytes32 public id;uint256 public sequence;
 function initialize()external{require(!initialized);initialized=true;setupHostile(false);deposit(100);f.risk.setRouteLimits(ROUTE_ID,BridgeRiskManager.Limits(100,1_000_000,1_000_000,1_000_000,1_000_000,100));f.risk.setAssetLimits(ASSET_ID,BridgeRiskManager.Limits(100,1_000_000,1_000_000,1_000_000,1_000_000,100));}
 function hostileMode(uint8 mode)external{token.arm(mode%3,address(f.router),abi.encodeCall(f.router.initiateOutbound,(ADAPTER_ID,ROUTE_ID,ASSET_ID,hex"0102",uint256(1),bytes(""))));}
 function begin(uint8 raw)external{
  if(started)return;uint256 n=uint256(raw)%100+1;if(token.balanceOf(address(0xB0B))<n)return;
  vm.prank(address(0xB0B));token.approve(address(custody),n);vm.prank(address(0xB0B));(bool ok,)=address(f.router).call(abi.encodeCall(f.router.initiateOutbound,(ADAPTER_ID,ROUTE_ID,ASSET_ID,hex"0102",n,bytes(""))));
  require(ok==(token.attack()!=2),"hostile debit model");if(ok){started=true;amount=n;id=f.transfers.deriveOutboundTransferId(ROUTE_ID,ASSET_ID,address(0xB0B),keccak256(hex"0102"),n,f.adapter.nextOutboundId());}
 }
 function tryDeposit(uint8 raw)external{
  uint256 n=uint256(raw)%100+1;IBridgeAdapter420.VerifiedTransfer memory v=_inbound(n);v.sourceMessageId=keccak256(abi.encode("security11",++sequence));v.sourceTxId=keccak256(abi.encode("security11-tx",sequence));f.adapter.setInbound(v);
  (bool ok,)=address(f.router).call(abi.encodeCall(f.router.acceptInboundAndSettle,(ADAPTER_ID,ProofEnvelopeFixture420.mock(f.router,ADAPTER_ID,hex"09"))));
  require(ok==((claimed-paid+n<=100)&&token.attack()!=1),"TVL/mint attack model");if(ok)claimed+=n;
 }
 function resolve(bool refund)external{
  if(!started)return;
  if(refund&&!resolved){(,,,,,,,BridgeTransferRegistry.Status s,,)=f.transfers.transfers(id);if(s!=BridgeTransferRegistry.Status.DISPUTED)f.transfers.disputeTransfer(id,keccak256("stateful cancellation"));}
  (bool ok,)=address(f.router).call(abi.encodeCall(f.router.resolveFundedOutbound,(id,outcomeProof(id,!refund))));
  require(ok==(!resolved&&(!refund||token.attack()!=1)),"outcome duplicate/delta model");if(ok){resolved=true;if(!refund)paid+=amount;}
 }
 function rollWindow(uint32 seconds_)external{vm.warp(block.timestamp+uint256(seconds_)%86401);}
 function check()external view{
  checkClaims(claimed-paid);require(!token.nestedSucceeded(),"unauthorized callback execution");
  uint256 pending=started&&!resolved?amount:0;require(custody.pendingAmount(ASSET_ID)==pending,"pending obligation drift");
  require(token.balanceOf(address(0xB0B))==token.totalSupply(),"beneficiary substitution");require(claimed-paid<=100,"TVL cap bypass");
 }
}
contract BridgeSecurityEconomicInvariant11Test{
 Security11EconomicHandler420 internal handler;struct FuzzSelector{address addr;bytes4[] selectors;}
 function setUp()public{handler=new Security11EconomicHandler420();handler.initialize();}
 function targetContracts()public view returns(address[] memory a){a=new address[](1);a[0]=address(handler);}
 function targetSelectors()public view returns(FuzzSelector[] memory a){bytes4[] memory s=new bytes4[](5);s[0]=handler.hostileMode.selector;s[1]=handler.begin.selector;s[2]=handler.tryDeposit.selector;s[3]=handler.resolve.selector;s[4]=handler.rollWindow.selector;a=new FuzzSelector[](1);a[0]=FuzzSelector(address(handler),s);}
 function invariantSecurity11HostileCallbacksCannotCreateValueOrEscapeCaps()public view{handler.check();}
}
