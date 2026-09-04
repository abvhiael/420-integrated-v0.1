// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

interface IERC721Receiver420 { function onERC721Received(address operator,address from,uint256 tokenId,bytes calldata data) external returns(bytes4); }
contract ERC721Template420 {
    string public name; string public symbol; string public baseURI; address public owner; bytes32 public immutable templateId; uint256 public totalSupply;
    mapping(uint256=>address) private _ownerOf; mapping(address=>uint256) private _balanceOf; mapping(uint256=>address) public getApproved; mapping(address=>mapping(address=>bool)) public isApprovedForAll;
    error Unauthorized(); error ZeroAddress(); error NotMinted(); error AlreadyMinted(); error UnsafeRecipient();
    event Transfer(address indexed from,address indexed to,uint256 indexed tokenId); event Approval(address indexed owner,address indexed approved,uint256 indexed tokenId); event ApprovalForAll(address indexed owner,address indexed operator,bool approved); event OwnershipTransferred(address indexed oldOwner,address indexed newOwner);
    constructor(string memory name_,string memory symbol_,string memory baseURI_,address owner_,bytes32 templateId_){ if(owner_==address(0)) revert ZeroAddress(); name=name_;symbol=symbol_;baseURI=baseURI_;owner=owner_;templateId=templateId_; }
    modifier onlyOwner(){if(msg.sender!=owner) revert Unauthorized();_;}
    function supportsInterface(bytes4 id) external pure returns(bool){return id==0x01ffc9a7||id==0x80ac58cd||id==0x5b5e139f;}
    function balanceOf(address a) external view returns(uint256){if(a==address(0)) revert ZeroAddress();return _balanceOf[a];}
    function ownerOf(uint256 id) public view returns(address){address o=_ownerOf[id];if(o==address(0)) revert NotMinted();return o;}
    function transferOwnership(address n) external onlyOwner{if(n==address(0)) revert ZeroAddress();emit OwnershipTransferred(owner,n);owner=n;}
    function setApprovalForAll(address op,bool approved) external{isApprovedForAll[msg.sender][op]=approved;emit ApprovalForAll(msg.sender,op,approved);}
    function approve(address to,uint256 id) external{address o=ownerOf(id);if(msg.sender!=o&&!isApprovedForAll[o][msg.sender]) revert Unauthorized();getApproved[id]=to;emit Approval(o,to,id);}
    function transferFrom(address from,address to,uint256 id) public{if(to==address(0)) revert ZeroAddress();address o=ownerOf(id);if(o!=from) revert Unauthorized();if(msg.sender!=o&&msg.sender!=getApproved[id]&&!isApprovedForAll[o][msg.sender]) revert Unauthorized();delete getApproved[id];unchecked{_balanceOf[from]--;}_balanceOf[to]++;_ownerOf[id]=to;emit Transfer(from,to,id);}
    function safeTransferFrom(address from,address to,uint256 id) external{safeTransferFrom(from,to,id,"");}
    function safeTransferFrom(address from,address to,uint256 id,bytes memory data) public{transferFrom(from,to,id);if(to.code.length!=0){try IERC721Receiver420(to).onERC721Received(msg.sender,from,id,data) returns(bytes4 v){if(v!=IERC721Receiver420.onERC721Received.selector) revert UnsafeRecipient();}catch{revert UnsafeRecipient();}}}
    function mint(address to,uint256 id) external onlyOwner{if(to==address(0)) revert ZeroAddress();if(_ownerOf[id]!=address(0)) revert AlreadyMinted();_ownerOf[id]=to;_balanceOf[to]++;totalSupply++;emit Transfer(address(0),to,id);}
    function burn(uint256 id) external{address o=ownerOf(id);if(msg.sender!=o&&msg.sender!=getApproved[id]&&!isApprovedForAll[o][msg.sender]) revert Unauthorized();delete getApproved[id];delete _ownerOf[id];unchecked{_balanceOf[o]--;totalSupply--;}emit Transfer(o,address(0),id);}
    function tokenURI(uint256 id) external view returns(string memory){ownerOf(id);return baseURI;}
}
