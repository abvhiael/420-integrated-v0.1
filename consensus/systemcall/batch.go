package systemcall

import (
	"crypto/sha256"
	"encoding/binary"
	"errors"
)

const BatchDomain = "420/CONSENSUS_SYSTEM_CALL_BATCH/V1"

var (
	ErrEmptyParent = errors.New("system-call batch parent hash is zero")
	ErrSequence    = errors.New("system-call batch sequence invalid")
	ErrCallContext = errors.New("system-call batch call context mismatch")
)

// Call is the consensus-owned representation of one execution-system instruction.
// Action is the canonical ASCII domain string and Target is the canonical 20-byte address.
type Call struct {
	Sequence       uint64
	ExecutionBlock uint64
	ParentHash     [32]byte
	ChainID        uint64
	Action         string
	Target         [20]byte
	Payload        []byte
}

// Batch is committed by the 420 consensus block and transported to the paired execution client.
type Batch struct {
	ExecutionBlock uint64
	ParentHash     [32]byte
	ChainID        uint64
	Calls          []Call
}

func (b Batch) Validate(previousSequence uint64) error {
	if b.ParentHash == ([32]byte{}) {
		return ErrEmptyParent
	}
	want := previousSequence + 1
	for i := range b.Calls {
		c := b.Calls[i]
		if c.Sequence != want || c.Sequence == 0 {
			return ErrSequence
		}
		if c.ExecutionBlock != b.ExecutionBlock || c.ParentHash != b.ParentHash || c.ChainID != b.ChainID {
			return ErrCallContext
		}
		want++
	}
	return nil
}

// Root returns the canonical SHA-256 batch commitment. The encoding is domain-separated,
// length-prefixed, and includes all context needed to prevent cross-block/cross-chain replay.
func (b Batch) Root() [32]byte {
	h := sha256.New()
	writeBytes(h, []byte(BatchDomain))
	writeU64(h, b.ChainID)
	writeU64(h, b.ExecutionBlock)
	h.Write(b.ParentHash[:])
	writeU64(h, uint64(len(b.Calls)))
	for i := range b.Calls {
		writeCall(h, b.Calls[i])
	}
	var out [32]byte
	copy(out[:], h.Sum(nil))
	return out
}

// CallCommitment returns the consensus-side SHA-256 commitment to one call.
// The EVM gateway separately computes its Keccak ABI callHash when the call executes.
func CallCommitment(c Call) [32]byte {
	h := sha256.New()
	writeBytes(h, []byte("420/CONSENSUS_SYSTEM_CALL_ITEM/V1"))
	writeCall(h, c)
	var out [32]byte
	copy(out[:], h.Sum(nil))
	return out
}

type writer interface { Write([]byte) (int, error) }

func writeCall(w writer, c Call) {
	writeU64(w, c.Sequence)
	writeU64(w, c.ExecutionBlock)
	w.Write(c.ParentHash[:])
	writeU64(w, c.ChainID)
	writeBytes(w, []byte(c.Action))
	w.Write(c.Target[:])
	writeBytes(w, c.Payload)
}

func writeBytes(w writer, b []byte) {
	writeU64(w, uint64(len(b)))
	w.Write(b)
}

func writeU64(w writer, v uint64) {
	var buf [8]byte
	binary.BigEndian.PutUint64(buf[:], v)
	w.Write(buf[:])
}
