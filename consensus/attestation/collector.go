package attestation

import (
	"errors"
	"fmt"
	"sync"

	ccrypto "github.com/420integrated/420-integrated/consensus/crypto"
	"github.com/420integrated/420-integrated/consensus/finality"
	ctypes "github.com/420integrated/420-integrated/consensus/types"
)

var (
	ErrDuplicateAttestation = errors.New("duplicate seat attestation")
	ErrWrongBlock           = errors.New("attestation does not match target block")
)

type SignatureAggregator interface {
	Aggregate(signatures []ctypes.BLSSignature) (ctypes.BLSSignature, error)
}

type Collector struct {
	mu            sync.Mutex
	committeeSize int
	data          ctypes.AttestationData
	bySeat        map[uint16]ctypes.Attestation
}

func NewCollector(committeeSize int, data ctypes.AttestationData) *Collector {
	return &Collector{
		committeeSize: committeeSize,
		data:          data,
		bySeat:        make(map[uint16]ctypes.Attestation),
	}
}

func (c *Collector) Add(att ctypes.Attestation) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	if int(att.Seat) >= c.committeeSize {
		return fmt.Errorf("seat %d outside committee", att.Seat)
	}
	if att.Data != c.data {
		return ErrWrongBlock
	}
	if _, exists := c.bySeat[att.Seat]; exists {
		return ErrDuplicateAttestation
	}
	c.bySeat[att.Seat] = att
	return nil
}

func (c *Collector) Count() int {
	c.mu.Lock()
	defer c.mu.Unlock()
	return len(c.bySeat)
}

func (c *Collector) HasQuorum() bool {
	return c.Count() >= finality.QuorumThreshold(c.committeeSize)
}

func (c *Collector) AssembleQC(protocolVersion uint32, committeeRoot ctypes.Root, agg SignatureAggregator) (ctypes.QuorumCertificate, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	threshold := finality.QuorumThreshold(c.committeeSize)
	if len(c.bySeat) < threshold {
		return ctypes.QuorumCertificate{}, fmt.Errorf("%w: got %d want %d", finality.ErrInsufficientQuorum, len(c.bySeat), threshold)
	}
	qc := ctypes.QuorumCertificate{
		Slot:            c.data.Slot,
		BlockRoot:       c.data.BlockRoot,
		ParentRoot:      c.data.ParentRoot,
		CommitteeRoot:   committeeRoot,
		ProtocolVersion: protocolVersion,
		SignerBitmap:    make([]byte, finality.BitmapBytes(c.committeeSize)),
	}

	sigs := make([]ctypes.BLSSignature, 0, len(c.bySeat))
	for seat := 0; seat < c.committeeSize; seat++ {
		if att, ok := c.bySeat[uint16(seat)]; ok {
			finality.SetSeat(qc.SignerBitmap, seat)
			sigs = append(sigs, att.Signature)
		}
	}
	combined, err := agg.Aggregate(sigs)
	if err != nil {
		return ctypes.QuorumCertificate{}, err
	}
	qc.AggregateSignature = combined

	// Force computation of the QC signing root here so assembly and verification
	// are anchored to the same domain-separated object representation.
	_ = ccrypto.SigningRoot(ccrypto.DomainQC, ctypes.ChainID, protocolVersion, qc.SigningDataRoot())
	return qc, nil
}
