package interoperability

import (
 "context"
 "encoding/json"
 "net/http"
 "net/http/httptest"
 "strings"
 "testing"
 "time"
)

const fixtureEntryPoint = "0x1111111111111111111111111111111111111111"

type scriptedOperator struct {
 points any
 receipt any
 malformed bool
 wrongID bool
 requests []string
}

func (o *scriptedOperator) ServeHTTP(w http.ResponseWriter,r *http.Request){
 if r.Method!=http.MethodPost||r.Header.Get("Content-Type")!="application/json"{http.Error(w,"invalid request",http.StatusBadRequest);return}
 var body struct {JSONRPC string `json:"jsonrpc"`;ID int `json:"id"`;Method string `json:"method"`;Params []json.RawMessage `json:"params"`}
 if err:=json.NewDecoder(r.Body).Decode(&body);err!=nil||body.JSONRPC!="2.0"{http.Error(w,"invalid envelope",http.StatusBadRequest);return}
 o.requests=append(o.requests,body.Method)
 if body.Method=="eth_sendUserOperation" {http.Error(w,"probe must never submit",http.StatusBadRequest);return}
 if o.malformed {_,_=w.Write([]byte("not-json"));return}
 var result any
 switch body.Method {
 case "eth_supportedEntryPoints": result=o.points
 case "eth_getUserOperationReceipt": result=o.receipt
 default: http.Error(w,"unexpected method",http.StatusBadRequest);return
 }
 id:=body.ID
 if o.wrongID{id++}
 w.Header().Set("Content-Type","application/json")
 _=json.NewEncoder(w).Encode(map[string]any{"jsonrpc":"2.0","id":id,"result":result})
}

func TestIndependentOperatorsAndClientCompatibility(t *testing.T){
 for _,name:=range []string{"420-operator","independent-client-operator"}{
  t.Run(name,func(t *testing.T){
   operator:=&scriptedOperator{points:[]string{strings.ToUpper(fixtureEntryPoint[:2])+fixtureEntryPoint[2:]},receipt:nil}
   // Entries may be mixed-case, while the 0x prefix remains canonical.
   operator.points=[]string{"0x"+strings.ToUpper(fixtureEntryPoint[2:])}
   server:=httptest.NewServer(operator);defer server.Close()
   probe:=Probe{Client:&http.Client{Timeout:time.Second},EntryPoint:fixtureEntryPoint}
   result,err:=probe.Check(context.Background(),server.URL)
   if err!=nil{t.Fatal(err)}
   if !result.Supported||!result.UnknownReceiptIsNull||result.EntryPoint!=fixtureEntryPoint{t.Fatalf("invalid qualification %+v",result)}
   if len(operator.requests)!=2||operator.requests[0]!="eth_supportedEntryPoints"||operator.requests[1]!="eth_getUserOperationReceipt"{t.Fatalf("unexpected operator methods: %v",operator.requests)}
  })
 }
}

func TestOperatorProbeRejectsIncompatibleEndpointsWithoutSubmitting(t *testing.T){
 cases:=[]struct{name string;operator scriptedOperator}{
  {"wrong_domain",scriptedOperator{points:[]string{"0x2222222222222222222222222222222222222222"}}},
  {"malformed_entrypoint",scriptedOperator{points:[]string{"0xzz"}}},
  {"fabricated_receipt",scriptedOperator{points:[]string{fixtureEntryPoint},receipt:map[string]any{"lifecycle":"included"}}},
  {"wrong_response_id",scriptedOperator{points:[]string{fixtureEntryPoint},wrongID:true}},
  {"malformed_response",scriptedOperator{points:[]string{fixtureEntryPoint},malformed:true}},
 }
 for _,tc:=range cases {
  t.Run(tc.name,func(t *testing.T){
   operator:=tc.operator
   server:=httptest.NewServer(&operator);defer server.Close()
   _,err:=(Probe{Client:server.Client(),EntryPoint:fixtureEntryPoint}).Check(context.Background(),server.URL)
   if err==nil{t.Fatal("incompatible operator qualified")}
   for _,method:=range operator.requests{if method=="eth_sendUserOperation"{t.Fatal("conformance probe submitted user operation")}}
  })
 }
}

func TestOperatorProbeRejectsInsecureRemoteEndpoint(t *testing.T){
 _,err:=(Probe{EntryPoint:fixtureEntryPoint}).Check(context.Background(),"http://example.com/rpc")
 if err==nil{t.Fatal("insecure remote operator was allowed")}
}
