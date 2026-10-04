// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../interfaces/I420System.sol"; import "./IAI420.sol"; import "./AIProviderRegistry.sol"; import "./AIModelRegistry.sol"; import "./AIModelDeploymentRegistry420.sol";
contract AIRouter420 is I420System,IAI420 {
    address public immutable override providerRegistry;address public immutable override modelRegistry;address public immutable override jobManager;
    address public immutable override authorization;address public immutable override policyRegistry;address public immutable override deploymentRegistry;
    address public immutable override requestRegistry;address public immutable override resultRegistry;address public immutable override computeAdapter;
    bytes32 public immutable override componentGraphHash; error InvalidDependency();
    constructor(address p,address m,address j,address a,address pol,address d,address req,address res,address comp){
        address[9] memory xs=[p,m,j,a,pol,d,req,res,comp];for(uint256 i;i<xs.length;++i){if(xs[i]==address(0)||xs[i].code.length==0)revert InvalidDependency();}
        providerRegistry=p;modelRegistry=m;jobManager=j;authorization=a;policyRegistry=pol;deploymentRegistry=d;requestRegistry=req;resultRegistry=res;computeAdapter=comp;
        componentGraphHash=keccak256(abi.encode(block.chainid,address(this),p,m,j,a,pol,d,req,res,comp));
    }
    function systemName() external pure returns(string memory){return "AIRouter420";} function protocolVersion() external pure returns(uint32){return 1;}
    function canUseDeployment(bytes32 id) external view returns(bool){return AIModelDeploymentRegistry420(deploymentRegistry).isOperational(id);}
    function isProviderOperational(bytes32 id) external view returns(bool){return AIProviderRegistry(providerRegistry).isOperational(id);}
    function isModelVersionOperational(bytes32 id) external view returns(bool){return AIModelRegistry(modelRegistry).isVersionOperational(id);}
    fallback() external {revert InvalidDependency();}
}
