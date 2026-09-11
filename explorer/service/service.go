package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	indexerapi "github.com/420integrated/420-integrated/indexer/api"
	"github.com/420integrated/420-integrated/indexer/decoder"
	"github.com/420integrated/420-integrated/indexer/model"
)

var (
	ErrWrongChain      = errors.New("420Explorer indexer is on the wrong chain")
	ErrIndexerStale    = errors.New("420Explorer indexer data is stale")
	ErrIndexerDegraded = errors.New("420Explorer indexer is degraded")
)

// IndexerReader is the complete chain-index dependency for the Explorer
// presentation service. Implementations must consume the shared 420Indexer
// read API; Explorer must never substitute direct JSON-RPC ingestion here.
type IndexerReader interface {
	Health(context.Context) (indexerapi.HealthResponse, error)
	Blocks(context.Context, uint32, string) (indexerapi.BlockPage, error)
	Block(context.Context, uint64) (model.BlockRecord, error)
	Transaction(context.Context, string) (model.TransactionRecord, error)
	Receipt(context.Context, string) (model.ReceiptRecord, error)
	BlockLogs(context.Context, uint64) ([]model.LogRecord, error)
	ServiceVersion(context.Context, string, uint32) (decoder.ServiceVersion, error)
}

type Service struct {
	indexer         IndexerReader
	requiredChainID uint64
	staleAfter      time.Duration
	now             func() time.Time
}

func New(indexer IndexerReader, requiredChainID uint64, staleAfter time.Duration) (*Service, error) {
	if indexer == nil {
		return nil, errors.New("420Indexer reader required")
	}
	if requiredChainID == 0 {
		return nil, errors.New("required chain id must be non-zero")
	}
	if staleAfter <= 0 {
		staleAfter = 2 * time.Minute
	}
	return &Service{
		indexer:         indexer,
		requiredChainID: requiredChainID,
		staleAfter:      staleAfter,
		now:             time.Now,
	}, nil
}

// NetworkStatus is presentation state derived from 420Indexer health. It is
// descriptive only and must never be treated as canonical consensus state.
type NetworkStatus struct {
	ChainID         uint64    `json:"chainId"`
	IndexedHeight   uint64    `json:"indexedHeight"`
	SafeHeight      uint64    `json:"safeHeight"`
	FinalizedHeight uint64    `json:"finalizedHeight"`
	SchemaVersion   string    `json:"schemaVersion"`
	DecoderSet      string    `json:"decoderSet"`
	IndexerState    string    `json:"indexerState"`
	LastIngestAt    time.Time `json:"lastIngestAt"`
	WrongChain      bool      `json:"wrongChain"`
	Stale           bool      `json:"stale"`
	Degraded        bool      `json:"degraded"`
}

func (s *Service) NetworkStatus(ctx context.Context) (NetworkStatus, error) {
	response, err := s.indexer.Health(ctx)
	if err != nil {
		return NetworkStatus{}, err
	}
	h := response.Health
	state := strings.ToUpper(strings.TrimSpace(h.State))
	status := NetworkStatus{
		ChainID:         h.ChainID,
		IndexedHeight:   h.IndexedHeight,
		SafeHeight:      h.SafeHeight,
		FinalizedHeight: h.FinalizedHeight,
		SchemaVersion:   h.SchemaVersion,
		DecoderSet:      h.DecoderSet,
		IndexerState:    h.State,
		LastIngestAt:    h.LastIngestAt,
		WrongChain:      h.ChainID != s.requiredChainID,
		Stale:           h.LastIngestAt.IsZero() || s.now().Sub(h.LastIngestAt) > s.staleAfter,
		Degraded:        state != "READY" && state != "HEALTHY" && state != "OK",
	}
	if status.WrongChain {
		return status, fmt.Errorf("%w: expected %d, got %d", ErrWrongChain, s.requiredChainID, h.ChainID)
	}
	if status.Degraded {
		return status, fmt.Errorf("%w: state=%s", ErrIndexerDegraded, h.State)
	}
	if status.Stale {
		return status, fmt.Errorf("%w: last ingest %s", ErrIndexerStale, h.LastIngestAt.UTC().Format(time.RFC3339))
	}
	return status, nil
}

type BlockView struct {
	Block model.BlockRecord `json:"block"`
	Logs  []model.LogRecord `json:"logs"`
}

func (s *Service) Block(ctx context.Context, number uint64) (BlockView, error) {
	block, err := s.indexer.Block(ctx, number)
	if err != nil {
		return BlockView{}, err
	}
	if err := s.requireRecordChain(block.ChainID); err != nil {
		return BlockView{}, err
	}
	logs, err := s.indexer.BlockLogs(ctx, number)
	if err != nil {
		return BlockView{}, err
	}
	for _, log := range logs {
		if err := s.requireRecordChain(log.ChainID); err != nil {
			return BlockView{}, err
		}
		if log.BlockHash != block.Hash || log.BlockNumber != block.Number {
			return BlockView{}, errors.New("420Indexer returned log provenance inconsistent with block")
		}
	}
	return BlockView{Block: block, Logs: logs}, nil
}

func (s *Service) Blocks(ctx context.Context, limit uint32, cursor string) (indexerapi.BlockPage, error) {
	page, err := s.indexer.Blocks(ctx, limit, cursor)
	if err != nil {
		return indexerapi.BlockPage{}, err
	}
	if err := s.requireRecordChain(page.Meta.ChainID); err != nil {
		return indexerapi.BlockPage{}, err
	}
	for _, block := range page.Blocks {
		if err := s.requireRecordChain(block.ChainID); err != nil {
			return indexerapi.BlockPage{}, err
		}
	}
	return page, nil
}

type TransactionView struct {
	Transaction model.TransactionRecord `json:"transaction"`
	Receipt     model.ReceiptRecord     `json:"receipt"`
}

func (s *Service) Transaction(ctx context.Context, hash string) (TransactionView, error) {
	tx, err := s.indexer.Transaction(ctx, hash)
	if err != nil {
		return TransactionView{}, err
	}
	if err := s.requireRecordChain(tx.ChainID); err != nil {
		return TransactionView{}, err
	}
	receipt, err := s.indexer.Receipt(ctx, hash)
	if err != nil {
		return TransactionView{}, err
	}
	if err := s.requireRecordChain(receipt.ChainID); err != nil {
		return TransactionView{}, err
	}
	if !strings.EqualFold(receipt.TransactionHash, tx.Hash) || receipt.BlockHash != tx.BlockHash || receipt.BlockNumber != tx.BlockNumber {
		return TransactionView{}, errors.New("420Indexer returned receipt provenance inconsistent with transaction")
	}
	return TransactionView{Transaction: tx, Receipt: receipt}, nil
}

func (s *Service) ServiceVersion(ctx context.Context, serviceID string, version uint32) (decoder.ServiceVersion, error) {
	return s.indexer.ServiceVersion(ctx, serviceID, version)
}

func (s *Service) requireRecordChain(chainID uint64) error {
	if chainID != s.requiredChainID {
		return fmt.Errorf("%w: expected %d, got %d", ErrWrongChain, s.requiredChainID, chainID)
	}
	return nil
}
