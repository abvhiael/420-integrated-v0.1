package systemcall

import (
	"encoding/hex"
	"errors"
	"math/big"
	"path/filepath"
	"testing"
)

func repeated32(v byte) (out [32]byte) {
	for i := range out {
		out[i] = v
	}
	return out
}

func repeatedAddress(v byte) (out Address) {
	for i := range out {
		out[i] = v
	}
	return out
}

func tokenAmount(v int64) *big.Int {
	return new(big.Int).Mul(big.NewInt(v), big.NewInt(1_000_000_000_000_000_000))
}

func mustHex(t *testing.T, raw string) []byte {
	t.Helper()
	out, err := hex.DecodeString(raw)
	if err != nil {
		t.Fatal(err)
	}
	return out
}

func TestStakeABIPayloadVectors(t *testing.T) {
	state := ValidatorStateOutcome{
		ValidatorID: repeated32(0x03), Status: StatusActive, EffectiveSlot: 4201,
		ActivationRotation: 2, ScheduledExitRotation: 5,
	}
	statePayload, err := EncodeValidatorStatePayload(state)
	if err != nil {
		t.Fatal(err)
	}
	stateVector := "17e619d80303030303030303030303030303030303030303030303030303030303030303" +
		"0000000000000000000000000000000000000000000000000000000000000004" +
		"0000000000000000000000000000000000000000000000000000000000001069" +
		"0000000000000000000000000000000000000000000000000000000000000002" +
		"0000000000000000000000000000000000000000000000000000000000000005" +
		"0000000000000000000000000000000000000000000000000000000000000000"
	if got, want := hex.EncodeToString(statePayload), stateVector; got != want {
		t.Fatalf("validator-state calldata\ngot  %s\nwant %s", got, want)
	}

	exitPayload, err := EncodeExitNoticePayload(ExitNoticeOutcome{ValidatorID: repeated32(0x01), NoticeRotation: 2})
	if err != nil {
		t.Fatal(err)
	}
	exitVector := "3dc84ed00101010101010101010101010101010101010101010101010101010101010101" +
		"0000000000000000000000000000000000000000000000000000000000000002"
	if got, want := hex.EncodeToString(exitPayload), exitVector; got != want {
		t.Fatalf("exit calldata\ngot  %s\nwant %s", got, want)
	}

	slash := SlashOutcome{
		Ordinal: 1, ValidatorID: repeated32(0x02), Offense: SlashDoubleProposal,
		CorrelationTier: 1, OwnedBond: tokenAmount(30_000), ProtocolCredit: tokenAmount(12_000),
		PenaltyBps: 1_000, EvidenceHash: repeated32(0xaa), ResultingStatus: StatusSuspended,
	}
	settlement, err := DeriveSlashSettlement(slash)
	if err != nil {
		t.Fatal(err)
	}
	if settlement.OwnedSlashed.Cmp(tokenAmount(3_000)) != 0 || settlement.CreditSlashed.Cmp(tokenAmount(1_200)) != 0 {
		t.Fatalf("unexpected slash settlement owned=%s credit=%s", settlement.OwnedSlashed, settlement.CreditSlashed)
	}
	slashPayload, err := EncodeSlashPayload(slash, settlement)
	if err != nil {
		t.Fatal(err)
	}
	slashVector := "0c6c52040202020202020202020202020202020202020202020202020202020202020202" +
		"0000000000000000000000000000000000000000000000000000000000000003" +
		"0000000000000000000000000000000000000000000000000000000000000001" +
		"0000000000000000000000000000000000000000000000a2a15d09519be00000" +
		"0000000000000000000000000000000000000000000000410d586a20a4c00000" +
		"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" +
		"0000000000000000000000000000000000000000000000000000000000000006"
	if got, want := hex.EncodeToString(slashPayload), slashVector; got != want {
		t.Fatalf("slash calldata\ngot  %s\nwant %s", got, want)
	}

	rotationPayload, err := EncodeRotationSnapshotPayload(RotationSnapshotOutcome{Rotation: 2, EligibleSnapshot: 60})
	if err != nil {
		t.Fatal(err)
	}
	rotationVector := "6594414c" +
		"0000000000000000000000000000000000000000000000000000000000000002" +
		"000000000000000000000000000000000000000000000000000000000000003c"
	if got, want := hex.EncodeToString(rotationPayload), rotationVector; got != want {
		t.Fatalf("rotation calldata\ngot  %s\nwant %s", got, want)
	}

	reward := RewardOutcome{
		BlockNumber: 4201, Proposer: repeatedAddress(0x11),
		Participants: []Address{repeatedAddress(0x33), repeatedAddress(0x22)}, ActiveCount: 15,
	}
	rewardSettlement, err := DeriveRewardSettlement(reward)
	if err != nil {
		t.Fatal(err)
	}
	rewardPayload, err := EncodeRewardPayload(reward, rewardSettlement)
	if err != nil {
		t.Fatal(err)
	}
	rewardVector := "ac11b5e1" +
		"0000000000000000000000000000000000000000000000000000000000001069" +
		"0000000000000000000000001111111111111111111111111111111111111111" +
		"00000000000000000000000000000000000000000000000000000000000000e0" +
		"0000000000000000000000000000000000000000000000000842b5e4d76de040" +
		"00000000000000000000000000000000000000000000000000970cfe0f6346e0" +
		"00000000000000000000000000000000000000000000000014e1fcfad4e41fc0" +
		"00000000000000000000000000000000000000000000000014e1fcfad4e41fc0" +
		"0000000000000000000000000000000000000000000000000000000000000002" +
		"0000000000000000000000002222222222222222222222222222222222222222" +
		"0000000000000000000000003333333333333333333333333333333333333333"
	if got, want := hex.EncodeToString(rewardPayload), rewardVector; got != want {
		t.Fatalf("reward calldata\ngot  %s\nwant %s", got, want)
	}
}

