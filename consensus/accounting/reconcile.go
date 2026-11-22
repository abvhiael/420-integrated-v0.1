package accounting

import (
	"context"
	"fmt"
	rec "github.com/420integrated/420-integrated/consensus/recovery"
	sys "github.com/420integrated/420-integrated/consensus/systemcall"
	"github.com/420integrated/420-integrated/indexer/model"
	"math/big"
	"sort"
	"strconv"
	"strings"
)

type expectation struct {
	name   string
	fields map[string]string
	slash  *sys.SlashOutcome
	used   bool
}

func expected(out sys.FinalizedStakeOutcomes) ([]expectation, error) {
	var result []expectation
	add := func(name string, fields map[string]string) {
		result = append(result, expectation{name: name, fields: fields})
	}
	if out.Rotation != nil {
		add("RotationSnapshotApplied", map[string]string{"rotation": fmt.Sprint(out.Rotation.Rotation), "eligibleCount": fmt.Sprint(out.Rotation.EligibleSnapshot)})
	}
	for _, e := range out.ExitNotices {
		add("ExitNoticeApplied", map[string]string{"validatorId": hex32(e.ValidatorID), "noticeRotation": fmt.Sprint(e.NoticeRotation), "exitEligibleRotation": fmt.Sprint(e.NoticeRotation + 1)})
	}
	for _, o := range out.Slashes {
		settlement, err := sys.DeriveSlashSettlement(o)
		if err != nil {
			return nil, err
		}
		copy := o
		result = append(result, expectation{name: "SlashApplied", slash: &copy, fields: map[string]string{"validatorId": hex32(o.ValidatorID), "offense": fmt.Sprint(o.Offense), "correlationTier": fmt.Sprint(o.CorrelationTier), "ownedSlashed": settlement.OwnedSlashed.String(), "creditSlashed": settlement.CreditSlashed.String(), "evidenceHash": hex32(o.EvidenceHash), "resultingStatus": fmt.Sprint(o.ResultingStatus)}})
	}
	for _, v := range out.ValidatorStates {
		add("ConsensusStateApplied", map[string]string{"validatorId": hex32(v.ValidatorID), "newStatus": fmt.Sprint(v.Status), "effectiveSlot": fmt.Sprint(v.EffectiveSlot), "activationRotation": fmt.Sprint(v.ActivationRotation), "scheduledExitRotation": fmt.Sprint(v.ScheduledExitRotation), "cooldownUntilRotation": fmt.Sprint(v.CooldownUntilRotation)})
	}
	if out.Reward != nil {
		v := out.Reward
		settlement, err := sys.DeriveRewardSettlement(*v)
		if err != nil {
			return nil, err
		}
		participant := new(big.Int).Mul(settlement.PerParticipantAmount, big.NewInt(int64(len(v.Participants))))
		add("RewardApplied", map[string]string{"blockNumber": fmt.Sprint(v.BlockNumber), "proposer": address(v.Proposer), "proposerAmount": settlement.ProposerAmount.String(), "participantAmount": participant.String(), "attentionAmount": settlement.AttentionAmount.String(), "developmentAmount": settlement.DevelopmentAmount.String()})
	}
	return result, nil
}
func consensusEvent(name string) bool {
	switch name {
	case "RewardApplied", "SlashApplied", "ExitNoticeApplied", "ConsensusStateApplied", "RotationSnapshotApplied":
		return true
	}
	return false
}
func match(expected *expectation, e Event) bool {
	if expected.used || expected.name != e.Name {
		return false
	}
	for k, v := range expected.fields {
		if e.Fields[k] != v {
			return false
		}
	}
	return true
}
func compare(r *Report, n uint64, want, actual State) {
	for _, k := range sortedKeys(want) {
		if actual[k] != want[k] {
			r.issue("EXECUTION_STATE_MISMATCH", n, k, want[k], actual[k])
		}
	}
	for _, k := range sortedKeys(actual) {
		if _, ok := want[k]; !ok {
			r.issue("UNEXPECTED_EXECUTION_STATE", n, k, "absent", actual[k])
		}
	}
}

