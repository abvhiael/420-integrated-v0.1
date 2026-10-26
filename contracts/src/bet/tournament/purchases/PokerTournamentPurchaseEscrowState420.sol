// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./PokerTournamentPurchasePolicies420.sol";
import "../PokerTournamentPurchaseAccounting420.sol";
import "../../../apps/Identity420.sol";
import "../../../revenue/DevelopmentCompensationVault420.sol";
import "../../../interfaces/genesis/ICapabilityRegistryExtended420.sol";

interface IPurchaseTournamentHost420 {
    function escrow()external view returns(address);
    function genuineStartedHand(bytes32,bytes32)external view returns(bool);
    function purchaseRiskAllowed(bytes32)external view returns(bool);
    function purchaseEligibility(bytes32,bytes32,uint8)external view returns(bool,uint32,uint16);
    function acceptPaidRequest(bytes32,uint64)external;
    function discardPaidRequest(bytes32,uint64)external;
    function acceptRebuy(bytes32,uint64)external;
    function acceptAddOn(bytes32,uint64)external;
    function canRefundRequest(bytes32,uint64)external view returns(bool);
    function admittedUniquePlayers(bytes32)external view returns(uint32);
}
interface ITournamentPurchaseAsset420 {
    function balanceOf(address) external view returns(uint256);
    function transferFrom(address,address,uint256) external returns(bool);
    function transfer(address,uint256) external returns(bool);
}

