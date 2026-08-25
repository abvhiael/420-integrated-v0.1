package committee15

import (
	"crypto/sha256"
	"fmt"

	"github.com/420integrated/420-integrated/consensus/attestation"
	ccrypto "github.com/420integrated/420-integrated/consensus/crypto"
	"github.com/420integrated/420-integrated/consensus/finality"
	"github.com/420integrated/420-integrated/consensus/proposer"
	"github.com/420integrated/420-integrated/consensus/slashing"
	ctypes "github.com/420integrated/420-integrated/consensus/types"
	"github.com/420integrated/420-integrated/consensus/validator"
)

type TestCrypto struct {
	Pubkeys []ctypes.BLSPubkey
}

func NewTestCrypto(n int) *TestCrypto {
	pks := make([]ctypes.BLSPubkey, n)
	for i := range pks {
		for j := range pks[i] {
			pks[i][j] = byte(i + j + 1)
		}
	}
	return &TestCrypto{Pubkeys: pks}
}

func pseudoSig(pk ctypes.BLSPubkey, message []byte) ctypes.BLSSignature {
	h := sha256.New()
	h.Write(pk[:])
	h.Write(message)
	sum := h.Sum(nil)
	var sig ctypes.BLSSignature
	for i := range sig {
		sig[i] = sum[i%len(sum)]
	}
	return sig
}

func (t *TestCrypto) Sign(seat int, message []byte) ctypes.BLSSignature {
	return pseudoSig(t.Pubkeys[seat], message)
}

func (t *TestCrypto) Aggregate(sigs []ctypes.BLSSignature) (ctypes.BLSSignature, error) {
	h := sha256.New()
	for _, s := range sigs {
		h.Write(s[:])
	}
	sum := h.Sum(nil)
	var out ctypes.BLSSignature
	for i := range out {
		out[i] = sum[i%len(sum)]
	}
	return out, nil
}

func (t *TestCrypto) VerifyAggregate(pubkeys []ctypes.BLSPubkey, message []byte, sig ctypes.BLSSignature) bool {
	// Rebuild aggregate from per-pubkey pseudo signatures.
	sigs := make([]ctypes.BLSSignature, 0, len(pubkeys))
	for _, pk := range pubkeys {
		sigs = append(sigs, pseudoSig(pk, message))
	}
	want, _ := t.Aggregate(sigs)
	return want == sig
}

type Result struct {
	ScheduledPrimary uint16
	UsedRank         uint8
	UsedSeat         uint16
	Attestations     int
	QCThreshold      int
	FinalizedSlot    uint64
}

func RunOneSlot(primaryAvailable, fb1Available bool) (Result, error) {
	seats := make([]validator.Seat, 15)
	seatIDs := make([]uint16, 15)
	for i := 0; i < 15; i++ {
		seats[i] = validator.Seat{ID: uint16(i), OccupantID: uint64(1000 + i), ActivatedAt: 0, ExitAt: 3}
		seatIDs[i] = uint16(i)
	}
	committee, err := validator.NewCommittee(0, seats)
	if err != nil {
		return Result{}, err
	}

	var seed [32]byte
	copy(seed[:], []byte("420-step4.4-deterministic-seed"))
	schedule, err := proposer.GenerateRotationSchedule(seatIDs, seed, 0)
	if err != nil {
		return Result{}, err
	}
	slot0 := schedule[0]

	usedSeat := slot0.Primary
	usedRank := uint8(0)
	if !primaryAvailable {
		usedSeat = slot0.Fallback1
		usedRank = 1
		if !fb1Available {
			usedSeat = slot0.Fallback2
			usedRank = 2
		}
	}

	var parent, block ctypes.Root
	parent[31] = 1
	block[31] = 2

	data := ctypes.AttestationData{
		Slot: 0, BlockRoot: block, ParentRoot: parent,
		Source: ctypes.Checkpoint{Slot: 0, Root: parent},
		Target: ctypes.Checkpoint{Slot: 0, Root: block},
	}
	collector := attestation.NewCollector(15, data)
	crypto := NewTestCrypto(15)
	protector := slashing.NewProtector()

	qcSkeleton := ctypes.QuorumCertificate{
		Slot: data.Slot, BlockRoot: data.BlockRoot, ParentRoot: data.ParentRoot,
		CommitteeRoot: committee.HashTreeRoot(), ProtocolVersion: 1,
		SignerBitmap: make([]byte, finality.BitmapBytes(15)),
	}
	qcSigningRoot := ccrypto.SigningRoot(ccrypto.DomainQC, ctypes.ChainID, 1, qcSkeleton.SigningDataRoot())

	for seat := 0; seat < 11; seat++ {
		if err := protector.CheckAndRecordAttestation(uint64(1000+seat), data.Slot, data.BlockRoot); err != nil {
			return Result{}, err
		}
		att := ctypes.Attestation{Seat: uint16(seat), Data: data, Signature: crypto.Sign(seat, qcSigningRoot[:])}
		if err := collector.Add(att); err != nil {
			return Result{}, err
		}
	}
	qc, err := collector.AssembleQC(1, committee.HashTreeRoot(), crypto)
	if err != nil {
		return Result{}, err
	}
	if err := finality.VerifyQC(qc, crypto.Pubkeys, ctypes.ChainID, crypto); err != nil {
		return Result{}, fmt.Errorf("assembled QC failed verification: %w", err)
	}

	tracker := finality.NewTracker(ctypes.Checkpoint{Slot: 0, Root: parent})
	// Parent cert then child cert so parent finalizes.
	parentQC := qc
	parentQC.Slot = 1
	parentQC.BlockRoot = block
	parentQC.ParentRoot = parent
	if err := tracker.AddCertified(parentQC); err != nil {
		return Result{}, err
	}

	var child ctypes.Root
	child[31] = 3
	childQC := parentQC
	childQC.Slot = 2
	childQC.ParentRoot = block
	childQC.BlockRoot = child
	if err := tracker.AddCertified(childQC); err != nil {
		return Result{}, err
	}

	return Result{
		ScheduledPrimary: slot0.Primary,
		UsedRank:         usedRank,
		UsedSeat:         usedSeat,
		Attestations:     collector.Count(),
		QCThreshold:      finality.QuorumThreshold(15),
		FinalizedSlot:    tracker.Status().Finalized.Slot,
	}, nil
}
