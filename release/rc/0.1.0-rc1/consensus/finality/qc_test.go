package finality

import (
	"crypto/sha256"
	"testing"

	ccrypto "github.com/420integrated/420-integrated/consensus/crypto"
	ctypes "github.com/420integrated/420-integrated/consensus/types"
)

type deterministicVerifier struct{}

func aggregateFor(pubkeys []ctypes.BLSPubkey, message []byte) ctypes.BLSSignature {
	h := sha256.New()
	for _, pk := range pubkeys {
		h.Write(pk[:])
	}
	h.Write(message)
	sum := h.Sum(nil)
	var sig ctypes.BLSSignature
	for i := range sig {
		sig[i] = sum[i%len(sum)]
	}
	return sig
}

func (deterministicVerifier) VerifyAggregate(pubkeys []ctypes.BLSPubkey, message []byte, sig ctypes.BLSSignature) bool {
	return aggregateFor(pubkeys, message) == sig
}

func TestFifteenSeatQCAndChainedFinality(t *testing.T) {
	const n = 15
	if QuorumThreshold(n) != 11 {
		t.Fatalf("threshold=%d want 11", QuorumThreshold(n))
	}

	pks := make([]ctypes.BLSPubkey, n)
	for i := range pks {
		for j := range pks[i] {
			pks[i][j] = byte(i + j + 1)
		}
	}

	var rootA, rootB, genesisRoot ctypes.Root
	rootA[31] = 0x0a
	rootB[31] = 0x0b
	genesisRoot[31] = 0x01

	makeQC := func(slot uint64, block, parent ctypes.Root) ctypes.QuorumCertificate {
		qc := ctypes.QuorumCertificate{
			Slot: slot, BlockRoot: block, ParentRoot: parent,
			ProtocolVersion: 1,
			SignerBitmap:    make([]byte, BitmapBytes(n)),
		}
		for i := 0; i < 11; i++ {
			SetSeat(qc.SignerBitmap, i)
		}
		signingRoot := ccrypto.SigningRoot(ccrypto.DomainQC, 420, 1, qc.SigningDataRoot())
		signers := make([]ctypes.BLSPubkey, 0, 11)
		for i := 0; i < 11; i++ {
			signers = append(signers, pks[i])
		}
		qc.AggregateSignature = aggregateFor(signers, signingRoot[:])
		return qc
	}

	qcA := makeQC(1, rootA, genesisRoot)
	if err := VerifyQC(qcA, pks, 420, deterministicVerifier{}); err != nil {
		t.Fatalf("qcA: %v", err)
	}
	qcB := makeQC(2, rootB, rootA)
	if err := VerifyQC(qcB, pks, 420, deterministicVerifier{}); err != nil {
		t.Fatalf("qcB: %v", err)
	}

	tr := NewTracker(ctypes.Checkpoint{Slot: 0, Root: genesisRoot})
	if err := tr.AddCertified(qcA); err != nil {
		t.Fatal(err)
	}
	if tr.Status().Finalized.Root != genesisRoot {
		t.Fatal("A must not finalize until certified child exists")
	}
	if err := tr.AddCertified(qcB); err != nil {
		t.Fatal(err)
	}
	if tr.Status().Finalized.Root != rootA {
		t.Fatal("expected A finalized")
	}
	if tr.Status().Safe.Root != rootB || tr.Status().Head.Root != rootB {
		t.Fatal("head/safe should be B")
	}
}

func TestQCRejectsTenOfFifteen(t *testing.T) {
	const n = 15
	pks := make([]ctypes.BLSPubkey, n)
	qc := ctypes.QuorumCertificate{
		ProtocolVersion: 1,
		SignerBitmap:    make([]byte, BitmapBytes(n)),
	}
	for i := 0; i < 10; i++ {
		SetSeat(qc.SignerBitmap, i)
	}
	if err := VerifyQC(qc, pks, 420, deterministicVerifier{}); err == nil {
		t.Fatal("10/15 must not certify")
	}
}
