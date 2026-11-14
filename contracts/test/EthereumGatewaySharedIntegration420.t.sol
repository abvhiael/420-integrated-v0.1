// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./helpers/EthereumSharedCoreFixture420.sol";
import "./EthereumGatewayQualification420.t.sol";
contract EthereumGatewaySharedIntegration420Test is EthereumSharedCoreFixture420,EthereumProofFixture420 {
    uint256 internal constant SOURCE_KEY=0x420beef;
    function bloomAdd(bytes memory bloom,bytes memory value) private pure {
        bytes32 h=keccak256(value);for(uint256 i;i<6;i+=2){uint256 bit=(uint256(uint8(h[i]))*256+uint8(h[i+1]))&2047;bloom[255-bit/8]|=bytes1(uint8(1<<(bit%8)));}
    }
    function receipt(EthereumVm420.Log[] memory logs,uint256 status) internal pure returns(bytes memory){
        bytes[] memory encodedLogs=new bytes[](logs.length);bytes memory bloom=new bytes(256);
        for(uint256 i;i<logs.length;++i){
            bytes[] memory fields=new bytes[](3);fields[0]=enc(abi.encodePacked(logs[i].emitter));bloomAdd(bloom,abi.encodePacked(logs[i].emitter));
            bytes[] memory topics=new bytes[](logs[i].topics.length);
            for(uint256 j;j<topics.length;++j){topics[j]=enc(abi.encodePacked(logs[i].topics[j]));bloomAdd(bloom,abi.encodePacked(logs[i].topics[j]));}
            fields[1]=list(topics);fields[2]=enc(logs[i].data);encodedLogs[i]=list(fields);
        }
        bytes[] memory r=new bytes[](4);r[0]=encUint(status);r[1]=encUint(210000);r[2]=enc(bloom);r[3]=list(encodedLogs);return list(r);
    }
    function sourceTransaction(address gateway,address token,uint256 amount,uint256 chainId,address router,bytes32 route,address recipient) internal returns(bytes memory){
        bytes[] memory f=new bytes[](9);f[0]=encUint(0);f[1]=encUint(1);f[2]=encUint(1_000_000);f[3]=enc(abi.encodePacked(gateway));f[4]=encUint(token==address(0)?amount:0);f[5]=enc(abi.encodeWithSelector(EthereumDepositGateway420.deposit.selector,token,amount,chainId,router,route,recipient));f[6]=encUint(1);f[7]=encUint(0);f[8]=encUint(0);
        (uint8 v,bytes32 r,bytes32 s)=vm.sign(SOURCE_KEY,keccak256(list(f)));f[6]=encUint(uint256(v)+10);f[7]=encUint(uint256(r));f[8]=encUint(uint256(s));return list(f);
    }
    function sourceDeposit(EthereumDepositGateway420 gateway,address token,uint256 amount,uint256 chainId,address router,bytes32 route,address recipient) internal returns(bytes memory rawTransaction,EthereumVm420.Log[] memory logs,bytes32 id){
        vm.chainId(1);address sender=vm.addr(SOURCE_KEY);vm.deal(address(this),10 ether);if(token==address(0))vm.deal(sender,10 ether);
        if(token!=address(0)){
            // Controlled local tokens at canonical addresses; historical code hashes
            // at these same addresses are independently proven in the consensus owner.
            vm.etch(token,type(EthereumEscrowTokenMock420).runtimeCode);EthereumEscrowTokenMock420(token).mint(sender,amount);
            vm.prank(sender);EthereumEscrowTokenMock420(token).approve(address(gateway),amount);gateway.setToken(token,true);
        }
        rawTransaction=sourceTransaction(address(gateway),token,amount,chainId,router,route,recipient);
        vm.recordLogs();vm.prank(sender);id=gateway.deposit{value:token==address(0)?amount:0}(token,amount,chainId,router,route,recipient);logs=vm.getRecordedLogs();vm.chainId(420);
    }
    function proofFor(EthereumConsensusLightClient420 c,bytes memory rawTransaction,EthereumVm420.Log[] memory logs,uint256 status) internal returns(EthereumGatewayMessageVerifier420.Proof memory p,bytes memory encoded){
        p.transactionIndex=0;p.transaction=rawTransaction;p.receipt=receipt(logs,status);p.logIndex=uint32(logs.length-1);
        bytes memory txNode=singleLeaf(hex"80",rawTransaction);bytes memory receiptNode=singleLeaf(hex"80",p.receipt);p.transactionProof=oneProof(txNode);p.receiptProof=oneProof(receiptNode);
        p.executionHeader=syntheticHeader(26411203,keccak256(txNode),keccak256(receiptNode));injectExecution(c,p.executionHeader);
        EthereumExecutionHeader420.Header memory h=EthereumExecutionHeader420.parse(p.executionHeader);encoded=abi.encode(h.number,h.blockHash,h.receiptsRoot,abi.encode(p));
    }

    function testConcreteEthereumGatewayRouterRiskTransferAndAtomicRollback() public {
        vm.chainId(420);Fixture memory f=_setup();EthereumConsensusLightClient420 c=finalizedClient();
        EthereumGatewayMessageVerifier420 messages=new EthereumGatewayMessageVerifier420(address(this),address(f.router));messages.setRoute(address(0),ROUTE_ID);
        EthereumFinalityVerifier420 verifier=new EthereumFinalityVerifier420(address(this),address(c),address(messages));EthereumBridgeAdapter420 a=new EthereumBridgeAdapter420(address(this),address(f.router),address(verifier));
        vm.chainId(1);EthereumDepositGateway420 gateway=new EthereumDepositGateway420(address(this));vm.chainId(420);
        a.setGateway(address(gateway),true);a.setAssetMapping(a.ETH_NATIVE_SOURCE_ASSET(),ASSET_ID,true);a.setRouteBinding(ASSET_ID,ROUTE_ID);
        f.routes.setRoute(ROUTE_ID,BridgeRouteRegistry.Route(ASSET_ID,a.ETH_ROUTE_CHAIN_ID(),uint64(block.chainid),a.ETH_NATIVE_SOURCE_ASSET(),bytes32(uint256(uint160(TOKEN))),a.ADAPTER_ID(),keccak256(abi.encode(address(verifier),address(c),address(messages))),2,BridgeRouteRegistry.Status.ACTIVE,true,true));
        f.router.setAdapter(a.ADAPTER_ID(),address(a));
        (bytes memory tx_,EthereumVm420.Log[] memory logs,bytes32 messageId)=sourceDeposit(gateway,address(0),1 ether,420,address(f.router),ROUTE_ID,address(0xB0B));
        (,bytes memory encoded)=proofFor(c,tx_,logs,1);
        f.routes.setDirection(ROUTE_ID,false,true);
        (bool ok,)=address(f.router).call(abi.encodeCall(f.router.acceptInbound,(a.ADAPTER_ID(),encoded)));require(!ok && !a.consumedMessages(messageId));
        f.routes.setDirection(ROUTE_ID,true,true);f.transfers.setRouter(address(f.router),false);
        (ok,)=address(f.router).call(abi.encodeCall(f.router.acceptInbound,(a.ADAPTER_ID(),encoded)));require(!ok && !a.consumedMessages(messageId));
        (,,,,,,uint256 rollbackTVL)=f.risk.routeUsage(ROUTE_ID);require(rollbackTVL==0);
        f.transfers.setRouter(address(f.router),true);bytes32 id=f.router.acceptInbound(a.ADAPTER_ID(),encoded);
        (,,,,uint256 amount,,,BridgeTransferRegistry.Status status,,)=f.transfers.transfers(id);require(amount==1 ether && status==BridgeTransferRegistry.Status.VERIFIED);
        (,,,,,,uint256 tvl)=f.risk.routeUsage(ROUTE_ID);require(tvl==1 ether && a.consumedMessages(messageId));
        (ok,)=address(f.router).call(abi.encodeCall(f.router.acceptInbound,(a.ADAPTER_ID(),encoded)));require(!ok);
        (,,,,,,uint256 afterReplay)=f.risk.routeUsage(ROUTE_ID);require(afterReplay==tvl);
    }
}
