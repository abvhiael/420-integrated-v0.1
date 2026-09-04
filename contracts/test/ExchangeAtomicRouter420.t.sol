// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/exchange/ExchangeAtomicRouter420.sol";
import "../src/exchange/ExchangeIds420.sol";
import "../src/interfaces/genesis/ICapabilityRegistry420.sol";

contract MockAtomicToken420 {
    string public name;
    string public symbol;
    uint8 public constant decimals = 18;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    constructor(string memory n, string memory s) { name = n; symbol = s; }
    function mint(address to, uint256 a) external { balanceOf[to] += a; totalSupply += a; }
    function approve(address s, uint256 a) external returns (bool) { allowance[msg.sender][s] = a; return true; }
    function transfer(address to, uint256 a) external returns (bool) { require(balanceOf[msg.sender] >= a); balanceOf[msg.sender] -= a; balanceOf[to] += a; return true; }
    function transferFrom(address f, address t, uint256 a) external returns (bool) { uint256 x=allowance[f][msg.sender]; require(x>=a && balanceOf[f]>=a); if(x!=type(uint256).max) allowance[f][msg.sender]=x-a; balanceOf[f]-=a; balanceOf[t]+=a; return true; }
}

contract MockAtomicCapabilityRegistry420 is ICapabilityRegistry420 {
    address public principal; bool public enabled = true;
    function setPrincipal(address p) external { principal=p; }
    function setEnabled(bool e) external { enabled=e; }
    function grant(bytes32) external pure override returns (CapabilityGrant memory g) { return g; }
    function isAuthorized(address p, bytes32 c, bytes32 cap, bytes32, uint256 a) external view override returns (bool) {
        return enabled && p==principal && c==ExchangeIds420.EXCHANGE_ROUTER && cap==ExchangeIds420.ACTION_SWAP && a<=1_000 ether;
    }
}

contract MockAtomicReferenceOracle420 is IExchangeReferenceOracle420 {
    struct Observation { uint256 priceE18; uint256 updatedAt; }
    mapping(bytes32 => Observation) public observations;
    function set(bytes32 m,uint256 p,uint256 t) external { observations[m]=Observation(p,t); }
    function referencePrice(bytes32 m) external view returns(uint256,uint256){ Observation memory o=observations[m]; return(o.priceE18,o.updatedAt); }
}

contract MockAtomicExecutionAdapter420 is IExchangeQuoteAdapter420, IExchangeExecutionAdapter420 {
    address public immutable sink = address(0xdead);
    function allowanceTarget() external view returns(address){return address(this);}    
    function quote(address,address,uint256 a,bytes calldata) external pure override returns(uint256,uint256){return(a,0);}    
    function executeSwap(address payer,address recipient,address tokenIn,address tokenOut,uint256 amountIn,uint256 minAmountOut,bytes calldata) external override returns(uint256){
        require(amountIn>=minAmountOut); require(MockAtomicToken420(tokenIn).transferFrom(payer,sink,amountIn)); require(MockAtomicToken420(tokenOut).transfer(recipient,amountIn)); return amountIn;
    }
}

