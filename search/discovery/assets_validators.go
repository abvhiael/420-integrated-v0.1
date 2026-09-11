package discovery

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/420integrated/420-integrated/search/architecture"
	"github.com/420integrated/420-integrated/search/indexerclient"
	searchresult "github.com/420integrated/420-integrated/search/result"
)

const validatorHistoryLimit uint32 = 200

type AssetValidatorReader interface {
	Qualified(context.Context) error
	Status(context.Context) (indexerclient.Status, error)
	AssetTransfers(context.Context, string, uint32) (indexerclient.AssetTransferPage, error)
	Transaction(context.Context, string) (indexerclient.Transaction, error)
	ProtocolEvents(context.Context, string, string, uint32) (indexerclient.ProtocolEventPage, error)
}

type AssetValidatorDiscovery struct {
	reader AssetValidatorReader
	now    func() time.Time
}

func NewAssetValidatorDiscovery(reader AssetValidatorReader) (*AssetValidatorDiscovery, error) {
	if reader == nil { return nil, errors.New("asset/validator reader required") }
	return &AssetValidatorDiscovery{reader: reader, now: time.Now}, nil
}

func (d *AssetValidatorDiscovery) ResolveAsset(ctx context.Context, assetKey string) ([]searchresult.Result, error) {
	assetKey = strings.TrimSpace(assetKey)
	if assetKey == "" { return nil, errors.New("asset key required") }
	status, indexedHeight, safeHeight, err := d.qualifiedStatus(ctx)
	if err != nil { return nil, err }
	page, err := d.reader.AssetTransfers(ctx, assetKey, 1)
	if err != nil { return nil, err }
	if len(page.Items) == 0 { return nil, nil }
	transfer := page.Items[0]
	tx, err := d.reader.Transaction(ctx, transfer.TransactionHash)
	if err != nil { return nil, err }
	if tx.ChainID != transfer.ChainID || tx.BlockNumber != transfer.BlockNumber { return nil, errors.New("asset transfer transaction provenance mismatch") }
	blockNumber, err := strconv.ParseUint(transfer.BlockNumber, 10, 64)
	if err != nil { return nil, errors.New("invalid asset transfer block number") }
	p := provenance(transfer.ChainID, &blockNumber, tx.BlockHash, transfer.TransactionHash, indexedHeight, safeHeight, d.now())
	p.Authority = "canonical chain/token transfer state via qualified 420Indexer projection"
	if transfer.LogIndex >= 0 {
		logIndex := uint64(transfer.LogIndex)
		p.LogIndex = &logIndex
	}
	subtitle := transfer.AssetKind
	if transfer.ContractAddress != nil && strings.TrimSpace(*transfer.ContractAddress) != "" { subtitle += " · " + *transfer.ContractAddress }
	if transfer.TokenID != nil && strings.TrimSpace(*transfer.TokenID) != "" { subtitle += " · token " + *transfer.TokenID }
	r, err := searchresult.New(
		architecture.DomainAsset,
		assetKey,
		architecture.SearchModeResolver,
		p,
		searchresult.Presentation{
			Title: "Asset " + assetKey,
			Subtitle: subtitle,
			Snippet: fmt.Sprintf("latest indexed transfer %s → %s · amount %s", transfer.From, transfer.To, transfer.Amount),
			Category: "asset",
			CanonicalURL: "/assets/" + url.PathEscape(assetKey),
			Tags: []string{"asset", transfer.AssetKind},
		},
	)
	_ = status
	if err != nil { return nil, err }
	return []searchresult.Result{r}, nil
}

func (d *AssetValidatorDiscovery) ResolveValidator(ctx context.Context, validatorID string) ([]searchresult.Result, error) {
	validatorID = strings.ToLower(strings.TrimSpace(validatorID))
	if validatorID == "" { return nil, errors.New("validator id required") }
	_, indexedHeight, safeHeight, err := d.qualifiedStatus(ctx)
	if err != nil { return nil, err }
	page, err := d.reader.ProtocolEvents(ctx, "420Stake", validatorID, validatorHistoryLimit)
	if err != nil { return nil, err }
	if page.NextCursor != nil { return nil, errors.New("validator event history exceeds bounded reconstruction window") }
	if len(page.Items) == 0 { return nil, nil }
	var registered *indexerclient.ProtocolEvent
	for i := range page.Items {
		event := &page.Items[i]
		if event.EventName == "ValidatorRegistered" { registered = event; break }
	}
	if registered == nil { return nil, errors.New("validator history missing registration event") }
	latest := page.Items[len(page.Items)-1]
	blockNumber, err := strconv.ParseUint(latest.BlockNumber, 10, 64)
	if err != nil { return nil, errors.New("invalid validator block number") }
	logIndex := uint64(latest.LogIndex)
	p := provenance(latest.ChainID, &blockNumber, latest.BlockHash, latest.TransactionHash, indexedHeight, safeHeight, d.now())
	p.Source = architecture.SourceIndexer
	p.Authority = "ValidatorRegistry canonical lifecycle via qualified 420Indexer 420Stake projection"
	p.LogIndex = &logIndex
	owner := fieldString(registered.Fields, "owner")
	withdrawal := fieldString(registered.Fields, "withdrawal")
	subtitle := owner
	if withdrawal != "" && withdrawal != owner { subtitle += " · withdrawal " + withdrawal }
	tags := []string{"validator", "420Stake", strings.ToLower(latest.EventName)}
	r, err := searchresult.New(
		architecture.DomainValidator,
		validatorID,
		architecture.SearchModeResolver,
		p,
		searchresult.Presentation{
			Title: "Validator " + validatorID,
			Subtitle: subtitle,
			Snippet: "latest indexed validator lifecycle event: " + latest.EventName,
			Category: "validator",
			CanonicalURL: "/validators/" + url.PathEscape(validatorID),
			Tags: tags,
		},
	)
	if err != nil { return nil, err }
	return []searchresult.Result{r}, nil
}

func (d *AssetValidatorDiscovery) qualifiedStatus(ctx context.Context) (indexerclient.Status, *uint64, *uint64, error) {
	if err := d.reader.Qualified(ctx); err != nil { return indexerclient.Status{}, nil, nil, err }
	status, err := d.reader.Status(ctx)
	if err != nil { return indexerclient.Status{}, nil, nil, err }
	indexedHeight, err := parseOptionalUint(status.IndexedHead)
	if err != nil { return indexerclient.Status{}, nil, nil, fmt.Errorf("invalid indexed head: %w", err) }
	safeHeight, err := parseOptionalUint(status.Finality.SafeHead)
	if err != nil { return indexerclient.Status{}, nil, nil, fmt.Errorf("invalid safe head: %w", err) }
	return status, indexedHeight, safeHeight, nil
}

func fieldString(fields map[string]any, key string) string {
	value, ok := fields[key]
	if !ok || value == nil { return "" }
	switch v := value.(type) {
	case string:
		return strings.TrimSpace(v)
	case float64:
		if v == float64(uint64(v)) { return strconv.FormatUint(uint64(v), 10) }
	}
	return fmt.Sprint(value)
}
