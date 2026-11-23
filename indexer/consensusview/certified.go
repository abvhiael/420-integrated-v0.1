package consensusview

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	rec "github.com/420integrated/420-integrated/consensus/recovery"
	"github.com/420integrated/420-integrated/indexer/model"
	"os"
	"strings"
)

// CertifiedProvider attributes indexed blocks directly to the production
// settlement history. It never turns execution or Indexer claims into authority.
type CertifiedProvider struct {
	dir    string
	trust  rec.Trust
	status *Provider
}

func NewCertified(dir, trustPath, pin, statusPath string) (*CertifiedProvider, error) {
	if dir == "" || trustPath == "" || len(pin) != 64 {
		return nil, fmt.Errorf("certified history, trust file and independent SHA-256 are required")
	}
	raw, err := os.ReadFile(trustPath)
	if err != nil {
		return nil, err
	}
	sum := sha256.Sum256(raw)
	if hex.EncodeToString(sum[:]) != pin {
		return nil, fmt.Errorf("certified consensus trust pin mismatch")
	}
	p := &CertifiedProvider{dir: dir}
	if err = rec.Decode(raw, &p.trust); err != nil {
		return nil, err
	}
	if _, err = rec.ReadCertifiedSnapshot(p.trust, p.dir); err != nil {
		return nil, err
	}
	if statusPath != "" {
		p.status, err = New(statusPath)
		if err != nil {
			return nil, err
		}
	}
	return p, nil
}
func (p *CertifiedProvider) ProducerForBlock(hash string) (model.BlockProducer, bool, error) {
	s, err := rec.ReadCertifiedSnapshot(p.trust, p.dir)
	if err != nil {
		return model.BlockProducer{}, false, err
	}
	for _, r := range s.Canonical {
		if strings.EqualFold(string(r.Payload.BlockHash), hash) {
			h := r.Consensus.Header
			return model.BlockProducer{ConsensusSlot: h.Slot, ProducerSeat: h.ProposerSeat, ProposerRank: h.ProposerRank, ConsensusBlockRoot: rootString(r.Certificate.BlockRoot), Certified: true}, true, nil
		}
	}
	return model.BlockProducer{}, false, nil
}
// ValidateIngestion verifies the independently pinned history required for
// producer attribution. An optional schedule must agree with that history.
func (p *CertifiedProvider) ValidateIngestion() error {
	if p.status != nil {
		_, err := p.Consensus()
		return err
	}
	_, err := rec.ReadCertifiedSnapshot(p.trust, p.dir)
	return err
}
func (p *CertifiedProvider) Consensus() (model.ConsensusStatus, error) {
	// Signed settlement history certifies previous outcomes, not a future proposer
	// schedule. An optional operational status projection must match that history.
	if p.status == nil {
		return model.ConsensusStatus{}, fmt.Errorf("%w: certified history has no future proposer schedule", ErrUnavailable)
	}
	s, err := rec.ReadCertifiedSnapshot(p.trust, p.dir)
	if err != nil {
		return model.ConsensusStatus{}, err
	}
	status, err := p.status.Consensus()
	if err != nil {
		return model.ConsensusStatus{}, err
	}
	if status.Head.Root != rootString(s.Head.Root) || status.Head.Slot != s.Head.Slot || status.Finalized.Root != rootString(s.Finalized.Root) || status.Finalized.Slot != s.Finalized.Slot {
		return model.ConsensusStatus{}, fmt.Errorf("%w: operational status differs from certified history", ErrInvalidStatus)
	}
	return status, nil
}
