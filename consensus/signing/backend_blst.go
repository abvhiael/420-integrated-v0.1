//go:build blst

package signing

import (
	"context"
	"fmt"
	"github.com/420integrated/420-integrated/consensus/crypto/bls"
	"github.com/420integrated/420-integrated/consensus/slashing"
	"sync"
)

type Signer struct {
	mu        sync.Mutex
	policy    Policy
	key       *bls.SecretKey
	protector *slashing.Protector
	witness   *Witness
	failed    error
}

func NewSigner(policy Policy, ikm []byte, protector *slashing.Protector, witness *Witness) (*Signer, error) {
	if err := policy.Validate(); err != nil {
		return nil, err
	}
	key, pk, err := bls.SecretFromIKM(ikm)
	if err != nil {
		return nil, err
	}
	if pk != policy.Identity.PublicKey || protector == nil || witness == nil || witness.key != identityKey(policy) {
		key.Destroy()
		return nil, fmt.Errorf("signer identity/history/witness mismatch")
	}
	id, err := protector.HistoryIdentity()
	if err != nil || id != policy.Identity {
		key.Destroy()
		return nil, slashing.ErrHistoryUnavailable
	}
	return &Signer{policy: policy, key: key, protector: protector, witness: witness}, nil
}
func (s *Signer) Sign(ctx context.Context, d Duty) (Result, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.failed != nil {
		return Result{}, s.failed
	}
	root, err := s.policy.Root(d)
	if err != nil {
		return Result{}, err
	}
	err = s.witness.Commit(ctx, func() ([]byte, error) {
		if _, err := s.policy.Reserve(s.protector, d); err != nil {
			return nil, err
		}
		raw, err := s.protector.Snapshot()
		if err == nil {
			qualificationStage("local-reserved")
		}
		return raw, err
	})
	if err != nil {
		s.failed = err
		return Result{}, err
	}
	qualificationStage("witness-committed")
	if err = ctx.Err(); err != nil {
		s.failed = err
		return Result{}, err
	}
	signature, err := s.key.Sign(root[:])
	if err != nil {
		s.failed = err
		return Result{}, err
	}
	qualificationStage("signature-created")
	return Result{PublicKey: s.policy.Identity.PublicKey, SigningRoot: root, Signature: signature}, nil
}
func verifyResult(p Policy, d Duty, r Result) error {
	root, err := p.Root(d)
	if err != nil {
		return err
	}
	if root != r.SigningRoot || p.Identity.PublicKey != r.PublicKey || !bls.Verify(r.PublicKey, root[:], r.Signature) {
		return fmt.Errorf("remote signature identity/root/cryptography mismatch")
	}
	return nil
}

func backendReady() error { return nil }
func ValidateKey(p Policy, ikm []byte) error {
	if err := p.Validate(); err != nil {
		return err
	}
	key, pk, err := bls.SecretFromIKM(ikm)
	if err != nil {
		return err
	}
	defer key.Destroy()
	if pk != p.Identity.PublicKey {
		return fmt.Errorf("BLS key does not match independently pinned identity")
	}
	return nil
}
func (s *Signer) Close() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.failed = slashing.ErrHistoryUnavailable
	s.key.Destroy()
}
