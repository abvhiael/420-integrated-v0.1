package rpc

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestQualificationSourceExercisesRealRPCAndRejectsRuntimeDivergence(t *testing.T) {
	now:=time.Unix(2000000000,0).UTC()
	chain:="0x1a4"
	latestTimestamp:=now.Unix()
	safeNumber:="0x62"
	finalizedNumber:="0x5f"

	srv:=httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){
		var req request
		if err:=json.NewDecoder(r.Body).Decode(&req);err!=nil{t.Fatal(err)}
		w.Header().Set("content-type","application/json")
		switch req.Method {
		case "eth_chainId":
			_ = json.NewEncoder(w).Encode(map[string]any{"jsonrpc":"2.0","id":req.ID,"result":chain})
		case "eth_getBlockByNumber":
			params,_:=req.Params.([]any)
			tag,_:=params[0].(string)
			var number,hash,parent,timestamp string
			switch tag {
			case "0x0":
				number,hash,parent,timestamp="0x0","0xgenesis","0x0","0x1"
			case "latest":
				number,hash,parent,timestamp="0x64","0xhead","0x63",hexQuantity(uint64(latestTimestamp))
			case "safe":
				number,hash,parent,timestamp=safeNumber,"0xsafe","0x61",hexQuantity(uint64(latestTimestamp-1))
			case "finalized":
				number,hash,parent,timestamp=finalizedNumber,"0xfinalized","0x5e",hexQuantity(uint64(latestTimestamp-2))
			default:
				t.Fatalf("unexpected block tag %q",tag)
			}
			_ = json.NewEncoder(w).Encode(map[string]any{"jsonrpc":"2.0","id":req.ID,"result":map[string]any{
				"number":number,"hash":hash,"parentHash":parent,"timestamp":timestamp,
			}})
		default:
			t.Fatalf("unexpected method %s",req.Method)
		}
	}))
	defer srv.Close()

	client:=NewClient(srv.URL,time.Second)
	source:=NewQualificationSource(context.Background(),client,420,"v1")
	reqs:=Requirements{RequiredChainID:420,ExpectedGenesisHash:"0xgenesis",MaxHeadAge:2*time.Minute,Now:now}

	if v,err:=Validate(source,reqs);err!=nil || !v.Healthy { t.Fatalf("healthy runtime source rejected: %+v err=%v",v,err) }

	chain="0x1"
	if _,err:=Validate(source,reqs);!errors.Is(err,ErrWrongChain){t.Fatalf("wrong-chain runtime source not rejected: %v",err)}
	chain="0x1a4"

	latestTimestamp=now.Add(-5*time.Minute).Unix()
	if _,err:=Validate(source,reqs);!errors.Is(err,ErrStaleSource){t.Fatalf("stale runtime source not rejected: %v",err)}
	latestTimestamp=now.Unix()

	safeNumber="0x65"
	if _,err:=Validate(source,reqs);!errors.Is(err,ErrFinalityOrdering){t.Fatalf("finality divergence not rejected: %v",err)}
}
