// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/exchange/ExchangeAtomicRouter420.sol";
import "../src/exchange/ExchangeIds420.sol";
import "../src/interfaces/genesis/ICapabilityRegistry420.sol";

contract FeeSettlementToken420 {
    string public name;
    string public symbol;
    uint8 public constant decimals = 18;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    constructor(string memory n,string memory s){name=n;symbol=s;}
    function mint(address to,uint256 a) external {balanceOf[to]+=a;totalSupply+=a;}
    function approve(address s,uint256 a) external returns(bool){allowance[msg.sender][s]=a;return true;}
    function transfer(address to,uint256 a) external returns(bool){require(balanceOf[msg.sender]>=a);balanceOf[msg.sender]-=a;balanceOf[to]+=a;return true;}
    function transferFrom(address f,address to,uint256 a) external returns(bool){uint256 x=allowance[f][msg.sender];require(x>=a&&balanceOf[f]>=a);if(x!=type(uint256).max)allowance[f][msg.sender]=x-a;balanceOf[f]-=a;balanceOf[to]+=a;return true;}
}

contract FeeSettlementCaps420 is ICapabilityRegistry420 {
    address public principal;
    function setPrincipal(address p) external {principal=p;}
    function grant(bytes32) external pure override returns(CapabilityGrant memory g){return g;}
    function isAuthorized(address p,bytes32 componentId,bytes32 capabilityId,bytes32,uint256) external view override returns(bool){return p==principal&&componentId==ExchangeIds420.EXCHANGE_ROUTER&&capabilityId==ExchangeIds420.ACTION_SWAP;}
}

contract FeeSettlementOracle420 is IExchangeReferenceOracle420 {
    function referencePrice(bytes32) external view returns(uint256,uint256){return(1e18,block.timestamp);}
}

contract FeeSettlementAdapter420 is IExchangeQuoteAdapter420, IExchangeExecutionAdapter420 {
    address public constant sink=address(0xFEE0);
    function allowanceTarget() external view returns(address){return address(this);}
    function quote(address,address,uint256 a,bytes calldata) external pure override returns(uint256,uint256){return(a,0);}
    function executeSwap(address payer,address recipient,address tokenIn,address tokenOut,uint256 amountIn,uint256 minAmountOut,bytes calldata) external override returns(uint256){require(amountIn>=minAmountOut);require(FeeSettlementToken420(tokenIn).transferFrom(payer,sink,amountIn));require(FeeSettlementToken420(tokenOut).transfer(recipient,amountIn));return amountIn;}
}

contract MockDevelopmentVaultFee420 {
    uint256 public received;
    function contributeToken(address token,bytes32,bytes32,bytes32,uint256 gross,uint16 bps) external {
        uint256 amount=gross*bps/10_000;
        require(FeeSettlementToken420(token).transferFrom(msg.sender,address(this),amount));
        received+=amount;
    }
}

