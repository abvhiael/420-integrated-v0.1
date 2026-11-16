// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../src/bridge/verifiers/BnbGatewayMessageVerifier420.sol";
import "../src/bridge/verifiers/BnbFinalityVerifier420.sol";
import "../src/bridge/adapters/BnbBridgeAdapter420.sol";
import "../src/bridge/BnbDepositGateway420.sol";
interface BnbExecutionVm420 {
 struct Log {bytes32[] topics;bytes data;address emitter;}
 function readFileBinary(string calldata) external view returns(bytes memory);function chainId(uint256) external;function deal(address,uint256) external;function recordLogs() external;function getRecordedLogs() external returns(Log[] memory);
}
/// @dev Explicit controlled execution-root oracle, never used as historical finality evidence.
contract BnbControlledExecution420 {bytes32 public h;bytes32 public r;uint64 public n;function set(uint64 n_,bytes32 h_,bytes32 r_) external {n=n_;h=h_;r=r_;}function isFinalizedExecutionBlock(uint64 n_,bytes32 h_,bytes32 r_) external view returns(bool){return n==n_&&h==h_&&r==r_;}}
contract BnbExecutionRouter420 {function inbound(BnbBridgeAdapter420 a,bytes calldata p) external returns(IBridgeAdapter420.VerifiedTransfer memory){return a.verifyInbound(p);}}
contract BnbExecution420Test {
 BnbExecutionVm420 constant vm=BnbExecutionVm420(address(uint160(uint256(keccak256("hevm cheat code")))));
 bytes32 constant ROUTE=keccak256("420/BRIDGE/ROUTE/BNB/MAINNET");bytes32 constant ASSET=keccak256("420/BRIDGE/ASSET/BNB");
 function file(string memory n) internal view returns(bytes memory){return vm.readFileBinary(string.concat("contracts/test/fixtures/bnb/",n));}
 function enc(bytes memory v) internal pure returns(bytes memory){return BnbHeader420.enc(v);}function li(bytes[] memory v) internal pure returns(bytes memory){return BnbHeader420.list(v);}
 function leaf(bytes memory value) internal pure returns(bytes memory){bytes[] memory v=new bytes[](2);v[0]=enc(hex"2080");v[1]=enc(value);return li(v);}
 function synthetic(bytes32 t,bytes32 r) internal view returns(bytes memory){bytes memory raw=file("header_116663999.rlp");EthereumRLP420.Item[] memory f=EthereumRLP420.children(raw,EthereumRLP420.item(raw,0));bytes[] memory a=new bytes[](f.length);for(uint256 i;i<f.length;++i)a[i]=EthereumRLP420.encoded(raw,f[i]);a[4]=enc(abi.encodePacked(t));a[5]=enc(abi.encodePacked(r));return li(a);}
 function controlledProof(BnbDepositGateway420 g,address router,uint256 destination,bytes32 route,uint256 status) internal returns(BnbGatewayMessageVerifier420.Proof memory p,bytes32 id){
  vm.chainId(56);vm.deal(address(this),10 ether);vm.recordLogs();id=g.deposit{value:1 ether}(address(0),1 ether,destination,router,route,address(0xB0B));BnbExecutionVm420.Log[] memory logs=vm.getRecordedLogs();vm.chainId(420);
  bytes[] memory logFields=new bytes[](3);logFields[0]=enc(abi.encodePacked(logs[0].emitter));bytes[] memory topics=new bytes[](logs[0].topics.length);for(uint256 i;i<topics.length;++i)topics[i]=enc(abi.encodePacked(logs[0].topics[i]));logFields[1]=li(topics);logFields[2]=enc(logs[0].data);bytes[] memory allLogs=new bytes[](1);allLogs[0]=li(logFields);bytes[] memory fields=new bytes[](4);fields[0]=enc(BnbHeader420.scalar(status));fields[1]=enc(hex"5208");fields[2]=enc(new bytes(256));fields[3]=li(allLogs);p.receipt=li(fields);
  // The controlled transaction binds actual deposit calldata; its inclusion, not
  // source EVM replay, is the bridge verifier's responsibility.
  bytes[] memory txFields=new bytes[](9);txFields[0]=enc(hex"01");txFields[1]=enc(hex"01");txFields[2]=enc(hex"0f4240");txFields[3]=enc(abi.encodePacked(address(g)));txFields[4]=enc(BnbHeader420.scalar(1 ether));txFields[5]=enc(abi.encodeWithSelector(g.deposit.selector,address(0),1 ether,destination,router,route,address(0xB0B)));txFields[6]=enc(hex"93");txFields[7]=enc(hex"01");txFields[8]=enc(hex"01");p.transaction=li(txFields);
  p.transactionProof=new bytes[](1);p.transactionProof[0]=leaf(p.transaction);p.receiptProof=new bytes[](1);p.receiptProof[0]=leaf(p.receipt);p.executionHeader=synthetic(keccak256(p.transactionProof[0]),keccak256(p.receiptProof[0]));
 }
 function envelope(BnbGatewayMessageVerifier420.Proof memory p) internal pure returns(bytes memory){BnbHeader420.Header memory h=BnbHeader420.parse(p.executionHeader);return abi.encode(h.number,h.hash,h.receiptsRoot,abi.encode(p));}
 function failed(address target,bytes memory data) internal { (bool ok,)=target.call(data);require(!ok,"invalid proof accepted");}
 function testControlledNativeGatewayConcreteCompositionReplayAndBindings() public {
  vm.chainId(420);BnbExecutionRouter420 router=new BnbExecutionRouter420();BnbControlledExecution420 oracle=new BnbControlledExecution420();BnbGatewayMessageVerifier420 m=new BnbGatewayMessageVerifier420(address(this),address(router));m.setRoute(address(0),ROUTE);BnbFinalityVerifier420 v=new BnbFinalityVerifier420(address(this),address(oracle),address(m));BnbBridgeAdapter420 a=new BnbBridgeAdapter420(address(this),address(router),address(v));BnbDepositGateway420 g=new BnbDepositGateway420(address(this));a.setGateway(address(g),true);a.setAssetMapping(a.BNB_NATIVE_SOURCE_ASSET(),ASSET,true);a.setRouteBinding(ASSET,ROUTE);
  (BnbGatewayMessageVerifier420.Proof memory p,bytes32 id)=controlledProof(g,address(router),420,ROUTE,1);BnbHeader420.Header memory h=BnbHeader420.parse(p.executionHeader);oracle.set(h.number,h.hash,h.receiptsRoot);IBridgeAdapter420.VerifiedTransfer memory result=router.inbound(a,envelope(p));require(result.amount==1 ether && result.recipient==address(0xB0B) && result.sourceMessageId==id && address(g).balance==1 ether);
  a.setVerifier(address(new BnbFinalityVerifier420(address(this),address(oracle),address(m))));failed(address(router),abi.encodeCall(router.inbound,(a,envelope(p))));
  (p,)=controlledProof(g,address(router),421,ROUTE,1);h=BnbHeader420.parse(p.executionHeader);oracle.set(h.number,h.hash,h.receiptsRoot);failed(address(router),abi.encodeCall(router.inbound,(a,envelope(p))));
  (p,)=controlledProof(g,address(router),420,keccak256("wrong route"),1);h=BnbHeader420.parse(p.executionHeader);oracle.set(h.number,h.hash,h.receiptsRoot);failed(address(router),abi.encodeCall(router.inbound,(a,envelope(p))));
  (p,)=controlledProof(g,address(router),420,ROUTE,0);h=BnbHeader420.parse(p.executionHeader);oracle.set(h.number,h.hash,h.receiptsRoot);failed(address(router),abi.encodeCall(router.inbound,(a,envelope(p))));
 }
 function testHistoricalTransactionAndReceiptInclusionRejectSubstitutionAndOrdinaryLogs() public {
  vm.chainId(420);BnbExecutionRouter420 router=new BnbExecutionRouter420();BnbGatewayMessageVerifier420 m=new BnbGatewayMessageVerifier420(address(this),address(router));
  for(uint256 i;i<2;++i){BnbGatewayMessageVerifier420.Proof memory p=abi.decode(file(i==0?"historical-native.bin":"historical-token.bin"),(BnbGatewayMessageVerifier420.Proof));BnbHeader420.Header memory h=BnbHeader420.parse(p.executionHeader);bytes memory key=EthereumRLP420.indexKey(p.transactionIndex);EthereumMPT420.verify(h.transactionsRoot,key,p.transaction,p.transactionProof);EthereumMPT420.verify(h.receiptsRoot,key,p.receipt,p.receiptProof);failed(address(m),abi.encodeCall(m.verifyGatewayMessage,(abi.encode(p),h.number,h.hash,h.receiptsRoot)));p.transaction[0]^=0x01;failed(address(m),abi.encodeCall(m.verifyGatewayMessage,(abi.encode(p),h.number,h.hash,h.receiptsRoot)));}
 }
 receive() external payable {}
}
