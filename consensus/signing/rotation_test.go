package signing

import (
	"errors"
	"testing"

	"github.com/420integrated/420-integrated/consensus/slashing"
	ct "github.com/420integrated/420-integrated/consensus/types"
)

func TestPolicyRejectsRetiredRotationDuty(t *testing.T) {
	p := Policy{
		Identity: slashing.HistoryIdentity{
			ChainID: ct.ChainID, Genesis: ct.Root{1}, ValidatorID: 96,
			PublicKey: ct.BLSPubkey{2},
		},
		ProtocolVersion: 1, CommitteeRoot: ct.Root{3}, Rotations: []uint64{0, 2},
	}
	duty := Duty{
		ChainID: ct.ChainID, Genesis: p.Identity.Genesis, ValidatorID: 96,
		ProtocolVersion: 1, Kind: "qc-vote",
		Vote: &ct.AttestationData{
			Slot: 1, BlockRoot: ct.Root{4}, ParentRoot: p.Identity.Genesis,
			Source: ct.Checkpoint{Root: p.Identity.Genesis},
			Target: ct.Checkpoint{Root: ct.Root{4}, Slot: 1},
		},
	}
	if _, err := p.Root(duty); err != nil {
		t.Fatal(err)
	}
	duty.Vote.Slot = ct.SlotsPerRotation
	duty.Vote.Target.Slot = duty.Vote.Slot
	if _, err := p.Root(duty); !errors.Is(err, slashing.ErrInvalidDuty) {
		t.Fatalf("retired signer accepted replacement rotation duty: %v", err)
	}
	duty.Vote.Slot = 2 * ct.SlotsPerRotation
	duty.Vote.Target.Slot = duty.Vote.Slot
	if _, err := p.Root(duty); err != nil {
		t.Fatal(err)
	}
}
