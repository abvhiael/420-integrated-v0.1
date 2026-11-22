package accounting

import (
	"context"
	"encoding/hex"
	"encoding/json"
	"fmt"
	eng "github.com/420integrated/420-integrated/consensus/engine"
	rec "github.com/420integrated/420-integrated/consensus/recovery"
	sys "github.com/420integrated/420-integrated/consensus/systemcall"
	ct "github.com/420integrated/420-integrated/consensus/types"
	ethhash "github.com/420integrated/420-integrated/execution/storage"
	"github.com/420integrated/420-integrated/indexer/model"
	"math/big"
	"reflect"
	"strings"
	"testing"
)

func encoded(t *testing.T, name string, fields map[string]string, n uint64, hash string, index uint64) model.LogRecord {
	t.Helper()
	for _, d := range definitions() {
		if d.Name != name {
			continue
		}
		l := model.LogRecord{ChainID: 420, BlockNumber: n, BlockHash: hash, Address: d.Address, TransactionHash: hex32([32]byte{}), LogIndex: index, Topics: []string{ethhash.EventTopic(signature(d))}, Data: "0x"}
		for _, f := range d.Inputs {
			v := fields[f.Name]
			var word []byte
			if strings.HasPrefix(v, "0x") {
				var err error
				word, err = hex.DecodeString(v[2:])
				if err != nil {
					t.Fatal(err)
				}
			} else {
				word = money(v).Bytes()
			}
			w := fmt.Sprintf("%064x", word)
			if f.Indexed {
				l.Topics = append(l.Topics, "0x"+w)
			} else {
				l.Data += w
			}
		}
		return l
	}
	t.Fatal(name)
	return model.LogRecord{}
}

// The accepted Geth native log archive supplies actual, order-sensitive payments;
// none of these records are fabricated Ethereum transaction receipts.
func rewardFixtureLogs(t *testing.T, reward *sys.RewardOutcome, hash string) []model.LogRecord {
    t.Helper()
    settlement, err := sys.DeriveRewardSettlement(*reward)
    if err != nil { t.Fatal(err) }
    out := []model.LogRecord{}
    add := func(name string, fields map[string]string) {
        out = append(out, encoded(t,name,fields,reward.BlockNumber,hash,uint64(len(out))))
    }
    pay := func(recipient,amount,kind string) {
        if money(amount).Sign() != 0 {
            add("NativeRewardPaid",map[string]string{
                "blockNumber":fmt.Sprint(reward.BlockNumber),"recipient":recipient,
                "kind":kind,"amount":amount,
            })
        }
    }
    pay(address(reward.Proposer),settlement.ProposerAmount.String(),"0")
    for _,participant:=range reward.Participants {
        pay(address(participant),settlement.PerParticipantAmount.String(),"1")
    }
    pay(AttentionTreasury,settlement.AttentionAmount.String(),"3")
    pay(DevelopmentTreasury,settlement.DevelopmentAmount.String(),"4")
    participantTotal:=new(big.Int).Mul(settlement.PerParticipantAmount,big.NewInt(int64(len(reward.Participants))))
    add("RewardApplied",map[string]string{
        "blockNumber":fmt.Sprint(reward.BlockNumber),"proposer":address(reward.Proposer),
        "proposerAmount":settlement.ProposerAmount.String(),
        "participantAmount":participantTotal.String(),
        "attentionAmount":settlement.AttentionAmount.String(),
        "developmentAmount":settlement.DevelopmentAmount.String(),
    })
    return out
}

type fixtureSource struct {
	logs           []model.LogRecord
	initial, final State
	fail           bool
}

