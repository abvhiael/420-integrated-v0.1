package service

import (
	"context"
	"errors"
	"fmt"
	"strings"

	indexerapi "github.com/420integrated/420-integrated/indexer/api"
	"github.com/420integrated/420-integrated/indexer/model"
)

var ErrInvalidAddress = errors.New("invalid EVM address")

type addressIndexerReader interface {
	AddressTransactions(context.Context, string, uint32) (indexerapi.AddressTransactionPage, error)
}

// AddressView is the Explorer presentation resource for an EVM address.
// It is derived exclusively from the shared 420Indexer address-filtered query.
type AddressView struct {
	Address      string                    `json:"address"`
	Meta         indexerapi.PageMeta       `json:"meta"`
	Transactions []model.TransactionRecord `json:"transactions"`
	TxCount      int                       `json:"txCount"`
}

func normalizeAddress(address string) (string, error) {
	address = strings.ToLower(strings.TrimSpace(address))
	if len(address) != 42 || !strings.HasPrefix(address, "0x") {
		return "", ErrInvalidAddress
	}
	for _, r := range address[2:] {
		if !((r >= '0' && r <= '9') || (r >= 'a' && r <= 'f')) {
			return "", ErrInvalidAddress
		}
	}
	return address, nil
}

func (s *Service) Address(ctx context.Context, address string, limit uint32) (AddressView, error) {
	normalized, err := normalizeAddress(address)
	if err != nil { return AddressView{}, err }
	reader, ok := s.indexer.(addressIndexerReader)
	if !ok { return AddressView{}, errors.New("420Indexer address query capability unavailable") }
	if limit == 0 { limit = 50 }
	page, err := reader.AddressTransactions(ctx, normalized, limit)
	if err != nil { return AddressView{}, err }
	if err := s.requireRecordChain(page.Meta.ChainID); err != nil { return AddressView{}, err }
	if !strings.EqualFold(page.Address, normalized) {
		return AddressView{}, errors.New("420Indexer returned address history for a different address")
	}
	for _, tx := range page.Transactions {
		if err := s.requireRecordChain(tx.ChainID); err != nil { return AddressView{}, err }
		if tx.BlockNumber > page.Meta.SnapshotHeight {
			return AddressView{}, errors.New("420Indexer returned address transaction beyond snapshot")
		}
		if !strings.EqualFold(tx.From, normalized) && !strings.EqualFold(tx.To, normalized) {
			return AddressView{}, fmt.Errorf("420Indexer returned unrelated transaction %s for address", tx.Hash)
		}
	}
	return AddressView{Address: normalized, Meta: page.Meta, Transactions: page.Transactions, TxCount: len(page.Transactions)}, nil
}
