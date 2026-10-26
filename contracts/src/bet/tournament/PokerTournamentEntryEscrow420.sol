// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./PokerTournamentPolicyRegistry420.sol";
import "./PokerTournamentPurchaseAccounting420.sol";
import "../../apps/Identity420.sol";
import "../../revenue/DevelopmentCompensationVault420.sol";
import "../../interfaces/genesis/ICapabilityRegistryExtended420.sol";

interface ITournamentAsset420 {
    function balanceOf(address) external view returns(uint256);
    function transferFrom(address,address,uint256) external returns(bool);
    function transfer(address,uint256) external returns(bool);
}

/// @notice Actual initial-entry/prize custody. No gameplay facts or prize-release authority.
/// @dev No upgrade/bind/owner-drain path. Later hand integration needs a separately qualified successor.
contract PokerTournamentEntryEscrow420 {
    bytes32 public constant DOMAIN=keccak256("420.BET.POKER.TOURNAMENT.ENTRY.ESCROW.V1");
    bytes32 public constant CREATE=keccak256("BET_POKER_TOURNAMENT_EVENT_CREATE.V1");
    bytes32 public constant ENTER=keccak256("BET_POKER_TOURNAMENT_EVENT_ENTER.V1");
    enum State { NONE, REGISTRATION, DELAYED, STARTING, CANCELLED }
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
    mapping(bytes32=>EventAccount) private events_;
    mapping(bytes32=>PokerTournamentPolicy420.Config) private configs;
    mapping(bytes32=>mapping(uint64=>Entry)) private entries;
    mapping(bytes32=>mapping(bytes32=>uint64)) public activeReceipt;
    mapping(bytes32=>mapping(bytes32=>uint64)) public nonceOf;
    mapping(address=>uint256) public credit;
    mapping(bytes32=>mapping(uint256=>uint256)) public capabilitySpend;
    uint256 public totalLiability;
    uint256 public heldPrizes;
    uint256 public heldFees;
    uint256 public totalCredits;
    uint256 public totalReceived;
    uint256 public totalWithdrawn;
    uint256 private entered;
    error Invalid(); error Unauthorized(); error TransferFailed(); error Reentrancy(); error GameplayIntegrationRequired();
    event Created(bytes32 indexed id,bytes32 indexed manifest,bytes32 policy,address funder,uint256 sponsor);
    event Purchased(bytes32 indexed id,uint64 indexed receipt,bytes32 indexed person,bytes32 subject,address payer,
        uint64 nonce,uint256 buyIn,uint256 fee,uint256 chips);
    event StateChanged(bytes32 indexed id,State state,uint64 readyAt);
    event Refunded(bytes32 indexed id,uint64 indexed receipt,address beneficiary,uint256 amount);
    event Withdrawn(address indexed beneficiary,uint256 amount);
    constructor(address policies_,address identity_,bytes32 issuer_,bytes32 type_,address devVault_) {
        if(policies_.code.length==0||identity_.code.length==0||devVault_.code.length==0||issuer_==0||type_==0)revert Invalid();
        policies=PokerTournamentPolicyRegistry420(policies_);authorization=policies.authorization();
        identities=Identity420(identity_);issuer=issuer_;credentialType=type_;asset=policies.asset();
        DevelopmentCompensationVault420 vault=DevelopmentCompensationVault420(payable(devVault_));
        if(address(vault.capabilityRegistry())!=address(authorization.capabilityRegistry()))revert Invalid();
        developmentFund=vault.beneficiary();if(developmentFund==address(0)||developmentFund==address(this))revert Invalid();
    }
    modifier guarded(){if(entered!=0)revert Reentrancy();entered=1;_;entered=0;}
    function scope(bytes32 id) public view returns(bytes32){return keccak256(abi.encode(DOMAIN,block.chainid,address(this),id));}
    function eventOf(bytes32 id) external view returns(EventAccount memory){return events_[id];}
    function entryOf(bytes32 id,uint64 index) external view returns(Entry memory){return entries[id][index];}
    function configOf(bytes32 id) external view returns(PokerTournamentPolicy420.Config memory){return configs[id];}
    function quote(bytes32 id) public view returns(PokerTournamentPurchaseAccounting420.Quote memory){
        if(events_[id].state==State.NONE)revert Invalid();return PokerTournamentPurchaseAccounting420.quote(configs[id].buyIn,configs[id].startingStack);
    }
    function _cap(bytes32 id,bytes32 action,uint256 amount) private view {
        if(!authorization.isAuthorized(msg.sender,action,scope(id),amount))revert Unauthorized();
    }
    function create(bytes32 id,bytes32 policyId) external guarded {
        _cap(id,CREATE,0);
        if(id==0||events_[id].state!=State.NONE||!policies.usableForNewEvent(policyId))revert Invalid();
        PokerTournamentPolicyRegistry420.Record memory r=policies.get(policyId);
        if(msg.sender!=r.publisher||block.timestamp>=r.config.registrationOpens)revert Unauthorized();
        _cap(id,CREATE,r.config.sponsoredPrize);
        EventAccount storage e=events_[id];e.state=State.REGISTRATION;e.policy=policyId;e.funder=msg.sender;
        e.manifest=keccak256(abi.encode(DOMAIN,block.chainid,address(this),id,policyId,r.digest,asset,developmentFund,address(identities),issuer,credentialType));
        configs[id]=r.config;e.prize=r.config.sponsoredPrize;e.sponsored=r.config.sponsoredPrize;
        e.received=e.sponsored;heldPrizes+=e.sponsored;_receive(e.sponsored);
        emit Created(id,e.manifest,policyId,msg.sender,e.sponsored);
    }
    function personKey(bytes32 subject,bytes32 credential,address actor) public view returns(bytes32) {
        (address controller,,,,,,bool active)=identities.profiles(subject);
        IIdentityCredential420.CredentialView memory c=identities.credential(credential);
        (,,,bytes32 person,,,,)=identities.credentials(credential);
        if(actor==address(0)||controller!=actor||!active||c.subjectId!=subject||c.issuerId!=issuer||
            c.credentialType!=credentialType||person==0||!identities.credentialMeetsTrust(credential,Identity420.TrustClass.VERIFIED))revert Unauthorized();
        return keccak256(abi.encode(issuer,person));
    }
    function purchase(bytes32 id,bytes32 subject,bytes32 credential,uint64 nonce,uint256 expectedTotal,bytes32 expectedManifest)
        external guarded returns(uint64 index)
    {
        _sync(id);EventAccount storage e=events_[id];PokerTournamentPolicy420.Config storage c=configs[id];
        if((e.state!=State.REGISTRATION&&e.state!=State.DELAYED)||block.timestamp<c.registrationOpens||
            expectedManifest!=e.manifest||e.reservedPlayers>=c.maxPlayers)revert Invalid();
        if(!policies.usableForNewEvent(e.policy))revert Unauthorized();
        bytes32 person=personKey(subject,credential,msg.sender);
        PokerTournamentPurchaseAccounting420.Quote memory q=quote(id);_cap(id,ENTER,q.total);
        if(activeReceipt[id][person]!=0||nonce!=nonceOf[id][person]+1||expectedTotal!=q.total)revert Invalid();
        _spendCapability(id,q.total);
        nonceOf[id][person]=nonce;index=++e.receipts;
        entries[id][index]=Entry(person,subject,msg.sender,nonce,q.prize,q.fee,q.chips,false);
        activeReceipt[id][person]=index;++e.reservedPlayers;e.prize+=q.prize;e.fees+=q.fee;e.received+=q.total;
        heldPrizes+=q.prize;heldFees+=q.fee;_sync(id);_receive(q.total);
        emit Purchased(id,index,person,subject,msg.sender,nonce,q.prize,q.fee,q.chips);
    }
    // Scope includes this escrow/event; local gross debits cannot evade a period budget by refunding.
    // Canonical consumption by other authorized components reduces the budget conservatively too.
    function _spendCapability(bytes32 id,uint256 amount) private {
        ICapabilityRegistryExtended420 registry=ICapabilityRegistryExtended420(address(authorization.capabilityRegistry()));
        bytes32 grantId=registry.activeGrantId(msg.sender,keccak256("420.BET.CORE"),ENTER,scope(id));
        ICapabilityRegistry420.CapabilityGrant memory g=registry.grant(grantId);
        if(g.periodLimit!=0){
            uint256 period=block.timestamp/g.periodSeconds;
            uint256 used=capabilitySpend[grantId][period]+registry.usage(grantId).used;
            if(used>g.periodLimit||amount>g.periodLimit-used)revert Unauthorized();
            capabilitySpend[grantId][period]+=amount;
        }
    }
    function unregister(bytes32 id,uint64 index,uint64 expectedNonce) external guarded {
        _sync(id);State s=events_[id].state;Entry storage x=entries[id][index];
        if((s!=State.REGISTRATION&&s!=State.DELAYED)||x.payer!=msg.sender||x.nonce!=expectedNonce)revert Unauthorized();
        _refund(id,index);
    }
    function tick(bytes32 id) external guarded {_sync(id);}
    function _sync(bytes32 id) private {
        EventAccount storage e=events_[id];PokerTournamentPolicy420.Config storage c=configs[id];
        if(e.state==State.NONE)revert Invalid();
        if(e.state==State.REGISTRATION){
            bool sng=c.startKind==PokerTournamentPolicy420.StartKind.SIT_AND_GO;
            if(sng&&e.reservedPlayers>=c.startingTarget)_ready(id,uint64(block.timestamp));
            else if(block.timestamp>=c.startOrRegistrationDeadline){
                if(!sng&&e.reservedPlayers>=c.minimum)_ready(id,c.startOrRegistrationDeadline);
                else {e.state=State.DELAYED;emit StateChanged(id,e.state,0);}
            }
        }
        if(e.state==State.DELAYED){
            uint256 end=uint256(c.startOrRegistrationDeadline)+c.underfillGrace;
            if(block.timestamp>=end)_cancel(id);
            else if(e.reservedPlayers>=(c.startKind==PokerTournamentPolicy420.StartKind.SIT_AND_GO?c.startingTarget:c.minimum))_ready(id,uint64(block.timestamp));
        }
        // There is deliberately no start/hand-observation hook in this custody version.
        if(e.state==State.STARTING&&block.timestamp>=uint256(e.readyAt)+c.technicalGrace)_cancel(id);
    }
    function _ready(bytes32 id,uint64 at_) private {EventAccount storage e=events_[id];e.state=State.STARTING;e.readyAt=at_;emit StateChanged(id,e.state,at_);}
    function _cancel(bytes32 id) private {
        EventAccount storage e=events_[id];e.state=State.CANCELLED;
        uint256 sponsor=e.sponsored;e.sponsored=0;e.prize-=sponsor;heldPrizes-=sponsor;_credit(id,e.funder,sponsor);
        emit StateChanged(id,e.state,e.readyAt);
    }
    /// @notice Permissionless processing, always credited to the immutable original payer.
    function refundCancelled(bytes32 id,uint64 index) external guarded {
        _sync(id);if(events_[id].state!=State.CANCELLED)revert Invalid();_refund(id,index);
    }
    function _refund(bytes32 id,uint64 index) private {
        Entry storage x=entries[id][index];EventAccount storage e=events_[id];
        if(x.payer==address(0)||x.refunded||activeReceipt[id][x.person]!=index)revert Invalid();
        x.refunded=true;delete activeReceipt[id][x.person];--e.reservedPlayers;
        e.prize-=x.buyIn;e.fees-=x.fee;heldPrizes-=x.buyIn;heldFees-=x.fee;
        _credit(id,x.payer,x.buyIn+x.fee);emit Refunded(id,index,x.payer,x.buyIn+x.fee);
    }
    function _credit(bytes32 id,address payer,uint256 amount) private {
        credit[payer]+=amount;totalCredits+=amount;events_[id].credited+=amount;
    }
    function withdraw() external guarded {
        uint256 amount=credit[msg.sender];if(amount==0)revert Invalid();
        credit[msg.sender]=0;totalCredits-=amount;totalLiability-=amount;totalWithdrawn+=amount;
        ITournamentAsset420 t=ITournamentAsset420(asset);uint256 before_=t.balanceOf(address(this));uint256 recipient=t.balanceOf(msg.sender);
        if(!t.transfer(msg.sender,amount)||t.balanceOf(address(this))+amount!=before_||t.balanceOf(msg.sender)!=recipient+amount)revert TransferFailed();
        _solvent();emit Withdrawn(msg.sender,amount);
    }
    function _receive(uint256 amount) private {
        ITournamentAsset420 t=ITournamentAsset420(asset);uint256 before_=t.balanceOf(address(this));uint256 payer=t.balanceOf(msg.sender);
        if(amount!=0&&!t.transferFrom(msg.sender,address(this),amount))revert TransferFailed();
        if(t.balanceOf(address(this))!=before_+amount||t.balanceOf(msg.sender)+amount!=payer)revert TransferFailed();
        totalLiability+=amount;totalReceived+=amount;_solvent();
    }
    function _solvent() private view {
        if(ITournamentAsset420(asset).balanceOf(address(this))<totalLiability||
            totalLiability!=heldPrizes+heldFees+totalCredits||totalReceived!=totalWithdrawn+totalLiability)revert Invalid();
    }
    function solvent() external view returns(bool){_solvent();return true;}
    function gameplayPurchasesEnabled() external pure returns(bool){return false;}
    function purchaseExtra() external pure {revert GameplayIntegrationRequired();}
    function admittedUniquePlayers(bytes32) external pure returns(uint32){return 0;}
}
