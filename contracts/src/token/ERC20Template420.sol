// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

contract ERC20Template420 {
    string public name;
    string public symbol;
    uint8 public constant decimals = 18;
    uint256 public totalSupply;
    uint256 public immutable cap;
    address public owner;
    bool public immutable mintable;
    bool public immutable burnable;
    bool public immutable permitEnabled;
    bool public immutable votesEnabled;
    bytes32 public immutable templateId;
    bytes32 public immutable DOMAIN_SEPARATOR;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    mapping(address => uint256) public nonces;
    mapping(address => address) public delegates;
    struct Checkpoint { uint48 fromBlock; uint208 votes; }
    mapping(address => Checkpoint[]) private _checkpoints;
    bytes32 private constant PERMIT_TYPEHASH = keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");
    error Unauthorized(); error ZeroAddress(); error InsufficientBalance(); error InsufficientAllowance(); error CapExceeded(); error FeatureDisabled(); error Expired(); error InvalidSignature(); error VoteOverflow();
    event Transfer(address indexed from,address indexed to,uint256 value); event Approval(address indexed owner,address indexed spender,uint256 value); event OwnershipTransferred(address indexed oldOwner,address indexed newOwner); event DelegateChanged(address indexed delegator,address indexed fromDelegate,address indexed toDelegate); event DelegateVotesChanged(address indexed delegate,uint256 previousVotes,uint256 newVotes);

    constructor(string memory name_, string memory symbol_, address owner_, uint256 initialSupply_, uint256 cap_, bool mintable_, bool burnable_, bool permit_, bool votes_, bytes32 templateId_) {
        if (owner_ == address(0)) revert ZeroAddress(); if (cap_ != 0 && initialSupply_ > cap_) revert CapExceeded();
        name=name_; symbol=symbol_; owner=owner_; cap=cap_; mintable=mintable_; burnable=burnable_; permitEnabled=permit_; votesEnabled=votes_; templateId=templateId_;
        DOMAIN_SEPARATOR=keccak256(abi.encode(keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),keccak256(bytes(name_)),keccak256(bytes("1")),block.chainid,address(this)));
        if (initialSupply_ != 0) _mint(owner_, initialSupply_);
    }
    modifier onlyOwner(){ if(msg.sender!=owner) revert Unauthorized(); _; }
    function transferOwnership(address next) external onlyOwner { if(next==address(0)) revert ZeroAddress(); emit OwnershipTransferred(owner,next); owner=next; }
    function renounceOwnership() external onlyOwner { emit OwnershipTransferred(owner,address(0)); owner=address(0); }
    function approve(address spender,uint256 amount) external returns(bool){ allowance[msg.sender][spender]=amount; emit Approval(msg.sender,spender,amount); return true; }
    function transfer(address to,uint256 amount) external returns(bool){ _transfer(msg.sender,to,amount); return true; }
    function transferFrom(address from,address to,uint256 amount) external returns(bool){ uint256 a=allowance[from][msg.sender]; if(a!=type(uint256).max){ if(a<amount) revert InsufficientAllowance(); unchecked{allowance[from][msg.sender]=a-amount;} emit Approval(from,msg.sender,allowance[from][msg.sender]); } _transfer(from,to,amount); return true; }
    function mint(address to,uint256 amount) external onlyOwner { if(!mintable) revert FeatureDisabled(); _mint(to,amount); }
    function burn(uint256 amount) external { if(!burnable) revert FeatureDisabled(); _burn(msg.sender,amount); }
    function burnFrom(address from,uint256 amount) external { if(!burnable) revert FeatureDisabled(); uint256 a=allowance[from][msg.sender]; if(a<amount) revert InsufficientAllowance(); unchecked{allowance[from][msg.sender]=a-amount;} emit Approval(from,msg.sender,allowance[from][msg.sender]); _burn(from,amount); }
    function permit(address holder,address spender,uint256 value,uint256 deadline,uint8 v,bytes32 r,bytes32 s) external { if(!permitEnabled) revert FeatureDisabled(); if(block.timestamp>deadline) revert Expired(); uint256 nonce=nonces[holder]++; bytes32 digest=keccak256(abi.encodePacked("\x19\x01",DOMAIN_SEPARATOR,keccak256(abi.encode(PERMIT_TYPEHASH,holder,spender,value,nonce,deadline)))); address signer=ecrecover(digest,v,r,s); if(signer==address(0)||signer!=holder) revert InvalidSignature(); allowance[holder][spender]=value; emit Approval(holder,spender,value); }
    function delegate(address delegatee) external { if(!votesEnabled) revert FeatureDisabled(); address old=delegates[msg.sender]; delegates[msg.sender]=delegatee; emit DelegateChanged(msg.sender,old,delegatee); _moveVotingPower(old,delegatee,balanceOf[msg.sender]); }
    function getVotes(address account) external view returns(uint256){ uint256 n=_checkpoints[account].length; return n==0?0:_checkpoints[account][n-1].votes; }
    function numCheckpoints(address account) external view returns(uint256){ return _checkpoints[account].length; }
    function getPastVotes(address account,uint256 blockNumber) external view returns(uint256){ require(blockNumber<block.number,"future block"); Checkpoint[] storage ck=_checkpoints[account]; uint256 low=0; uint256 high=ck.length; while(low<high){ uint256 mid=(low+high)/2; if(ck[mid].fromBlock<=blockNumber) low=mid+1; else high=mid; } return low==0?0:ck[low-1].votes; }
    function _transfer(address from,address to,uint256 amount) internal { if(to==address(0)) revert ZeroAddress(); uint256 b=balanceOf[from]; if(b<amount) revert InsufficientBalance(); unchecked{balanceOf[from]=b-amount;} balanceOf[to]+=amount; emit Transfer(from,to,amount); if(votesEnabled) _moveVotingPower(delegates[from],delegates[to],amount); }
    function _mint(address to,uint256 amount) internal { if(to==address(0)) revert ZeroAddress(); uint256 next=totalSupply+amount; if(cap!=0&&next>cap) revert CapExceeded(); totalSupply=next; balanceOf[to]+=amount; emit Transfer(address(0),to,amount); if(votesEnabled) _moveVotingPower(address(0),delegates[to],amount); }
    function _burn(address from,uint256 amount) internal { uint256 b=balanceOf[from]; if(b<amount) revert InsufficientBalance(); unchecked{balanceOf[from]=b-amount; totalSupply-=amount;} emit Transfer(from,address(0),amount); if(votesEnabled) _moveVotingPower(delegates[from],address(0),amount); }
    function _moveVotingPower(address src,address dst,uint256 amount) internal { if(amount==0||src==dst) return; if(src!=address(0)) _writeCheckpoint(src,false,amount); if(dst!=address(0)) _writeCheckpoint(dst,true,amount); }
    function _writeCheckpoint(address delegatee,bool add,uint256 amount) internal { Checkpoint[] storage ck=_checkpoints[delegatee]; uint256 old=ck.length==0?0:ck[ck.length-1].votes; uint256 next=add?old+amount:old-amount; if(next>type(uint208).max) revert VoteOverflow(); if(ck.length!=0&&ck[ck.length-1].fromBlock==block.number) ck[ck.length-1].votes=uint208(next); else ck.push(Checkpoint(uint48(block.number),uint208(next))); emit DelegateVotesChanged(delegatee,old,next); }
}
