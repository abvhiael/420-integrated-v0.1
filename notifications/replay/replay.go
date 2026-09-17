package replay

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"
)

const StreamVersion = "v1"

type Provenance struct {
	ChainID string
	BlockNumber string
	BlockHash string
	TransactionHash string
	TransactionIndex int
	LogIndex int
	ContractAddress string
}

type EventEnvelope struct {
	StreamVersion string
	ID string
	Source string
	Topic string
	Protocol string
	EventName string
	ObjectKey string
	LifecycleState string
	Provenance Provenance
	Authoritative bool
}

type EventBatch struct {
	StreamVersion string
	Events []EventEnvelope
	NextCursor string
	Authoritative bool
}

type CanonicalSignal struct {
	ID string
	Kind string
	EventID string
	ReplacementEventID string
	ChainID string
	BlockNumber string
	BlockHash string
	Authoritative bool
}

type Stream interface {
	ProtocolEvents(context.Context, uint64, string) (EventBatch, error)
}

type Handler interface {
	HandleEvent(context.Context, EventEnvelope) error
	HandleCanonicality(context.Context, CanonicalSignal) error
}

type Checkpoint struct {
	ChainID uint64
	Cursor string
	Authoritative bool
}

type CheckpointStore interface {
	Load(uint64) (Checkpoint, bool, error)
	Save(Checkpoint) error
}

type MemoryCheckpointStore struct { mu sync.RWMutex; items map[uint64]Checkpoint }

func NewMemoryCheckpointStore() *MemoryCheckpointStore { return &MemoryCheckpointStore{items: map[uint64]Checkpoint{}} }
func (s *MemoryCheckpointStore) Load(chainID uint64) (Checkpoint, bool, error) { s.mu.RLock(); defer s.mu.RUnlock(); v, ok := s.items[chainID]; return v, ok, nil }
func (s *MemoryCheckpointStore) Save(c Checkpoint) error { if c.ChainID == 0 || c.Authoritative { return errors.New("invalid non-authoritative checkpoint") }; s.mu.Lock(); defer s.mu.Unlock(); s.items[c.ChainID] = c; return nil }

type Processor struct { chainID uint64; stream Stream; checkpoints CheckpointStore; handler Handler }

func NewProcessor(chainID uint64, stream Stream, checkpoints CheckpointStore, handler Handler) (*Processor, error) {
	if chainID == 0 { return nil, errors.New("chain id must be non-zero") }
	if stream == nil || checkpoints == nil || handler == nil { return nil, errors.New("stream, checkpoint store and handler are required") }
	return &Processor{chainID: chainID, stream: stream, checkpoints: checkpoints, handler: handler}, nil
}

func (p *Processor) ReplayOnce(ctx context.Context) (Checkpoint, error) {
	current, ok, err := p.checkpoints.Load(p.chainID)
	if err != nil { return Checkpoint{}, err }
	cursor := ""
	if ok { if current.ChainID != p.chainID || current.Authoritative { return Checkpoint{}, errors.New("invalid stored checkpoint") }; cursor = current.Cursor }
	batch, err := p.stream.ProtocolEvents(ctx, p.chainID, cursor)
	if err != nil { return Checkpoint{}, err }
	if err := validateBatch(p.chainID, batch); err != nil { return Checkpoint{}, err }
	for _, event := range batch.Events {
		if err := p.handler.HandleEvent(ctx, event); err != nil { return Checkpoint{}, fmt.Errorf("process event %s: %w", event.ID, err) }
	}
	next := Checkpoint{ChainID: p.chainID, Cursor: batch.NextCursor, Authoritative: false}
	if err := p.checkpoints.Save(next); err != nil { return Checkpoint{}, err }
	return next, nil
}

func (p *Processor) ApplyCanonicalSignal(ctx context.Context, signal CanonicalSignal) error {
	if signal.Authoritative || signal.ChainID != fmt.Sprint(p.chainID) { return errors.New("invalid canonicality signal") }
	switch signal.Kind { case "finalized", "retracted", "superseded": default: return errors.New("unsupported canonicality signal") }
	if strings.TrimSpace(signal.ID) == "" || strings.TrimSpace(signal.EventID) == "" || strings.TrimSpace(signal.BlockHash) == "" { return errors.New("malformed canonicality signal") }
	return p.handler.HandleCanonicality(ctx, signal)
}

func validateBatch(chainID uint64, batch EventBatch) error {
	if batch.StreamVersion != StreamVersion || batch.Authoritative { return errors.New("invalid event batch envelope") }
	want := fmt.Sprint(chainID)
	for _, event := range batch.Events {
		if event.StreamVersion != StreamVersion || event.Authoritative || event.Source != "protocol" { return errors.New("invalid event envelope") }
		if strings.TrimSpace(event.ID) == "" || strings.TrimSpace(event.Protocol) == "" || strings.TrimSpace(event.EventName) == "" { return errors.New("malformed event envelope") }
		if event.Provenance.ChainID != want { return errors.New("notification batch chain mismatch") }
		if strings.TrimSpace(event.Provenance.BlockHash) == "" || strings.TrimSpace(event.Provenance.TransactionHash) == "" || event.Provenance.LogIndex < 0 { return errors.New("invalid event provenance") }
	}
	return nil
}
