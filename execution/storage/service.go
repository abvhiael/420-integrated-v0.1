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
	NodeID        string
	CapacityBytes uint64
	DataDir       string
	ListenAddr    string
	RPCURL        string
	StartBlock    uint64
	Confirmations uint64
	BatchSize     uint64
	SyncInterval  time.Duration
	Contracts     RPCStorageContracts
}

type ServiceStatus struct {
	Ready       bool       `json:"ready"`
	LastSync    time.Time  `json:"last_sync,omitempty"`
	LastCursor  SyncCursor `json:"last_cursor"`
	LastError   string     `json:"last_error,omitempty"`
}

type Service struct {
	cfg        ServiceConfig
	backend    RPCBackend
	projection *StorageProjection
	runtime    *Runtime
	syncer     Syncer
	httpServer *http.Server
	mu         sync.RWMutex
	status     ServiceStatus
}

func NewService(cfg ServiceConfig) (*Service, error) {
	if cfg.NodeID == "" || cfg.CapacityBytes == 0 || cfg.DataDir == "" || cfg.ListenAddr == "" || cfg.RPCURL == "" {
		return nil, ErrInvalidChainState
	}
	if cfg.SyncInterval <= 0 {
		cfg.SyncInterval = 5 * time.Second
	}
	if cfg.BatchSize == 0 {
		cfg.BatchSize = 256
	}
	if err := os.MkdirAll(cfg.DataDir, 0o700); err != nil {
		return nil, err
	}
	backend := RPCBackend{URL: cfg.RPCURL, Client: &http.Client{Timeout: 15 * time.Second}}
	reader := RPCStorageReader{Backend: backend, Contracts: cfg.Contracts, StartBlock: cfg.StartBlock}
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
	runtime, err := NewRuntime(cfg.NodeID, cfg.CapacityBytes, store, projection, nil)
	if err != nil { return nil, err }
	cursor, err := NewFileCursorStore(filepath.Join(cfg.DataDir, "cursor.json"))
	if err != nil { return nil, err }
	s := &Service{cfg: cfg, backend: backend, projection: projection, runtime: runtime}
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
		if errors.Is(err, ErrChainReorganization) { s.status.Ready = false }
		return
	}
	s.status.Ready = true
	s.status.LastError = ""
	s.status.LastCursor = cursor
	s.status.LastSync = time.Now().UTC()
}

func (s *Service) syncOnce(ctx context.Context) {
	cursor, err := s.syncer.Sync(ctx)
	s.setSyncResult(cursor, err)
}

func (s *Service) Run(ctx context.Context) error {
	if s == nil || s.httpServer == nil { return ErrInvalidChainState }
	s.syncOnce(ctx)

	errCh := make(chan error, 1)
	go func() {
		err := s.httpServer.ListenAndServe()
		if errors.Is(err, http.ErrServerClosed) { err = nil }
		errCh <- err
	}()

	ticker := time.NewTicker(s.cfg.SyncInterval)
	defer ticker.Stop()
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
		case <-ticker.C:
			s.syncOnce(ctx)
		}
	}
}
