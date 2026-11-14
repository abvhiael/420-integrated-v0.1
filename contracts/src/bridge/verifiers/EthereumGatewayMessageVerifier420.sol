// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../../interfaces/IEthereumGatewayMessageVerifier420.sol";
import "../../system/SystemAccess.sol";
import "./EthereumExecutionHeader420.sol";
import "./EthereumMPT420.sol";

/// @notice Authenticates a successful transaction and canonical gateway deposit log
/// against the SAME finalized execution header. Transport metadata supplies no authority.
contract EthereumGatewayMessageVerifier420 is IEthereumGatewayMessageVerifier420,SystemAccess {
    bytes32 public constant DEPOSIT_EVENT=keccak256("BridgeDeposit420(bytes32,address,address,uint256,address,bytes32,address,uint256,uint256)");
    uint256 public immutable destinationChainId;
    address public immutable destinationRouter;
    mapping(address=>bytes32) public routes;
    error InvalidReceiptProof();
    error InvalidDepositEvent();
    struct Proof {bytes executionHeader; uint64 transactionIndex; bytes transaction; bytes[] transactionProof; bytes receipt; bytes[] receiptProof; uint32 logIndex;}
    constructor(address governance,address router) SystemAccess(governance){
        if(router.code.length==0)revert InvalidDepositEvent();destinationChainId=block.chainid;destinationRouter=router;
    }
    function setRoute(address token,bytes32 route) external onlyGovernance {routes[token]=route;}
    function verifyGatewayMessage(bytes calldata encoded,uint64 blockNumber,bytes32 blockHash,bytes32 receiptsRoot) external view returns(GatewayMessage memory m){
        if(encoded.length>1_100_000 || block.chainid!=destinationChainId)revert InvalidReceiptProof();
        Proof memory p=abi.decode(encoded,(Proof));if(keccak256(encoded)!=keccak256(abi.encode(p)))revert InvalidReceiptProof();
        EthereumExecutionHeader420.Header memory h=EthereumExecutionHeader420.parse(p.executionHeader);
        if(h.number!=blockNumber || h.blockHash!=blockHash || h.receiptsRoot!=receiptsRoot)revert InvalidReceiptProof();
        bytes memory key=EthereumRLP420.indexKey(p.transactionIndex);
        EthereumMPT420.verify(h.transactionsRoot,key,p.transaction,p.transactionProof);
        EthereumMPT420.verify(h.receiptsRoot,key,p.receipt,p.receiptProof);
        m.transactionHash=keccak256(p.transaction);
        bytes memory receipt=receiptPayload(p.receipt);
        EthereumRLP420.validate(receipt);
        EthereumRLP420.Item[] memory fields=EthereumRLP420.children(receipt,EthereumRLP420.item(receipt,0));
        if(fields.length!=4 || EthereumRLP420.integer(receipt,fields[0])!=1 || fields[2].list || fields[2].length!=256)revert InvalidReceiptProof();
        EthereumRLP420.integer(receipt,fields[1]);
        EthereumRLP420.Item[] memory logs=EthereumRLP420.children(receipt,fields[3]);
        if(p.logIndex>=logs.length)revert InvalidReceiptProof();
        EthereumRLP420.Item[] memory log_=EthereumRLP420.children(receipt,logs[p.logIndex]);
        if(log_.length!=3)revert InvalidDepositEvent();m.gateway=EthereumRLP420.account(receipt,log_[0]);
        EthereumRLP420.Item[] memory topics=EthereumRLP420.children(receipt,log_[1]);
        if(topics.length!=4 || EthereumRLP420.word(receipt,topics[0])!=DEPOSIT_EVENT)revert InvalidDepositEvent();
        m.messageId=EthereumRLP420.word(receipt,topics[1]);
        m.sourceToken=topicAddress(EthereumRLP420.word(receipt,topics[2]));
        m.sourceSender=topicAddress(EthereumRLP420.word(receipt,topics[3]));
        bytes memory data=EthereumRLP420.data(receipt,log_[2]);
        if(data.length!=192)revert InvalidDepositEvent();
        (uint256 chainId,address router,bytes32 route,address recipient,uint256 amount,uint256 nonce)=abi.decode(data,(uint256,address,bytes32,address,uint256,uint256));
        if(keccak256(data)!=keccak256(abi.encode(chainId,router,route,recipient,amount,nonce)) || chainId!=destinationChainId || router!=destinationRouter
            || route==0 || routes[m.sourceToken]!=route || recipient==address(0) || m.sourceSender==address(0) || amount==0 || nonce==0)revert InvalidDepositEvent();
        bytes32 expected=keccak256(abi.encode("420/ETH/DEPOSIT/V1",uint256(1),m.gateway,m.sourceSender,m.sourceToken,chainId,router,route,recipient,amount,nonce));
        if(m.messageId!=expected)revert InvalidDepositEvent();m.recipient=recipient;m.amount=amount;
        m.destinationChainId=chainId;m.destinationRouter=router;m.routeId=route;
    }
    function receiptPayload(bytes memory raw) internal pure returns(bytes memory){
        if(raw.length==0 || raw.length>131072)revert InvalidReceiptProof();
        uint8 tag=uint8(raw[0]);
        if(tag>=0xc0)return raw;
        if(tag==0 || tag>4)revert InvalidReceiptProof();
        return EthereumRLP420.slice(raw,1,raw.length-1);
    }
    function topicAddress(bytes32 topic) private pure returns(address){if(uint256(topic)>>160!=0)revert InvalidDepositEvent();return address(uint160(uint256(topic)));}
}
