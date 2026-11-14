// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./helpers/EthereumProofFixture420.sol";
import "../src/bridge/EthereumDepositGateway420.sol";
import "../src/bridge/verifiers/EthereumFinalityVerifier420.sol";
import "../src/bridge/adapters/EthereumBridgeAdapter420.sol";

contract EthereumGatewayRouterCaller420 {
    function inbound(EthereumBridgeAdapter420 adapter,bytes calldata proof) external returns(IBridgeAdapter420.VerifiedTransfer memory){return adapter.verifyInbound(proof);}
}
contract EthereumEscrowTokenMock420 {
    mapping(address=>uint256) public balanceOf;
    mapping(address=>mapping(address=>uint256)) public allowance;
    uint256 public mode;
    bool public reentryRejected;
    event Transfer(address indexed from,address indexed to,uint256 amount);
    function mint(address to,uint256 amount) external {balanceOf[to]+=amount;}
    function setMode(uint256 value) external {mode=value;}
    function approve(address spender,uint256 amount) external returns(bool){allowance[msg.sender][spender]=amount;return true;}
    function transferFrom(address from,address to,uint256 amount) external returns(bool){
        if(mode==1)return false;if(mode==2)revert("token rejected");
        require(allowance[from][msg.sender]>=amount && balanceOf[from]>=amount);allowance[from][msg.sender]-=amount;balanceOf[from]-=amount;
        uint256 received=mode==3?amount-1:amount;balanceOf[to]+=received;emit Transfer(from,to,received);
        if(mode==4){(bool ok,)=msg.sender.call(abi.encodeWithSelector(EthereumDepositGateway420.deposit.selector,address(this),amount,uint256(420),address(0x420),bytes32(uint256(1)),from));reentryRejected=!ok;}
        return true;
    }
}
contract EthereumNoReturnTokenMock420 {
    mapping(address=>uint256) public balanceOf;
    mapping(address=>mapping(address=>uint256)) public allowance;
    function mint(address to,uint256 amount) external {balanceOf[to]+=amount;}
    function approve(address spender,uint256 amount) external {allowance[msg.sender][spender]=amount;}
    function transferFrom(address from,address to,uint256 amount) external {require(allowance[from][msg.sender]>=amount && balanceOf[from]>=amount);allowance[from][msg.sender]-=amount;balanceOf[from]-=amount;balanceOf[to]+=amount;}
}

