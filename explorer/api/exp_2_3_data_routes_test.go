package api

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	indexerapi "github.com/420integrated/420-integrated/indexer/api"
	"github.com/420integrated/420-integrated/indexer/model"
	explorerservice "github.com/420integrated/420-integrated/explorer/service"
)

type exp23Indexer struct {
	*fakeIndexer
	addressPage indexerapi.AddressTransactionPage
	assetPage   indexerapi.AssetTransferPage
	contract    model.ContractRecord
}

func (f *exp23Indexer) AddressTransactions(context.Context, string, uint32) (indexerapi.AddressTransactionPage, error) {
	return f.addressPage, nil
}
func (f *exp23Indexer) AssetTransfers(context.Context, string, string, uint32) (indexerapi.AssetTransferPage, error) {
	return f.assetPage, nil
}
func (f *exp23Indexer) Contract(context.Context, string) (model.ContractRecord, error) {
	return f.contract, nil
}

func newEXP23Server(t *testing.T, idx *exp23Indexer) *Server {
	t.Helper()
	svc, err := explorerservice.New(idx, 420, time.Hour)
	if err != nil { t.Fatal(err) }
	s, err := NewServer(svc)
	if err != nil { t.Fatal(err) }
	return s
}

func TestEXP23AddressContractAndAssetRoutes(t *testing.T) {
	addr := "0x1111111111111111111111111111111111111111"
	idx := &exp23Indexer{
		fakeIndexer: &fakeIndexer{},
		addressPage: indexerapi.AddressTransactionPage{
			Address: addr,
			Meta: indexerapi.PageMeta{ChainID: 420, SnapshotHeight: 12, SnapshotHash: "0x12"},
			Transactions: []model.TransactionRecord{{ChainID: 420, BlockNumber: 12, Hash: "0xtx", From: addr}},
		},
		assetPage: indexerapi.AssetTransferPage{
			Meta: indexerapi.PageMeta{ChainID: 420, SnapshotHeight: 12, SnapshotHash: "0x12"},
			AssetKey: "native:420", Address: addr,
			Transfers: []model.AssetTransferRecord{{ChainID: 420, BlockNumber: 12, TransactionHash: "0xtx", LogIndex: -1, AssetKey: "native:420", AssetKind: "native", From: addr, Amount: "420"}},
		},
		contract: model.ContractRecord{
			ChainID: 420, Address: addr, DeploymentTxHash: "0xtx", DeploymentHash: "0x12", RuntimeCode: "0x6000", CodeHash: "0xcode",
		},
	}
	s := newEXP23Server(t, idx)

	rr := httptest.NewRecorder()
	s.Handler().ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/v1/addresses/"+addr+"?limit=50", nil))
	if rr.Code != http.StatusOK { t.Fatalf("address status=%d body=%s", rr.Code, rr.Body.String()) }
	var av explorerservice.AddressView
	if err := json.Unmarshal(rr.Body.Bytes(), &av); err != nil { t.Fatal(err) }
	if av.Address != addr || av.TxCount != 1 || av.Meta.SnapshotHeight != 12 { t.Fatalf("unexpected address view: %+v", av) }

	rr = httptest.NewRecorder()
	s.Handler().ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/v1/contracts/"+addr, nil))
	if rr.Code != http.StatusOK { t.Fatalf("contract status=%d body=%s", rr.Code, rr.Body.String()) }
	var cv explorerservice.ContractDetailView
	if err := json.Unmarshal(rr.Body.Bytes(), &cv); err != nil { t.Fatal(err) }
	if !cv.HasRuntimeCode || cv.RuntimeCodeBytes != 2 || cv.Contract.CodeHash != "0xcode" { t.Fatalf("unexpected contract view: %+v", cv) }

	rr = httptest.NewRecorder()
	s.Handler().ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/v1/assets/activity?assetKey=native:420&address="+addr+"&limit=50", nil))
	if rr.Code != http.StatusOK { t.Fatalf("asset status=%d body=%s", rr.Code, rr.Body.String()) }
	var tv explorerservice.AssetActivityView
	if err := json.Unmarshal(rr.Body.Bytes(), &tv); err != nil { t.Fatal(err) }
	if tv.TransferCount != 1 || tv.AssetKey != "native:420" || tv.Address != addr { t.Fatalf("unexpected asset view: %+v", tv) }
}

func TestEXP23RoutesRejectInvalidInputs(t *testing.T) {
	s := newEXP23Server(t, &exp23Indexer{
		fakeIndexer: &fakeIndexer{},
		addressPage: indexerapi.AddressTransactionPage{Meta: indexerapi.PageMeta{ChainID: 420}},
		assetPage: indexerapi.AssetTransferPage{Meta: indexerapi.PageMeta{ChainID: 420}},
		contract: model.ContractRecord{ChainID: 420},
	})
	cases := []string{
		"/v1/addresses/0xnope",
		"/v1/addresses/0x1111111111111111111111111111111111111111?limit=251",
		"/v1/contracts/0xnope",
		"/v1/assets/activity?address=0xnope",
		"/v1/assets/activity?limit=251",
	}
	for _, path := range cases {
		rr := httptest.NewRecorder()
		s.Handler().ServeHTTP(rr, httptest.NewRequest(http.MethodGet, path, nil))
		if rr.Code != http.StatusBadRequest {
			t.Fatalf("%s status=%d body=%s", path, rr.Code, rr.Body.String())
		}
	}
}
