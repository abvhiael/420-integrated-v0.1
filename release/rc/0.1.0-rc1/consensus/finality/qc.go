package finality

import (
	"errors"
	"fmt"
	"math/bits"

	ccrypto "github.com/420integrated/420-integrated/consensus/crypto"
	ctypes "github.com/420integrated/420-integrated/consensus/types"
)

var (
	ErrInsufficientQuorum = errors.New("insufficient quorum")
	ErrBitmapSize         = errors.New("invalid signer bitmap size")
)

func QuorumThreshold(n int) int {
	return (2*n)/3 + 1
}

func BitmapBytes(n int) int {
	return (n + 7) / 8
}

func CountSigners(bitmap []byte, committeeSize int) (int, error) {
	if len(bitmap) != BitmapBytes(committeeSize) {
		return 0, ErrBitmapSize
	}
	count := 0
	for _, b := range bitmap {
		count += bits.OnesCount8(b)
	}
	// reject bits outside committee range
	extra := len(bitmap)*8 - committeeSize
	if extra > 0 {
		mask := byte(0xff << (8 - extra))
		if bitmap[len(bitmap)-1]&mask != 0 {
			return 0, fmt.Errorf("bitmap sets seat outside committee")
		}
	}
	return count, nil
}

func SeatSigned(bitmap []byte, seat int) bool {
	if seat < 0 || seat/8 >= len(bitmap) {
		return false
	}
	return bitmap[seat/8]&(1<<uint(seat%8)) != 0
}

func SetSeat(bitmap []byte, seat int) {
	bitmap[seat/8] |= 1 << uint(seat%8)
}

type AggregateVerifier interface {
	VerifyAggregate(pubkeys []ctypes.BLSPubkey, message []byte, signature ctypes.BLSSignature) bool
}

func VerifyQC(qc ctypes.QuorumCertificate, committeePubkeys []ctypes.BLSPubkey, chainID uint64, verifier AggregateVerifier) error {
	count, err := CountSigners(qc.SignerBitmap, len(committeePubkeys))
	if err != nil {
		return err
	}
	if count < QuorumThreshold(len(committeePubkeys)) {
		return fmt.Errorf("%w: got %d want %d", ErrInsufficientQuorum, count, QuorumThreshold(len(committeePubkeys)))
	}

	signers := make([]ctypes.BLSPubkey, 0, count)
	for seat, pk := range committeePubkeys {
		if SeatSigned(qc.SignerBitmap, seat) {
			signers = append(signers, pk)
		}
	}
	root := ccrypto.SigningRoot(
		ccrypto.DomainQC,
		chainID,
		qc.ProtocolVersion,
		qc.SigningDataRoot(),
	)
	if verifier == nil || !verifier.VerifyAggregate(signers, root[:], qc.AggregateSignature) {
		return fmt.Errorf("aggregate signature verification failed")
	}
	return nil
}
