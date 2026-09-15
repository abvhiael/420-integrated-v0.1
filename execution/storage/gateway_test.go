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

type gatewayDiscoveryFunc func(context.Context, GatewayRequest) ([]GatewayCandidate, error)
func (f gatewayDiscoveryFunc) DiscoverGatewaySources(ctx context.Context, req GatewayRequest) ([]GatewayCandidate,error){ return f(ctx,req) }

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

func TestGatewayRouterDiscoveryFiltersAndFailsOverDeterministically(t *testing.T){
	payload:=[]byte("abcd"); req:=gatewayRequest(payload); calls:=[]string{}
	source:=func(name string, data []byte, err error) GatewaySource {
		return gatewaySourceFunc(func(context.Context,GatewayRequest)([]byte,error){calls=append(calls,name);return data,err})
	}
	g:=GatewayRouter{Discovery:gatewayDiscoveryFunc(func(context.Context,GatewayRequest)([]GatewayCandidate,error){
		return []GatewayCandidate{
			{ProviderID:"provider-z",NodeID:"node-z",Capability:GatewayCapabilityCache,Priority:10,Active:true,Source:source("cache-z",payload,nil)},
			{ProviderID:"provider-a",NodeID:"node-a",Capability:GatewayCapabilityCache,Priority:5,Active:true,Source:source("cache-a",nil,errors.New("cache a down"))},
			{ProviderID:"provider-inactive",NodeID:"node-inactive",Capability:GatewayCapabilityCache,Priority:0,Active:false,Source:source("inactive",payload,nil)},
			{ProviderID:"provider-other",NodeID:"node-other",Capability:GatewayCapability("relay"),Priority:0,Active:true,Source:source("wrong-capability",payload,nil)},
			{ProviderID:"provider-store",NodeID:"node-store",Capability:GatewayCapabilityStore,Priority:0,Active:true,Source:source("store",payload,nil)},
		},nil
	})}
	res,err:=g.Route(context.Background(),req);if err!=nil{t.Fatal(err)}
	if res.Tier!="cache"||res.ProviderID!="provider-z"||res.NodeID!="node-z"{t.Fatalf("bad result %+v",res)}
	if len(calls)!=2||calls[0]!="cache-a"||calls[1]!="cache-z"{t.Fatalf("calls=%v",calls)}
	if len(res.Attempts)!=1||res.Attempts[0].ProviderID!="provider-a"{t.Fatalf("attempts=%+v",res.Attempts)}
}

func TestGatewayRouterDiscoveryTieBreakAndDedup(t *testing.T){
	payload:=[]byte("abcd"); req:=gatewayRequest(payload); calls:=[]string{}
	g:=GatewayRouter{Discovery:gatewayDiscoveryFunc(func(context.Context,GatewayRequest)([]GatewayCandidate,error){
		return []GatewayCandidate{
			{ProviderID:"provider-b",NodeID:"node-b",Capability:GatewayCapabilityCache,Priority:7,Active:true,Source:gatewaySourceFunc(func(context.Context,GatewayRequest)([]byte,error){calls=append(calls,"b");return payload,nil})},
			{ProviderID:"provider-a",NodeID:"node-a",Capability:GatewayCapabilityCache,Priority:7,Active:true,Source:gatewaySourceFunc(func(context.Context,GatewayRequest)([]byte,error){calls=append(calls,"a");return payload,nil})},
			{ProviderID:"provider-a",NodeID:"node-a",Capability:GatewayCapabilityCache,Priority:7,Active:true,Source:gatewaySourceFunc(func(context.Context,GatewayRequest)([]byte,error){calls=append(calls,"duplicate");return payload,nil})},
		},nil
	})}
	res,err:=g.Route(context.Background(),req);if err!=nil{t.Fatal(err)}
	if res.ProviderID!="provider-a"||res.NodeID!="node-a"{t.Fatalf("bad result %+v",res)}
	if len(calls)!=1||calls[0]!="a"{t.Fatalf("calls=%v",calls)}
}

func TestGatewayRouterDiscoveryFailureFallsBackToStatic(t *testing.T){
	payload:=[]byte("abcd"); req:=gatewayRequest(payload)
	g:=GatewayRouter{
		Discovery:gatewayDiscoveryFunc(func(context.Context,GatewayRequest)([]GatewayCandidate,error){return nil,errors.New("discovery unavailable")}),
		Store:[]GatewaySource{gatewaySourceFunc(func(context.Context,GatewayRequest)([]byte,error){return payload,nil})},
	}
	res,err:=g.Route(context.Background(),req);if err!=nil{t.Fatal(err)}
	if res.Tier!="store"||len(res.Attempts)!=1||res.Attempts[0].Tier!="discovery"{t.Fatalf("bad result %+v",res)}
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