contract EthereumGatewayQualification420Test is EthereumProofFixture420 {
    uint256 internal constant SOURCE_KEY=0x420beef;
    bytes32 internal constant ETH_ROUTE=keccak256("420/BRIDGE/ROUTE/ETH/MAINNET");
    bytes32 internal constant ETH_ASSET=keccak256("420/BRIDGE/ASSET/ETH");
    struct Context {EthereumConsensusLightClient420 client; EthereumGatewayMessageVerifier420 messages; EthereumFinalityVerifier420 verifier; EthereumBridgeAdapter420 adapter; EthereumGatewayRouterCaller420 router; EthereumDepositGateway420 gateway; EthereumGatewayMessageVerifier420.Proof proof; bytes encoded; bytes32 messageId; address sender;}
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
    function setup(address token,bytes32 route,bytes32 asset) internal returns(Context memory x){
        vm.chainId(420);x.client=finalizedClient();x.router=new EthereumGatewayRouterCaller420();x.messages=new EthereumGatewayMessageVerifier420(address(this),address(x.router));x.messages.setRoute(token,route);
        x.verifier=new EthereumFinalityVerifier420(address(this),address(x.client),address(x.messages));x.adapter=new EthereumBridgeAdapter420(address(this),address(x.router),address(x.verifier));
        vm.chainId(1);x.gateway=new EthereumDepositGateway420(address(this));vm.chainId(420);
        x.adapter.setGateway(address(x.gateway),true);x.adapter.setAssetMapping(x.adapter.sourceAssetKey(token),asset,true);x.adapter.setRouteBinding(asset,route);x.sender=vm.addr(SOURCE_KEY);
        (bytes memory tx_,EthereumVm420.Log[] memory logs,bytes32 id)=sourceDeposit(x.gateway,token,1 ether,420,address(x.router),route,address(0xB0B));x.messageId=id;
        (x.proof,x.encoded)=proofFor(x.client,tx_,logs,1);
    }
    function testControlledNativeGatewayConcreteVerifierAdapterAndRotationReplay() public {
        Context memory x=setup(address(0),ETH_ROUTE,ETH_ASSET);
        IBridgeAdapter420.VerifiedTransfer memory result=x.router.inbound(x.adapter,x.encoded);
        require(result.recipient==address(0xB0B) && result.sender==x.sender && result.amount==1 ether && result.assetId==ETH_ASSET && result.routeId==ETH_ROUTE && result.sourceTxId==keccak256(x.proof.transaction) && result.sourceMessageId==x.messageId);
        (bytes32 gateway,bytes32 asset)=x.adapter.verifiedSourceContext(x.messageId);require(gateway==bytes32(uint256(uint160(address(x.gateway)))) && asset==x.adapter.ETH_NATIVE_SOURCE_ASSET());
        EthereumFinalityVerifier420 replacement=new EthereumFinalityVerifier420(address(this),address(x.client),address(x.messages));x.adapter.setVerifier(address(replacement));
        vm.expectRevert(EthereumBridgeAdapter420.Replay.selector);x.router.inbound(x.adapter,x.encoded);
    }
    function testControlledAllCanonicalEthereumTokenRoutes() public {
        address[7] memory tokens=[address(bytes20(hex"7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9")),address(bytes20(hex"18aaa7115705e8be94bffebde57af9bfc265b998")),address(bytes20(hex"1abaea1f7c830bd89acc67ec4af516284b1bc33c")),address(bytes20(hex"514910771af9ca656af840dff83e8264ecf986ca")),address(bytes20(hex"3fa142dd3f384414e05e71ad0939274edc82ec0a")),address(bytes20(hex"1f9840a85d5af5bf1d1762f925bdaddc4201f984")),address(bytes20(hex"dac17f958d2ee523a2206206994597c13d831ec7"))];
        string[7] memory names=[string("AAVE"),"AUDIO","EURC","LINK","QCAD","UNI","USDT"];
        for(uint256 i;i<tokens.length;++i){
            bytes32 asset=keccak256(abi.encodePacked("420/BRIDGE/ASSET/",names[i]));bytes32 route=keccak256(abi.encodePacked("420/BRIDGE/ROUTE/",names[i],"/ETHEREUM/MAINNET"));Context memory x=setup(tokens[i],route,asset);
            IBridgeAdapter420.VerifiedTransfer memory result=x.router.inbound(x.adapter,x.encoded);require(result.assetId==asset && result.routeId==route && result.amount==1 ether && result.recipient==address(0xB0B));
            (bytes32 gateway,bytes32 sourceAsset)=x.adapter.verifiedSourceContext(x.messageId);require(gateway==bytes32(uint256(uint160(address(x.gateway)))) && sourceAsset==bytes32(uint256(uint160(tokens[i]))));
            // Misbinding the exact same token proof to another active route fails before replay is consumed.
            Context memory second=setup(tokens[i],route,asset);second.adapter.setRouteBinding(asset,keccak256("wrong route"));
            vm.expectRevert(EthereumBridgeAdapter420.RouteNotAllowed.selector);second.router.inbound(second.adapter,second.encoded);
        }
    }
    function testOrdinaryHistoricalPaymentsCannotBecomeGatewayDeposits() public {
        vm.chainId(420);EthereumConsensusLightClient420 c=finalizedClient();EthereumGatewayRouterCaller420 r=new EthereumGatewayRouterCaller420();EthereumGatewayMessageVerifier420 m=new EthereumGatewayMessageVerifier420(address(this),address(r));m.setRoute(address(0),ETH_ROUTE);
        EthereumGatewayMessageVerifier420.Proof memory p=history("native");EthereumExecutionHeader420.Header memory h=EthereumExecutionHeader420.parse(p.executionHeader);
        vm.expectRevert(EthereumGatewayMessageVerifier420.InvalidReceiptProof.selector);m.verifyGatewayMessage(abi.encode(p),h.number,h.blockHash,h.receiptsRoot);
        p=history("usdt");vm.expectRevert(EthereumGatewayMessageVerifier420.InvalidDepositEvent.selector);m.verifyGatewayMessage(abi.encode(p),h.number,h.blockHash,h.receiptsRoot);
        require(c.isFinalizedExecutionBlock(h.number,h.blockHash,h.receiptsRoot));
    }
    function testAuthenticatedWrongDestinationAndRouteEventsRejected() public {
        Context memory x=setup(address(0),ETH_ROUTE,ETH_ASSET);
        uint256[3] memory chains=[uint256(421),420,420];address[3] memory routers=[address(x.router),address(0xBAD),address(x.router)];bytes32[3] memory routes=[ETH_ROUTE,ETH_ROUTE,keccak256("wrong source route")];
        for(uint256 i;i<3;++i){
            (bytes memory tx_,EthereumVm420.Log[] memory logs,)=sourceDeposit(x.gateway,address(0),1 ether,chains[i],routers[i],routes[i],address(0xB0B));
            (,bytes memory encoded)=proofFor(x.client,tx_,logs,1);
            vm.expectRevert(EthereumGatewayMessageVerifier420.InvalidDepositEvent.selector);x.router.inbound(x.adapter,encoded);
        }
    }
    function testTransactionReceiptIdentitySuccessAndEnvelopeSubstitutionRejected() public {
        Context memory x=setup(address(0),ETH_ROUTE,ETH_ASSET);
        EthereumExecutionHeader420.Header memory h=EthereumExecutionHeader420.parse(x.proof.executionHeader);
        vm.expectRevert(EthereumFinalityVerifier420.InvalidEnvelope.selector);x.verifier.verifyFinalizedTransfer(abi.encodePacked(x.encoded,hex"00"));
        x.proof.transaction[x.proof.transaction.length-1]^=0x01;
        (bool ok,)=address(x.verifier).staticcall(abi.encodeCall(x.verifier.verifyFinalizedTransfer,(abi.encode(h.number,h.blockHash,h.receiptsRoot,abi.encode(x.proof)))));require(!ok,"transaction substitution accepted");
        x.proof.transaction[x.proof.transaction.length-1]^=0x01;x.proof.receipt[x.proof.receipt.length-1]^=0x01;
        (ok,)=address(x.verifier).staticcall(abi.encodeCall(x.verifier.verifyFinalizedTransfer,(abi.encode(h.number,h.blockHash,h.receiptsRoot,abi.encode(x.proof)))));require(!ok,"recipient/amount/log substitution accepted");
        x.proof.receipt[x.proof.receipt.length-1]^=0x01;x.proof.transactionIndex=1;
        (ok,)=address(x.verifier).staticcall(abi.encodeCall(x.verifier.verifyFinalizedTransfer,(abi.encode(h.number,h.blockHash,h.receiptsRoot,abi.encode(x.proof)))));require(!ok,"receipt/transaction index substitution accepted");
        (bytes memory tx_,EthereumVm420.Log[] memory logs,)=sourceDeposit(x.gateway,address(0),1 ether,420,address(x.router),ETH_ROUTE,address(0xB0B));
        (,bytes memory failed)=proofFor(x.client,tx_,logs,0);
        vm.expectRevert(EthereumGatewayMessageVerifier420.InvalidReceiptProof.selector);x.router.inbound(x.adapter,failed);
    }
    function testGatewayEscrowAmountsFailuresAndReentrancy() public {
        vm.chainId(1);EthereumDepositGateway420 g=new EthereumDepositGateway420(address(this));EthereumEscrowTokenMock420 t=new EthereumEscrowTokenMock420();address user=vm.addr(SOURCE_KEY);t.mint(user,10 ether);vm.prank(user);t.approve(address(g),10 ether);g.setToken(address(t),true);
        for(uint256 mode=1;mode<=3;++mode){t.setMode(mode);vm.prank(user);vm.expectRevert(EthereumDepositGateway420.InvalidDeposit.selector);g.deposit(address(t),1 ether,420,address(0x420),ETH_ROUTE,user);require(g.nonce()==0 && t.balanceOf(address(g))==0 && t.balanceOf(user)==10 ether);}
        t.setMode(4);vm.prank(user);g.deposit(address(t),1 ether,420,address(0x420),ETH_ROUTE,user);require(t.reentryRejected() && g.nonce()==1 && t.balanceOf(address(g))==1 ether);
        EthereumNoReturnTokenMock420 noReturn=new EthereumNoReturnTokenMock420();noReturn.mint(user,1 ether);vm.prank(user);noReturn.approve(address(g),1 ether);g.setToken(address(noReturn),true);vm.prank(user);g.deposit(address(noReturn),1 ether,420,address(0x420),ETH_ROUTE,user);require(g.nonce()==2 && noReturn.balanceOf(address(g))==1 ether);
        vm.deal(address(this),1 ether);vm.expectRevert(EthereumDepositGateway420.InvalidDeposit.selector);g.deposit{value:1}(address(0),2,420,address(0x420),ETH_ROUTE,user);
        vm.chainId(420);vm.expectRevert(EthereumDepositGateway420.InvalidDeposit.selector);g.deposit(address(0),1,421,address(0x420),ETH_ROUTE,user);
    }
    function testAuthenticatedDepositCannotBeConsumedByAnotherDestinationRouter() public {
        Context memory x=setup(address(0),ETH_ROUTE,ETH_ASSET);EthereumGatewayRouterCaller420 other=new EthereumGatewayRouterCaller420();
        EthereumBridgeAdapter420 adapter=new EthereumBridgeAdapter420(address(this),address(other),address(x.verifier));
        adapter.setGateway(address(x.gateway),true);adapter.setAssetMapping(adapter.ETH_NATIVE_SOURCE_ASSET(),ETH_ASSET,true);adapter.setRouteBinding(ETH_ASSET,ETH_ROUTE);
        vm.expectRevert(EthereumBridgeAdapter420.InvalidProof.selector);other.inbound(adapter,x.encoded);
        require(!adapter.consumedMessages(x.messageId) && !x.adapter.consumedMessages(x.messageId));
        x.router.inbound(x.adapter,x.encoded);
    }
}
