// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/exchange/ExchangeAtomicRouter420.sol";
import "../src/exchange/ExchangeIds420.sol";
import "../src/exchange/Wrapped420.sol";
import "../src/interfaces/genesis/ICapabilityRegistry420.sol";

interface IERC20NativeValueTest420 {
    function approve(address spender, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);
}

contract NativeValueToken420 {
    string public constant name = "TEST";
    string public constant symbol = "TEST";
    uint8 public constant decimals = 18;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    function mint(address to,uint256 amount) external { balanceOf[to]+=amount; totalSupply+=amount; }
    function approve(address spender,uint256 amount) external returns(bool){ allowance[msg.sender][spender]=amount; return true; }
    function transfer(address to,uint256 amount) external returns(bool){ require(balanceOf[msg.sender]>=amount); balanceOf[msg.sender]-=amount; balanceOf[to]+=amount; return true; }
    function transferFrom(address from,address to,uint256 amount) external returns(bool){ uint256 a=allowance[from][msg.sender]; require(a>=amount && balanceOf[from]>=amount); if(a!=type(uint256).max) allowance[from][msg.sender]=a-amount; balanceOf[from]-=amount; balanceOf[to]+=amount; return true; }
}

contract NativeValueCaps420 is ICapabilityRegistry420 {
    address public principal;
    bool public enabled = true;
    function setPrincipal(address p) external { principal=p; }
    function setEnabled(bool e) external { enabled=e; }
    function grant(bytes32) external pure override returns (CapabilityGrant memory g) { return g; }
    function isAuthorized(address p,bytes32 componentId,bytes32 capabilityId,bytes32,uint256 amount) external view override returns(bool){
        return enabled && p==principal && componentId==ExchangeIds420.EXCHANGE_ROUTER && capabilityId==ExchangeIds420.ACTION_SWAP && amount<=100 ether;
    }
}

contract NativeValueOracle420 is IExchangeReferenceOracle420 {
    uint256 public price = 1e18;
    uint256 public updatedAt;
    constructor(){ updatedAt=block.timestamp; }
    function set(uint256 p) external { price=p; updatedAt=block.timestamp; }
    function referencePrice(bytes32) external view returns(uint256,uint256){ return(price,updatedAt); }
}

contract NativeValueAdapter420 is IExchangeQuoteAdapter420, IExchangeExecutionAdapter420 {
    address public constant sink = address(0x420420);
    function allowanceTarget() external view returns(address){ return address(this); }
    function quote(address,address,uint256 amountIn,bytes calldata) external pure override returns(uint256,uint256){ return(amountIn,0); }
    function executeSwap(address payer,address recipient,address tokenIn,address tokenOut,uint256 amountIn,uint256 minAmountOut,bytes calldata) external override returns(uint256){
        require(amountIn>=minAmountOut,"slippage");
        require(IERC20NativeValueTest420(tokenIn).transferFrom(payer,sink,amountIn),"pull");
        require(IERC20NativeValueTest420(tokenOut).transfer(recipient,amountIn),"push");
        return amountIn;
    }
}

contract RejectNativeRecipient420 {
    receive() external payable { revert("reject native"); }
}

contract ForceNative420 {
    constructor() payable {}
    function force(address payable target) external { selfdestruct(target); }
}

