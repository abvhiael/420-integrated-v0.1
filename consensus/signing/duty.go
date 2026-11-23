// Package signing implements the production validator signing boundary. It has
// no Wallet/owner signing, opaque-root signing, or deterministic signature mode.
package signing

import (
	"fmt"
	cc "github.com/420integrated/420-integrated/consensus/crypto"
	"github.com/420integrated/420-integrated/consensus/slashing"
	ct "github.com/420integrated/420-integrated/consensus/types"
	"slices"
)

type Policy struct {
	Identity        slashing.HistoryIdentity
	ProtocolVersion uint32
	CommitteeRoot   ct.Root
	Seat            uint16
	Rotations       []uint64 `json:",omitempty"`
}
type Duty struct {
	ChainID         uint64
	Genesis         ct.Root
	ValidatorID     uint64
	ProtocolVersion uint32
	Kind            string
	Proposal        *ct.ConsensusBlock  `json:",omitempty"`
	Vote            *ct.AttestationData `json:",omitempty"`
}
type Result struct {
	PublicKey   ct.BLSPubkey
	SigningRoot ct.Root
	Signature   ct.BLSSignature
}

func (p Policy) Validate() error {
	if p.Identity.ChainID != ct.ChainID || p.Identity.Genesis == (ct.Root{}) || p.Identity.PublicKey == (ct.BLSPubkey{}) || p.ProtocolVersion != 1 || p.CommitteeRoot == (ct.Root{}) || p.Seat >= 30 {
		return fmt.Errorf("invalid protected signing policy")
	}
	for i, rotation := range p.Rotations {
		if i > 0 && rotation <= p.Rotations[i-1] {
			return fmt.Errorf("protected signing rotations must be strictly increasing")
		}
	}
	return nil
}

// AllowsRotation limits policies with an explicit activation schedule.
func (p Policy) AllowsRotation(rotation uint64) bool {
	return len(p.Rotations) == 0 || slices.Contains(p.Rotations, rotation)
}

// Root derives the signing root from a complete typed duty. Callers cannot
// supply a domain or an opaque signing root. Protocol domains remain frozen.
func (p Policy) Root(d Duty) (ct.Root, error) {
	if err := p.Validate(); err != nil {
		return ct.Root{}, err
	}
	if d.ChainID != p.Identity.ChainID || d.Genesis != p.Identity.Genesis || d.ValidatorID != p.Identity.ValidatorID || d.ProtocolVersion != p.ProtocolVersion {
		return ct.Root{}, slashing.ErrInvalidDuty
	}
	switch d.Kind {
	case "proposal":
		b := d.Proposal
		if b == nil || d.Vote != nil || b.Slot == 0 || b.ProposerSeat != p.Seat || b.ProposerRank > 2 || b.CommitteeRoot != p.CommitteeRoot || !p.AllowsRotation(b.Slot/ct.SlotsPerRotation) || (len(p.Rotations) > 0 && b.Rotation != b.Slot/ct.SlotsPerRotation) || b.ParentConsensusRoot == (ct.Root{}) || b.ExecutionPayloadHash == (ct.Root{}) || b.ConsensusStateRoot == (ct.Root{}) || b.SystemCallBatchRoot == (ct.Root{}) {
			return ct.Root{}, slashing.ErrInvalidDuty
		}
		return cc.SigningRoot(cc.DomainBlockProposal, d.ChainID, d.ProtocolVersion, b.HashTreeRoot()), nil
	case "attestation", "qc-vote":
		v := d.Vote
		if v == nil || d.Proposal != nil || v.Source.Slot >= v.Target.Slot || v.Target.Slot > v.Slot || !p.AllowsRotation(v.Slot/ct.SlotsPerRotation) || v.BlockRoot == (ct.Root{}) || v.ParentRoot == (ct.Root{}) || v.Source.Root == (ct.Root{}) || v.Target.Root == (ct.Root{}) {
			return ct.Root{}, slashing.ErrInvalidDuty
		}
		if d.Kind == "attestation" {
			return cc.SigningRoot(cc.DomainAttestation, d.ChainID, d.ProtocolVersion, v.HashTreeRoot()), nil
		}
		qc := ct.QuorumCertificate{Slot: v.Slot, BlockRoot: v.BlockRoot, ParentRoot: v.ParentRoot, CommitteeRoot: p.CommitteeRoot, ProtocolVersion: d.ProtocolVersion}
		return cc.SigningRoot(cc.DomainQC, d.ChainID, d.ProtocolVersion, qc.SigningDataRoot()), nil
	default:
		// No frozen recovery-message type/domain exists in this protocol package.
		// In particular, never reinterpret recovery requests as proposals or votes.
		return ct.Root{}, slashing.ErrInvalidDuty
	}
}
func (p Policy) Reserve(protector *slashing.Protector, d Duty) (ct.Root, error) {
	root, err := p.Root(d)
	if err != nil {
		return ct.Root{}, err
	}
	if protector == nil {
		return ct.Root{}, slashing.ErrHistoryUnavailable
	}
	if d.Kind == "proposal" {
		err = protector.CheckAndRecordProposal(d.ValidatorID, d.Proposal.Slot, d.Proposal.HashTreeRoot())
	} else {
		kind := d.Kind
		if kind == "attestation" {
			kind = "attestation-data"
		}
		err = protector.CheckAndRecordSigningVote(d.ValidatorID, *d.Vote, root, kind)
	}
	return root, err
}
