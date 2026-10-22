// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./PokerConfidentialDeal420.sol";

/// @notice Segregated, fully funded provider performance bonds. Each provider
/// posts 100% of the locked table escrow for EVERY concurrently accepted hand.
/// No player chip is collateral and no unbonded hand can start.
/// The canonical native engine exclusively closes bonds after ledger finality.
/// Slashing pays a frozen risk-compensation destination, never an operator.
contract PokerProviderAccountability420 {
    PokerConfidentialDeal420 public immutable deals;
    PokerSeatLedger420 public immutable ledger;
    address public immutable nativeEngine;
    address public immutable riskCompensation;
    uint256 private entered;
    struct Bond {
        bytes32 tableId;
        address asset;
        uint256 each;
        bool locked;
        bool closed;
        uint8 faultMask;
    }
    mapping(bytes32=>Bond) public bonds;
    mapping(address=>mapping(address=>uint256)) public available;
    error InvalidState();error Unauthorized();error TransferFailed();error BalanceDelta();error Reentrancy();
    event ProviderBondFunded(address indexed provider,address indexed asset,uint256 amount);
    event ProviderBondLocked(bytes32 indexed handId,uint256 perProvider,address asset);
    event ProviderBondClosed(bytes32 indexed handId,uint8 faultMask,uint256 slashed);
    constructor(address deals_,address engine_,address riskFund_){
        if(deals_==address(0)||engine_==address(0)||engine_.code.length==0||
           riskFund_==address(0))revert InvalidState();
        deals=PokerConfidentialDeal420(deals_);
        ledger=deals.ledger();
        nativeEngine=engine_;
        riskCompensation=riskFund_;
    }
    modifier guarded(){
        if(entered!=0)revert Reentrancy();
        entered=1;_;entered=0;
    }
    function _provider(address user)private view returns(bool){
        return user==deals.providerA()||user==deals.providerB();
    }
    function _token(bytes32 tableId)private view returns(address){
        return deals.tables().getTable(tableId).config.asset;
    }
    // Exact custody delta is deliberate. Every external entry is guarded,
    // and callback regressions are mandatory on the qualifying SHA.
    // slither-disable-start reentrancy-balance
    function fund(bytes32 tableId,uint256 amount) external guarded {
        _fund(_token(tableId),amount);
    }
    function fundAsset(address asset,uint256 amount)external guarded{
        _fund(asset,amount);
    }
    function _fund(address asset,uint256 amount)private {
        if(!_provider(msg.sender)||amount==0||asset==address(0)||asset.code.length==0)
            revert Unauthorized();
        IPokerToken420 token=IPokerToken420(asset);
        uint256 beforeBal=token.balanceOf(address(this));
        if(!token.transferFrom(msg.sender,address(this),amount))revert TransferFailed();
        uint256 afterBal=token.balanceOf(address(this));
        if(afterBal<beforeBal||afterBal-beforeBal!=amount)revert BalanceDelta();
        available[asset][msg.sender]+=amount;
        emit ProviderBondFunded(msg.sender,asset,amount);
    }
    // slither-disable-end reentrancy-balance
    function withdraw(address asset,uint256 amount)external guarded{
        if(!_provider(msg.sender)||amount==0||available[asset][msg.sender]<amount)
            revert Unauthorized();
        available[asset][msg.sender]-=amount;
        if(!IPokerToken420(asset).transfer(msg.sender,amount))revert TransferFailed();
    }
    function lock(bytes32 handId)external guarded {
        if(msg.sender!=nativeEngine)revert Unauthorized();
        PokerConfidentialDeal420.Hand memory h=deals.getHand(handId);
        if(bonds[handId].locked||bonds[handId].closed||
           ledger.activeHand(h.tableId)!=handId||
           ledger.lockedSnapshot(h.tableId)==bytes32(0))revert InvalidState();
        uint256 required=ledger.lockedTotal(h.tableId);
        address asset=_token(h.tableId);
        address a=deals.providerA();address b=deals.providerB();
        if(required==0||available[asset][a]<required||available[asset][b]<required)
            revert InvalidState();
        available[asset][a]-=required;available[asset][b]-=required;
        bonds[handId]=Bond(h.tableId,asset,required,true,false,0);
        emit ProviderBondLocked(handId,required,asset);
    }
    function isCollateralized(bytes32 handId)external view returns(bool){
        Bond memory b=bonds[handId];
        return b.locked&&!b.closed&&b.each!=0;
    }
    /// @notice Native engine supplies an OBJECTIVELY computed two-bit fault mask
    /// after canonical ledger consumption. Nonfaulted providers recover bonds;
    /// faulted provider coverage is sent to the immutable compensation address.
    function close(bytes32 handId,uint8 faultMask)external guarded{
        if(msg.sender!=nativeEngine||faultMask>3)revert Unauthorized();
        Bond storage b=bonds[handId];
        if(!b.locked||b.closed||!ledger.handConsumed(handId))revert InvalidState();
        b.closed=true;b.locked=false;b.faultMask=faultMask;
        address a=deals.providerA();address providerB=deals.providerB();
        uint256 slash=0;
        if((faultMask&1)!=0)slash+=b.each;
        else available[b.asset][a]+=b.each;
        if((faultMask&2)!=0)slash+=b.each;
        else available[b.asset][providerB]+=b.each;
        if(slash!=0&&!IPokerToken420(b.asset).transfer(riskCompensation,slash))
            revert TransferFailed();
        emit ProviderBondClosed(handId,faultMask,slash);
    }
}
