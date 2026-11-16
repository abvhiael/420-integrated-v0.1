// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../system/SystemAccess.sol";
import "./tokens/SupportedTokenRoutes420.sol";
import "../interfaces/IEthereumSourceGatewaySettlement420.sol";
import "../interfaces/IEthereumWithdrawalBacking420.sol";
import "./BridgeVerifierRegistry420.sol";

interface EthereumGatewayToken420 {
    function balanceOf(address) external view returns (uint256);
    function decimals() external view returns (uint8);
    function transferFrom(address, address, uint256) external returns (bool);
}

/// @notice Ethereum-side escrow ingress for native ETH and explicitly supported ERC-20s.
/// Withdrawal custody is a separate deployment/activation dependency.
contract EthereumDepositGateway420 is SystemAccess,IEthereumSourceGatewaySettlement420 {
    mapping(address => bool) public tokens;
    uint256 public nonce;
    IEthereumWithdrawalBacking420 public verifier;
    BridgeVerifierRegistry420 public qualification;
    uint256 public backingChain;
    address public backingRouter;
    address public backingAdapter;
    bool public settlementActive;
    bytes32 public routeConfigHash;
    bytes32 public tokenConfigHash;
    mapping(bytes32=>bytes32) public withdrawalRoute;
    mapping(bytes32=>bytes32) public withdrawalAsset;
    mapping(bytes32=>uint8) public withdrawalStatus; // 1=paid, 2=irrevocably cancelled here
    struct Delivery {address token;address recipient;uint256 amount;bytes32 evidence;}
    mapping(bytes32=>Delivery) private delivery;
    struct DepositLock {address token;address owner;uint256 chain;address router;bytes32 route;address recipient;uint256 amount;bool refunded;}
    mapping(bytes32=>DepositLock) public depositLocks;
    event SourceDepositRefunded(bytes32 indexed messageId,address indexed owner,uint256 amount,bytes32 evidence);

    event WithdrawalPaid(bytes32 indexed messageId,bytes32 indexed evidence,address recipient,uint256 amount);
    event WithdrawalCancelled(bytes32 indexed messageId,bytes32 indexed evidence);

    bool private entered;
    error InvalidDeposit();
    event BridgeDeposit420(
        bytes32 indexed messageId,
        address indexed token,
        address indexed sender,
        uint256 destinationChainId,
        address destinationRouter,
        bytes32 routeId,
        address recipient,
        uint256 amount,
        uint256 nonce
    );
    constructor(address governance) SystemAccess(governance) {}

    function setToken(address token, bool allowed) external onlyGovernance {
        if (token.code.length == 0) revert InvalidDeposit();
        if (allowed) _requireToken(token);
        tokens[token] = allowed;tokenConfigHash=keccak256(abi.encode(tokenConfigHash,token,allowed));
    }

    function deposit(
        address token,
        uint256 amount,
        uint256 destinationChainId,
        address destinationRouter,
        bytes32 routeId,
        address recipient
    ) external payable returns (bytes32 messageId) {
        if (
            entered || block.chainid != 1 || amount == 0 || destinationChainId == 0 || destinationChainId == 1
                || destinationRouter == address(0) || routeId == 0 || recipient == address(0)
        ) revert InvalidDeposit();
        entered = true;
        if (token == address(0)) {
            if (msg.value != amount) revert InvalidDeposit();
        } else {
            if (msg.value != 0 || !tokens[token]) revert InvalidDeposit();
            _requireToken(token);
            uint256 before_ = EthereumGatewayToken420(token).balanceOf(address(this));
            uint256 senderBefore = EthereumGatewayToken420(token).balanceOf(msg.sender);
            (bool ok, bytes memory result) =
                token.call(abi.encodeCall(EthereumGatewayToken420.transferFrom, (msg.sender, address(this), amount)));
            if (!ok || (result.length != 0 && (result.length != 32 || !abi.decode(result, (bool))))) {
                revert InvalidDeposit();
            }
            uint256 after_ = EthereumGatewayToken420(token).balanceOf(address(this));
            uint256 senderAfter = EthereumGatewayToken420(token).balanceOf(msg.sender);
            _requireToken(token);
            if (
                after_ < before_ || after_ - before_ != amount || senderAfter > senderBefore
                    || senderBefore - senderAfter != amount
            ) revert InvalidDeposit();
        }
        uint256 n = ++nonce;
        messageId = keccak256(
            abi.encode(
                "420/ETH/DEPOSIT/V1",
                block.chainid,
                address(this),
                msg.sender,
                token,
                destinationChainId,
                destinationRouter,
                routeId,
                recipient,
                amount,
                n
            )
        );
        depositLocks[messageId]=DepositLock(token,msg.sender,destinationChainId,destinationRouter,routeId,recipient,amount,false);
        emit BridgeDeposit420(
            messageId, token, msg.sender, destinationChainId, destinationRouter, routeId, recipient, amount, n
        );
        entered = false;
    }

    function _requireToken(address token) internal view {
        SupportedTokenRoutes420.Profile memory p = SupportedTokenRoutes420.profile(
            keccak256("420/BRIDGE/ETHEREUM/MAINNET/V12.5.4"), bytes32(uint256(uint160(token)))
        );
        if (EthereumGatewayToken420(token).decimals() != p.decimals) revert InvalidDeposit();
    }
    function configureSettlement(BridgeVerifierRegistry420 q,IEthereumWithdrawalBacking420 v,uint256 chain,address router,address adapter) external onlyGovernance {
        require(!settlementActive&&!entered&&address(q).code.length!=0&&address(v).code.length!=0&&chain!=0&&chain!=1&&router!=address(0)&&adapter!=address(0),"settlement config");
        qualification=q;verifier=v;backingChain=chain;backingRouter=router;backingAdapter=adapter;
    }
    function setWithdrawalRoute(bytes32 source,bytes32 asset,bytes32 route) external onlyGovernance {
        require(!settlementActive&&!entered&&asset!=0&&route!=0,"withdrawal route");
        if(source==keccak256("420/BRIDGE/ETHEREUM/NATIVE/ETH"))require(asset==keccak256("420/BRIDGE/ASSET/ETH"),"native asset");
        else {SupportedTokenRoutes420.Profile memory p=SupportedTokenRoutes420.profile(keccak256("420/BRIDGE/ETHEREUM/MAINNET/V12.5.4"),source);require(p.assetId==asset&&p.routeId==route,"source token route");}
        withdrawalRoute[source]=route;withdrawalAsset[source]=asset;routeConfigHash=keccak256(abi.encode(routeConfigHash,source,asset,route));
    }
    function configurationState() external view returns(bytes32){return keccak256(abi.encode(address(qualification),address(verifier),backingChain,backingRouter,backingAdapter,routeConfigHash,tokenConfigHash));}
    function setSettlementActive(bool enabled) external onlyGovernance {if(enabled){require(block.chainid==1,"Ethereum mainnet");qualification.requireDirection(address(this),2);}settlementActive=enabled;}
    function backingCommitment(IEthereumOutboundMessage420.OutboundMessage calldata request,bool cancellation) public view returns(bytes32){return keccak256(abi.encode("420/ETH/CUSTODY_BACKING/V1",block.chainid,address(this),request,cancellation));}
    function _backed(IEthereumOutboundMessage420.OutboundMessage calldata r,bytes calldata proof,bool cancel) private view returns(bytes32 approval){
        require(block.chainid==1&&!entered&&r.sourceChainId==backingChain&&r.sourceRouter==backingRouter&&r.sourceAdapter==backingAdapter&&r.messageId!=0&&r.sender!=address(0)&&r.recipient!=address(0)&&r.localAmount>0&&r.ethereumAmount>0&&r.nonce>0,"withdrawal domain");
        require(withdrawalRoute[r.ethereumAsset]==r.routeId&&withdrawalAsset[r.ethereumAsset]==r.assetId&&r.routeId!=0&&withdrawalStatus[r.messageId]==0,"withdrawal binding/replay");
        require(proof.length>=32&&proof.length<=4_200_000,"backing proof bounds");approval=qualification.requireDirection(address(this),2);
        require(verifier.verifyBacking(r,proof,cancel)==backingCommitment(r,cancel),"unbacked withdrawal");
    }
    function cancelWithdrawal(IEthereumOutboundMessage420.OutboundMessage calldata r,bytes calldata proof) external {
        bytes32 approval=_backed(r,proof,true);entered=true;withdrawalStatus[r.messageId]=2;
        require(qualification.requireDirection(address(this),2)==approval,"qualification changed");emit WithdrawalCancelled(r.messageId,backingCommitment(r,true));entered=false;
    }
    function settleEthereumWithdrawal(IEthereumOutboundMessage420.OutboundMessage calldata r,bytes calldata proof) external returns(bytes32 id){
        require(settlementActive,"custody inactive");bytes32 approval=_backed(r,proof,false);entered=true;withdrawalStatus[r.messageId]=1;
        address token;
        if(r.ethereumAsset==keccak256("420/BRIDGE/ETHEREUM/NATIVE/ETH")){uint256 before_=address(this).balance;(bool ok,)=r.recipient.call{value:r.ethereumAmount}("");require(ok&&address(this).balance+r.ethereumAmount==before_,"native release");}
        else {require(uint256(r.ethereumAsset)>>160==0,"token encoding");token=address(uint160(uint256(r.ethereumAsset)));require(tokens[token],"token disabled");_requireToken(token);uint256 held=EthereumGatewayToken420(token).balanceOf(address(this));uint256 before_=EthereumGatewayToken420(token).balanceOf(r.recipient);
            (bool ok,bytes memory result)=token.call(abi.encodeWithSignature("transfer(address,uint256)",r.recipient,r.ethereumAmount));require(ok&&(result.length==0||(result.length==32&&abi.decode(result,(bool)))),"token release");
            require(EthereumGatewayToken420(token).balanceOf(address(this))+r.ethereumAmount==held&&EthereumGatewayToken420(token).balanceOf(r.recipient)==before_+r.ethereumAmount,"release delta");_requireToken(token);}
        require(settlementActive&&qualification.requireDirection(address(this),2)==approval,"custody changed during release");
        id=backingCommitment(r,false);delivery[r.messageId]=Delivery(token,r.recipient,r.ethereumAmount,id);emit WithdrawalPaid(r.messageId,id,r.recipient,r.ethereumAmount);entered=false;
    }
    function settlementEvidence(bytes32 id) external view returns(address,address,uint256,bytes32){Delivery memory d=delivery[id];return(d.token,d.recipient,d.amount,d.evidence);}

    function depositRefundCommitment(bytes32 id) public view returns(bytes32){DepositLock storage d=depositLocks[id];require(d.owner!=address(0),"unknown deposit");return keccak256(abi.encode("420/ETH/DEPOSIT_REFUND/V1",block.chainid,address(this),id,d.token,d.owner,d.chain,d.router,d.route,d.recipient,d.amount));}
    function refundUnmintedDeposit(bytes32 id,bytes calldata proof) external {
        require(block.chainid==1&&!entered&&proof.length>=32&&proof.length<=4_200_000,"deposit refund domain");DepositLock storage d=depositLocks[id];require(d.owner!=address(0)&&!d.refunded&&d.chain==backingChain&&d.router==backingRouter,"deposit refund binding");bytes32 approval=qualification.requireDirection(address(this),2);bytes32 e=depositRefundCommitment(id);
        require(IEthereumDepositRefundBacking420(address(verifier)).verifyDepositRefund(id,proof)==e,"unproven unminted deposit");entered=true;d.refunded=true;
        if(d.token==address(0)){uint256 held=address(this).balance;(bool ok,)=d.owner.call{value:d.amount}("");require(ok&&address(this).balance+d.amount==held,"native source refund");}
        else {_requireToken(d.token);uint256 held=EthereumGatewayToken420(d.token).balanceOf(address(this));uint256 before_=EthereumGatewayToken420(d.token).balanceOf(d.owner);(bool ok,bytes memory result)=d.token.call(abi.encodeWithSignature("transfer(address,uint256)",d.owner,d.amount));require(ok&&(result.length==0||(result.length==32&&abi.decode(result,(bool))))&&EthereumGatewayToken420(d.token).balanceOf(address(this))+d.amount==held&&EthereumGatewayToken420(d.token).balanceOf(d.owner)==before_+d.amount,"source token refund");_requireToken(d.token);}
        require(qualification.requireDirection(address(this),2)==approval,"source refund qualification changed");entered=false;emit SourceDepositRefunded(id,d.owner,d.amount,e);
    }

}
