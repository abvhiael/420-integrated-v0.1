package service

import (
	"context"
	"errors"
	"math/big"
	"strings"

	indexerapi "github.com/420integrated/420-integrated/indexer/api"
	"github.com/420integrated/420-integrated/indexer/model"
)

type assetIndexerReader interface {
	AssetTransfers(context.Context, string, string, uint32) (indexerapi.AssetTransferPage, error)
}

type AssetActivityView struct {
	Meta          indexerapi.PageMeta       `json:"meta"`
	AssetKey      string                    `json:"assetKey,omitempty"`
	Address       string                    `json:"address,omitempty"`
	Transfers     []model.AssetTransferRecord `json:"transfers"`
	TransferCount int                       `json:"transferCount"`
}

func (s *Service) AssetActivity(ctx context.Context, assetKey, address string, limit uint32) (AssetActivityView, error) {
	reader, ok := s.indexer.(assetIndexerReader)
	if !ok { return AssetActivityView{}, errors.New("420Indexer asset query capability unavailable") }
	assetKey = strings.ToLower(strings.TrimSpace(assetKey))
	address = strings.TrimSpace(address)
	if address != "" {
		normalized, err := normalizeAddress(address)
		if err != nil { return AssetActivityView{}, err }
		address = normalized
	}
	if limit == 0 { limit = 50 }
	if limit > 250 { return AssetActivityView{}, errors.New("asset activity limit exceeds 250") }
	page, err := reader.AssetTransfers(ctx, assetKey, address, limit)
	if err != nil { return AssetActivityView{}, err }
	if err := s.requireRecordChain(page.Meta.ChainID); err != nil { return AssetActivityView{}, err }
	if page.CanonicalAuthority { return AssetActivityView{}, errors.New("420Indexer asset response claimed canonical authority") }
	if assetKey != "" && !strings.EqualFold(page.AssetKey, assetKey) { return AssetActivityView{}, errors.New("420Indexer returned asset activity for a different asset") }
	if address != "" && !strings.EqualFold(page.Address, address) { return AssetActivityView{}, errors.New("420Indexer returned asset activity for a different address") }
	for _, transfer := range page.Transfers {
		if err := s.requireRecordChain(transfer.ChainID); err != nil { return AssetActivityView{}, err }
		if transfer.BlockNumber > page.Meta.SnapshotHeight { return AssetActivityView{}, errors.New("420Indexer returned asset transfer beyond snapshot") }
		if strings.TrimSpace(transfer.TransactionHash) == "" || strings.TrimSpace(transfer.AssetKey) == "" { return AssetActivityView{}, errors.New("420Indexer returned asset transfer without provenance") }
		if transfer.LogIndex < -1 { return AssetActivityView{}, errors.New("420Indexer returned invalid asset transfer position") }
		amount, ok := new(big.Int).SetString(transfer.Amount, 10)
		if !ok || amount.Sign() < 0 { return AssetActivityView{}, errors.New("420Indexer returned invalid asset transfer amount") }
		if assetKey != "" && !strings.EqualFold(transfer.AssetKey, assetKey) { return AssetActivityView{}, errors.New("420Indexer returned unrelated asset transfer") }
		if address != "" && !strings.EqualFold(transfer.From, address) && !strings.EqualFold(transfer.To, address) { return AssetActivityView{}, errors.New("420Indexer returned asset transfer unrelated to address") }
	}
	return AssetActivityView{Meta:page.Meta, AssetKey:page.AssetKey, Address:page.Address, Transfers:page.Transfers, TransferCount:len(page.Transfers)}, nil
}
