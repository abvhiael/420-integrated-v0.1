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

func TestEXP24ConsensusClientRejectsAuthorityClaim(t *testing.T) {
	srv:=httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){
		if r.URL.Path!="/v1/consensus"{http.NotFound(w,r);return}
		w.Header().Set("Content-Type","application/json")
		_ = json.NewEncoder(w).Encode(indexerapi.ReadResponse[model.ConsensusStatus]{
			Data:model.ConsensusStatus{ChainID:420},
			CanonicalAuthority:true,
		})
	}))
	defer srv.Close()
	client,err:=New(srv.URL,time.Second); if err!=nil{t.Fatal(err)}
	if _,err:=client.Consensus(context.Background()); err!=ErrIndexerAuthorityViolation {
		t.Fatalf("expected authority violation, got %v",err)
	}
}