contract ExchangeNativeValue420Test is Test {
    bytes32 private constant W_ID=keccak256("420/exchange/native/W420");
    bytes32 private constant T_ID=keccak256("420/exchange/native/TEST");
    bytes32 private constant MARKET=keccak256("420/exchange/native/W420-TEST");
    bytes32 private constant ROUTE=keccak256("420/exchange/native/route");

    Wrapped420 private wrapped;
    NativeValueToken420 private token;
    NativeValueCaps420 private caps;
    NativeValueOracle420 private referenceOracle;
    NativeValueAdapter420 private adapter;
    ExchangeAuthorization420 private authorization;
    ExchangeEmergencyControl420 private emergency;
    ExchangeOracleGuard420 private oracleGuard;
    ExchangeAssetRegistry420 private assets;
    ExchangeMarketRegistry420 private markets;
    ExchangeRouteRegistry420 private routes;
    ExchangeFeePolicy420 private feePolicy;
    ExchangeFeeRouter420 private feeRouter;
    ExchangeAtomicRouter420 private router;

    receive() external payable {}

    constructor() payable {
        vm.deal(address(this),100 ether);
        wrapped=new Wrapped420();
        token=new NativeValueToken420();
        caps=new NativeValueCaps420();
        referenceOracle=new NativeValueOracle420();
        adapter=new NativeValueAdapter420();
        authorization=new ExchangeAuthorization420(address(caps));
        emergency=new ExchangeEmergencyControl420(address(this));
        oracleGuard=new ExchangeOracleGuard420(address(this));
        assets=new ExchangeAssetRegistry420(address(this));
        markets=new ExchangeMarketRegistry420(address(this),address(assets),T_ID);
        routes=new ExchangeRouteRegistry420(address(this));
        feePolicy=new ExchangeFeePolicy420(address(this));
        feeRouter=new ExchangeFeeRouter420(address(this),address(feePolicy));

        _asset(W_ID,address(wrapped),bytes16("W420"));
        _asset(T_ID,address(token),bytes16("TEST"));
        markets.configureMarket(MARKET,W_ID,T_ID,keccak256("native-market"),address(adapter),ExchangeTypes420.MarketStatus.ACTIVE,keccak256("native-metadata"));
        routes.configureRoute(ROUTE,keccak256("420SWAP"),address(adapter),address(adapter),keccak256("native-route"),true);
        oracleGuard.configureGuard(MARKET,address(referenceOracle),1 days,500,true);
        router=new ExchangeAtomicRouter420(address(markets),address(assets),address(routes),address(authorization),address(emergency),address(oracleGuard),address(wrapped),address(feeRouter));
        caps.setPrincipal(address(this));

        token.mint(address(adapter),100 ether);
        token.mint(address(this),100 ether);
        token.approve(address(adapter),type(uint256).max);

        wrapped.deposit{value:20 ether}();
        wrapped.transfer(address(adapter),20 ether);
    }

    function testNativeInputWrapsExecutesAndLeavesNoResidue() public {
        ExchangeAtomicRouter420.Hop[] memory hops=_toToken();
        bytes32 pathHash=router.hashPath(address(wrapped),1 ether,address(this),hops);
        uint256 beforeToken=token.balanceOf(address(this));
        uint256 out=router.swapExactInputNativePath{value:1 ether}(95e16,address(this),pathHash,hops);
        require(out==1 ether,"output");
        require(token.balanceOf(address(this))-beforeToken==1 ether,"recipient");
        require(wrapped.balanceOf(address(router))==0,"wrapped residue");
        require(wrapped.allowance(address(router),address(adapter))==0,"allowance residue");
        require(address(router).balance==0,"native residue");
    }

    function testTokenInputUnwrapsFinalOutputAndLeavesNoResidue() public {
        ExchangeAtomicRouter420.Hop[] memory hops=_toNative();
        bytes32 pathHash=router.hashPath(address(token),1 ether,address(this),hops);
        uint256 beforeNative=address(this).balance;
        uint256 out=router.swapExactInputPathForNative(address(token),1 ether,95e16,address(this),pathHash,hops);
        require(out==1 ether,"output");
        require(address(this).balance==beforeNative+1 ether,"native recipient");
        require(wrapped.balanceOf(address(router))==0,"wrapped residue");
        require(address(router).balance==0,"native residue");
    }

    function testDirectNativeTransferIsRejected() public {
        (bool ok,)=address(router).call{value:1}("");
        require(!ok,"direct native accepted");
    }

    function testNativeInputOracleFailureRollsBackWrapAndValue() public {
        ExchangeAtomicRouter420.Hop[] memory hops=_toToken();
        bytes32 pathHash=router.hashPath(address(wrapped),1 ether,address(this),hops);
        uint256 beforeNative=address(this).balance;
        uint256 beforeSupply=wrapped.totalSupply();
        referenceOracle.set(2e18);
        (bool ok,)=address(router).call{value:1 ether}(abi.encodeWithSelector(router.swapExactInputNativePath.selector,95e16,address(this),pathHash,hops));
        require(!ok,"deviation accepted");
        require(address(this).balance==beforeNative,"native not rolled back");
        require(wrapped.totalSupply()==beforeSupply,"wrap not rolled back");
        require(wrapped.balanceOf(address(router))==0,"router wrapped residue");
        require(address(router).balance==0,"router native residue");
        referenceOracle.set(1e18);
    }

    function testForcedNativeBalanceIsPreservedAcrossUnwrap() public {
        ForceNative420 force=new ForceNative420{value:2 ether}();
        force.force(payable(address(router)));
        require(address(router).balance==2 ether,"force failed");

        ExchangeAtomicRouter420.Hop[] memory hops=_toNative();
        bytes32 pathHash=router.hashPath(address(token),1 ether,address(this),hops);
        uint256 beforeRecipient=address(this).balance;
        uint256 out=router.swapExactInputPathForNative(address(token),1 ether,95e16,address(this),pathHash,hops);

        require(out==1 ether,"output");
        require(address(this).balance==beforeRecipient+1 ether,"recipient output");
        require(address(router).balance==2 ether,"forced balance changed");
        require(wrapped.balanceOf(address(router))==0,"wrapped residue");
    }

    function testRejectingNativeRecipientRollsBackInputAndOutput() public {
        RejectNativeRecipient420 rejecting=new RejectNativeRecipient420();
        ExchangeAtomicRouter420.Hop[] memory hops=_toNative();
        bytes32 pathHash=router.hashPath(address(token),1 ether,address(rejecting),hops);
        uint256 beforeInput=token.balanceOf(address(this));
        uint256 beforeAdapterWrapped=wrapped.balanceOf(address(adapter));
        uint256 beforeNonce=router.tradeNonce();

        (bool ok,)=address(router).call(
            abi.encodeWithSelector(
                router.swapExactInputPathForNative.selector,
                address(token),1 ether,95e16,address(rejecting),pathHash,hops
            )
        );
        require(!ok,"rejecting recipient accepted");
        require(token.balanceOf(address(this))==beforeInput,"input not rolled back");
        require(wrapped.balanceOf(address(adapter))==beforeAdapterWrapped,"venue output not rolled back");
        require(router.tradeNonce()==beforeNonce,"trade nonce not rolled back");
        require(wrapped.balanceOf(address(router))==0,"wrapped residue");
        require(wrapped.allowance(address(router),address(feeRouter))==0,"fee allowance residue");
    }

    function testFakeWrappedNativeFinalAssetIsRejected() public {
        Wrapped420 fakeWrapped=new Wrapped420();
        ExchangeAtomicRouter420.Hop[] memory hops=new ExchangeAtomicRouter420.Hop[](1);
        hops[0]=ExchangeAtomicRouter420.Hop(MARKET,ROUTE,address(fakeWrapped),1,"");
        bytes32 pathHash=router.hashPath(address(token),1 ether,address(this),hops);
        uint256 beforeInput=token.balanceOf(address(this));

        (bool ok,)=address(router).call(
            abi.encodeWithSelector(
                router.swapExactInputPathForNative.selector,
                address(token),1 ether,1,address(this),pathHash,hops
            )
        );
        require(!ok,"fake wrapped native accepted");
        require(token.balanceOf(address(this))==beforeInput,"input moved on fake wrapper");
    }

    function testFeeDistributionRollsBackWhenNativeRecipientRejects() public {
        address protocol=address(0x1201);
        address development=address(0x1202);
        address community=address(0x1203);
        address liquidity=address(0x1204);
        address devVault=address(0x1205);
        feePolicy.setFeeSplit(ExchangeFeePolicy420.FeeSplit(4000,2000,2000,2000,0));
        feePolicy.setRecipients(ExchangeFeePolicy420.Recipients(protocol,development,community,liquidity,devVault));
        feeRouter.setCollector(address(router),true);
        feePolicy.setExchangeFee(100);

        RejectNativeRecipient420 rejecting=new RejectNativeRecipient420();
        ExchangeAtomicRouter420.Hop[] memory hops=_toNative();
        bytes32 pathHash=router.hashPath(address(token),1 ether,address(rejecting),hops);
        uint256 beforeInput=token.balanceOf(address(this));
        uint256 beforeProtocol=wrapped.balanceOf(protocol);
        uint256 beforeDevelopment=wrapped.balanceOf(development);
        uint256 beforeCommunity=wrapped.balanceOf(community);
        uint256 beforeLiquidity=wrapped.balanceOf(liquidity);
        uint256 beforeNonce=router.tradeNonce();

        (bool ok,)=address(router).call(
            abi.encodeWithSelector(
                router.swapExactInputPathForNative.selector,
                address(token),1 ether,98e16,address(rejecting),pathHash,hops
            )
        );
        require(!ok,"fee+reject path accepted");
        require(token.balanceOf(address(this))==beforeInput,"fee path input not rolled back");
        require(wrapped.balanceOf(protocol)==beforeProtocol,"protocol fee leaked");
        require(wrapped.balanceOf(development)==beforeDevelopment,"development fee leaked");
        require(wrapped.balanceOf(community)==beforeCommunity,"community fee leaked");
        require(wrapped.balanceOf(liquidity)==beforeLiquidity,"liquidity fee leaked");
        require(wrapped.balanceOf(address(feeRouter))==0,"fee router residue");
        require(wrapped.allowance(address(router),address(feeRouter))==0,"fee allowance residue");
        require(router.tradeNonce()==beforeNonce,"trade nonce consumed on rollback");

        feePolicy.setExchangeFee(0);
    }

    function _toToken() private view returns(ExchangeAtomicRouter420.Hop[] memory h){ h=new ExchangeAtomicRouter420.Hop[](1); h[0]=ExchangeAtomicRouter420.Hop(MARKET,ROUTE,address(token),95e16,""); }
    function _toNative() private view returns(ExchangeAtomicRouter420.Hop[] memory h){ h=new ExchangeAtomicRouter420.Hop[](1); h[0]=ExchangeAtomicRouter420.Hop(MARKET,ROUTE,address(wrapped),95e16,""); }
    function _asset(bytes32 id,address t,bytes16 s) private { assets.configureAsset(id,s,keccak256(abi.encodePacked("chain",id)),keccak256(abi.encodePacked("asset",id)),t,ExchangeTypes420.AssetCategory.OTHER,ExchangeTypes420.AssetStatus.VERIFIED,keccak256(abi.encodePacked("verification",id)),keccak256(abi.encodePacked("metadata",id))); }
}
