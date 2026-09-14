package storage

import (
	"context"
	"encoding/binary"
	"encoding/hex"
	"errors"
	"strings"
	"time"
)

const maxStorageProofBytes = 65_536

var ErrProofSubmission = errors.New("storage proof submission failed")

type RPCProofSubmitter struct {
	Backend      RPCBackend
	Registry     string
	From         string
	PollInterval time.Duration
	ReceiptWait  time.Duration
}

func (s RPCProofSubmitter) SubmitProof(ctx context.Context, proof Proof) error {
	if !validHexAddress(s.Registry) || !validHexAddress(s.From) || len(proof.Payload) == 0 || len(proof.Payload) > maxStorageProofBytes {
		return ErrProofSubmission
	}
	commitmentID, err := bytes32Arg(proof.CommitmentID)
	if err != nil { return ErrProofSubmission }
	challengeID, err := bytes32Arg(proof.ChallengeID)
	if err != nil { return ErrProofSubmission }
	epoch := proof.Epoch.UTC().Unix()
	if epoch <= 0 { return ErrProofSubmission }

	data := encodeSubmitProof(commitmentID, challengeID, uint64(epoch), proof.Payload)
	var txHash string
	if err := s.Backend.call(ctx, "eth_sendTransaction", []interface{}{map[string]interface{}{
		"from": s.From,
		"to": s.Registry,
		"data": "0x" + hex.EncodeToString(data),
	}}, &txHash); err != nil || !validHash32(txHash) {
		return ErrProofSubmission
	}

	poll := s.PollInterval
	if poll <= 0 { poll = 250 * time.Millisecond }
	wait := s.ReceiptWait
	if wait <= 0 { wait = 30 * time.Second }
	deadline := time.Now().Add(wait)
	for {
		if err := ctx.Err(); err != nil { return err }
		if time.Now().After(deadline) { return context.DeadlineExceeded }
		var receipt *struct {
			Status string `json:"status"`
			Hash string `json:"transactionHash"`
		}
		err := s.Backend.call(ctx, "eth_getTransactionReceipt", []interface{}{txHash}, &receipt)
		if err == nil && receipt != nil {
			if !equalHex(receipt.Hash, txHash) || receipt.Status != "0x1" { return ErrProofSubmission }
			return nil
		}
		if err != nil && !errors.Is(err, ErrRPC) { return err }
		timer := time.NewTimer(poll)
		select {
		case <-ctx.Done():
			timer.Stop()
			return ctx.Err()
		case <-timer.C:
		}
	}
}

func encodeSubmitProof(commitmentID, challengeID [32]byte, epoch uint64, proof []byte) []byte {
	sig := keccak256([]byte("submitProof(bytes32,bytes32,uint64,bytes)"))
	padded := ((len(proof) + 31) / 32) * 32
	out := make([]byte, 4+32*4+32+padded)
	copy(out[:4], sig[:4])
	copy(out[4:36], commitmentID[:])
	copy(out[36:68], challengeID[:])
	binary.BigEndian.PutUint64(out[4+32*2+24:4+32*3], epoch)
	binary.BigEndian.PutUint64(out[4+32*3+24:4+32*4], 128)
	binary.BigEndian.PutUint64(out[4+32*4+24:4+32*5], uint64(len(proof)))
	copy(out[4+32*5:], proof)
	return out
}

func validHash32(v string) bool {
	v = strings.TrimSpace(v)
	if len(v) != 66 || !strings.HasPrefix(strings.ToLower(v), "0x") { return false }
	return isHex(v[2:])
}
