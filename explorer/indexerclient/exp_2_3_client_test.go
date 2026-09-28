package indexerclient

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	indexerapi "github.com/420integrated/420-integrated/indexer/api"
	"github.com/420integrated/420-integrated/indexer/model"
)

func TestEXP23ClientRejectsAuthorityClaimsAcrossDataRoutes(t *testing.T) {
	addr := "0x1111111111111111111111111111111111111111"
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("content-type", "application/json")
		switch r.URL.Path {
		case "/v1/transactions":
			json.NewEncoder(w).Encode(indexerapi.AddressTransactionPage{Address: addr, Meta: indexerapi.PageMeta{ChainID: 420}, CanonicalAuthority: true})
		case "/v1/contracts/" + addr:
			json.NewEncoder(w).Encode(indexerapi.ReadResponse[model.ContractRecord]{Data: model.ContractRecord{ChainID: 420, Address: addr}, CanonicalAuthority: true})
		case "/v1/asset-transfers":
			json.NewEncoder(w).Encode(indexerapi.AssetTransferPage{Meta: indexerapi.PageMeta{ChainID: 420}, CanonicalAuthority: true})
		default:
			http.NotFound(w, r)
		}
	}))
	defer srv.Close()

	client, err := New(srv.URL, time.Second)
	if err != nil { t.Fatal(err) }
	ctx := context.Background()
	if _, err := client.AddressTransactions(ctx, addr, 50); err != ErrIndexerAuthorityViolation {
		t.Fatalf("address authority claim not rejected: %v", err)
	}
	if _, err := client.Contract(ctx, addr); err != ErrIndexerAuthorityViolation {
		t.Fatalf("contract authority claim not rejected: %v", err)
	}
	if _, err := client.AssetTransfers(ctx, "", "", 50); err != ErrIndexerAuthorityViolation {
		t.Fatalf("asset authority claim not rejected: %v", err)
	}
}
