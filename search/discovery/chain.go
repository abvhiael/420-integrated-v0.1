package discovery

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/420integrated/420-integrated/search/architecture"
	"github.com/420integrated/420-integrated/search/indexerclient"
	searchresult "github.com/420integrated/420-integrated/search/result"
)

type ChainReader interface {
	Qualified(context.Context) error
	Status(context.Context) (indexerclient.Status, error)
	Search(context.Context, string, uint32) ([]indexerclient.SearchResult, error)
	Block(context.Context, string) (indexerclient.Block, error)
	Transaction(context.Context, string) (indexerclient.Transaction, error)
	Address(context.Context, string) (indexerclient.Address, error)
}

type ChainDiscovery struct {
	reader ChainReader
	now    func() time.Time
}

func NewChainDiscovery(reader ChainReader) (*ChainDiscovery, error) {
	if reader == nil { return nil, errors.New("chain reader required") }
	return &ChainDiscovery{reader: reader, now: time.Now}, nil
}

func (d *ChainDiscovery) Resolve(ctx context.Context, term string) ([]searchresult.Result, error) {
	term = strings.TrimSpace(term)
	if term == "" { return nil, errors.New("search term required") }
	if err := d.reader.Qualified(ctx); err != nil { return nil, err }
	status, err := d.reader.Status(ctx)
	if err != nil { return nil, err }
	indexedHeight, err := parseOptionalUint(status.IndexedHead)
	if err != nil { return nil, fmt.Errorf("invalid indexed head: %w", err) }
	safeHeight, err := parseOptionalUint(status.Finality.SafeHead)
	if err != nil { return nil, fmt.Errorf("invalid safe head: %w", err) }
	matches, err := d.reader.Search(ctx, term, 20)
	if err != nil { return nil, err }
	out := make([]searchresult.Result, 0, len(matches))
	for _, match := range matches {
		var r searchresult.Result
		switch match.Type {
		case "block":
			r, err = d.blockResult(ctx, match, indexedHeight, safeHeight)
		case "transaction":
			r, err = d.transactionResult(ctx, match, indexedHeight, safeHeight)
		case "address":
			r, err = d.addressResult(ctx, match, indexedHeight, safeHeight)
		default:
			continue
		}
		if err != nil { return nil, err }
		out = append(out, r)
	}
	return out, nil
}

func (d *ChainDiscovery) blockResult(ctx context.Context, match indexerclient.SearchResult, indexedHeight, safeHeight *uint64) (searchresult.Result, error) {
	block, err := d.reader.Block(ctx, match.Key)
	if err != nil { return searchresult.Result{}, err }
	number, err := strconv.ParseUint(block.Number, 10, 64)
	if err != nil { return searchresult.Result{}, errors.New("invalid block number") }
	return searchresult.New(
		architecture.DomainBlock,
		block.Number,
		architecture.SearchModeResolver,
		provenance(block.ChainID, &number, block.Hash, "", indexedHeight, safeHeight, d.now()),
		searchresult.Presentation{Title: "Block " + block.Number, Subtitle: block.Hash, Category: "block", CanonicalURL: "/blocks/" + block.Number},
	)
}

func (d *ChainDiscovery) transactionResult(ctx context.Context, match indexerclient.SearchResult, indexedHeight, safeHeight *uint64) (searchresult.Result, error) {
	tx, err := d.reader.Transaction(ctx, match.Key)
	if err != nil { return searchresult.Result{}, err }
	blockNumber, err := strconv.ParseUint(tx.BlockNumber, 10, 64)
	if err != nil { return searchresult.Result{}, errors.New("invalid transaction block number") }
	return searchresult.New(
		architecture.DomainTransaction,
		tx.Hash,
		architecture.SearchModeResolver,
		provenance(tx.ChainID, &blockNumber, tx.BlockHash, tx.Hash, indexedHeight, safeHeight, d.now()),
		searchresult.Presentation{Title: "Transaction " + tx.Hash, Subtitle: fmt.Sprintf("block %s", tx.BlockNumber), Category: "transaction", CanonicalURL: "/transactions/" + tx.Hash},
	)
}

func (d *ChainDiscovery) addressResult(ctx context.Context, match indexerclient.SearchResult, indexedHeight, safeHeight *uint64) (searchresult.Result, error) {
	address, err := d.reader.Address(ctx, match.Key)
	if err != nil { return searchresult.Result{}, err }
	domain := architecture.DomainAddress
	category := "address"
	title := "Address " + address.Address
	canonicalURL := "/addresses/" + address.Address
	if address.IsContract {
		domain = architecture.DomainContract
		category = "contract"
		title = "Contract " + address.Address
		canonicalURL = "/contracts/" + address.Address
	}
	return searchresult.New(
		domain,
		address.Address,
		architecture.SearchModeResolver,
		provenance(address.ChainID, nil, "", "", indexedHeight, safeHeight, d.now()),
		searchresult.Presentation{Title: title, Category: category, CanonicalURL: canonicalURL},
	)
}

func provenance(chain string, blockNumber *uint64, blockHash, txHash string, indexedHeight, safeHeight *uint64, indexedAt time.Time) searchresult.Provenance {
	chainID, _ := strconv.ParseUint(chain, 10, 64)
	finality := searchresult.FinalityHead
	if blockNumber != nil && safeHeight != nil && *blockNumber <= *safeHeight { finality = searchresult.FinalitySafe }
	return searchresult.Provenance{
		Source: architecture.SourceIndexer,
		Authority: "420Indexer projection of canonical chain state",
		ChainID: chainID,
		BlockNumber: blockNumber,
		BlockHash: blockHash,
		TransactionHash: txHash,
		Finality: finality,
		IndexedAt: indexedAt,
		IndexedHeight: indexedHeight,
		FinalizedHeight: nil,
	}
}

func parseOptionalUint(value string) (*uint64, error) {
	value = strings.TrimSpace(value)
	if value == "" { return nil, nil }
	parsed, err := strconv.ParseUint(value, 10, 64)
	if err != nil { return nil, err }
	return &parsed, nil
}
