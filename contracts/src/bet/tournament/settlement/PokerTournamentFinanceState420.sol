// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../purchases/PokerTournamentPurchaseEscrowState420.sol";
import "./PokerTournamentPrizePolicies420.sol";
import "./PokerTournamentPrizeHost420.sol";
import "./PokerTournamentPrizeMath420.sol";
abstract contract PokerTournamentFinanceState420 is PokerTournamentPurchaseEscrowState420 {
    bytes32 public constant FINANCIAL_DOMAIN=keccak256("420.BET.POKER.TOURNAMENT.FINANCIAL.SETTLEMENT.V1");
    PokerTournamentPrizePolicies420 public immutable prizePolicies;
    enum Mode {NONE,LOADING,ALLOCATING,CLAIMABLE,PAID,REFUNDING,REFUNDED}
    struct Financial {Mode mode;uint64 recoveryAnchor;uint64 recoveryDeadline;uint64 receiptEnd;uint64 refundCursor;uint32 unique;uint32 loaded;uint32 allocated;uint32 positiveClaims;uint256 prize;uint256 fees;uint256 allocatedSum;bytes32 standingsRoot;bytes32 financialRoot;PokerTournamentPrizeMath420.Row[] rows;mapping(bytes32=>uint32) index;}
    struct FinancialStore {mapping(bytes32=>Financial) events;}
    bytes32 private constant SLOT=keccak256("420.bet.tournament.financial.settlement.v1");
    event C7FinancialCredit(bytes32 indexed eventId,uint8 kind,bytes32 person,uint64 receipt,address payee,uint256 prize,uint256 fee);
    event C7FinancialState(bytes32 indexed eventId,uint8 mode,bytes32 root,uint256 prize,uint256 fees);
    event C7PrizeRow(bytes32 indexed eventId,bytes32 person,address payee,uint64 receipt,uint32 first,uint32 last,uint256 amount,bytes32 root);
    event C7RecoveryCheckpoint(bytes32 indexed eventId,uint64 anchor,uint64 deadline);
    constructor(address p,address i,bytes32 issuer_,bytes32 type_,address d,address financialPolicies_)PokerTournamentPurchaseEscrowState420(p,i,issuer_,type_,d){
        if(financialPolicies_.code.length==0)revert Invalid();prizePolicies=PokerTournamentPrizePolicies420(financialPolicies_);if(address(prizePolicies.policies())!=address(policies))revert Invalid();
    }
    function _financial()internal pure returns(FinancialStore storage s){bytes32 slot=SLOT;assembly("memory-safe"){s.slot:=slot}}
    function _hostView()internal view returns(PokerTournamentPrizeHost420){if(gameplayHost==address(0)||gameplayHost.codehash!=hostCodeHash)revert Invalid();return PokerTournamentPrizeHost420(gameplayHost);}
    function _complete(bytes32 id)internal view returns(bytes32 context,bytes32 root,uint32 unique){
        PokerTournamentPrizeHost420 h=_hostView();(PokerTournamentHostState420.Phase phase,,,,,,)=h.eventState(id);
        (,,,bool waveOpen,bool finished,,bytes32 result,uint32 cursor,uint32 count)=h.standingsState(id);
        (uint32 hands,uint32 pending,uint32 queued,)=h.financialFacts(id);
        if(phase!=PokerTournamentHostState420.Phase.COMPLETE||!finished||waveOpen||count<2||count>576||cursor!=count||hands!=0||pending!=0||queued!=0||!started[id]||events_[id].state!=State.STARTING||result==0)revert Invalid();
        (,,,,context,,)=h.eventState(id);return(context,result,count);
    }
    function _checkTerms(bytes32 policyId)internal view returns(bytes32){PokerTournamentPolicyRegistry420.Record memory base_=policies.get(policyId);PokerTournamentPrizePolicies420.Record memory p=prizePolicies.get(base_.config.payoutPolicy);
        if(p.status!=PokerTournamentPrizePolicies420.Status.PUBLISHED||p.publisher!=base_.publisher||p.operatorId!=base_.config.operatorId||p.maximum<base_.config.maxPlayers||base_.config.recoveryPolicy!=prizePolicies.FULL_REFUND())revert Invalid();return p.digest;
    }
}
abstract contract PokerTournamentFinanceModule420 is PokerTournamentFinanceState420 {
    address public immutable bank;
    constructor(address p,address i,bytes32 issuer_,bytes32 type_,address d,address f,address b)PokerTournamentFinanceState420(p,i,issuer_,type_,d,f){if(b==address(0))revert Invalid();bank=b;}
    modifier onlyBank(){if(address(this)!=bank)revert Unauthorized();_;}
}
