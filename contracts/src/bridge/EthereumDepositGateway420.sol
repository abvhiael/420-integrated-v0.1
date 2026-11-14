// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../system/SystemAccess.sol";
interface EthereumGatewayToken420 {
    function balanceOf(address) external view returns(uint256);
    function transferFrom(address,address,uint256) external returns(bool);
}
/// @notice Ethereum-side escrow ingress for native ETH and explicitly supported ERC-20s.
/// Withdrawal custody is a separate deployment/activation dependency.
contract EthereumDepositGateway420 is SystemAccess {
    mapping(address=>bool) public tokens;
    uint256 public nonce;
    bool private entered;
    error InvalidDeposit();
    event BridgeDeposit420(bytes32 indexed messageId,address indexed token,address indexed sender,uint256 destinationChainId,address destinationRouter,bytes32 routeId,address recipient,uint256 amount,uint256 nonce);
    constructor(address governance) SystemAccess(governance){}
    function setToken(address token,bool allowed) external onlyGovernance {if(token.code.length==0)revert InvalidDeposit();tokens[token]=allowed;}
    function deposit(address token,uint256 amount,uint256 destinationChainId,address destinationRouter,bytes32 routeId,address recipient) external payable returns(bytes32 messageId){
        if(entered || block.chainid!=1 || amount==0 || destinationChainId==0 || destinationChainId==1 || destinationRouter==address(0) || routeId==0 || recipient==address(0))revert InvalidDeposit();
        entered=true;
        if(token==address(0)){if(msg.value!=amount)revert InvalidDeposit();}
        else {
            if(msg.value!=0 || !tokens[token])revert InvalidDeposit();
            uint256 before_=EthereumGatewayToken420(token).balanceOf(address(this));
            (bool ok,bytes memory result)=token.call(abi.encodeCall(EthereumGatewayToken420.transferFrom,(msg.sender,address(this),amount)));
            if(!ok || (result.length!=0 && (result.length!=32 || !abi.decode(result,(bool)))))revert InvalidDeposit();
            uint256 after_=EthereumGatewayToken420(token).balanceOf(address(this));
            if(after_<before_ || after_-before_!=amount)revert InvalidDeposit();
        }
        uint256 n=++nonce;
        messageId=keccak256(abi.encode("420/ETH/DEPOSIT/V1",block.chainid,address(this),msg.sender,token,destinationChainId,destinationRouter,routeId,recipient,amount,n));
        emit BridgeDeposit420(messageId,token,msg.sender,destinationChainId,destinationRouter,routeId,recipient,amount,n);
        entered=false;
    }
}
