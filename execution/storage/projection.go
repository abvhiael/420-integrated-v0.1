package storage

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

var ErrProjectionState = errors.New("invalid storage projection state")

type StorageEventTopics struct {
	AgreementActivated string
	AgreementCompleted string
	AgreementCancelled string
	SettlementOpened    string
	SettlementCompleted string
	SettlementCancelled string
}

type StorageContracts struct {
	Agreement  string
	Settlement string
}

type AssignmentSnapshot struct {
	Assignment Assignment `json:"assignment"`
	WindowCount uint32 `json:"window_count"`
	NextWindow uint32 `json:"next_window"`
	SettlementID string `json:"settlement_id,omitempty"`
}

type CanonicalStorageReader interface {
	AssignmentByAgreement(ctx context.Context, agreementID string) (AssignmentSnapshot, error)
	Window(ctx context.Context, agreementID string, windowIndex uint32) (Challenge, time.Time, error)
}

type ProjectionStateStore interface {
	Load(ctx context.Context) (map[string]AssignmentSnapshot, error)
	Save(ctx context.Context, snapshots map[string]AssignmentSnapshot) error
	Clear(ctx context.Context) error
}

type FileProjectionStateStore struct {
	mu sync.Mutex
	path string
}

func NewFileProjectionStateStore(path string) (*FileProjectionStateStore, error) {
	if strings.TrimSpace(path) == "" { return nil, ErrProjectionState }
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil { return nil, err }
	return &FileProjectionStateStore{path:path}, nil
}

func (s *FileProjectionStateStore) Load(_ context.Context) (map[string]AssignmentSnapshot, error) {
	s.mu.Lock(); defer s.mu.Unlock()
	b, err := os.ReadFile(s.path)
	if errors.Is(err, os.ErrNotExist) { return map[string]AssignmentSnapshot{}, nil }
	if err != nil { return nil, err }
	out := map[string]AssignmentSnapshot{}
	if err := json.Unmarshal(b, &out); err != nil { return nil, err }
	return out, nil
}

func (s *FileProjectionStateStore) Save(_ context.Context, snapshots map[string]AssignmentSnapshot) error {
	s.mu.Lock(); defer s.mu.Unlock()
	b, err := json.Marshal(snapshots)
	if err != nil { return err }
	tmp := s.path + ".tmp"
	if err := os.WriteFile(tmp, b, 0o600); err != nil { return err }
	return os.Rename(tmp, s.path)
}

func (s *FileProjectionStateStore) Clear(_ context.Context) error {
	s.mu.Lock(); defer s.mu.Unlock()
	if err := os.Remove(s.path); err != nil && !errors.Is(err, os.ErrNotExist) { return err }
	return nil
}

type StorageProjection struct {
	mu sync.RWMutex
	Contracts StorageContracts
	Topics StorageEventTopics
	Reader CanonicalStorageReader
	State ProjectionStateStore
	snapshots map[string]AssignmentSnapshot
}

func NewStorageProjection(contracts StorageContracts, topics StorageEventTopics, reader CanonicalStorageReader, state ProjectionStateStore) (*StorageProjection, error) {
	if reader == nil || state == nil || strings.TrimSpace(contracts.Agreement) == "" { return nil, ErrProjectionState }
	loaded, err := state.Load(context.Background())
	if err != nil { return nil, err }
	return &StorageProjection{Contracts:contracts, Topics:topics, Reader:reader, State:state, snapshots:loaded}, nil
}

func (p *StorageProjection) Filter() LogFilter {
	addresses := []string{p.Contracts.Agreement}
	if strings.TrimSpace(p.Contracts.Settlement) != "" { addresses = append(addresses, p.Contracts.Settlement) }
	topics := []string{}
	for _, t := range []string{p.Topics.AgreementActivated,p.Topics.AgreementCompleted,p.Topics.AgreementCancelled,p.Topics.SettlementOpened,p.Topics.SettlementCompleted,p.Topics.SettlementCancelled} {
		if strings.TrimSpace(t) != "" { topics = append(topics,t) }
	}
	return LogFilter{Addresses:addresses, Topics:[][]string{topics}}
}