// Reconcile always reconstructs from the independently pinned genesis and the
// verified canonical path. Restarts cannot duplicate counters; replacements do
// not inherit orphaned balances. No source is mutated and no cache is authority.
func Reconcile(ctx context.Context, snapshot rec.CertifiedSnapshot, source Source, index Index) (r Report) {
	r = Report{Schema: "420-stake-accounting-reconciliation-v1", ChainID: snapshot.Trust.ChainID, Block: snapshot.Anchor.ExecutionBlock, BlockHash: hex32(snapshot.Anchor.BlockHash), ConsensusRoot: hex32(snapshot.Head.Root), FinalizedRoot: hex32(snapshot.Finalized.Root), Status: "DISCREPANCY", State: State{}, Discrepancies: []Discrepancy{}, Issuance: Issuance{GrossScheduled:"0", NativePaid:"0", CommunityAccrued:"0", CommunityBacked:"0", CommunitySettled:"0", Basis:"certified native node420 issuance, canonical RewardController payouts and historical execution state"}}
	defer func() {
		if p := recover(); p != nil {
			r.Status = "DISCREPANCY"
			r.issue("INVALID_ACCOUNTING_INPUT", 0, "input", "valid uint256/state", fmt.Sprint(p))
		}
	}()
	fail := func(n uint64, err error) {
		r.issue("SOURCE_UNAVAILABLE_OR_CONTRADICTORY", n, "source", "verified canonical evidence", err.Error())
	}
	if snapshot.Trust.ChainID != 420 || snapshot.Anchor.ChainID != 420 {
		fail(0, fmt.Errorf("wrong chain"))
		return
	}
	if err := source.Anchor(ctx, snapshot.Anchor); err != nil {
		fail(r.Block, err)
		return
	}
	canonical := map[uint64]string{snapshot.Trust.Execution.ExecutionBlock: hex32(snapshot.Trust.Execution.BlockHash)}
	allLogs := []model.LogRecord{}
	ids, accounts := map[string]bool{}, map[string]bool{}
	for _, record := range snapshot.Canonical {
		n, err := strconv.ParseUint(strings.TrimPrefix(record.Payload.BlockNumber, "0x"), 16, 64)
		if err != nil {
			fail(0, err)
			return
		}
		canonical[n] = string(record.Payload.BlockHash)
		logs, err := source.Logs(ctx, record)
		if err != nil {
			fail(n, err)
			return
		}
		for _, log := range logs {
			if !relevant(log) {
				continue
			}
			if log.ChainID != 420 || log.BlockNumber != n || !strings.EqualFold(log.BlockHash, canonical[n]) {
				r.issue("ORPHANED_EXECUTION_EVENT", n, eventKey(log), canonical[n], log.BlockHash)
				continue
			}
			e, err := Decode(log)
			if err != nil {
				r.issue("MALFORMED_EXECUTION_EVENT", n, eventKey(log), "retained ABI", err.Error())
				continue
			}
			if id := e.Fields["validatorId"]; id != "" {
				ids[id] = true
			}
			for _, key := range []string{"owner", "withdrawal", "beneficiary", "proposer", "recipient"} {
				if a := e.Fields[key]; a != "" {
					accounts[a] = true
				}
			}
			allLogs = append(allLogs, log)
		}
		for _, v := range record.Outcomes.Slashes {
			ids[hex32(v.ValidatorID)] = true
		}
		for _, v := range record.Outcomes.ValidatorStates {
			ids[hex32(v.ValidatorID)] = true
		}
		for _, v := range record.Outcomes.ExitNotices {
			ids[hex32(v.ValidatorID)] = true
		}
		if reward := record.Outcomes.Reward; reward != nil {
			accounts[CommunityReward] = true
			accounts[address(reward.Proposer)] = true
			for _, a := range reward.Participants {
				accounts[address(a)] = true
			}
		}
	}
	if uint64(len(snapshot.Canonical)) != snapshot.Anchor.ExecutionBlock-snapshot.Trust.Execution.ExecutionBlock {
		fail(0, fmt.Errorf("incomplete canonical accounting range"))
		return
	}
	idList, accountList := sortedKeys(ids), sortedKeys(accounts)
	initial, err := source.State(ctx, snapshot.Trust.Execution, idList, accountList)
	if err != nil {
		fail(0, err)
		return
	}
	for k, v := range initial {
		r.State[k] = v
		if !strings.HasPrefix(k, "balance/") && v != "0" && v != ZeroAddress {
			r.issue("NONZERO_GENESIS_ACCOUNTING", 0, k, "zero", v)
		}
	}
	sort.Slice(allLogs, func(i, j int) bool {
		a, b := allLogs[i], allLogs[j]
		if a.BlockNumber != b.BlockNumber {
			return a.BlockNumber < b.BlockNumber
		}
		if a.TransactionIndex != b.TransactionIndex {
			return a.TransactionIndex < b.TransactionIndex
		}
		return a.LogIndex < b.LogIndex
	})
	executionEvents := map[string]model.LogRecord{}
	seenEvidence := map[string]bool{}
	cursor := 0
	anchor := snapshot.Trust.Execution
	for _, record := range snapshot.Canonical {
		anchor.ExecutionBlock++
		anchor.BlockHash = record.Consensus.Header.ExecutionPayloadHash
		calls := record.Consensus.Body.SystemCalls
		if len(calls) > 0 {
			anchor.LastSequence = calls[len(calls)-1].Sequence
		}
		n := anchor.ExecutionBlock
		expects, err := expected(record.Outcomes)
		if err != nil {
			fail(n, err)
			return
		}
		r.Issuance.GrossScheduled = sum(r.Issuance.GrossScheduled, sys.GrossBlockIssuance(n).String())
		for cursor < len(allLogs) && allLogs[cursor].BlockNumber == n {
			log := allLogs[cursor]
			cursor++
			key := eventKey(log)
			if _, ok := executionEvents[key]; ok {
				r.issue("DUPLICATE_EXECUTION_EVENT", n, key, "one", "multiple")
				continue
			}
			executionEvents[key] = log
			e, _ := Decode(log)
			if consensusEvent(e.Name) {
				found := -1
				for i := range expects {
					if match(&expects[i], e) {
						found = i
						break
					}
				}
				if found < 0 {
					r.issue("CONTRADICTORY_CONSENSUS_EVENT", n, key, "certified outcome", e.Name)
					continue
				}
				expects[found].used = true
				if slash := expects[found].slash; slash != nil {
					if r.State.get(vk(hex32(slash.ValidatorID), "owned")) != slash.OwnedBond.String() || r.State.get(vk(hex32(slash.ValidatorID), "credit")) != slash.ProtocolCredit.String() {
						r.issue("CONSENSUS_COLLATERAL_MISMATCH", n, hex32(slash.ValidatorID), "certified pre-slash composition", "different execution custody")
					}
				}
			}
			if e.Name == "SlashApplied" {
				evidence := e.Fields["evidenceHash"]
				if seenEvidence[evidence] {
					r.issue("DUPLICATE_SLASH_EVIDENCE", n, key, "unused evidence", evidence)
					continue
				}
				seenEvidence[evidence] = true
			}
			if err := Apply(r.State, e, n, record.Outcomes.Reward); err != nil {
				r.issue("CONTRADICTORY_ACCOUNTING_EVENT", n, key, "consistent ordered transition", err.Error())
			}
		}
		for _, e := range expects {
			if !e.used {
				r.issue("MISSING_CONSENSUS_EVENT", n, e.name, fmt.Sprint(e.fields), "absent")
			}
		}
		r.State["rewardAppliedCurrent"] = "0"
		if record.Outcomes.Reward != nil {
			r.State["rewardAppliedCurrent"] = "1"
		}
		if err = source.Anchor(ctx, anchor); err != nil {
			fail(n, err)
			return
		}
		actual, err := source.State(ctx, anchor, idList, accountList)
		if err != nil {
			fail(n, err)
			return
		}
		compare(&r, n, r.State, actual)
		for _, id := range idList {
			credit := sum(r.State.get(vk(id, "credit")), r.State.get(vk(id, "pending")))
			if credit != r.State.get(ck(id, "funded")) {
				r.issue("CREDIT_CUSTODY_DIVERGENCE", n, id, credit, r.State.get(ck(id, "funded")))
			}
		}
	}
	if index.ChainID != 420 || index.Height != r.Block || !strings.EqualFold(index.Hash, r.BlockHash) {
		r.issue("INDEXER_CHECKPOINT_MISMATCH", index.Height, "indexer", fmt.Sprintf("420:%d:%s", r.Block, r.BlockHash), fmt.Sprintf("%d:%d:%s", index.ChainID, index.Height, index.Hash))
	}
	finalHeight := snapshot.Trust.Execution.ExecutionBlock
	finalHash := hex32(snapshot.Trust.Execution.BlockHash)
	for _, record := range snapshot.Canonical {
		if record.Certificate.BlockRoot == snapshot.Finalized.Root {
			finalHeight, _ = strconv.ParseUint(strings.TrimPrefix(record.Payload.BlockNumber, "0x"), 16, 64)
			finalHash = string(record.Payload.BlockHash)
		}
	}
	if index.FinalizedHeight != finalHeight || !strings.EqualFold(index.FinalizedHash, finalHash) {
		r.issue("INDEXER_FINALIZED_CHECKPOINT_MISMATCH", index.FinalizedHeight, "finalized", fmt.Sprintf("%d:%s", finalHeight, finalHash), fmt.Sprintf("%d:%s", index.FinalizedHeight, index.FinalizedHash))
	}
	for n, hash := range canonical {
		if !strings.EqualFold(index.Blocks[n], hash) {
			r.issue("INDEXER_CANONICAL_BLOCK_MISMATCH", n, "block", hash, index.Blocks[n])
		}
	}
	indexed := map[string]bool{}
	for _, log := range index.Logs {
		if !relevant(log) {
			continue
		}
		key := eventKey(log)
		if indexed[key] {
			r.issue("DUPLICATE_INDEXER_EVENT", log.BlockNumber, key, "one", "multiple")
			continue
		}
		indexed[key] = true
		if log.ChainID != 420 || !strings.EqualFold(canonical[log.BlockNumber], log.BlockHash) {
			r.issue("ORPHANED_INDEXER_EVENT", log.BlockNumber, key, canonical[log.BlockNumber], log.BlockHash)
			continue
		}
		authoritative, ok := executionEvents[key]
		if !ok {
			r.issue("EXTRA_INDEXER_EVENT", log.BlockNumber, key, "absent in execution", "present")
		} else if !equalLog(authoritative, log) {
			r.issue("CONTRADICTORY_INDEXER_EVENT", log.BlockNumber, key, "exact execution ABI/log identity", "different")
		}
	}
	for _, key := range sortedKeys(executionEvents) {
		if !indexed[key] {
			log := executionEvents[key]
			r.issue("MISSING_INDEXER_EVENT", log.BlockNumber, key, "present", "absent")
		}
	}
	r.Issuance.NativePaid=r.State.get("nativeRewardPaid")
    r.Issuance.CommunityAccrued=r.State.get("communityRewardAccrued")
    r.Issuance.CommunityBacked=r.State.get("communityRewardBackingReceived")
    r.Issuance.CommunitySettled=r.State.get("communityRewardSettled")
    if r.Issuance.CommunityAccrued!=r.Issuance.CommunitySettled ||
       r.Issuance.CommunityBacked!=r.Issuance.CommunitySettled {
        r.issue("COMMUNITY_REWARD_UNSETTLED",r.Block,"community","equal accrual backing and physical settlement",fmt.Sprintf("%s/%s/%s",r.Issuance.CommunityAccrued,r.Issuance.CommunityBacked,r.Issuance.CommunitySettled))
    }
    if r.State.get(balance(Reward))!="0" {
        r.issue("REWARD_CONTROLLER_RESIDUAL_NATIVE",r.Block,"rewardBalance","0",r.State.get(balance(Reward)))
    }
	r.Issuance.Security = r.State.get("grossSecurityIssued")
	r.Issuance.Attention = r.State.get("grossAttentionIssued")
	r.Issuance.Development = r.State.get("grossDevelopmentIssued")
	r.Issuance.Realized = sum(sum(r.Issuance.Security, r.Issuance.Attention), r.Issuance.Development)
	if r.Issuance.NativePaid!=r.Issuance.Realized {
        r.issue("UNBACKED_REALIZED_ISSUANCE",r.Block,"nativeIssued",r.Issuance.Realized,r.Issuance.NativePaid)
    }
	nonIssued := new(big.Int).Sub(money(r.Issuance.GrossScheduled), money(r.Issuance.Realized))
	if nonIssued.Sign() < 0 {
		r.issue("ISSUANCE_EXCEEDS_SCHEDULE", r.Block, "issuance", r.Issuance.GrossScheduled, r.Issuance.Realized)
	}
	r.Issuance.NonIssued = nonIssued.String()
	if err := source.Anchor(ctx, snapshot.Anchor); err != nil {
		fail(r.Block, err)
	}
	sort.Slice(r.Discrepancies, func(i, j int) bool {
		a, b := r.Discrepancies[i], r.Discrepancies[j]
		return fmt.Sprintf("%020d:%s:%s:%s", a.Block, a.Code, a.Path, a.Actual) < fmt.Sprintf("%020d:%s:%s:%s", b.Block, b.Code, b.Path, b.Actual)
	})
	if len(r.Discrepancies) == 0 {
		r.Status = "RECONCILED"
	}
	return
}