func TestRewardArithmeticDeterministicAndConservative(t *testing.T) {
	out := RewardOutcome{
		BlockNumber: 4201, Proposer: repeatedAddress(0x11),
		Participants: []Address{repeatedAddress(0x22), repeatedAddress(0x33)}, ActiveCount: 15,
	}
	got, err := DeriveRewardSettlement(out)
	if err != nil {
		t.Fatal(err)
	}
	checks := map[string]struct {
		got  *big.Int
		want string
	}{
		"gross":       {got.GrossScheduled, "4200000000000000000"},
		"security":    {got.SecurityScheduled, "1190476190475600000"},
		"attention":   {got.AttentionAmount, "1504761904762200000"},
		"development": {got.DevelopmentAmount, "1504761904762200000"},
		"proposer":    {got.ProposerAmount, "595238095237800000"},
		"participant": {got.PerParticipantAmount, "42517006802700000"},
	}
	for name, check := range checks {
		if check.got.String() != check.want {
			t.Fatalf("%s got=%s want=%s", name, check.got, check.want)
		}
	}
	realized := new(big.Int).Add(new(big.Int).Set(got.AttentionAmount), got.DevelopmentAmount)
	realized.Add(realized, got.ProposerAmount)
	realized.Add(realized, new(big.Int).Mul(got.PerParticipantAmount, big.NewInt(int64(len(got.Participants)))))
	if realized.Cmp(got.GrossScheduled) > 0 {
		t.Fatalf("realized issuance exceeds gross: %s > %s", realized, got.GrossScheduled)
	}
	if GrossBlockIssuance(142_800_000).Cmp(floorBlockIssuance) != 0 {
		t.Fatal("issuance floor not active at frozen floor era")
	}
	scale16, err := SecurityAllocationScale(16)
	if err != nil {
		t.Fatal(err)
	}
	want16 := minSecurityAllocation + (maxSecurityAllocation-minSecurityAllocation)/15
	if scale16 != want16 {
		t.Fatalf("transitional active-count scale=%d want=%d", scale16, want16)
	}
}

