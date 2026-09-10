package storage

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"time"
)

type ServiceConfig struct {
	NodeID          string
	CapacityBytes   uint64
	DataDir         string
	ListenAddr      string
	RPCURL          string
	StartBlock      uint64
	Confirmations   uint64
	BatchSize       uint64
	SyncInterval    time.Duration
	ProofInterval   time.Duration
	ProofSubmitter  ProofSubmitter
	Contracts       RPCStorageContracts
}

type ServiceStatus struct {
	Ready          bool       `json:"ready"`
	LastSync       time.Time  `json:"last_sync,omitempty"`
	LastCursor     SyncCursor `json:"last_cursor"`
	LastError      string     `json:"last_error,omitempty"`
	LastProof      time.Time  `json:"last_proof,omitempty"`
	LastProofError string     `json:"last_proof_error,omitempty"`
}

type Service struct {
	cfg         ServiceConfig
	backend     RPCBackend
	projection *StorageProjection
	runtime     *Runtime
	syncer      Syncer
	scheduler   ProofScheduler
	httpServer  *http.Server
	mu          sync.RWMutex
	status      ServiceStatus
}

func NewService(cfg ServiceConfig) (*Service, error) {
	if cfg.CapacityBytes == 0 || cfg.DataDir == "" || cfg.ListenAddr == "" || cfg.RPCURL == "" {
		return nil, ErrInvalidChainState
	}
	if _, err := bytes32Arg(cfg.NodeID); err != nil { return nil, ErrInvalidChainState }
	if cfg.SyncInterval <= 0 { cfg.SyncInterval = 5 * time.Second }
	if cfg.ProofInterval <= 0 { cfg.ProofInterval = cfg.SyncInterval }
	if cfg.BatchSize == 0 { cfg.BatchSize = 256 }
	if err := os.MkdirAll(cfg.DataDir, 0o700); err != nil { return nil, err }

	backend := RPCBackend{URL: cfg.RPCURL, Client: &http.Client{Timeout: 15 * time.Second}}
	reader := RPCStorageReader{Backend: backend, Contracts: cfg.Contracts, StartBlock: cfg.StartBlock}
	if err := reader.validate(); err != nil { return nil, err }

	state, err := NewFileProjectionStateStore(filepath.Join(cfg.DataDir, "projection.json"))
	if err != nil { return nil, err }
	projection, err := NewStorageProjection(
		StorageContracts{Agreement: cfg.Contracts.Agreement, Settlement: cfg.Contracts.Settlement},
		StorageEventTopics{
			AgreementActivated: EventTopic("StorageAgreementActivated(bytes32,bytes32,bytes32,bytes32)"),
			AgreementCompleted: EventTopic("StorageAgreementCompleted(bytes32)"),
			AgreementCancelled: EventTopic("StorageAgreementCancelled(bytes32)"),
			SettlementOpened: EventTopic("StorageSettlementOpened(bytes32,bytes32,address,address,address,address,uint256,uint32)"),
			SettlementCompleted: EventTopic("StorageSettlementCompleted(bytes32,uint256,uint256)"),
			SettlementCancelled: EventTopic("StorageSettlementCancelled(bytes32,uint256)"),
		}, reader, state,
	)
	if err != nil { return nil, err }
	store, err := OpenFileStore(filepath.Join(cfg.DataDir, "store"))
	if err != nil { return nil, err }
	runtime, err := NewRuntime(cfg.NodeID, cfg.CapacityBytes, store, projection, cfg.ProofSubmitter)
	if err != nil { return nil, err }
	cursor, err := NewFileCursorStore(filepath.Join(cfg.DataDir, "cursor.json"))
	if err != nil { return nil, err }

	s := &Service{cfg: cfg, backend: backend, projection: projection, runtime: runtime, scheduler: ProofScheduler{Projection: projection}}
	s.syncer = Syncer{Backend: backend, Cursor: cursor, Projection: projection, StartBlock: cfg.StartBlock, Confirmations: cfg.Confirmations, BatchSize: cfg.BatchSize}
	s.httpServer = &http.Server{Addr: cfg.ListenAddr, Handler: NewTransportHandler(s), ReadHeaderTimeout: 10 * time.Second}
	return s, nil
}

func (s *Service) Runtime() *Runtime { return s.runtime }

func (s *Service) Status() ServiceStatus {
	s.mu.RLock(); defer s.mu.RUnlock()
	return s.status
}

func (s *Service) setSyncResult(cursor SyncCursor, err error) {
	s.mu.Lock(); defer s.mu.Unlock()
	if err != nil {
		s.status.LastError = err.Error()
		s.status.Ready = false
		return
	}
	s.status.Ready = true
	s.status.LastError = ""
	s.status.LastCursor = cursor
	s.status.LastSync = time.Now().UTC()
}

func (s *Service) setProofResult(at time.Time, err error) {
	s.mu.Lock(); defer s.mu.Unlock()
	if err != nil {
		s.status.LastProofError = err.Error()
		return
	}
	s.status.LastProofError = ""
	s.status.LastProof = at.UTC()
}

func (s *Service) syncOnce(ctx context.Context) {
	cursor, err := s.syncer.Sync(ctx)
	s.setSyncResult(cursor, err)
}

func (s *Service) proveOnce(ctx context.Context, now time.Time) error {
	if s == nil || s.cfg.ProofSubmitter == nil {
		return nil
	}
	items, err := s.scheduler.Due(ctx, now)
	if err != nil {
		s.setProofResult(now, err)
		return err
	}
	for _, item := range items {
		if _, err := s.runtime.Prove(ctx, item.Challenge); err != nil {
			s.setProofResult(now, err)
			return err
		}
		if err := s.scheduler.MarkSubmitted(ctx, item); err != nil {
			s.setProofResult(now, err)
			return err
		}
	}
	s.setProofResult(now, nil)
	return nil
}

func (s *Service) Run(ctx context.Context) error {
	if s == nil || s.httpServer == nil { return ErrInvalidChainState }
	s.syncOnce(ctx)
	if s.cfg.ProofSubmitter != nil {
		_ = s.proveOnce(ctx, time.Now().UTC())
	}

	errCh := make(chan error, 1)
	go func() {
		err := s.httpServer.ListenAndServe()
		if errors.Is(err, http.ErrServerClosed) { err = nil }
		errCh <- err
	}()

	syncTicker := time.NewTicker(s.cfg.SyncInterval)
	defer syncTicker.Stop()
	var proofTicker *time.Ticker
	var proofC <-chan time.Time
	if s.cfg.ProofSubmitter != nil {
		proofTicker = time.NewTicker(s.cfg.ProofInterval)
		proofC = proofTicker.C
		defer proofTicker.Stop()
	}
	for {
		select {
		case <-ctx.Done():
			shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancel()
			if err := s.httpServer.Shutdown(shutdownCtx); err != nil { return err }
			return nil
		case err := <-errCh:
			if err != nil { return fmt.Errorf("storage transport: %w", err) }
			return nil
		case <-syncTicker.C:
			s.syncOnce(ctx)
		case now := <-proofC:
			_ = s.proveOnce(ctx, now.UTC())
		}
	}
}
