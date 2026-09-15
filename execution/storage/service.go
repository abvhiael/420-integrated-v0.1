package storage

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

type ServiceConfig struct {
	NodeID                string
	CapacityBytes         uint64
	DataDir               string
	ListenAddr            string
	RPCURL                string
	StartBlock            uint64
	Confirmations         uint64
	BatchSize             uint64
	SyncInterval          time.Duration
	ProofInterval         time.Duration
	ProofSubmitter        ProofSubmitter
	ProofRegistry         string
	ProofFrom             string
	ProofReceiptWait      time.Duration
	ReconcileInterval     time.Duration
	ReconcileMinBackoff   time.Duration
	ReconcileMaxBackoff   time.Duration
	AuthToken             string
	ReadAuthToken         string
	WriteAuthToken        string
	TLSCertFile           string
	TLSKeyFile            string
	MaxConcurrentRequests uint32
	Contracts             RPCStorageContracts
}

type ServiceStatus struct {
	Ready              bool       `json:"ready"`
	Degraded           bool       `json:"degraded"`
	LastSync           time.Time  `json:"last_sync,omitempty"`
	LastCursor         SyncCursor `json:"last_cursor"`
	LastError          string     `json:"last_error,omitempty"`
	LastProof          time.Time  `json:"last_proof,omitempty"`
	LastProofError     string     `json:"last_proof_error,omitempty"`
	LastReconcile      time.Time  `json:"last_reconcile,omitempty"`
	LastReconcileError string     `json:"last_reconcile_error,omitempty"`
	MissingShards      uint64     `json:"missing_shards"`
	MissedProofWindows uint64     `json:"missed_proof_windows"`
}

type Service struct {
	cfg         ServiceConfig
	backend     RPCBackend
	projection *StorageProjection
	runtime     *Runtime
	syncer      Syncer
	scheduler   ProofScheduler
	reconciler  *ProviderReconciler
	httpServer  *http.Server
	mu          sync.RWMutex
	status      ServiceStatus
}

func normalizeProviderAuth(cfg *ServiceConfig) {
	legacy := strings.TrimSpace(cfg.AuthToken)
	if strings.TrimSpace(cfg.ReadAuthToken) == "" { cfg.ReadAuthToken = legacy }
	if strings.TrimSpace(cfg.WriteAuthToken) == "" { cfg.WriteAuthToken = legacy }
	cfg.ReadAuthToken = strings.TrimSpace(cfg.ReadAuthToken)
	cfg.WriteAuthToken = strings.TrimSpace(cfg.WriteAuthToken)
	cfg.TLSCertFile = strings.TrimSpace(cfg.TLSCertFile)
	cfg.TLSKeyFile = strings.TrimSpace(cfg.TLSKeyFile)
	if cfg.MaxConcurrentRequests == 0 { cfg.MaxConcurrentRequests = 128 }
}

func validateProviderTransportSecurity(cfg ServiceConfig) error {
	if (cfg.TLSCertFile == "") != (cfg.TLSKeyFile == "") { return ErrInvalidChainState }
	if loopbackListen(cfg.ListenAddr) { return nil }
	if cfg.ReadAuthToken == "" || cfg.WriteAuthToken == "" { return ErrInvalidChainState }
	if cfg.TLSCertFile == "" || cfg.TLSKeyFile == "" { return ErrInvalidChainState }
	return nil
}

