package store

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"

	"github.com/420integrated/420-integrated/indexer/model"
)

// FileStore is the first durable GEN-11.1B store. It uses atomic file replacement so a restart
// observes either the previous complete snapshot or the new complete snapshot, never a partial write.
// The format is intentionally rebuildable and versioned; a database-backed implementation can replace it later.
type FileStore struct {
	mu   sync.Mutex
	path string
	data fileState
}

type fileState struct {
	Version      uint64                              `json:"version"`
	Checkpoint   *model.ChainCheckpoint              `json:"checkpoint,omitempty"`
	Blocks       map[uint64]model.BlockRecord         `json:"blocks"`
	Transactions map[string]model.TransactionRecord   `json:"transactions"`
	Receipts     map[string]model.ReceiptRecord       `json:"receipts"`
	Logs         map[string]model.LogRecord           `json:"logs"`
	Contracts    map[string]model.ContractRecord      `json:"contracts"`
}

func NewFileStore(path string) (*FileStore, error) {
	if path == "" { return nil, errors.New("store path required") }
	s := &FileStore{path: path}
	s.data = emptyFileState()
	b, err := os.ReadFile(path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) { return s, nil }
		return nil, err
	}
	if err := json.Unmarshal(b, &s.data); err != nil { return nil, fmt.Errorf("decode indexer store: %w", err) }
	if s.data.Blocks == nil { s.data.Blocks = map[uint64]model.BlockRecord{} }
	if s.data.Transactions == nil { s.data.Transactions = map[string]model.TransactionRecord{} }
	if s.data.Receipts == nil { s.data.Receipts = map[string]model.ReceiptRecord{} }
	if s.data.Logs == nil { s.data.Logs = map[string]model.LogRecord{} }
	if s.data.Contracts == nil { s.data.Contracts = map[string]model.ContractRecord{} }
	return s, nil
}

func emptyFileState() fileState {
	return fileState{Version: 1, Blocks: map[uint64]model.BlockRecord{}, Transactions: map[string]model.TransactionRecord{}, Receipts: map[string]model.ReceiptRecord{}, Logs: map[string]model.LogRecord{}, Contracts: map[string]model.ContractRecord{}}
}

func (s *FileStore) persistLocked() error {
	if err := os.MkdirAll(filepath.Dir(s.path), 0o755); err != nil { return err }
	b, err := json.MarshalIndent(s.data, "", "  ")
	if err != nil { return err }
	tmp := s.path + ".tmp"
	if err := os.WriteFile(tmp, b, 0o600); err != nil { return err }
	f, err := os.OpenFile(tmp, os.O_RDWR, 0o600)
	if err != nil { return err }
	if err := f.Sync(); err != nil { f.Close(); return err }
	if err := f.Close(); err != nil { return err }
	return os.Rename(tmp, s.path)
}

// Reset discards all rebuildable indexed state while preserving only the store format version.
// Canonical chain state is never mutated; the next ingestion pass reconstructs the projection from RPC.
func (s *FileStore) Reset() error {
	s.mu.Lock(); defer s.mu.Unlock()
	s.data = emptyFileState()
	return s.persistLocked()
}

func (s *FileStore) Checkpoint() (model.ChainCheckpoint, bool, error) {
	s.mu.Lock(); defer s.mu.Unlock()
	if s.data.Checkpoint == nil { return model.ChainCheckpoint{}, false, nil }
	return *s.data.Checkpoint, true, nil
}

func (s *FileStore) SaveCheckpoint(cp model.ChainCheckpoint) error {
	s.mu.Lock(); defer s.mu.Unlock()
	s.data.Checkpoint = &cp
	return s.persistLocked()
}

func (s *FileStore) Block(number uint64) (model.BlockRecord, bool, error) {
	s.mu.Lock(); defer s.mu.Unlock()
	b, ok := s.data.Blocks[number]
	return b, ok, nil
}

func (s *FileStore) PutBlock(b model.BlockRecord) error {
	s.mu.Lock(); defer s.mu.Unlock()
	s.data.Blocks[b.Number] = b
	return s.persistLocked()
}

func (s *FileStore) PutBundle(block model.BlockRecord, txs []model.TransactionRecord, receipts []model.ReceiptRecord, logs []model.LogRecord) error {
	s.mu.Lock(); defer s.mu.Unlock()
	s.data.Blocks[block.Number] = block
	for _, tx := range txs { s.data.Transactions[strings.ToLower(tx.Hash)] = tx }
	for _, r := range receipts { s.data.Receipts[strings.ToLower(r.TransactionHash)] = r }
	for _, lg := range logs { s.data.Logs[logKey(lg)] = lg }
	return s.persistLocked()
}

func (s *FileStore) PutContract(record model.ContractRecord) error {
	s.mu.Lock(); defer s.mu.Unlock()
	s.data.Contracts[strings.ToLower(record.Address)] = record
	return s.persistLocked()
}

func (s *FileStore) Contract(address string) (model.ContractRecord, bool, error) {
	s.mu.Lock(); defer s.mu.Unlock()
	record, ok := s.data.Contracts[strings.ToLower(address)]
	return record, ok, nil
}

func (s *FileStore) Transaction(hash string) (model.TransactionRecord, bool, error) {
	s.mu.Lock(); defer s.mu.Unlock()
	tx, ok := s.data.Transactions[strings.ToLower(hash)]
	return tx, ok, nil
}

func (s *FileStore) Receipt(txHash string) (model.ReceiptRecord, bool, error) {
	s.mu.Lock(); defer s.mu.Unlock()
	r, ok := s.data.Receipts[strings.ToLower(txHash)]
	return r, ok, nil
}

func (s *FileStore) LogsByBlock(number uint64) ([]model.LogRecord, error) {
	s.mu.Lock(); defer s.mu.Unlock()
	out := make([]model.LogRecord, 0)
	for _, lg := range s.data.Logs { if lg.BlockNumber == number { out = append(out, lg) } }
	sort.Slice(out, func(i, j int) bool {
		if out[i].TransactionIndex == out[j].TransactionIndex { return out[i].LogIndex < out[j].LogIndex }
		return out[i].TransactionIndex < out[j].TransactionIndex
	})
	return out, nil
}

func (s *FileStore) DeleteBlocksAbove(number uint64) error {
	s.mu.Lock(); defer s.mu.Unlock()
	for n := range s.data.Blocks { if n > number { delete(s.data.Blocks, n) } }
	for h, tx := range s.data.Transactions { if tx.BlockNumber > number { delete(s.data.Transactions, h) } }
	for h, r := range s.data.Receipts { if r.BlockNumber > number { delete(s.data.Receipts, h) } }
	for k, lg := range s.data.Logs { if lg.BlockNumber > number { delete(s.data.Logs, k) } }
	for address, record := range s.data.Contracts { if record.DeploymentBlock > number { delete(s.data.Contracts, address) } }
	return s.persistLocked()
}

func logKey(lg model.LogRecord) string {
	return fmt.Sprintf("%s:%d", strings.ToLower(lg.TransactionHash), lg.LogIndex)
}