func TestRewardRejectsMalformedParticipantSets(t *testing.T) {
	proposer := repeatedAddress(0x11)
	_, err := DeriveRewardSettlement(RewardOutcome{
		BlockNumber: 10, Proposer: proposer, ActiveCount: 15,
		Participants: []Address{repeatedAddress(0x22), repeatedAddress(0x22)},
	})
	if !errors.Is(err, ErrInvalidStakeOutcome) {
		t.Fatalf("duplicate participant err=%v", err)
	}
	_, err = DeriveRewardSettlement(RewardOutcome{
		BlockNumber: 10, Proposer: proposer, ActiveCount: 15,
		Participants: []Address{proposer},
	})
	if !errors.Is(err, ErrInvalidStakeOutcome) {
		t.Fatalf("proposer participant err=%v", err)
	}
}

func TestSlashBoundsAndFinality(t *testing.T) {
	base := SlashOutcome{
		Ordinal: 1, ValidatorID: repeated32(0x01), Offense: SlashDoubleProposal,
		CorrelationTier: 0, OwnedBond: tokenAmount(21_000), ProtocolCredit: tokenAmount(21_000),
		EvidenceHash: repeated32(0x99), ResultingStatus: StatusSuspended,
	}
	base.PenaltyBps = 501
	if _, err := DeriveSlashSettlement(base); !errors.Is(err, ErrInvalidStakeOutcome) {
		t.Fatalf("over-ceiling slash err=%v", err)
	}
	base.Offense = SlashFinalityEquivocation
	base.PenaltyBps = 10_000
	got, err := DeriveSlashSettlement(base)
	if err != nil {
		t.Fatal(err)
	}
	if got.OwnedSlashed.Cmp(base.OwnedBond) != 0 || got.CreditSlashed.Cmp(base.ProtocolCredit) != 0 {
		t.Fatal("finality equivocation did not consume all collateral")
	}
}

func TestBuildStakeBatchCanonicalOrderAndSequence(t *testing.T) {
	parent := repeated32(0x42)
	reward := RewardOutcome{
		BlockNumber: 101, Proposer: repeatedAddress(0x11), ActiveCount: 15,
		Participants: []Address{repeatedAddress(0x33), repeatedAddress(0x22)},
	}
	outcomes := FinalizedStakeOutcomes{
		Rotation: &RotationSnapshotOutcome{Rotation: 7, EligibleSnapshot: 60},
		ExitNotices: []ExitNoticeOutcome{
			{ValidatorID: repeated32(0x05), NoticeRotation: 7},
			{ValidatorID: repeated32(0x01), NoticeRotation: 7},
		},
		Slashes: []SlashOutcome{{
			Ordinal: 9, ValidatorID: repeated32(0x02), Offense: SlashDoubleProposal,
			OwnedBond: tokenAmount(42_000), ProtocolCredit: new(big.Int), PenaltyBps: 500,
			EvidenceHash: repeated32(0xaa), ResultingStatus: StatusSuspended,
		}},
		ValidatorStates: []ValidatorStateOutcome{
			{ValidatorID: repeated32(0x07), Status: StatusActive, EffectiveSlot: 100, ActivationRotation: 7, ScheduledExitRotation: 10},
			{ValidatorID: repeated32(0x03), Status: StatusEligible, EffectiveSlot: 100, ActivationRotation: 7},
		},
		Reward: &reward,
	}
	batch, err := BuildStakeBatch(DerivationContext{ExecutionBlock: 101, ParentHash: parent, ChainID: 420}, 41, outcomes)
	if err != nil {
		t.Fatal(err)
	}
	wantActions := []string{
		ActionRotation, ActionExitNotice, ActionExitNotice, ActionValidatorSlash,
		ActionValidatorState, ActionValidatorState, ActionReward,
	}
	if len(batch.Calls) != len(wantActions) {
		t.Fatalf("calls=%d", len(batch.Calls))
	}
	for i, want := range wantActions {
		if batch.Calls[i].Action != want || batch.Calls[i].Sequence != uint64(42+i) {
			t.Fatalf("call[%d]=%s seq=%d", i, batch.Calls[i].Action, batch.Calls[i].Sequence)
		}
	}
	if batch.Calls[1].Payload[4] != 0x01 || batch.Calls[2].Payload[4] != 0x05 {
		t.Fatal("exit notices not sorted by validator id")
	}
	if batch.Calls[4].Payload[4] != 0x03 || batch.Calls[5].Payload[4] != 0x07 {
		t.Fatal("validator states not sorted by validator id")
	}
}

