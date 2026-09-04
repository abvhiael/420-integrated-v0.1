package types

import (
	"encoding/hex"
	"fmt"

	"github.com/420integrated/420-integrated/consensus/ssz"
)

type Root = ssz.Root

type BLSPubkey [48]byte
type BLSSignature [96]byte

type Checkpoint struct {
	Slot uint64
	Root Root
}

func (c Checkpoint) HashTreeRoot() Root {
	return ssz.Container(
		ssz.Uint64Root(c.Slot),
		ssz.Bytes32Root(c.Root),
	)
}

type AttestationData struct {
	Slot       uint64
	BlockRoot  Root
	ParentRoot Root
	Source     Checkpoint
	Target     Checkpoint
}

func (a AttestationData) HashTreeRoot() Root {
	return ssz.Container(
		ssz.Uint64Root(a.Slot),
		ssz.Bytes32Root(a.BlockRoot),
		ssz.Bytes32Root(a.ParentRoot),
		a.Source.HashTreeRoot(),
		a.Target.HashTreeRoot(),
	)
}

type Attestation struct {
	Seat      uint16
	Data      AttestationData
	Signature BLSSignature
}

type QuorumCertificate struct {
	Slot               uint64
	BlockRoot          Root
	ParentRoot         Root
	CommitteeRoot      Root
	ProtocolVersion    uint32
	SignerBitmap       []byte
	AggregateSignature BLSSignature
}

func (q QuorumCertificate) SigningDataRoot() Root {
	return ssz.Container(
		ssz.Uint64Root(q.Slot),
		ssz.Bytes32Root(q.BlockRoot),
		ssz.Bytes32Root(q.ParentRoot),
		ssz.Bytes32Root(q.CommitteeRoot),
		ssz.Uint32Root(q.ProtocolVersion),
	)
}

// ConsensusBlock commits the execution payload and every consensus-owned execution
// instruction. SystemCallBatchRoot is the canonical SHA-256 root produced by
// consensus/systemcall.Batch.Root and must equal the paired execution header extraData.
type ConsensusBlock struct {
	Slot                 uint64
	ProposerSeat         uint16
	ProposerRank         uint8
	ParentConsensusRoot  Root
	ExecutionPayloadHash Root
	ConsensusStateRoot   Root
	CommitteeRoot        Root
	Rotation             uint64
	LatestQC             QuorumCertificate
	RandomnessContext    Root
	SystemCallBatchRoot  Root
}

func (b ConsensusBlock) HashTreeRoot() Root {
	return ssz.Container(
		ssz.Uint64Root(b.Slot),
		ssz.Uint64Root(uint64(b.ProposerSeat)),
		ssz.Uint64Root(uint64(b.ProposerRank)),
		ssz.Bytes32Root(b.ParentConsensusRoot),
		ssz.Bytes32Root(b.ExecutionPayloadHash),
		ssz.Bytes32Root(b.ConsensusStateRoot),
		ssz.Bytes32Root(b.CommitteeRoot),
		ssz.Uint64Root(b.Rotation),
		b.LatestQC.SigningDataRoot(),
		ssz.Bytes32Root(b.RandomnessContext),
		ssz.Bytes32Root(b.SystemCallBatchRoot),
	)
}

func ParseRoot(s string) (Root, error) {
	var r Root
	if len(s) >= 2 && s[:2] == "0x" { s = s[2:] }
	b, err := hex.DecodeString(s)
	if err != nil { return r, err }
	if len(b) != 32 { return r, fmt.Errorf("root must be 32 bytes, got %d", len(b)) }
	copy(r[:], b)
	return r, nil
}