abstract contract PokerTournamentPurchaseEscrowState420 {

    bytes32 public constant DOMAIN=keccak256("420.BET.POKER.TOURNAMENT.PURCHASE.ESCROW.V1");
    bytes32 public constant CREATE=keccak256("BET_POKER_TOURNAMENT_EVENT_CREATE.V1");
    bytes32 public constant ENTER=keccak256("BET_POKER_TOURNAMENT_EVENT_ENTER.V1");
    enum State { NONE, REGISTRATION, DELAYED, STARTING, CANCELLED }
    enum Kind { INITIAL,RE_ENTRY,REBUY,LATE,ADD_ON }
    enum ReceiptStatus { NONE,QUEUED,ACTIVATED,REFUNDED }
    struct Receipt {Kind kind;ReceiptStatus status;uint64 acceptedAt;uint64 readyUntil;uint64 previous;uint32 generation;uint16 level;}
    PokerTournamentPurchasePolicies420 public immutable purchasePolicies;
    mapping(bytes32=>bytes32) public purchasePlan;
    mapping(bytes32=>mapping(uint64=>Receipt)) internal receipts_;
    mapping(bytes32=>mapping(bytes32=>uint64)) public pendingReceipt;
    mapping(bytes32=>mapping(bytes32=>uint64)) public addOnReceipt;
    bytes32 public constant ADD_ON=keccak256("BET_POKER_TOURNAMENT_ADD_ON.V1");
    event C6ReceiptData(bytes encoded);
    struct EventAccount {
        State state; bytes32 policy; bytes32 manifest; address funder; uint64 readyAt;
        uint32 reservedPlayers; uint64 receipts; uint256 prize; uint256 fees; uint256 sponsored;
        uint256 received; uint256 credited;
    }
    struct Entry {
        bytes32 person; bytes32 subject; address payer; uint64 nonce;
        uint256 buyIn; uint256 fee; uint256 chips; bool refunded;
    }
    PokerTournamentPolicyRegistry420 public immutable policies;
    BetAuthorization420 public immutable authorization;
    Identity420 public immutable identities;
    bytes32 public immutable issuer;
    bytes32 public immutable credentialType;
    address public immutable asset;
    address public immutable developmentFund;
    mapping(bytes32=>EventAccount) internal events_;
    mapping(bytes32=>PokerTournamentPolicy420.Config) internal configs;
    mapping(bytes32=>mapping(uint64=>Entry)) internal entries;
    mapping(bytes32=>mapping(bytes32=>uint64)) public activeReceipt;
    mapping(bytes32=>mapping(bytes32=>uint64)) public nonceOf;
    mapping(bytes32=>mapping(uint64=>bytes32)) public receiptCredential;
    mapping(address=>uint256) public credit;
    mapping(bytes32=>mapping(uint256=>uint256)) public capabilitySpend;
    uint256 public totalLiability;
    uint256 public heldPrizes;
    uint256 public heldFees;
    uint256 public totalCredits;
    uint256 public totalReceived;
    uint256 public totalWithdrawn;
    uint256 internal entered;
    address public gameplayHost; bytes32 public hostCodeHash; uint256 public createdEvents;
    mapping(bytes32=>bool) public started;
    bytes32 public constant BIND_HOST=keccak256("BET_POKER_TOURNAMENT_RUNTIME_BIND_HOST.V1");
    bytes32 public constant EXTRA=keccak256("BET_POKER_TOURNAMENT_RUNTIME_EXTRA.V1");
    error Invalid(); error Unauthorized(); error TransferFailed(); error Reentrancy(); error GameplayIntegrationRequired();
    event Created(bytes32 indexed id,bytes32 indexed manifest,bytes32 policy,address funder,uint256 sponsor);
    event Purchased(bytes32 indexed id,uint64 indexed receipt,bytes32 indexed person,bytes32 subject,address payer,
        uint64 nonce,uint256 buyIn,uint256 fee,uint256 chips);
    event StateChanged(bytes32 indexed id,State state,uint64 readyAt);
    event Refunded(bytes32 indexed id,uint64 indexed receipt,address beneficiary,uint256 amount);
    event Withdrawn(address indexed beneficiary,uint256 amount);
    constructor(address purchasePolicies_,address identity_,bytes32 issuer_,bytes32 type_,address devVault_) {
        PokerTournamentPurchasePolicies420 plans=PokerTournamentPurchasePolicies420(purchasePolicies_);address policies_=address(plans.policies());purchasePolicies=plans;
        if(policies_.code.length==0||identity_.code.length==0||devVault_.code.length==0||issuer_==0||type_==0)revert Invalid();
        policies=PokerTournamentPolicyRegistry420(policies_);authorization=policies.authorization();
        identities=Identity420(identity_);issuer=issuer_;credentialType=type_;asset=policies.asset();
        DevelopmentCompensationVault420 vault=DevelopmentCompensationVault420(payable(devVault_));
        if(address(vault.capabilityRegistry())!=address(authorization.capabilityRegistry()))revert Invalid();
        developmentFund=vault.beneficiary();if(developmentFund==address(0)||developmentFund==address(this))revert Invalid();
    }
    modifier guarded(){if(entered!=0)revert Reentrancy();entered=1;_;entered=0;}
    function _scope(bytes32 id) internal view returns(bytes32){return keccak256(abi.encode(DOMAIN,block.chainid,address(this),id));}
    function _eventOf(bytes32 id) internal view returns(EventAccount memory){return events_[id];}
    function _entryOf(bytes32 id,uint64 index) internal view returns(Entry memory){return entries[id][index];}
    function _configOf(bytes32 id) internal view returns(PokerTournamentPolicy420.Config memory){return configs[id];}
    function _quote(bytes32 id) internal view returns(PokerTournamentPurchaseAccounting420.Quote memory){
        if(events_[id].state==State.NONE)revert Invalid();return PokerTournamentPurchaseAccounting420.quote(configs[id].buyIn,configs[id].startingStack);
    }
    function _personKey(bytes32 subject,bytes32 credential,address actor) internal view returns(bytes32) {
        (address controller,,,,,,bool active)=identities.profiles(subject);
        IIdentityCredential420.CredentialView memory c=identities.credential(credential);
        (,,,bytes32 person,,,,)=identities.credentials(credential);
        if(actor==address(0)||controller!=actor||!active||c.subjectId!=subject||c.issuerId!=issuer||
            c.credentialType!=credentialType||person==0||!identities.credentialMeetsTrust(credential,Identity420.TrustClass.VERIFIED))revert Unauthorized();
        return keccak256(abi.encode(issuer,person));
    }
    function _receiptOf(bytes32 id,uint64 index)internal view returns(Receipt memory){return receipts_[id][index];}
    function _newMoney(bytes32 id)internal view{
        PokerTournamentPolicyRegistry420.Record memory r=policies.get(events_[id].policy);
        if(r.status!=PokerTournamentPolicyRegistry420.Status.PUBLISHED||!policies.operators().isActive(r.config.operatorId))revert Unauthorized();
        if(gameplayHost!=address(0)&&(gameplayHost.codehash!=hostCodeHash||!IPurchaseTournamentHost420(gameplayHost).purchaseRiskAllowed(id)))revert Unauthorized();
    }
    function _cap(bytes32 id,bytes32 action,uint256 amount) internal view {
        if(!authorization.isAuthorized(msg.sender,action,_scope(id),amount))revert Unauthorized();
    }
    function _spendCapability(bytes32 id,uint256 amount,bytes32 action) internal {
        ICapabilityRegistryExtended420 registry=ICapabilityRegistryExtended420(address(authorization.capabilityRegistry()));
        bytes32 grantId=registry.activeGrantId(msg.sender,keccak256("420.BET.CORE"),action,_scope(id));
        ICapabilityRegistry420.CapabilityGrant memory g=registry.grant(grantId);
        if(g.periodLimit!=0){
            uint256 period=block.timestamp/g.periodSeconds;
            uint256 used=capabilitySpend[grantId][period]+registry.usage(grantId).used;
            if(used>g.periodLimit||amount>g.periodLimit-used)revert Unauthorized();
            capabilitySpend[grantId][period]+=amount;
        }
    }
    function _credit(bytes32 id,address payer,uint256 amount) internal {
        credit[payer]+=amount;totalCredits+=amount;events_[id].credited+=amount;
    }
    function _receive(uint256 amount) internal {
        ITournamentPurchaseAsset420 t=ITournamentPurchaseAsset420(asset);uint256 before_=t.balanceOf(address(this));uint256 payer=t.balanceOf(msg.sender);
        if(amount!=0&&!t.transferFrom(msg.sender,address(this),amount))revert TransferFailed();
        if(t.balanceOf(address(this))!=before_+amount||t.balanceOf(msg.sender)+amount!=payer)revert TransferFailed();
        totalLiability+=amount;totalReceived+=amount;_solvent();
    }
    function _solvent() internal view {
        if(ITournamentPurchaseAsset420(asset).balanceOf(address(this))<totalLiability||
            totalLiability!=heldPrizes+heldFees+totalCredits||totalReceived!=totalWithdrawn+totalLiability)revert Invalid();
    }
    function _host() internal view {if(msg.sender!=gameplayHost||msg.sender.codehash!=hostCodeHash)revert Unauthorized();}
    function _emitReceipt(bytes32 id,uint64 index)internal{
        Entry storage x=entries[id][index];Receipt storage r=receipts_[id][index];emit C6ReceiptData(abi.encode(id,index,uint8(r.kind),uint8(r.status),x.person,x.payer,x.nonce,x.buyIn,x.fee,x.chips,r.acceptedAt,r.readyUntil,r.previous));
    }
}
