// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./TokenIds420.sol";
import "./TokenTemplateRegistry420.sol";
import "./ERC20Template420.sol";
import "./ERC721Template420.sol";
import "./ERC1155Template420.sol";

interface ITokenCommunityTreasuryVault420 {
    function vaultId() external view returns (bytes32);
    function depositNative() external payable;
}

contract TokenFactory420 is I420System {
    uint256 public constant CREATION_FEE = 42 ether;
    TokenTemplateRegistry420 public immutable templates;
    ITokenCommunityTreasuryVault420 public immutable communityTreasuryVault;
    mapping(address=>uint256) public creatorNonce;
    mapping(address=>bool) public isFactoryDeployment;
    struct Deployment { address token; address creator; bytes32 templateId; uint32 templateVersion; bytes32 configHash; uint64 deployedAt; }
    Deployment[] private _deployments;
    bool private _entered;
    error ZeroAddress(); error IncorrectFee(); error TemplateDisabled(); error InvalidTemplate(); error TreasuryDepositFailed(); error Reentrancy(); error InvalidConfig(); error InvalidTreasuryVault();
    event TokenDeployed(address indexed token,address indexed creator,bytes32 indexed templateId,uint32 templateVersion,bytes32 configHash,uint256 feePaid);
    event CreationFeeDeposited(address indexed treasuryVault,bytes32 indexed treasuryVaultId,uint256 amount);
    constructor(address templateRegistry_,address communityTreasuryVault_){
        if(templateRegistry_==address(0)||communityTreasuryVault_==address(0)) revert ZeroAddress();
        templates=TokenTemplateRegistry420(templateRegistry_);
        ITokenCommunityTreasuryVault420 treasury=ITokenCommunityTreasuryVault420(communityTreasuryVault_);
        if(treasury.vaultId()!=TokenIds420.COMMUNITY_TOKEN_REVENUE_VAULT) revert InvalidTreasuryVault();
        communityTreasuryVault=treasury;
    }
    modifier nonReentrant(){if(_entered) revert Reentrancy();_entered=true;_;_entered=false;}
    modifier exactFee(){if(msg.value!=CREATION_FEE) revert IncorrectFee();_;}
    function createERC20(bytes32 templateId,string calldata name,string calldata symbol,uint256 initialSupply,uint256 cap_,bytes32 userSalt) external payable nonReentrant exactFee returns(address token){if(!templates.enabled(templateId)) revert TemplateDisabled();bool mintable=false;bool burnable=false;bool permit_=false;bool votes_=false;uint256 effectiveCap=0;
        if(templateId==TokenIds420.ERC20_FIXED){}
        else if(templateId==TokenIds420.ERC20_MINTABLE){mintable=true;}
        else if(templateId==TokenIds420.ERC20_CAPPED){if(cap_==0||initialSupply>cap_) revert InvalidConfig();mintable=true;effectiveCap=cap_;}
        else if(templateId==TokenIds420.ERC20_BURNABLE){burnable=true;}
        else if(templateId==TokenIds420.ERC20_PERMIT){permit_=true;}
        else if(templateId==TokenIds420.ERC20_VOTES){permit_=true;votes_=true;}
        else revert InvalidTemplate();
        uint256 nonce=creatorNonce[msg.sender]++;bytes32 salt=keccak256(abi.encode(msg.sender,userSalt,templateId,nonce));bytes32 configHash=keccak256(abi.encode(name,symbol,initialSupply,effectiveCap));ERC20Template420 t=new ERC20Template420{salt:salt}(name,symbol,msg.sender,initialSupply,effectiveCap,mintable,burnable,permit_,votes_,templateId);token=address(t);_finish(token,templateId,configHash);
    }
    function createERC721(string calldata name,string calldata symbol,string calldata baseURI,bytes32 userSalt) external payable nonReentrant exactFee returns(address token){bytes32 id=TokenIds420.ERC721_COLLECTION;if(!templates.enabled(id)) revert TemplateDisabled();uint256 nonce=creatorNonce[msg.sender]++;bytes32 salt=keccak256(abi.encode(msg.sender,userSalt,id,nonce));bytes32 configHash=keccak256(abi.encode(name,symbol,baseURI));token=address(new ERC721Template420{salt:salt}(name,symbol,baseURI,msg.sender,id));_finish(token,id,configHash);}
    function createERC1155(string calldata uri_,bytes32 userSalt) external payable nonReentrant exactFee returns(address token){bytes32 id=TokenIds420.ERC1155_MULTI;if(!templates.enabled(id)) revert TemplateDisabled();uint256 nonce=creatorNonce[msg.sender]++;bytes32 salt=keccak256(abi.encode(msg.sender,userSalt,id,nonce));bytes32 configHash=keccak256(abi.encode(uri_));token=address(new ERC1155Template420{salt:salt}(uri_,msg.sender,id));_finish(token,id,configHash);}
    function _finish(address token,bytes32 id,bytes32 configHash) internal {
        TokenTemplateRegistry420.Template memory meta=templates.template(id);
        isFactoryDeployment[token]=true;
        _deployments.push(Deployment(token,msg.sender,id,meta.version,configHash,uint64(block.timestamp)));
        emit TokenDeployed(token,msg.sender,id,meta.version,configHash,CREATION_FEE);
        try communityTreasuryVault.depositNative{value:CREATION_FEE}() {
            emit CreationFeeDeposited(address(communityTreasuryVault),TokenIds420.COMMUNITY_TOKEN_REVENUE_VAULT,CREATION_FEE);
        } catch {
            revert TreasuryDepositFailed();
        }
    }
    function deploymentCount() external view returns(uint256){return _deployments.length;}
    function deployment(uint256 index) external view returns(Deployment memory){return _deployments[index];}
    function systemName() external pure returns(string memory){return "420TokenFactory";}
    function protocolVersion() external pure returns(uint32){return 1;}
}
