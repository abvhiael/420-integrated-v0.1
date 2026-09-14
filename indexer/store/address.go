package store

import (
	"strings"

	"github.com/420integrated/420-integrated/indexer/model"
)

// TransactionsByAddress returns rebuildable indexed transactions where the
// address is sender or recipient. Ordering is applied by the API layer so all
// backends share one presentation contract.
func (s *FileStore) TransactionsByAddress(address string) ([]model.TransactionRecord, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	address = strings.ToLower(strings.TrimSpace(address))
	out := make([]model.TransactionRecord, 0)
	for _, tx := range s.data.Transactions {
		if strings.ToLower(tx.From) == address || strings.ToLower(tx.To) == address {
			out = append(out, tx)
		}
	}
	return out, nil
}
