// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/pay/RefundManager420.sol";
import "../src/pay/PaymentRegistry420.sol";
import "./helpers/GenesisMocks420.sol";

interface VmRefundFunding420 {
    function deal(address who,uint256 amount) external;
    function expectRevert() external;
}
contract RefundedPaymentLedgerMock420 {
    address public payer;
    address public settlementAsset;
    uint256 public maximum;
    uint256 public authorized;
    uint8 public status;
    function set(address p,address asset,uint256 max,uint256 a,uint8 s) external {
        payer=p;settlementAsset=asset;maximum=max;authorized=a;status=s;
    }
    function refundAccounting(bytes32) external view returns(address,address,uint256,uint256,uint8) {
        return(payer,settlementAsset,maximum,authorized,status);
    }
}
contract RefundFundingTokenMock420 {
    mapping(address=>uint256) public balanceOf;
    mapping(address=>mapping(address=>uint256)) public allowance;
    bool public failPayout;
    function mint(address to,uint256 amount) external {balanceOf[to]+=amount;}
    function approve(address spender,uint256 amount) external returns(bool){allowance[msg.sender][spender]=amount;return true;}
    function transferFrom(address sender,address receiver,uint256 amount) external returns(bool) {
        require(allowance[sender][msg.sender]>=amount && balanceOf[sender]>=amount,"funds");
        allowance[sender][msg.sender]-=amount;balanceOf[sender]-=amount;balanceOf[receiver]+=amount;return true;
    }
    function transfer(address receiver,uint256 amount) external returns(bool) {
        if(failPayout)return false;
        require(balanceOf[msg.sender]>=amount,"funds");
        balanceOf[msg.sender]-=amount;balanceOf[receiver]+=amount;return true;
    }
    function fail(bool value) external {failPayout=value;}
}
contract RefundUntrustedCaller420 {
    function attempt(RefundManager420 manager, bytes32 paymentId, address asset, uint256 amount) external returns(bool) {
        (bool ok,)=address(manager).call(abi.encodeWithSelector(manager.fundAuthorizedRefund.selector,paymentId,asset,amount));
        return ok;
    }
    function cancel(RefundManager420 manager,bytes32 paymentId,address asset,uint256 amount) external returns(bool) {
        (bool ok,)=address(manager).call(abi.encodeWithSelector(manager.cancelAuthorizedRefundFunding.selector,paymentId,asset,amount));
        return ok;
    }
    function execute(RefundManager420 manager,bytes32 paymentId,address asset,address payer,uint256 amount) external returns(bool) {
        (bool ok,)=address(manager).call(abi.encodeWithSelector(manager.executeFundedRefund.selector,keccak256("untrusted-refund"),paymentId,asset,payer,amount,uint256(100),bytes32(0)));
        return ok;
    }
}
contract RefundManager420FundedTest {
    VmRefundFunding420 internal constant vm=VmRefundFunding420(address(uint160(uint256(keccak256("hevm cheat code")))));
    address internal constant BUYER=address(0xBEEF);
    bytes32 internal constant PAYMENT=keccak256("funded-payment");
    bytes32 internal constant REFUND=keccak256("funded-refund");
    function setUpFixture() internal returns(RefundManager420 manager,RefundedPaymentLedgerMock420 ledger,RefundFundingTokenMock420 token) {
        GenesisMockEnvironment420 env=new GenesisMockEnvironment420();
        manager=new RefundManager420(address(this),address(env.registry()),keccak256("funded-refund-suite"));
        ledger=new RefundedPaymentLedgerMock420();
        token=new RefundFundingTokenMock420();
        env.registerResident(address(manager),manager.componentId());
        env.setSettlementAsset(address(token),keccak256("TESTASSET"),true);
        manager.setPaymentRegistry(address(ledger));
        ledger.set(BUYER,address(token),100,60,7);
        token.mint(address(this),100);
        token.approve(address(manager),100);
    }
    function testFundedRefundPaysBuyerOnceAndPreservesCanonicalTotals() public {
        (RefundManager420 m,,RefundFundingTokenMock420 token)=setUpFixture();
        m.fundAuthorizedRefund(PAYMENT,address(token),60);
        require(token.balanceOf(address(m))==60,"escrow not funded");
        m.executeFundedRefund(REFUND,PAYMENT,address(token),BUYER,60,100,keccak256("reason"));
        require(token.balanceOf(BUYER)==60,"funds not returned");
        require(m.refundedByPayment(PAYMENT)==60,"canonical amount mismatch");
        require(m.authorizedRefundEscrow(PAYMENT)==0,"escrow not consumed");
        require(m.fundedRefundExecuted(REFUND),"refund not proven executed");
        vm.expectRevert();
        m.executeFundedRefund(REFUND,PAYMENT,address(token),BUYER,60,100,keccak256("reason"));
    }
    function testCannotPayBeforeFundingOrBeyondGovernanceAuthorization() public {
        (RefundManager420 m,,RefundFundingTokenMock420 token)=setUpFixture();
        vm.expectRevert();
        m.executeFundedRefund(REFUND,PAYMENT,address(token),BUYER,1,100,bytes32(0));
        vm.expectRevert();
        m.fundAuthorizedRefund(PAYMENT,address(token),61);
        m.fundAuthorizedRefund(PAYMENT,address(token),40);
        vm.expectRevert();
        m.executeFundedRefund(REFUND,PAYMENT,address(token),BUYER,41,100,bytes32(0));
        require(token.balanceOf(BUYER)==0,"unapproved funds sent");
    }
    function testTransferFailureRollsBackAccountingAndEscrow() public {
        (RefundManager420 m,,RefundFundingTokenMock420 token)=setUpFixture();
        m.fundAuthorizedRefund(PAYMENT,address(token),20);
        token.fail(true);
        vm.expectRevert();
        m.executeFundedRefund(REFUND,PAYMENT,address(token),BUYER,20,100,bytes32(0));
        require(m.authorizedRefundEscrow(PAYMENT)==20,"escrow corrupted");
        require(m.refundedByPayment(PAYMENT)==0,"phantom accounting");
        require(!m.fundedRefundExecuted(REFUND),"phantom payout");
        token.fail(false);
        m.executeFundedRefund(REFUND,PAYMENT,address(token),BUYER,20,100,bytes32(0));
        require(token.balanceOf(BUYER)==20,"retry did not pay");
    }
    function testWrongRecipientAndAssetNeverPaid() public {
        (RefundManager420 m,,RefundFundingTokenMock420 token)=setUpFixture();
        m.fundAuthorizedRefund(PAYMENT,address(token),20);
        vm.expectRevert();
        m.executeFundedRefund(REFUND,PAYMENT,address(token),address(0xDEAD),20,100,bytes32(0));
        vm.expectRevert();
        m.executeFundedRefund(REFUND,PAYMENT,address(0xCAFE),BUYER,20,100,bytes32(0));
        require(m.authorizedRefundEscrow(PAYMENT)==20 && m.refundedByPayment(PAYMENT)==0,"corrupt after reject");
    }
    function testGovernanceUnwindsUnusedEscrowToOriginalFundingCaller() public {
        (RefundManager420 m,,RefundFundingTokenMock420 token)=setUpFixture();
        m.fundAuthorizedRefund(PAYMENT,address(token),40);
        m.cancelAuthorizedRefundFunding(PAYMENT,address(token),10);
        require(m.authorizedRefundEscrow(PAYMENT)==30,"unwind escrow mismatch");
        require(token.balanceOf(address(this))==70,"governance funding not returned");
        m.executeFundedRefund(REFUND,PAYMENT,address(token),BUYER,30,100,bytes32(0));
        require(token.balanceOf(BUYER)==30,"remaining refund not returned");
    }
    function testNonGovernanceCannotFundOrExecuteOrCancel() public {
        (RefundManager420 m,,RefundFundingTokenMock420 token)=setUpFixture();
        RefundUntrustedCaller420 attacker=new RefundUntrustedCaller420();
        require(!attacker.attempt(m,PAYMENT,address(token),1),"non governance funded");
        m.fundAuthorizedRefund(PAYMENT,address(token),20);
        require(!attacker.cancel(m,PAYMENT,address(token),1),"unauthorized cancel");
        require(!attacker.execute(m,PAYMENT,address(token),BUYER,1),"unauthorized payout");
        require(m.authorizedRefundEscrow(PAYMENT)==20,"escrow changed");
    }

}

