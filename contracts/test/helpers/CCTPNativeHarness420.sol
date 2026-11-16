// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../../src/bridge/adapters/USDCCCTPAdapter.sol";

interface CCTPVm420 {
    struct Log {bytes32[] topics;bytes data;address emitter;}
    function readFile(string calldata) external view returns(string memory);
    function parseBytes(string calldata) external pure returns(bytes memory);
    function etch(address,bytes calldata) external;
    function store(address,bytes32,bytes32) external;
    function chainId(uint256) external;
    function roll(uint256) external;
    function warp(uint256) external;
    function prank(address) external;
    function recordLogs() external;
    function getRecordedLogs() external returns(Log[] memory);
    function addr(uint256) external returns(address);
    function sign(uint256,bytes32) external returns(uint8,bytes32,bytes32);
}
interface CCTPNativeMT420 is ICircleMessageTransmitterV2420 {
    function initialize(address,address,address,address,address[] calldata,uint256,uint256) external;
    function pause() external;
    function enableAttester(address) external;
    function disableAttester(address) external;
    function setSignatureThreshold(uint256) external;
}
interface CCTPNativeTM420 is ICircleTokenMessengerV2420 {
    struct Roles {address owner;address rescuer;address feeRecipient;address denylister;address tokenMinter;address minFeeController;}
    function initialize(Roles calldata,uint256,uint32[] calldata,bytes32[] calldata) external;
    function removeRemoteTokenMessenger(uint32) external;
    function addRemoteTokenMessenger(uint32,bytes32) external;
}
interface CCTPNativeMinter420 is ICircleTokenMinterV2420 {
    function linkTokenPair(address,uint32,bytes32) external;
    function unlinkTokenPair(address,uint32,bytes32) external;
    function addLocalTokenMessenger(address) external;
    function setMaxBurnAmountPerMessage(address,uint256) external;
}
/// @dev Controlled token double, NOT deployed native USDC or issuer mint authority.
/// The MessageTransmitter, proxies, TokenMessenger and TokenMinter are actual
/// pinned upstream 0.7.6 bytecode, never programmable verifier stubs.
contract CCTPNativeTokenDouble420 {
    uint8 public constant decimals=6;
    mapping(address=>uint256) public balanceOf;
    mapping(address=>mapping(address=>uint256)) public allowance;
    address public controller;
    address public minter;
    uint8 public mintMode;
    address public reentryRouter;
    bytes public reentryData;
    bytes4 public reentryError;
    function initialize(address c,address m) external {require(controller==address(0));controller=c;minter=m;}
    function fund(address to,uint256 amount) external {require(msg.sender==controller);balanceOf[to]+=amount;}
    function setMintMode(uint8 mode) external {require(msg.sender==controller);mintMode=mode;}
    function setReentry(address router,bytes calldata data) external {require(msg.sender==controller);reentryRouter=router;reentryData=data;}
    function mint(address to,uint256 amount) external returns(bool){require(msg.sender==minter);if(mintMode==1)return false;if(mintMode==2)return true;if(reentryRouter!=address(0)){(bool ok,bytes memory reason)=reentryRouter.call(reentryData);require(!ok,"reentrant success");reentryError=bytes4(reason);}balanceOf[to]+=amount;return true;}
    function burn(uint256 amount) external {require(msg.sender==minter);balanceOf[msg.sender]-=amount;}
    function approve(address spender,uint256 amount) external returns(bool){allowance[msg.sender][spender]=amount;return true;}
    function transferFrom(address from,address to,uint256 amount) external returns(bool){allowance[from][msg.sender]-=amount;balanceOf[from]-=amount;balanceOf[to]+=amount;return true;}
}
contract CCTPRouterCaller420 {
    function inbound(USDCCCTPAdapter a,bytes calldata p) external returns(IBridgeAdapter420.VerifiedTransfer memory){return a.verifyInbound(p);}
    function inboundAndFail(USDCCCTPAdapter a,bytes calldata p) external {a.verifyInbound(p);revert("later router failure");}
    function outbound(USDCCCTPAdapter a,bytes32 r,bytes32 asset,address sender,bytes calldata recipient,uint256 amount,bytes calldata extra) external payable returns(bytes32){return a.initiateOutbound{value:msg.value}(r,asset,sender,recipient,amount,extra);}
}
abstract contract CCTPNativeHarness420 {
    CCTPVm420 internal constant vm=CCTPVm420(address(uint160(uint256(keccak256("hevm cheat code")))));
    address internal constant MT=0x81D40F21F12A8F0E3252Bccb954D722d4c464B64;
    address internal constant TM=0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d;
    address internal constant FEES=address(0xFEE);
    bytes32 internal constant ASSET=keccak256("420/BRIDGE/ASSET/USDC");
    bytes32 internal constant IMPL_SLOT=0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;
    bytes32 internal constant ADMIN_SLOT=0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103;
    address internal router;
    USDCCCTPAdapter internal adapter;
    CCTPNativeTokenDouble420 internal token;
    CCTPNativeMinter420 internal minter;
    uint32 internal domain;
    function file(string memory name) internal view returns(bytes memory){return vm.parseBytes(string.concat("0x",vm.readFile(string.concat("contracts/test/fixtures/cctp/",name))));}
    function code(string memory name) internal view returns(bytes memory){return file(string.concat("upstream/",name,".creation.hex"));}
    function deploy(bytes memory creation,bytes memory args) internal returns(address a){bytes memory init=bytes.concat(creation,args);assembly("memory-safe"){a:=create(0,add(init,32),mload(init))}require(a!=address(0),"native deploy");}
    function proxyAt(address target,address implementation) internal {
        address template=deploy(code("AdminUpgradableProxy"),abi.encode(implementation,address(this),bytes("")));
        vm.etch(target,template.code);vm.store(target,IMPL_SLOT,bytes32(uint256(uint160(implementation))));vm.store(target,ADMIN_SLOT,bytes32(uint256(uint160(address(this)))));
    }
    function setupNative(uint32 local,address selectedRouter) internal {
        domain=local;router=selectedRouter==address(0)?address(new CCTPRouterCaller420()):selectedRouter;
        vm.chainId(local==0?1:8453);
        address implementation=deploy(code("MessageTransmitterV2"),abi.encode(local,uint32(1)));proxyAt(MT,implementation);
        address[] memory attesters=new address[](2);attesters[0]=0x52Ed4cBff8DcE6A19748043F3240ec03c834bCeF;attesters[1]=0x725b06F73ff761eF5390e39315e2BfbF60d33F96;
        CCTPNativeMT420(MT).initialize(address(this),address(this),address(this),address(this),attesters,2,10000);
        minter=CCTPNativeMinter420(deploy(code("TokenMinterV2"),abi.encode(address(this))));
        address tokenAddress=local==0?0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
        vm.etch(tokenAddress,type(CCTPNativeTokenDouble420).runtimeCode);token=CCTPNativeTokenDouble420(tokenAddress);token.initialize(address(this),address(minter));
        implementation=deploy(code("TokenMessengerV2"),abi.encode(MT,uint32(1)));proxyAt(TM,implementation);
        uint32[] memory domains=new uint32[](local==0?3:1);bytes32[] memory messengers=new bytes32[](domains.length);
        string[3] memory names=[string("base-standard"),string("arbitrum-fast"),string("solana-standard")];
        for(uint256 i;i<domains.length;++i){CCTPV2Message420.Message memory m=CCTPV2Message420.decode(file(string.concat(local==0?names[i]:"ethereum-fast-to-base",".message.hex")));domains[i]=m.sourceDomain;messengers[i]=m.sender;minter.linkTokenPair(tokenAddress,m.sourceDomain,m.burnToken);}
        CCTPNativeTM420.Roles memory roles=CCTPNativeTM420.Roles(address(this),address(this),FEES,address(this),address(minter),address(this));
        CCTPNativeTM420(TM).initialize(roles,0,domains,messengers);minter.addLocalTokenMessenger(TM);minter.setMaxBurnAmountPerMessage(tokenAddress,type(uint256).max);
        adapter=new USDCCCTPAdapter(address(this),router,tokenAddress,ASSET);adapter.configureIssuer(MT,TM,local,keccak256("CONTROLLED NATIVE RUNTIME; NOT 420 ISSUER APPROVAL"));
        for(uint256 i;i<domains.length;++i){bytes memory raw=file(string.concat(local==0?names[i]:"ethereum-fast-to-base",".message.hex"));CCTPV2Message420.Message memory m=CCTPV2Message420.decode(raw);adapter.setPeer(m.sourceDomain,USDCCCTPAdapter.Peer(route(m.sourceDomain),m.sender,m.sourceDomain==5?bytes32(0xa65fc81ce19edcd2d2c340b02fa61be1d5badde1592833ddf92009d8cf685455):bytes32(uint256(uint160(MT))),m.burnToken,1000,m.sourceDomain!=5,true,true));}
        adapter.setIssuerEnabled(true);
    }
    function route(uint32 source) internal view returns(bytes32){return keccak256(abi.encode("CONTROLLED/USDC/CCTP",source,domain));}
    function proof(string memory name) internal view returns(bytes memory){return abi.encode(file(string.concat(name,".message.hex")),file(string.concat(name,".attestation.hex")));}
    function message(string memory name) internal view returns(CCTPV2Message420.Message memory){return CCTPV2Message420.decode(file(string.concat(name,".message.hex")));}
    function inbound(string memory name) internal returns(IBridgeAdapter420.VerifiedTransfer memory){return CCTPRouterCaller420(router).inbound(adapter,proof(name));}
    function reject(bytes memory p,bytes4 expected) internal {
        (bool ok,bytes memory reason)=router.call(abi.encodeCall(CCTPRouterCaller420.inbound,(adapter,p)));require(!ok,"bad evidence accepted");if(expected!=0)require(bytes4(reason)==expected,"wrong rejection boundary");
    }
    function setWord(bytes memory raw,uint256 at,uint256 value,uint256 width) internal pure {for(uint256 i;i<width;++i)raw[at+i]=bytes1(uint8(value>>(8*(width-1-i))));}
}
