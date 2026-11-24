// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../src/bet/BetCasinoProfitAccounting420.sol";
import "../src/system/CapabilityRegistry420.sol";

interface VmProfit420 {
    function deal(address,uint256) external;
    function prank(address) external;
    function expectRevert(bytes4) external;
}
contract BetProfitAccounting420Test {
    VmProfit420 constant vm = VmProfit420(address(uint160(uint256(keccak256("hevm cheat code")))));
    CapabilityRegistry420 caps;
    BetAuthorization420 auth;
    VaultAccounting420 accounting;
    BankrollVault420 v1;
    BankrollVault420 v2;
    BetEconomics420 economics;
    BetProfitAccounting420 p1;
    BetProfitAccounting420 p2;
    BetCasinoProfitAccounting420 casino;
    bytes32 constant GAME = keccak256("profit-game");
    bytes32 constant OP = keccak256("profit-operator");
    address constant PLAYER = address(0x1234);
    address constant PROTOCOL = address(0x5678);
    address constant OPERATOR = address(0x9012);
    uint256 nonce;
    receive() external payable {}
    function grant(address who,bytes32 action,bytes32 scope) private {
        caps.createGrant(keccak256(abi.encode(++nonce)),who,BetIds420.COMPONENT_BET,action,scope,type(uint128).max,0,0,0,0);
    }
    function makeVault(bytes32 id) private returns(BankrollVault420 v) {
        v = new BankrollVault420(id,address(0),address(auth),address(accounting),address(new WithdrawalQueue420(address(auth))),0);
        bytes32 scope = auth.scopeForVault(id);
        grant(address(this),BetIds420.ACTION_VAULT_REGISTER,scope);
        accounting.registerVault(id,address(0));
        grant(address(this),BetIds420.ACTION_LP_DEPOSIT,scope);
        grant(address(v),BetIds420.ACTION_VAULT_RECORD_DEPOSIT,scope);
        grant(address(this),BetIds420.ACTION_VAULT_ESCROW_STAKE,scope);
        grant(address(this),BetIds420.ACTION_VAULT_SETTLE_WAGER,scope);
        grant(address(v),BetIds420.ACTION_VAULT_SETTLE_WAGER,scope);
        v.depositNative{value:1000 ether}();
    }
    function setUp() public {
        vm.deal(address(this),100000 ether);
        caps = new CapabilityRegistry420();
        caps.registerProtocolComponent(BetIds420.COMPONENT_BET,address(this));
        auth = new BetAuthorization420(address(caps));
        accounting = new VaultAccounting420(address(auth));
        v1 = makeVault(keccak256("v1"));
        v2 = makeVault(keccak256("v2"));
        p1 = new BetProfitAccounting420(address(v1),address(0));
        p2 = new BetProfitAccounting420(address(v2),address(0));
        BetOperatorRegistry420 ops = new BetOperatorRegistry420(address(auth));
        grant(address(this),BetIds420.ACTION_OPERATOR_REGISTER,auth.scopeForOperator(OP));
        ops.registerOperator(OP,OPERATOR,OP);
        economics = new BetEconomics420(address(auth),address(ops),address(0));
        grant(address(this),BetIds420.ACTION_ECONOMICS_CONFIGURE,auth.scopeForGameVersion(GAME));
        economics.configureFeeSchedule(BetEconomics420.FeeSchedule(GAME,GAME,100,200,PROTOCOL,GAME,false));
        grant(address(this),BetIds420.ACTION_ECONOMICS_FUND,auth.scopeForAsset(address(0)));
        grant(address(this),BetIds420.ACTION_ECONOMICS_BIND,auth.scopeForGameVersion(GAME));
        grant(address(this),BetIds420.ACTION_ECONOMICS_FINALIZE,auth.scopeForGameVersion(GAME));
        grant(address(this),BetIds420.ACTION_REWARD_ACCRUE,auth.scopeGlobal());
        grant(address(this),BetIds420.ACTION_PROMOTION_GRANT,auth.scopeGlobal());
        economics.fundFees{value:100 ether}(100 ether);
        economics.fundRewards{value:50 ether}(50 ether);
        economics.fundPromotions{value:30 ether}(30 ether);
        BetProfitAccounting420[] memory v = new BetProfitAccounting420[](2);
        v[0]=p1; v[1]=p2;
        BetEconomics420[] memory e = new BetEconomics420[](1);
        e[0]=economics;
        casino = new BetCasinoProfitAccounting420(address(0),v,e);
    }
    function settle(BankrollVault420 v,bytes32 id,uint256 stake,uint256 payout) private {
        v.escrowWagerStakeNative{value:stake}(id,PLAYER);
        v.resolveWager(id,payout);
    }
    function testCrossVaultNettingAndPrincipal() public {
        settle(v1,keccak256("loss"),100 ether,0);
        settle(v2,keccak256("win"),100 ether,150 ether);
        BetCasinoProfitAccounting420.Report memory r=casino.report();
        require(r.reconciled && r.gamingResult==50 ether && r.deposits==2000 ether,"net");
        require(r.wagers==200 ether && r.payouts==150 ether && r.lpEquity==2050 ether,"equity");
        require(r.otherLpEquity==r.lpEquity && r.eligibleRevenue==0,"protected");
    }
    function testRefundAndReplay() public {
        bytes32 id=keccak256("refund");
        settle(v1,id,10 ether,10 ether);
        require(!p1.report().reconciled,"unclassified");
        vm.prank(PLAYER);
        vm.expectRevert(BankrollVault420.Unauthorized.selector);
        v1.classifyEqualReturn(id,true);
        v1.classifyEqualReturn(id,true);
        require(p1.report().reconciled && p1.report().refunds==10 ether,"refund");
        vm.expectRevert(BankrollVault420.InvalidAmount.selector);
        v1.classifyEqualReturn(id,true);
        vm.expectRevert(BankrollVault420.StakeAlreadyEscrowed.selector);
        v1.escrowWagerStakeNative{value:1}(id,PLAYER);
    }
    function testFeesAndExpenses() public {
        bytes32 id=keccak256("fee");
        economics.bindWager(id,GAME,OP,100 ether);
        economics.finalizeWagerFees(id,BetTypes420.TerminalOutcome.LOSS);
        economics.accrueReward(id,PLAYER,10 ether,uint64(block.timestamp+1 days),1,GAME);
        vm.prank(PLAYER); economics.claim(id);
        economics.grantPromotion(keccak256("promo"),PLAYER,5 ether,uint64(block.timestamp+1 days),1,GAME);
        BetCasinoProfitAccounting420.Report memory r=casino.report();
        require(r.reconciled && r.protocolFees==1 ether && r.operatorFees==2 ether,"fees");
        require(r.feeObligations==3 ether && r.paidExpenses==10 ether && r.outstandingExpenses==5 ether,"expenses");
        require(r.eligibleRevenue==0,"funding is not revenue");
    }
    function testDuplicateSourceRejected() public {
        BetProfitAccounting420[] memory v=new BetProfitAccounting420[](2);
        v[0]=p1; v[1]=new BetProfitAccounting420(address(v1),address(0));
        BetEconomics420[] memory e=new BetEconomics420[](0);
        vm.expectRevert(BetCasinoProfitAccounting420.InvalidInventory.selector);
        new BetCasinoProfitAccounting420(address(0),v,e);
    }
    function testAssetMismatchRejected() public {
        BetProfitAccounting420[] memory v=new BetProfitAccounting420[](1);v[0]=p1;
        BetEconomics420[] memory e=new BetEconomics420[](0);
        vm.expectRevert(BetCasinoProfitAccounting420.InvalidInventory.selector);
        new BetCasinoProfitAccounting420(address(1),v,e);
    }
    function testCustodyMismatchFailsClosed() public {
        vm.deal(address(v1),1001 ether);
        require(!casino.report().reconciled && casino.report().eligibleRevenue==0,"unbacked");
    }
    function testEscrowNeverRevenue() public {
        v1.escrowWagerStakeNative{value:10 ether}(GAME,PLAYER);
        BetCasinoProfitAccounting420.Report memory r=casino.report();
        require(r.reconciled && r.escrow==10 ether && r.wagers==0 && r.gamingResult==0,"escrow");
    }
    function testFuzzSettlementConservation(uint96 a,uint96 b) public {
        uint256 stake=uint256(a)%100 ether+1;
        uint256 payout=uint256(b)%200 ether;
        settle(v1,GAME,stake,payout);
        if(stake==payout) v1.classifyEqualReturn(GAME,false);
        BetProfitAccounting420.Report memory r=p1.report();
        require(r.reconciled && r.gamingResult==int256(stake)-int256(payout),"pnl");
        require(r.assets==1000 ether+stake-payout && r.eligibleRevenue==0,"assets");
    }
    function invariant_ProtectedCapitalAndFunding() public view {
        BetCasinoProfitAccounting420.Report memory r=casino.report();
        require(r.reconciled && r.eligibleRevenue==0,"conservation");
        require(r.lpEquity==r.genesisEquity+r.otherLpEquity,"LP equity");
    }
}