func (s *fixtureSource) Anchor(context.Context, sys.SequenceAnchor) error {
	if s.fail {
		return fmt.Errorf("execution unavailable")
	}
	return nil
}
func (s *fixtureSource) Logs(context.Context, rec.Record) ([]model.LogRecord, error) {
	return s.logs, nil
}
func (s *fixtureSource) State(_ context.Context, a sys.SequenceAnchor, _ []string, _ []string) (State, error) {
	if a.ExecutionBlock == 0 {
		return s.initial, nil
	}
	return s.final, nil
}
func fixtureReport(t *testing.T) (rec.CertifiedSnapshot, *fixtureSource, Index) {
	t.Helper()
	g, h := [32]byte{1}, [32]byte{2}
	root := [32]byte{3}
	reward := &sys.RewardOutcome{BlockNumber: 1, ActiveCount: 15, Proposer: sys.Address{1}, Participants: []sys.Address{{2}, {3}}}
	out := sys.FinalizedStakeOutcomes{Reward: reward}
    logs:=rewardFixtureLogs(t,reward,hex32(h))
    initial := State{
        "grossSecurityIssued":"0","grossAttentionIssued":"0","grossDevelopmentIssued":"0",
        "rewardAppliedCurrent":"0","nativeRewardPaid":"0",
        "communityRewardAccrued":"0","communityRewardBackingReceived":"0",
        "communityRewardSettled":"0",balance(Reward):"0",
        accrued(CommunityReward):"0",
        balance(CommunityReward):"0",
        accrued(address(reward.Proposer)):"0",
        accrued(address(reward.Participants[0])):"0",
        accrued(address(reward.Participants[1])):"0",
    }
	final := State{}
	for k, v := range initial {
		final[k] = v
	}
    for _,log:=range logs {
        e,err:=Decode(log)
        if err!=nil {t.Fatal(err)}
        if err=Apply(final,e,1,reward);err!=nil {t.Fatal(err)}
    }
	final["rewardAppliedCurrent"] = "1"
	snap := rec.CertifiedSnapshot{Trust: rec.Trust{ChainID: 420, Execution: sys.SequenceAnchor{ChainID: 420, BlockHash: g}}, Anchor: sys.SequenceAnchor{ChainID: 420, ExecutionBlock: 1, BlockHash: h}, Head: ct.Checkpoint{Root: root}, Finalized: ct.Checkpoint{Root: [32]byte{7}}, Canonical: []rec.Record{{Consensus: ct.ConsensusBlockEnvelope{Header: ct.ConsensusBlock{ExecutionPayloadHash: h}}, Outcomes: out, Payload: eng.ExecutionPayloadV3{BlockNumber: "0x1", BlockHash: eng.Hash32(hex32(h))}}}}
	index := Index{ChainID: 420, Height: 1, Hash: hex32(h), FinalizedHash: hex32(g), Blocks: map[uint64]string{0: hex32(g), 1: hex32(h)}, Logs: logs}
	return snap, &fixtureSource{logs: logs, initial: initial, final: final}, index
}
func has(r Report, code string) bool {
	for _, d := range r.Discrepancies {
		if d.Code == code {
			return true
		}
	}
	return false
}
func TestCanonicalReconciliationRestartAndDiscrepancies(t *testing.T) {
	snap, source, index := fixtureReport(t)
	clean := Reconcile(context.Background(), snap, source, index)
	if clean.Status != "RECONCILED" {
		t.Fatalf("%+v", clean.Discrepancies)
	}
	if clean.CanonicalAuthority || money(clean.Issuance.NonIssued).Sign() <= 0 {
		t.Fatal("authority or nonparticipation accounting")
	}
	for i := 0; i < 3; i++ {
		again := Reconcile(context.Background(), snap, source, index)
		if !reflect.DeepEqual(clean, again) {
			t.Fatal("restart changed report")
		}
	}
	cases := []struct {
		name, code string
		mutate     func(*fixtureSource, *Index)
	}{
		{"missing", "MISSING_INDEXER_EVENT", func(s *fixtureSource, i *Index) { i.Logs = nil }},
		{"duplicate", "DUPLICATE_INDEXER_EVENT", func(s *fixtureSource, i *Index) { i.Logs = append(i.Logs, i.Logs[0]) }},
		{"orphan", "ORPHANED_INDEXER_EVENT", func(s *fixtureSource, i *Index) { i.Logs[0].BlockHash = hex32([32]byte{9}) }},
		{"contradictory", "CONTRADICTORY_INDEXER_EVENT", func(s *fixtureSource, i *Index) { i.Logs[0].Data = "0x" + strings.Repeat("0", 256) }},
		{"state", "EXECUTION_STATE_MISMATCH", func(s *fixtureSource, i *Index) { s.final["grossSecurityIssued"] = "1" }},
		{"missing native", "MISSING_CONSENSUS_EVENT", func(s *fixtureSource, i *Index) { s.logs = nil }},
		{"duplicated execution", "DUPLICATE_EXECUTION_EVENT", func(s *fixtureSource, i *Index) { s.logs = append(s.logs, s.logs[0]) }},
		{"finalized", "INDEXER_FINALIZED_CHECKPOINT_MISMATCH", func(s *fixtureSource, i *Index) { i.FinalizedHeight = 1 }},
		{"wrong chain", "INDEXER_CHECKPOINT_MISMATCH", func(s *fixtureSource, i *Index) { i.ChainID = 421 }},
		{"unavailable", "SOURCE_UNAVAILABLE_OR_CONTRADICTORY", func(s *fixtureSource, i *Index) { s.fail = true }},
		{"malformed", "MALFORMED_EXECUTION_EVENT", func(s *fixtureSource, i *Index) { s.logs[0].Data = "0x01" }},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			a, s, i := fixtureReport(t)
			c.mutate(s, &i)
			r := Reconcile(context.Background(), a, s, i)
			if r.Status != "DISCREPANCY" || !has(r, c.code) {
				t.Fatalf("%s: %+v", c.code, r.Discrepancies)
			}
		})
	}
	raw, err := json.Marshal(clean)
	if err != nil || !json.Valid(raw) {
		t.Fatal("machine report", err)
	}
}
func TestSponsoredRewardNativeNinetyTenAndIndexerEvidence(t *testing.T) {
    reward:=&sys.RewardOutcome{BlockNumber:4200,ActiveCount:15,
        Proposer:sys.Address{1},Participants:[]sys.Address{{2}}}
    settlement,err:=sys.DeriveRewardSettlement(*reward)
    if err!=nil {t.Fatal(err)}
    proposer:=address(reward.Proposer)
    participant:=address(reward.Participants[0])
    share:=new(big.Int).Mul(new(big.Int).Set(settlement.ProposerAmount),big.NewInt(1000))
    share.Div(share,big.NewInt(10000))
    net:=new(big.Int).Sub(settlement.ProposerAmount,share)
    s:=State{"communityRewardAccrued":"0","communityRewardBackingReceived":"0",
       "communityRewardSettled":"0","nativeRewardPaid":"0",
       "grossSecurityIssued":"0","grossAttentionIssued":"0","grossDevelopmentIssued":"0",
       balance(CommunityReward):"0",accrued(CommunityReward):"0",
       accrued(proposer):"0",accrued(participant):"0"}
    pay:=func(recipient,kind,amount string) Event {
        return Event{Name:"NativeRewardPaid",Fields:map[string]string{
            "blockNumber":"4200","recipient":recipient,"kind":kind,"amount":amount}}
    }
    events:=[]Event{
        {Name:"SponsoredValidatorRewardAllocated",Fields:map[string]string{
            "owner":proposer,"communityFund":CommunityReward,
            "gross":settlement.ProposerAmount.String(),"communityShare":share.String()}},
        {Name:"CommunityRewardBackingReceived",Fields:map[string]string{
            "source":Reward,"amount":share.String(),"backedTotal":share.String()}},
        pay(CommunityReward,"2",share.String()),
        {Name:"CommunityRewardSettled",Fields:map[string]string{
            "reserve":CommunityReward,"amount":share.String(),"settledTotal":share.String()}},
        pay(proposer,"0",net.String()),
        pay(participant,"1",settlement.PerParticipantAmount.String()),
        pay(AttentionTreasury,"3",settlement.AttentionAmount.String()),
        pay(DevelopmentTreasury,"4",settlement.DevelopmentAmount.String()),
        {Name:"RewardApplied",Fields:map[string]string{
            "blockNumber":"4200","proposer":proposer,
            "proposerAmount":settlement.ProposerAmount.String(),
            "participantAmount":settlement.PerParticipantAmount.String(),
            "attentionAmount":settlement.AttentionAmount.String(),
            "developmentAmount":settlement.DevelopmentAmount.String(),
        }},
    }
    for i,event:=range events {
        // Roundtrip exact ABI topics/data through canonical Indexer decoder.
        log:=encoded(t,event.Name,event.Fields,4200,hex32([32]byte{42}),uint64(i))
        decoded,err:=Decode(log)
        if err!=nil {t.Fatal(err)}
        if err:=Apply(s,decoded,4200,reward);err!=nil {
            t.Fatalf("native sponsor event %d (%s): %v",i,event.Name,err)
        }
    }
    realized:=new(big.Int).Add(new(big.Int).Set(settlement.ProposerAmount),settlement.PerParticipantAmount)
    realized.Add(realized,settlement.AttentionAmount)
    realized.Add(realized,settlement.DevelopmentAmount)
    if s.get(accrued(proposer))!=net.String() || s.get(accrued(participant))!=settlement.PerParticipantAmount.String() ||
       s.get("communityRewardSettled")!=share.String() ||
       s.get("communityRewardBackingReceived")!=share.String() ||
       s.get("communityRewardAccrued")!=share.String() ||
       s.get(balance(CommunityReward))!=share.String() ||
       s.get("nativeRewardPaid")!=realized.String() {
        t.Fatalf("unbacked sponsored native 90/10 payout accepted: %+v",s)
    }
    corrupt:=func(name string,index int,mutate func(*Event)){
        t.Run(name,func(t *testing.T){
            state:=State{}
            for k,v:=range map[string]string{
                "communityRewardAccrued":"0","communityRewardBackingReceived":"0",
                "communityRewardSettled":"0","nativeRewardPaid":"0",
                "grossSecurityIssued":"0","grossAttentionIssued":"0","grossDevelopmentIssued":"0",
                balance(CommunityReward):"0",accrued(CommunityReward):"0",
                accrued(proposer):"0",accrued(participant):"0",
            } {state[k]=v}
            rejected:=false
            for i,event:=range events {
                copy:=Event{Name:event.Name,Fields:map[string]string{}}
                for k,v:=range event.Fields {copy.Fields[k]=v}
                if i==index {mutate(&copy)}
                if err:=Apply(state,copy,4200,reward);err!=nil {
                    rejected=true;break
                }
            }
            if !rejected {t.Fatal("tampered sponsored native settlement reconciled")}
        })
    }
    corrupt("incorrect-community-share",0,func(e *Event){e.Fields["communityShare"]="1"})
    corrupt("forged-backing-source",1,func(e *Event){e.Fields["source"]=participant})
    corrupt("redirected-reserve",3,func(e *Event){e.Fields["reserve"]=proposer})
    corrupt("missing-native-transfer",4,func(e *Event){e.Fields["amount"]="1"})
    corrupt("wrong-execution-block",5,func(e *Event){e.Fields["blockNumber"]="4199"})
    corrupt("extra-native-mint",7,func(e *Event){e.Fields["amount"]="1"})
}

