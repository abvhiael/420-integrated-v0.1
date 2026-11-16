// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./BridgeValueCustody420.sol";
/// Explicit bridged representation, never issuer-native CADC/USDC. No administrator mint role.
/// Canonical status still requires actual Registry mappings and qualified backing infrastructure.
contract BridgeRepresentation420 {
 string public name;string public symbol;uint8 public immutable decimals;bytes32 public immutable assetId;
 address public immutable controller;BridgeVerifierRegistry420 public immutable qualification;
 bool public constant issuerNative=false;
 uint256 public totalSupply;mapping(address=>uint256) public balanceOf;mapping(address=>mapping(address=>uint256)) public allowance;
 event Transfer(address indexed from,address indexed to,uint256 amount);event Approval(address indexed owner,address indexed spender,uint256 amount);
 constructor(bytes32 asset,uint8 units,BridgeValueCustody420 custody){
  require(address(custody).code.length>45&&custody.deploymentAddress()==address(custody)&&units<=77,"representation controller");
  string[20] memory symbols=[string("BTC"),"ETH","SOL","BNB","DOGE","LTC","XRP","TRX","POT","BOB","CURE","ARRR","AUDIO","UNI","LINK","AAVE","USDT","QCAD","EURC","RAY"];
  uint8[12] memory nativeUnits=[uint8(8),18,9,18,8,8,6,6,8,8,6,8];bool found;
  for(uint256 i;i<symbols.length;++i)if(asset==keccak256(abi.encodePacked("420/BRIDGE/ASSET/",symbols[i]))){if(i<12)require(units==nativeUnits[i],"native representation units");name=string.concat("420 Bridged ",symbols[i]);symbol=string.concat("b",symbols[i]);found=true;break;}
  require(found,"unsupported/issuer-native representation");assetId=asset;decimals=units;controller=address(custody);qualification=BridgeVerifierRegistry420(custody.qualificationAnchor());
 }
 modifier onlyController(){require(msg.sender==controller,"representation minter");qualification.requireCurrent(controller);_;}
 function approve(address spender,uint256 amount) external returns(bool){allowance[msg.sender][spender]=amount;emit Approval(msg.sender,spender,amount);return true;}
 function transfer(address to,uint256 amount) external returns(bool){_transfer(msg.sender,to,amount);return true;}
 function transferFrom(address from,address to,uint256 amount) external returns(bool){_spend(from,msg.sender,amount);_transfer(from,to,amount);return true;}
 function bridgeMint(address to,uint256 amount) external onlyController {require(to!=address(0),"mint recipient");totalSupply+=amount;balanceOf[to]+=amount;emit Transfer(address(0),to,amount);}
 function bridgeBurnFrom(address from,uint256 amount) external onlyController {_spend(from,msg.sender,amount);balanceOf[from]-=amount;totalSupply-=amount;emit Transfer(from,address(0),amount);}
 function _transfer(address from,address to,uint256 amount) private {require(to!=address(0),"transfer recipient");balanceOf[from]-=amount;balanceOf[to]+=amount;emit Transfer(from,to,amount);}
 function _spend(address from,address spender,uint256 amount) private {uint256 allowed=allowance[from][spender];if(allowed!=type(uint256).max){allowance[from][spender]=allowed-amount;emit Approval(from,spender,allowed-amount);}}
}
