package api

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/420integrated/420-integrated/explorer/service"
	"github.com/420integrated/420-integrated/indexer/model"
)

type compensationFixture struct {
	*fakeIndexer
	events []service.CompensationEvent
}

func (f *compensationFixture) CompensationEvents(context.Context, uint64, string) ([]service.CompensationEvent, error) {
	return f.events, nil
}

func TestCompensationTransactionFinalityAndReplacement(t *testing.T) {
	f := &compensationFixture{fakeIndexer: transactionFixture()}
	tx := "0x" + strings.Repeat("1", 64)
	block := "0x" + strings.Repeat("2", 64)
	f.tx.Hash, f.receipt.TransactionHash, f.logs[0].TransactionHash = tx, tx, tx
	f.tx.BlockHash, f.receipt.BlockHash, f.block.Hash, f.logs[0].BlockHash = block, block, block, block
	f.health.Health = model.Health{ChainID: 420, IndexedHeight: 9, SafeHeight: 8, FinalizedHeight: 7, State: "READY", LastIngestAt: time.Now()}
	base := service.CompensationEvent{
		ChainID: "420", BlockNumber: "7", BlockHash: block, TransactionHash: tx,
		TransactionIndex: 1, ContractAddress: f.logs[0].Address, Protocol: service.CompensationProtocol,
		EventName: "FounderCompensationClaimed",
		Fields:    map[string]string{"beneficiary": f.logs[0].Address, "asset": f.logs[0].Address, "amount": "9007199254740993001"},
	}
	f.events = []service.CompensationEvent{base}
	svc, err := service.New(f, 420, time.Hour)
	if err != nil {
		t.Fatal(err)
	}
	server, err := NewServer(svc)
	if err != nil {
		t.Fatal(err)
	}
	read := func() *httptest.ResponseRecorder {
		out := httptest.NewRecorder()
		server.Handler().ServeHTTP(out, httptest.NewRequest(http.MethodGet, "/v1/transactions/"+tx+"/compensation", nil))
		return out
	}
	out := read()
	var view service.CompensationView
	if err := json.Unmarshal(out.Body.Bytes(), &view); err != nil {
		t.Fatal(err)
	}
	if out.Code != 200 || out.Header().Get("Cache-Control") != "no-store" || view.Confirmations != 3 ||
		view.Finality != model.FinalityFinalized || len(view.Events) != 1 ||
		view.Events[0].Fields["amount"] != base.Fields["amount"] {
		t.Fatalf("unexpected compensation view: %d %s", out.Code, out.Body)
	}
	f.block.Hash = "0x" + strings.Repeat("3", 64)
	if out = read(); out.Code != 503 || strings.Contains(out.Body.String(), base.Fields["amount"]) {
		t.Fatalf("orphaned projection was presented: %d %s", out.Code, out.Body)
	}
	f.events = nil
	if out = read(); out.Code != 200 || !strings.Contains(out.Body.String(), `"events":[]`) {
		t.Fatalf("expected empty canonical projection: %d %s", out.Code, out.Body)
	}
}