func TestCreditReplacementSlashingAndWithdrawal(t *testing.T) {
	id := hex32([32]byte{1})
	owner := "0x0000000000000000000000000000000000000001"
	s := State{balance(CreditReserve): "100", balance(Registry): "0", balance(ProtocolReserve): "0"}
	apply := func(name string, fields map[string]string, n uint64) {
		t.Helper()
		fields["validatorId"] = id
		if err := Apply(s, Event{Name: name, Fields: fields}, n, nil); err != nil {
			t.Fatalf("%s: %v", name, err)
		}
	}
	apply("CreditAssigned", map[string]string{"amount": "40", "beneficiary": owner}, 1)
	apply("ProtocolCreditReceived", map[string]string{"amount": "40", "beneficiary": owner}, 1)
	apply("CreditFunded", map[string]string{"amount": "40", "beneficiary": owner}, 1)
	apply("ValidatorRegistered", map[string]string{"ownedBond": "60", "protocolCredit": "40", "owner": owner, "withdrawal": owner}, 1)
	apply("CreditReturned", map[string]string{"amount": "10"}, 2)
	apply("ProtocolCreditReplaced", map[string]string{"amount": "10", "ownedBond": "70", "protocolCredit": "30"}, 2)
	apply("CreditReturned", map[string]string{"amount": "3"}, 3)
	apply("SlashApplied", map[string]string{"ownedSlashed": "7", "creditSlashed": "3", "evidenceHash": hex32([32]byte{2}), "resultingStatus": "6"}, 3)
	if s.get("totalOwnedSlashed") != "7" || s.get("totalProtocolCreditRecycled") != "13" || s.get(balance(ProtocolReserve)) != "7" {
		t.Fatal(s)
	}
	apply("ConsensusStateApplied", map[string]string{"previousStatus": "6", "newStatus": "8", "effectiveSlot": "4", "activationRotation": "0", "scheduledExitRotation": "1", "cooldownUntilRotation": "0"}, 4)
	apply("ConsensusStateApplied", map[string]string{"previousStatus": "8", "newStatus": "9", "effectiveSlot": "5", "activationRotation": "0", "scheduledExitRotation": "1", "cooldownUntilRotation": "0"}, 105844)
	apply("CreditReturned", map[string]string{"amount": "27"}, 105844)
	fields := map[string]string{"validatorId": id, "ownedAmount": "63", "recycledCredit": "27", "withdrawal": owner}
	if err := Apply(s, Event{Name: "ValidatorBondWithdrawn", Fields: fields}, 5, nil); err == nil {
		t.Fatal("premature withdrawal")
	}
	apply("ValidatorBondWithdrawn", fields, 105844)
	if s.get(balance(Registry)) != "0" || s.get(balance(CreditReserve)) != "100" || s.get("totalOwnedWithdrawn") != "63" || s.get("totalProtocolCreditCustody") != "0" {
		t.Fatal(s)
	}
	if err := Apply(s, Event{Name: "ValidatorBondWithdrawn", Fields: fields}, 105845, nil); err == nil {
		t.Fatal("duplicate withdrawal")
	}
	if new(big.Int).Add(money(s.get("totalOwnedSlashed")), money(s.get("totalOwnedWithdrawn"))).String() != "70" {
		t.Fatal("owned conservation")
	}
}