func NewService(cfg ServiceConfig) (*Service, error) {
	if cfg.CapacityBytes == 0 || cfg.DataDir == "" || cfg.ListenAddr == "" || cfg.RPCURL == "" { return nil, ErrInvalidChainState }
	if _, err := bytes32Arg(cfg.NodeID); err != nil { return nil, ErrInvalidChainState }
	normalizeProviderAuth(&cfg)
	if err := validateProviderTransportSecurity(cfg); err != nil { return nil, err }
	proofRegistry := strings.TrimSpace(cfg.ProofRegistry)
	proofFrom := strings.TrimSpace(cfg.ProofFrom)
	if (proofRegistry == "") != (proofFrom == "") { return nil, ErrInvalidChainState }
	if proofRegistry != "" && (!validHexAddress(proofRegistry) || !validHexAddress(proofFrom)) { return nil, ErrInvalidChainState }
	if cfg.SyncInterval <= 0 { cfg.SyncInterval = 5 * time.Second }
	if cfg.ProofInterval <= 0 { cfg.ProofInterval = cfg.SyncInterval }
	if cfg.ReconcileInterval <= 0 { cfg.ReconcileInterval = 30 * time.Second }
	if cfg.ReconcileMinBackoff <= 0 { cfg.ReconcileMinBackoff = 5 * time.Second }
	if cfg.ReconcileMaxBackoff <= 0 { cfg.ReconcileMaxBackoff = time.Minute }
	if cfg.ReconcileMaxBackoff < cfg.ReconcileMinBackoff { return nil, ErrInvalidChainState }
	if cfg.BatchSize == 0 { cfg.BatchSize = 256 }
	if err := os.MkdirAll(cfg.DataDir, 0o700); err != nil { return nil, err }

	backend := RPCBackend{URL: cfg.RPCURL, Client: &http.Client{Timeout: 15 * time.Second}}
	if cfg.ProofSubmitter == nil && proofRegistry != "" { cfg.ProofSubmitter = RPCProofSubmitter{Backend: backend, Registry: proofRegistry, From: proofFrom, ReceiptWait: cfg.ProofReceiptWait} }
	reader := RPCStorageReader{Backend: backend, Contracts: cfg.Contracts, StartBlock: cfg.StartBlock}
	if err := reader.validate(); err != nil { return nil, err }

	state, err := NewFileProjectionStateStore(filepath.Join(cfg.DataDir, "projection.json")); if err != nil { return nil, err }
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
	); if err != nil { return nil, err }
	store, err := OpenFileStore(filepath.Join(cfg.DataDir, "store")); if err != nil { return nil, err }
	runtime, err := NewRuntime(cfg.NodeID, cfg.CapacityBytes, store, projection, cfg.ProofSubmitter); if err != nil { return nil, err }
	cursor, err := NewFileCursorStore(filepath.Join(cfg.DataDir, "cursor.json")); if err != nil { return nil, err }
	reconciler, err := NewProviderReconciler(runtime,projection,cfg.ReconcileInterval,cfg.ReconcileMinBackoff,cfg.ReconcileMaxBackoff); if err != nil { return nil, err }

	s := &Service{cfg: cfg, backend: backend, projection: projection, runtime: runtime, scheduler: ProofScheduler{Projection: projection}, reconciler: reconciler}
	s.syncer = Syncer{Backend: backend, Cursor: cursor, Projection: projection, StartBlock: cfg.StartBlock, Confirmations: cfg.Confirmations, BatchSize: cfg.BatchSize}
	s.httpServer = &http.Server{Addr: cfg.ListenAddr, Handler: NewTransportHandler(s), ReadHeaderTimeout: 10*time.Second, IdleTimeout: 60*time.Second, MaxHeaderBytes: 32<<10}
	return s, nil
}

func loopbackListen(addr string) bool {
	host, _, err := net.SplitHostPort(addr); if err != nil { return false }
	host = strings.TrimSpace(strings.Trim(host, "[]"))
	if strings.EqualFold(host, "localhost") { return true }
	ip := net.ParseIP(host)
	return ip != nil && ip.IsLoopback()
}

func (s *Service) Runtime() *Runtime { return s.runtime }
func (s *Service) Status() ServiceStatus { s.mu.RLock(); defer s.mu.RUnlock(); return s.status }

func (s *Service) setSyncResult(cursor SyncCursor, err error) {
	s.mu.Lock(); defer s.mu.Unlock()
	if err != nil { s.status.LastError=err.Error(); s.status.Ready=false; return }
	s.status.LastError="";s.status.LastCursor=cursor;s.status.LastSync=time.Now().UTC();s.status.Ready=!s.status.Degraded
}