contract RefundManager420NativeFundedTest {
    VmRefundFunding420 internal constant vm = VmRefundFunding420(address(uint160(uint256(keccak256("hevm cheat code")))));
    address internal constant PAYER=address(0xBEEF);
    bytes32 internal constant PAYMENT=keccak256("native-refund-payment");
    receive() external payable {}
    function testNativeGovernanceFundedRefundActuallyReturnsCoin() public {
        GenesisMockEnvironment420 env=new GenesisMockEnvironment420();
        RefundManager420 m=new RefundManager420(address(this),address(env.registry()),keccak256("native-refund"));
        RefundedPaymentLedgerMock420 ledger=new RefundedPaymentLedgerMock420();
        env.registerResident(address(m),m.componentId());
        env.setSettlementAsset(address(0),keccak256("CANONICAL-NATIVE"),true);
        m.setPaymentRegistry(address(ledger));
        ledger.set(PAYER,address(0),1 ether,1 ether,6);
        vm.deal(address(this),2 ether);
        m.fundAuthorizedRefund{value:1 ether}(PAYMENT,address(0),1 ether);
        require(address(m).balance==1 ether,"native escrow missing");
        m.executeFundedRefund(keccak256("native-refund-id"),PAYMENT,address(0),PAYER,1 ether,1 ether,bytes32(0));
        require(PAYER.balance==1 ether,"native payment not returned");
        require(address(m).balance==0 && m.refundedByPayment(PAYMENT)==1 ether,"native refund accounting");
    }
}