contract ExchangeFeeSettlement420Test {
    bytes32 private constant A_ID=keccak256("fee/A");
    bytes32 private constant B_ID=keccak256("fee/B");
    bytes32 private constant C_ID=keccak256("fee/C");
    bytes32 private constant AB=keccak256("fee/AB");
    bytes32 private constant BC=keccak256("fee/BC");
    bytes32 private constant ROUTE=keccak256("fee/route");
    address private constant PROTOCOL=address(0x1001);
    address private constant DEVELOPMENT=address(0x1002);
    address private constant COMMUNITY=address(0x1003);
    address private constant LIQUIDITY=address(0x1004);

    FeeSettlementToken420 private a;
    FeeSettlementToken420 private b;
    FeeSettlementToken420 private c;
    FeeSettlementCaps420 private caps;
    FeeSettlementOracle420 private refOracle;
    FeeSettlementAdapter420 private adapter;
    MockDevelopmentVaultFee420 private devVault;
    ExchangeAuthorization420 private authorization;
    ExchangeEmergencyControl420 private emergency;
    ExchangeOracleGuard420 private guard;
    ExchangeAssetRegistry420 private assets;
    ExchangeMarketRegistry420 private markets;
    ExchangeRouteRegistry420 private routes;
    ExchangeFeePolicy420 private policy;
    ExchangeFeeRouter420 private feeRouter;
    ExchangeAtomicRouter420 private router;

    constructor(){
        a=new FeeSettlementToken420("A","A");b=new FeeSettlementToken420("B","B");c=new FeeSettlementToken420("C","C");
        caps=new FeeSettlementCaps420();refOracle=new FeeSettlementOracle420();adapter=new FeeSettlementAdapter420();devVault=new MockDevelopmentVaultFee420();
        authorization=new ExchangeAuthorization420(address(caps));emergency=new ExchangeEmergencyControl420(address(this));guard=new ExchangeOracleGuard420(address(this));assets=new ExchangeAssetRegistry420(address(this));markets=new ExchangeMarketRegistry420(address(this),address(assets),C_ID);routes=new ExchangeRouteRegistry420(address(this));policy=new ExchangeFeePolicy420(address(this));feeRouter=new ExchangeFeeRouter420(address(this),address(policy));
        _asset(A_ID,address(a),bytes16("A"));_asset(B_ID,address(b),bytes16("B"));_asset(C_ID,address(c),bytes16("C"));
        markets.configureMarket(AB,A_ID,B_ID,keccak256("AB"),address(adapter),ExchangeTypes420.MarketStatus.ACTIVE,keccak256("AB-meta"));markets.configureMarket(BC,B_ID,C_ID,keccak256("BC"),address(adapter),ExchangeTypes420.MarketStatus.ACTIVE,keccak256("BC-meta"));
        routes.configureRoute(ROUTE,keccak256("420SWAP"),address(adapter),address(adapter),keccak256("fee-route"),true);guard.configureGuard(AB,address(refOracle),1 days,500,true);guard.configureGuard(BC,address(refOracle),1 days,500,true);
        policy.setFeeSplit(ExchangeFeePolicy420.FeeSplit(4000,2000,1500,2000,500));
        policy.setRecipients(ExchangeFeePolicy420.Recipients(PROTOCOL,DEVELOPMENT,COMMUNITY,LIQUIDITY,address(devVault)));
        policy.setExchangeFee(100);
        router=new ExchangeAtomicRouter420(address(markets),address(assets),address(routes),address(authorization),address(emergency),address(guard),address(a),address(feeRouter));
        feeRouter.setCollector(address(router),true);caps.setPrincipal(address(this));
        a.mint(address(this),1000 ether);b.mint(address(adapter),1000 ether);c.mint(address(adapter),1000 ether);a.approve(address(adapter),type(uint256).max);
    }

    function testTwoHopFeeChargedOnceAndFiveWayConserved() public {
        ExchangeAtomicRouter420.Hop[] memory hops=_twoHop();
        bytes32 pathHash=router.hashPath(address(a),100 ether,address(this),hops);
        uint256 beforeC=c.balanceOf(address(this));
        uint256 out=router.swapExactInputPath(address(a),100 ether,99 ether,address(this),pathHash,hops);
        require(out==99 ether,"net output");
        require(c.balanceOf(address(this))-beforeC==99 ether,"recipient net");
        require(c.balanceOf(PROTOCOL)==4e17,"protocol");
        require(c.balanceOf(DEVELOPMENT)==2e17,"development");
        require(c.balanceOf(COMMUNITY)==15e16,"community");
        require(c.balanceOf(LIQUIDITY)==2e17,"liquidity");
        require(devVault.received()==5e16,"developer");
        require(c.balanceOf(address(router))==0,"router residue");
        require(c.balanceOf(address(feeRouter))==0,"fee router residue");
        require(c.allowance(address(router),address(feeRouter))==0,"fee allowance residue");
    }

    function testNetSlippageFloorRollsBackFeeAndTrade() public {
        ExchangeAtomicRouter420.Hop[] memory hops=_twoHop();
        bytes32 pathHash=router.hashPath(address(a),100 ether,address(this),hops);
        uint256 beforeA=a.balanceOf(address(this));
        uint256 beforeProtocol=c.balanceOf(PROTOCOL);
        (bool ok,)=address(router).call(abi.encodeWithSelector(router.swapExactInputPath.selector,address(a),100 ether,995e17,address(this),pathHash,hops));
        require(!ok,"net slippage accepted");
        require(a.balanceOf(address(this))==beforeA,"input not rolled back");
        require(c.balanceOf(PROTOCOL)==beforeProtocol,"fee not rolled back");
    }

    function testRepeatedIdenticalPathGetsUniqueTradeRefs() public {
        ExchangeAtomicRouter420.Hop[] memory hops=_twoHop();
        bytes32 pathHash=router.hashPath(address(a),10 ether,address(this),hops);
        router.swapExactInputPath(address(a),10 ether,99e17,address(this),pathHash,hops);
        router.swapExactInputPath(address(a),10 ether,99e17,address(this),pathHash,hops);
        require(router.tradeNonce()==2,"nonce");
    }

    function _twoHop() private view returns(ExchangeAtomicRouter420.Hop[] memory h){h=new ExchangeAtomicRouter420.Hop[](2);h[0]=ExchangeAtomicRouter420.Hop(AB,ROUTE,address(b),1,"");h[1]=ExchangeAtomicRouter420.Hop(BC,ROUTE,address(c),1,"");}
    function _asset(bytes32 id,address t,bytes16 s) private {assets.configureAsset(id,s,keccak256(abi.encodePacked("chain",id)),keccak256(abi.encodePacked("asset",id)),t,ExchangeTypes420.AssetCategory.OTHER,ExchangeTypes420.AssetStatus.VERIFIED,keccak256(abi.encodePacked("verification",id)),keccak256(abi.encodePacked("metadata",id)));}
}