func TestBuildRejectsAmbiguousMutation(t *testing.T) {
	id := repeated32(0x01)
	parent := repeated32(0x42)
	_, err := BuildStakeBatch(DerivationContext{ExecutionBlock: 1, ParentHash: parent, ChainID: 420}, 0, FinalizedStakeOutcomes{
		Slashes: []SlashOutcome{{
			Ordinal: 1, ValidatorID: id, Offense: SlashDoubleProposal,
			OwnedBond: tokenAmount(42_000), ProtocolCredit: new(big.Int), PenaltyBps: 500,
			EvidenceHash: repeated32(0xaa), ResultingStatus: StatusSuspended,
		}},
		ValidatorStates: []ValidatorStateOutcome{{ValidatorID: id, Status: StatusSuspended}},
	})
	if !errors.Is(err, ErrInvalidStakeOutcome) {
		t.Fatalf("ambiguous mutation err=%v", err)
	}
}

func TestSequenceManagerPersistenceAndExplicitRecovery(t *testing.T) {
	store := FileSequenceStore{Path: filepath.Join(t.TempDir(), "stake-sequence.json")}
	manager := SequenceManager{Store: store}
	parent := SequenceAnchor{ChainID: 420, ExecutionBlock: 100, BlockHash: repeated32(0x44), LastSequence: 9}

	if _, err := manager.RequireCanonicalParent(parent); !errors.Is(err, ErrSequenceRecoveryRequired) {
		t.Fatalf("missing journal should require explicit recovery: %v", err)
	}
	if err := manager.RecoverCanonicalParent(parent); err != nil {
		t.Fatal(err)
	}
	batch, err := manager.BuildNext(parent, FinalizedStakeOutcomes{
		Rotation: &RotationSnapshotOutcome{Rotation: 7, EligibleSnapshot: 60},
	})
	if err != nil {
		t.Fatal(err)
	}
	if batch.Calls[0].Sequence != 10 {
		t.Fatalf("sequence=%d", batch.Calls[0].Sequence)
	}
	childHash := repeated32(0x55)
	child, err := manager.CommitCanonicalChild(parent, childHash, batch)
	if err != nil {
		t.Fatal(err)
	}
	if child.LastSequence != 10 || child.ExecutionBlock != 101 {
		t.Fatalf("child=%+v", child)
	}

	restarted := SequenceManager{Store: FileSequenceStore{Path: store.Path}}
	if got, err := restarted.RequireCanonicalParent(child); err != nil || got != 10 {
		t.Fatalf("restart got=%d err=%v", got, err)
	}
	if _, err := restarted.RequireCanonicalParent(parent); !errors.Is(err, ErrSequenceRecoveryRequired) {
		t.Fatalf("stale parent accepted after commit: %v", err)
	}

	// Reorg recovery is explicit: the caller supplies a separately verified canonical
	// parent, and only then may the durable local cursor move backwards.
	alternate := SequenceAnchor{ChainID: 420, ExecutionBlock: 100, BlockHash: repeated32(0x66), LastSequence: 5}
	if err := restarted.RecoverCanonicalParent(alternate); err != nil {
		t.Fatal(err)
	}
	replacement, err := restarted.BuildNext(alternate, FinalizedStakeOutcomes{
		Rotation: &RotationSnapshotOutcome{Rotation: 7, EligibleSnapshot: 60},
	})
	if err != nil {
		t.Fatal(err)
	}
	if replacement.Calls[0].Sequence != 6 || replacement.ParentHash != alternate.BlockHash {
		t.Fatalf("replacement sequence/context incorrect: %+v", replacement.Calls[0])
	}
}

func TestVectorFixtureSanity(t *testing.T) {
	// Protect against accidental truncation of the known ABI vectors used in the
	// Solidity cross-language fixture.
	if len(mustHex(t, "17e619d8")) != 4 || len(mustHex(t, "ac11b5e1")) != 4 {
		t.Fatal("selector fixture length")
	}
}