func TestReplacementAccountingEqualsCleanCanonicalRebuild(t *testing.T) {
	old, oldSource, oldIndex := fixtureReport(t)
	oldReport := Reconcile(context.Background(), old, oldSource, oldIndex)
	replacement, source, index := fixtureReport(t)
	hash := [32]byte{9}
	replacement.Anchor.BlockHash = hash
	replacement.Canonical[0].Payload.BlockHash = eng.Hash32(hex32(hash))
	replacement.Canonical[0].Consensus.Header.ExecutionPayloadHash = hash
	reward := replacement.Canonical[0].Outcomes.Reward
	reward.Participants = reward.Participants[:1]
	source.logs = rewardFixtureLogs(t,reward,hex32(hash))
	source.final = State{}
	for k, v := range source.initial {
		source.final[k] = v
	}
    for _,log:=range source.logs {
        e,err:=Decode(log)
        if err!=nil {t.Fatal(err)}
        if err=Apply(source.final,e,1,reward);err!=nil {t.Fatal(err)}
    }
	source.final["rewardAppliedCurrent"] = "1"
	index.Hash = hex32(hash)
	index.Blocks[1] = hex32(hash)
	index.Logs = source.logs
	clean := Reconcile(context.Background(), replacement, source, index)
	if clean.Status != "RECONCILED" || reflect.DeepEqual(clean.State, oldReport.State) {
		t.Fatal("replacement inherited orphan accrual", clean.Discrepancies)
	}
	for i := 0; i < 3; i++ {
		if rebuilt := Reconcile(context.Background(), replacement, source, index); !reflect.DeepEqual(rebuilt, clean) {
			t.Fatal("restart/rebuild diverged")
		}
	}
	index.Logs = append(index.Logs, oldIndex.Logs...)
	if result := Reconcile(context.Background(), replacement, source, index); !has(result, "ORPHANED_INDEXER_EVENT") {
		t.Fatal("orphan accepted")
	}
}