contract ExchangeAtomicRouter420Test {
    bytes32 private constant A_ID=keccak256("420/exchange/atomic/A");
    bytes32 private constant B_ID=keccak256("420/exchange/atomic/B");
    bytes32 private constant C_ID=keccak256("420/exchange/atomic/C");
    bytes32 private constant AB=keccak256("420/exchange/atomic/AB");
    bytes32 private constant BC=keccak256("420/exchange/atomic/BC");
    bytes32 private constant ROUTE=keccak256("420/exchange/atomic/route");
    MockAtomicCapabilityRegistry420 caps; MockAtomicReferenceOracle420 refOracle; ExchangeAuthorization420 auth; ExchangeEmergencyControl420 emergency; ExchangeOracleGuard420 guard; ExchangeAssetRegistry420 assets; ExchangeMarketRegistry420 markets; ExchangeRouteRegistry420 routes; ExchangeAtomicRouter420 router; MockAtomicExecutionAdapter420 adapter; MockAtomicToken420 a; MockAtomicToken420 b; MockAtomicToken420 c;

    constructor(){
        caps=new MockAtomicCapabilityRegistry420(); refOracle=new MockAtomicReferenceOracle420(); auth=new ExchangeAuthorization420(address(caps)); emergency=new ExchangeEmergencyControl420(address(this)); guard=new ExchangeOracleGuard420(address(this)); assets=new ExchangeAssetRegistry420(address(this)); markets=new ExchangeMarketRegistry420(address(this),address(assets),C_ID); routes=new ExchangeRouteRegistry420(address(this)); adapter=new MockAtomicExecutionAdapter420(); a=new MockAtomicToken420("A","A"); b=new MockAtomicToken420("B","B"); c=new MockAtomicToken420("C","C");
        _asset(A_ID,address(a),bytes16("A")); _asset(B_ID,address(b),bytes16("B")); _asset(C_ID,address(c),bytes16("C"));
        markets.configureMarket(AB,A_ID,B_ID,keccak256("AB-canonical"),address(adapter),ExchangeTypes420.MarketStatus.ACTIVE,keccak256("AB-metadata"));
        markets.configureMarket(BC,B_ID,C_ID,keccak256("BC-canonical"),address(adapter),ExchangeTypes420.MarketStatus.ACTIVE,keccak256("BC-metadata"));
        routes.configureRoute(ROUTE,keccak256("420SWAP"),address(adapter),address(adapter),keccak256("atomic-route"),true);
        refOracle.set(AB,1e18,block.timestamp); refOracle.set(BC,1e18,block.timestamp); guard.configureGuard(AB,address(refOracle),1 days,500,true); guard.configureGuard(BC,address(refOracle),1 days,500,true);
        router=new ExchangeAtomicRouter420(address(markets),address(assets),address(routes),address(auth),address(emergency),address(guard),address(a)); caps.setPrincipal(address(this));
        a.mint(address(this),1_000 ether); b.mint(address(adapter),10_000 ether); c.mint(address(adapter),10_000 ether); a.approve(address(adapter),type(uint256).max);
    }

    function testExecutesTwoHopPathAtomically() public { ExchangeAtomicRouter420.Hop[] memory h=_path(); bytes32 ph=router.hashPath(address(a),100 ether,address(this),h); uint256 before=c.balanceOf(address(this)); uint256 out=router.swapExactInputPath(address(a),100 ether,95 ether,address(this),ph,h); require(out==100 ether && c.balanceOf(address(this))-before==100 ether); require(b.balanceOf(address(router))==0); require(b.allowance(address(router),address(adapter))==0); }
    function testRejectsPathHashMismatch() public { ExchangeAtomicRouter420.Hop[] memory h=_path(); (bool ok,)=address(router).call(abi.encodeWithSelector(router.swapExactInputPath.selector,address(a),100 ether,95 ether,address(this),bytes32(uint256(123)),h)); require(!ok); }
    function testRejectsUnauthorizedHop() public { ExchangeAtomicRouter420.Hop[] memory h=_path(); bytes32 ph=router.hashPath(address(a),100 ether,address(this),h); caps.setEnabled(false); (bool ok,)=address(router).call(abi.encodeWithSelector(router.swapExactInputPath.selector,address(a),100 ether,95 ether,address(this),ph,h)); require(!ok); caps.setEnabled(true); }
    function testEmergencyHaltFailsClosed() public { ExchangeAtomicRouter420.Hop[] memory h=_path(); bytes32 ph=router.hashPath(address(a),100 ether,address(this),h); emergency.setHalt(ExchangeEmergencyControl420.Domain.SWAPS,true,keccak256("incident")); (bool ok,)=address(router).call(abi.encodeWithSelector(router.swapExactInputPath.selector,address(a),100 ether,95 ether,address(this),ph,h)); require(!ok); emergency.setHalt(ExchangeEmergencyControl420.Domain.SWAPS,false,bytes32(0)); }
    function testOracleDeviationFailsClosedAndRollsBack() public { ExchangeAtomicRouter420.Hop[] memory h=_path(); bytes32 ph=router.hashPath(address(a),100 ether,address(this),h); uint256 before=a.balanceOf(address(this)); refOracle.set(AB,2e18,block.timestamp); (bool ok,)=address(router).call(abi.encodeWithSelector(router.swapExactInputPath.selector,address(a),100 ether,95 ether,address(this),ph,h)); require(!ok && a.balanceOf(address(this))==before); refOracle.set(AB,1e18,block.timestamp); }
    function _path() private view returns(ExchangeAtomicRouter420.Hop[] memory h){ h=new ExchangeAtomicRouter420.Hop[](2); h[0]=ExchangeAtomicRouter420.Hop(AB,ROUTE,address(b),95 ether,""); h[1]=ExchangeAtomicRouter420.Hop(BC,ROUTE,address(c),95 ether,""); }
    function _asset(bytes32 id,address t,bytes16 s) private { assets.configureAsset(id,s,keccak256(abi.encodePacked("chain",id)),keccak256(abi.encodePacked("asset",id)),t,ExchangeTypes420.AssetCategory.OTHER,ExchangeTypes420.AssetStatus.VERIFIED,keccak256(abi.encodePacked("verification",id)),keccak256(abi.encodePacked("metadata",id))); }
}