func (s *Service) setProofResult(at time.Time, err error) {
	s.mu.Lock(); defer s.mu.Unlock()
	if err != nil { s.status.LastProofError=err.Error(); return }
	s.status.LastProofError="";s.status.LastProof=at.UTC()
}

func (s *Service) setReconcileResult(at time.Time, result ProviderReconcileResult, err error) {
	s.mu.Lock(); defer s.mu.Unlock()
	s.status.LastReconcile=at.UTC();s.status.MissingShards=result.MissingShards;s.status.MissedProofWindows=result.MissedProofWindows
	if err!=nil { s.status.LastReconcileError=err.Error();s.status.Degraded=true;s.status.Ready=false;return }
	s.status.LastReconcileError=""
	s.status.Degraded=result.MissingShards>0||result.MissedProofWindows>0
	s.status.Ready=s.status.LastError==""&&!s.status.Degraded
}

func (s *Service) syncOnce(ctx context.Context) { cursor,err:=s.syncer.Sync(ctx);s.setSyncResult(cursor,err) }

func (s *Service) reconcileOnce(ctx context.Context, now time.Time) time.Duration {
	if s==nil||s.reconciler==nil{return time.Minute}
	res,next,err:=s.reconciler.RunOnce(ctx,now);s.setReconcileResult(now,res,err)
	if next<=0{return s.cfg.ReconcileMinBackoff};return next
}

func (s *Service) proveOnce(ctx context.Context, now time.Time) error {
	if s == nil || s.cfg.ProofSubmitter == nil { return nil }
	items, err := s.scheduler.Due(ctx, now); if err != nil { s.setProofResult(now, err); return err }
	for _, item := range items {
		if _, err := s.runtime.Prove(ctx, item.Challenge); err != nil { s.setProofResult(now, err); return err }
		if err := s.scheduler.MarkSubmitted(ctx, item); err != nil { s.setProofResult(now, err); return err }
	}
	s.setProofResult(now,nil);return nil
}

func (s *Service) Run(ctx context.Context) error {
	if s == nil || s.httpServer == nil { return ErrInvalidChainState }
	s.syncOnce(ctx)
	reconcileDelay:=s.reconcileOnce(ctx,time.Now().UTC())
	if s.cfg.ProofSubmitter != nil { _ = s.proveOnce(ctx,time.Now().UTC()) }

	errCh:=make(chan error,1)
	go func(){var err error;if s.cfg.TLSCertFile!=""{err=s.httpServer.ListenAndServeTLS(s.cfg.TLSCertFile,s.cfg.TLSKeyFile)}else{err=s.httpServer.ListenAndServe()};if errors.Is(err,http.ErrServerClosed){err=nil};errCh<-err}()
	syncTicker:=time.NewTicker(s.cfg.SyncInterval);defer syncTicker.Stop()
	reconcileTimer:=time.NewTimer(reconcileDelay);defer reconcileTimer.Stop()
	var proofTicker *time.Ticker;var proofC <-chan time.Time
	if s.cfg.ProofSubmitter!=nil{proofTicker=time.NewTicker(s.cfg.ProofInterval);proofC=proofTicker.C;defer proofTicker.Stop()}
	for{
		select{
		case<-ctx.Done():
			shutdownCtx,cancel:=context.WithTimeout(context.Background(),10*time.Second);defer cancel();if err:=s.httpServer.Shutdown(shutdownCtx);err!=nil{return err};return nil
		case err:=<-errCh:
			if err!=nil{return fmt.Errorf("storage transport: %w",err)};return nil
		case<-syncTicker.C:s.syncOnce(ctx)
		case now:=<-proofC:_=s.proveOnce(ctx,now.UTC())
		case now:=<-reconcileTimer.C:
			next:=s.reconcileOnce(ctx,now.UTC());reconcileTimer.Reset(next)
		}
	}
}
