package api

import (
	"errors"
	"sort"
	"strings"

	"github.com/420integrated/420-integrated/indexer/model"
)

var ErrAddressQueryUnavailable = errors.New("address query unavailable")

// AddressTransactionPage is a bounded, snapshot-pinned address history view.
// It mirrors the IDX-6 address-filtered transaction query at the shared /v1 boundary.
type AddressTransactionPage struct {
	Address            string                    `json:"address"`
	Meta               PageMeta                  `json:"meta"`
	Transactions       []model.TransactionRecord `json:"transactions"`
	CanonicalAuthority bool                      `json:"canonicalAuthority"`
}

type addressReadStore interface {
	TransactionsByAddress(address string) ([]model.TransactionRecord, error)
}

// AddressTransactions exposes address-filtered transaction history from the
// rebuildable index projection. The snapshot is the current persisted checkpoint.
func (b *StoreBackend) AddressTransactions(address string, limit uint32) (AddressTransactionPage, error) {
	reader, ok := b.store.(addressReadStore)
	if !ok {
		return AddressTransactionPage{}, ErrAddressQueryUnavailable
	}
	if limit == 0 || limit > 250 {
		return AddressTransactionPage{}, ErrInvalidCursor
	}
	cp, ok, err := b.store.Checkpoint()
	if err != nil { return AddressTransactionPage{}, err }
	if !ok { return AddressTransactionPage{}, ErrSnapshotUnavailable }

	address = strings.ToLower(strings.TrimSpace(address))
	txs, err := reader.TransactionsByAddress(address)
	if err != nil { return AddressTransactionPage{}, err }
	filtered := make([]model.TransactionRecord, 0, len(txs))
	for _, tx := range txs {
		if tx.BlockNumber <= cp.IndexedHeight { filtered = append(filtered, tx) }
	}
	sort.Slice(filtered, func(i, j int) bool {
		if filtered[i].BlockNumber == filtered[j].BlockNumber { return filtered[i].Index > filtered[j].Index }
		return filtered[i].BlockNumber > filtered[j].BlockNumber
	})
	if uint32(len(filtered)) > limit { filtered = filtered[:limit] }

	return AddressTransactionPage{
		Address: address,
		Meta: PageMeta{
			ChainID: cp.ChainID, SnapshotHeight: cp.IndexedHeight, SnapshotHash: cp.IndexedHash,
			SafeHeight: cp.SafeHeight, FinalizedHeight: cp.FinalizedHeight, SchemaVersion: cp.SchemaVersion,
		},
		Transactions: filtered,
		CanonicalAuthority: false,
	}, nil
}