contract RefundManager420RealRegistryIntegrationTest {
    VmRefundFunding420 internal constant vm=VmRefundFunding420(address(uint160(uint256(keccak256("hevm cheat code")))));
    bytes32 internal constant INVOICE=keccak256("verified-merchant-invoice");
    bytes32 internal constant REFUND=keccak256("governed-real-refund");
    function _setup() internal returns(PaymentRegistry420 payments,RefundManager420 refunds,RefundFundingTokenMock420 token) {
        GenesisMockEnvironment420 env=new GenesisMockEnvironment420();
        bytes32 cfg=keccak256("real-registry-funded-refund");
        payments=new PaymentRegistry420(address(this),address(env.registry()),cfg);
        refunds=new RefundManager420(address(this),address(env.registry()),cfg);
        token=new RefundFundingTokenMock420();
        env.registerResident(address(payments),payments.componentId());
        env.registerResident(address(refunds),refunds.componentId());
        env.setSettlementAsset(address(token),keccak256("INTEGRATION-ASSET"),true);
        refunds.setPaymentRegistry(address(payments));
        token.mint(address(this),100);
        token.approve(address(refunds),100);
    }
    function testGovernedRegistryAuthorizationFundsAndTransfersExactlyOnce() public {
        (PaymentRegistry420 payments,RefundManager420 refunds,RefundFundingTokenMock420 token)=_setup();
        bytes32 paymentId=payments.createPayment(INVOICE,address(this),address(0xCAFE),address(token),100,address(token),100,bytes32(0),1);
        payments.recordFinalized(paymentId,INVOICE,keccak256("receipt"),address(token),100,0);
        payments.applyRefund(paymentId,60,false);
        refunds.fundAuthorizedRefund(paymentId,address(token),60);
        refunds.executeFundedRefund(REFUND,paymentId,address(token),address(this),60,100,keccak256("refund reason"));
        require(refunds.fundedRefundExecuted(REFUND) && refunds.refundedByPayment(paymentId)==60,"Pay payout not reconciled");
        require(token.balanceOf(address(this))==100 && token.balanceOf(address(refunds))==0,"actual return missing");
        vm.expectRevert();
        refunds.executeFundedRefund(REFUND,paymentId,address(token),address(this),60,100,bytes32(0));
    }
}
