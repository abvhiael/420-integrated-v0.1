package indexerclient

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	indexerapi "github.com/420integrated/420-integrated/indexer/api"
	"github.com/420integrated/420-integrated/indexer/model"
)

func TestStakeActivityClientUsesDerivedIndexerRouteAndPreservesFilters(t *testing.T) {
	validatorID:="0x"+strings.Repeat("a",64)
	address:="0x1111111111111111111111111111111111111111"
	srv:=httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){
		if r.URL.Path!="/v1/stake/activity"{t.Fatalf("path=%s",r.URL.Path)}
		if r.URL.Query().Get("validatorId")!=validatorID||r.URL.Query().Get("address")!=address||r.URL.Query().Get("limit")!="25"{
			t.Fatalf("unexpected query: %s",r.URL.RawQuery)
		}
		json.NewEncoder(w).Encode(indexerapi.StakeActivityPage{
			Meta:indexerapi.PageMeta{ChainID:420,SnapshotHeight:7,SafeHeight:6,FinalizedHeight:5},
			ValidatorID:validatorID,Address:address,
			Records:[]model.StakeActivityRecord{{ChainID:420,BlockNumber:5,ContractAddress:indexerapi.StakeValidatorRegistryAddress,EventName:"ValidatorRegistered",ValidatorID:validatorID,Addresses:[]string{address},Finality:model.FinalityFinalized}},
			CanonicalAuthority:false,
		})
	}))
	defer srv.Close()
	client,err:=New(srv.URL,time.Second);if err!=nil{t.Fatal(err)}
	page,err:=client.StakeActivity(context.Background(),validatorID,address,25);if err!=nil{t.Fatal(err)}
	if len(page.Records)!=1||page.Records[0].EventName!="ValidatorRegistered"{t.Fatalf("unexpected page: %+v",page)}
}

func TestStakeActivityClientRejectsIndexerCanonicalAuthorityClaim(t *testing.T) {
	srv:=httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){
		json.NewEncoder(w).Encode(indexerapi.StakeActivityPage{CanonicalAuthority:true})
	}))
	defer srv.Close()
	client,_:=New(srv.URL,time.Second)
	if _,err:=client.StakeActivity(context.Background(),"","",50);err!=ErrIndexerAuthorityViolation{
		t.Fatalf("expected authority violation, got %v",err)
	}
}