func (p *StorageProjection) Apply(ctx context.Context, log ChainLog) error {
	if log.Removed || len(log.Topics) == 0 { return ErrInvalidChainState }
	topic := log.Topics[0]
	switch {
	case equalHex(log.Address, p.Contracts.Agreement) && equalHex(topic, p.Topics.AgreementActivated):
		if len(log.Topics) < 4 { return ErrInvalidChainState }
		agreementID := log.Topics[1]
		snapshot, err := p.Reader.AssignmentByAgreement(ctx, agreementID)
		if err != nil { return err }
		if !equalHex(snapshot.Assignment.AgreementID, agreementID) || !equalHex(snapshot.Assignment.CommitmentID, log.Topics[2]) || !equalHex(snapshot.Assignment.NodeID, log.Topics[3]) || !snapshot.Assignment.Active { return ErrInvalidChainState }
		return p.put(ctx, agreementID, snapshot)
	case equalHex(log.Address, p.Contracts.Agreement) && (equalHex(topic,p.Topics.AgreementCompleted) || equalHex(topic,p.Topics.AgreementCancelled)):
		if len(log.Topics) < 2 { return ErrInvalidChainState }
		return p.deactivate(ctx, log.Topics[1])
	case equalHex(log.Address, p.Contracts.Settlement) && equalHex(topic,p.Topics.SettlementOpened):
		if len(log.Topics) < 3 { return ErrInvalidChainState }
		agreementID := log.Topics[2]
		snapshot, err := p.Reader.AssignmentByAgreement(ctx, agreementID)
		if err != nil { return err }
		snapshot.SettlementID = log.Topics[1]
		return p.put(ctx, agreementID, snapshot)
	case equalHex(log.Address, p.Contracts.Settlement) && (equalHex(topic,p.Topics.SettlementCompleted) || equalHex(topic,p.Topics.SettlementCancelled)):
		return nil
	default:
		return ErrInvalidChainState
	}
}

func (p *StorageProjection) Reset(ctx context.Context, _ uint64) error {
	p.mu.Lock()
	p.snapshots = map[string]AssignmentSnapshot{}
	p.mu.Unlock()
	return p.State.Clear(ctx)
}

func (p *StorageProjection) put(ctx context.Context, agreementID string, snapshot AssignmentSnapshot) error {
	if strings.TrimSpace(snapshot.Assignment.CommitmentID) == "" || snapshot.NextWindow > snapshot.WindowCount { return ErrProjectionState }
	p.mu.Lock(); defer p.mu.Unlock()
	p.snapshots[agreementID] = snapshot
	return p.State.Save(ctx, cloneSnapshots(p.snapshots))
}

func (p *StorageProjection) deactivate(ctx context.Context, agreementID string) error {
	p.mu.Lock(); defer p.mu.Unlock()
	s, ok := p.snapshots[agreementID]
	if !ok { return nil }
	s.Assignment.Active = false
	p.snapshots[agreementID] = s
	return p.State.Save(ctx, cloneSnapshots(p.snapshots))
}

func (p *StorageProjection) Assignment(_ context.Context, commitmentID string) (Assignment, error) {
	p.mu.RLock(); defer p.mu.RUnlock()
	for _, s := range p.snapshots {
		if equalHex(s.Assignment.CommitmentID, commitmentID) {
			if !s.Assignment.Active { return Assignment{}, ErrInactiveAssignment }
			return s.Assignment, nil
		}
	}
	return Assignment{}, ErrInactiveAssignment
}

func (p *StorageProjection) snapshotList() []AssignmentSnapshot {
	p.mu.RLock(); defer p.mu.RUnlock()
	out := make([]AssignmentSnapshot,0,len(p.snapshots))
	for _, s := range p.snapshots { out = append(out,s) }
	return out
}

func (p *StorageProjection) markWindow(ctx context.Context, agreementID string, next uint32) error {
	p.mu.Lock(); defer p.mu.Unlock()
	s, ok := p.snapshots[agreementID]
	if !ok || next > s.WindowCount { return ErrProjectionState }
	s.NextWindow = next
	p.snapshots[agreementID] = s
	return p.State.Save(ctx, cloneSnapshots(p.snapshots))
}

func cloneSnapshots(in map[string]AssignmentSnapshot) map[string]AssignmentSnapshot {
	out := make(map[string]AssignmentSnapshot,len(in))
	for k,v := range in { out[k]=v }
	return out
}

type ScheduledChallenge struct {
	AgreementID string
	WindowIndex uint32
	Challenge Challenge
	Deadline time.Time
}

type ProofScheduler struct { Projection *StorageProjection }

func (s ProofScheduler) Due(ctx context.Context, now time.Time) ([]ScheduledChallenge, error) {
	if s.Projection == nil { return nil, ErrProjectionState }
	now = now.UTC()
	out := []ScheduledChallenge{}
	for _, snap := range s.Projection.snapshotList() {
		if !snap.Assignment.Active || snap.NextWindow >= snap.WindowCount { continue }
		challenge, deadline, err := s.Projection.Reader.Window(ctx, snap.Assignment.AgreementID, snap.NextWindow)
		if err != nil { return nil, err }
		if !equalHex(challenge.AgreementID, snap.Assignment.AgreementID) || !equalHex(challenge.CommitmentID, snap.Assignment.CommitmentID) || challenge.ChallengeID == "" || deadline.Before(challenge.Epoch) { return nil, ErrProjectionState }
		if now.Before(challenge.Epoch) || now.After(deadline) { continue }
		out = append(out, ScheduledChallenge{AgreementID:snap.Assignment.AgreementID, WindowIndex:snap.NextWindow, Challenge:challenge, Deadline:deadline})
	}
	return out,nil
}

func (s ProofScheduler) MarkSubmitted(ctx context.Context, item ScheduledChallenge) error {
	if s.Projection == nil { return ErrProjectionState }
	return s.Projection.markWindow(ctx, item.AgreementID, item.WindowIndex+1)
}
