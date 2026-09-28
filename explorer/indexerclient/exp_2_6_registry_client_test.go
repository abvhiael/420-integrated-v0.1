package indexerclient

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	indexerapi "github.com/420integrated/420-integrated/indexer/api"
	"github.com/420integrated/420-integrated/indexer/decoder"
)

func TestEXP26ServiceVersionClientRejectsAuthorityClaim(t *testing.T){
	srv:=httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){
		w.Header().Set("Content-Type","application/json")
		_ = json.NewEncoder(w).Encode(indexerapi.ReadResponse[decoder.ServiceVersion]{
			Data:decoder.ServiceVersion{ServiceID:"420Registry",Version:2},
			CanonicalAuthority:true,
		})
	}))
	defer srv.Close()
	client,err:=New(srv.URL,time.Second); if err!=nil{t.Fatal(err)}
	if _,err:=client.ServiceVersion(context.Background(),"420Registry",2);err!=ErrIndexerAuthorityViolation{
		t.Fatalf("expected authority violation, got %v",err)
	}
}
