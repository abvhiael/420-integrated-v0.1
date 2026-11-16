// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../../src/bridge/BridgeValueCustody420.sol";
import "./BridgeQualificationFixture420.sol";
interface ValueFixtureStorage420 {function load(address,bytes32) external view returns(bytes32);function store(address,bytes32,bytes32) external;}
contract ValueToken420 {
 uint8 public constant decimals=18;uint256 public totalSupply;mapping(address=>uint256) public balanceOf;mapping(address=>mapping(address=>uint256)) public allowance;address public custody;bool public fail;
 function configure(address c) external {require(custody==address(0));custody=c;}
 function setFail(bool b) external {fail=b;}
 function approve(address a,uint256 n) external returns(bool){allowance[msg.sender][a]=n;return true;}
 function bridgeMint(address to,uint256 n) external {require(msg.sender==custody&&!fail,"mint authorization");balanceOf[to]+=n;totalSupply+=n;}
 function bridgeBurnFrom(address from,uint256 n) external {require(msg.sender==custody&&!fail,"burn authorization");allowance[from][msg.sender]-=n;balanceOf[from]-=n;totalSupply-=n;}
 function transferFrom(address from,address to,uint256 n) external returns(bool){allowance[from][msg.sender]-=n;_move(from,to,n);return true;}
 function transfer(address to,uint256 n) external returns(bool){_move(msg.sender,to,n);return true;}
 function _move(address from,address to,uint256 n) private {require(!fail);balanceOf[from]-=n;balanceOf[to]+=n;}
 function uncontrolledMint(address to,uint256 n) external {balanceOf[to]+=n;totalSupply+=n;}
}
/// Controlled outcome certificate only, never a production source authority.
contract ValueOutcome420 is IBridgeWithdrawalOutcome420 {
 bytes32 public constant root=keccak256("CONTROLLED ECONOMIC OUTCOME / NOT SOURCE AUTHORITY");bool public reject;
 function setReject(bool b) external {reject=b;}
 function verifyOutcome(bytes calldata data) external view returns(Receipt memory){require(!reject,"unverified outcome");return abi.decode(data,(Receipt));}
}
library ValueCustodyFixture420 {
 function approve(GenesisMockEnvironment420 env,BridgeValueCustody420 custody,address token,address verifier,bytes memory rootCall,bytes32 source,bytes32 destination) internal {
  BridgeVerifierRegistry420 q=BridgeQualificationFixture420.registry(env);BridgeVerifierRegistry420.Registration memory r;r.consumer=q.identity(address(custody),BridgeVerifierRegistry420.ProxyKind.DIRECT);r.verifier=q.identity(verifier,BridgeVerifierRegistry420.ProxyKind.DIRECT);r.verifierGetter=bytes4(keccak256("verifier()"));r.sourceChainKey=source;r.destinationChainKey=destination;r.proofSystem=keccak256("CONTROLLED VALUE CUSTODY / NOT PRODUCTION");r.configurationHash=keccak256("controlled value profile");r.evidenceHash=keccak256("CONTROLLED PROOFS / NO ISSUER AUTHORIZATION");r.directions=3;r.dependencies=new BridgeVerifierRegistry420.Identity[](1);r.dependencies[0]=q.identity(token,BridgeVerifierRegistry420.ProxyKind.DIRECT);r.probes=new BridgeVerifierRegistry420.Probe[](8);bytes memory config=abi.encodeWithSignature("configurationState()");r.probes[0]=BridgeVerifierRegistry420.Probe(1,true,rootCall,BridgeQualificationFixture420.resultHash(verifier,rootCall));r.probes[1]=BridgeVerifierRegistry420.Probe(0,false,config,BridgeQualificationFixture420.resultHash(address(custody),config));bytes32[6] memory ids=[BridgeIds420.GATEWAY_ROUTER,BridgeIds420.TRANSFER_REGISTRY,BridgeIds420.ROUTE_REGISTRY,BridgeIds420.RISK_MANAGER,BridgeIds420.ACCOUNTING_REGISTRY,GenesisInterfaceIds420.CANONICAL_ASSET_REGISTRY];for(uint256 i;i<ids.length;++i){bytes memory data=abi.encodeCall(custody.executionBinding,(ids[i]));r.probes[i+2]=BridgeVerifierRegistry420.Probe(0,false,data,BridgeQualificationFixture420.resultHash(address(custody),data));}q.record(r,0,true);
 }
 function nativeProvider(GenesisMockEnvironment420 env,address token,bytes32 asset,bytes32 source,bytes32 destination) internal returns(BridgeValueCustody420 custody){
  uint8 decimals=IBridgeValueToken420(token).decimals();ValueFixtureStorage420 vm=ValueFixtureStorage420(address(uint160(uint256(keccak256("hevm cheat code")))));bytes32 slot=bytes32(uint256(keccak256(abi.encode(asset,uint256(1))))+1);bytes32 old=vm.load(address(env.assets()),slot);vm.store(address(env.assets()),slot,bytes32((uint256(old)&~(uint256(255)<<160))|(uint256(decimals)<<160)));
  ValueOutcome420 outcome=new ValueOutcome420();custody=new BridgeValueCustody420(address(this),address(env.registry()),keccak256("controlled native value custody"),outcome);env.registerResident(address(custody),custody.componentId());custody.configure(asset,token,BridgeValueCustody420.Mode.NATIVE_PROVIDER);approve(env,custody,token,address(outcome),abi.encodeWithSignature("root()"),source,destination);
 }
}
