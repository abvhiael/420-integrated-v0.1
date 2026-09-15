package storage

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
)

type gatewaySourceFunc func(context.Context, GatewayRequest) ([]byte, error)
func (f gatewaySourceFunc) FetchGatewayObject(ctx context.Context, req GatewayRequest) ([]byte,error){ return f(ctx,req) }

func gatewayRequest(payload []byte) GatewayRequest {
	return GatewayRequest{CacheKey:cacheTestKey(payload,"manifest-a",1),CommitmentID:"commitment-a"}
}

func TestGatewayRouterCacheFirst(t *testing.T){
	payload:=[]byte("abcd"); req:=gatewayRequest(payload); storeCalls:=0
	g:=GatewayRouter{
		Cache:[]GatewaySource{gatewaySourceFunc(func(context.Context,GatewayRequest)([]byte,error){return payload,nil})},
		Store:[]GatewaySource{gatewaySourceFunc(func(context.Context,GatewayRequest)([]byte,error){storeCalls++;return payload,nil})},
	}
	res,err:=g.Route(context.Background(),req); if err!=nil{t.Fatal(err)}
	if res.Tier!="cache"||res.Source!=0||string(res.Payload)!="abcd"||storeCalls!=0{t.Fatalf("bad result %+v storeCalls=%d",res,storeCalls)}
}

func TestGatewayRouterFallsBackToStore(t *testing.T){
	payload:=[]byte("abcd"); req:=gatewayRequest(payload)
	g:=GatewayRouter{
		Cache:[]GatewaySource{gatewaySourceFunc(func(context.Context,GatewayRequest)([]byte,error){return nil,errors.New("cache down")})},
		Store:[]GatewaySource{gatewaySourceFunc(func(context.Context,GatewayRequest)([]byte,error){return payload,nil})},
	}
	res,err:=g.Route(context.Background(),req); if err!=nil{t.Fatal(err)}
	if res.Tier!="store"||len(res.Attempts)!=1||res.Attempts[0].Tier!="cache"{t.Fatalf("bad result %+v",res)}
}

func TestGatewayRouterRejectsCorruptSourceAndContinues(t *testing.T){
	payload:=[]byte("abcd"); req:=gatewayRequest(payload)
	g:=GatewayRouter{
		Cache:[]GatewaySource{gatewaySourceFunc(func(context.Context,GatewayRequest)([]byte,error){return []byte("wxyz"),nil})},
		Store:[]GatewaySource{gatewaySourceFunc(func(context.Context,GatewayRequest)([]byte,error){return payload,nil})},
	}
	res,err:=g.Route(context.Background(),req); if err!=nil{t.Fatal(err)}
	if res.Tier!="store"||len(res.Attempts)!=1{t.Fatalf("bad result %+v",res)}
}

func TestGatewayRouterFailsClosed(t *testing.T){
	payload:=[]byte("abcd"); req:=gatewayRequest(payload)
	g:=GatewayRouter{Cache:[]GatewaySource{gatewaySourceFunc(func(context.Context,GatewayRequest)([]byte,error){return nil,errors.New("miss")})}}
	res,err:=g.Route(context.Background(),req); if !errors.Is(err,ErrGatewayRoute)||len(res.Attempts)!=1{t.Fatalf("res=%+v err=%v",res,err)}
}

func TestGatewayHTTPSources(t *testing.T){
	payload:=[]byte("abcd"); req:=gatewayRequest(payload)
	server:=httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){
		if r.Header.Get("Authorization")!="Bearer secret"{t.Fatalf("missing auth: %q",r.Header.Get("Authorization"))}
		switch r.URL.Path {
		case "/v1/cache":
			if r.URL.Query().Get("manifest_id")!="manifest-a"{t.Fatalf("bad cache query %s",r.URL.RawQuery)}
		case "/v1/shards/commitment-a":
		default:
			t.Fatalf("unexpected path %s",r.URL.Path)
		}
		_,_=w.Write(payload)
	})); defer server.Close()
	cache:=HTTPGatewayCacheSource{BaseURL:server.URL,Client:server.Client(),Token:"secret"}
	if got,err:=cache.FetchGatewayObject(context.Background(),req);err!=nil||string(got)!="abcd"{t.Fatalf("cache got=%q err=%v",got,err)}
	store:=HTTPGatewayStoreSource{BaseURL:server.URL,Client:server.Client(),Token:"secret"}
	if got,err:=store.FetchGatewayObject(context.Background(),req);err!=nil||string(got)!="abcd"{t.Fatalf("store got=%q err=%v",got,err)}
}
