// Package interoperability provides a read-only wire conformance probe for
// clients selecting independently operated 420 Bundler endpoints. It never
// submits an operation or treats an operator's reply as canonical chain evidence.
package interoperability

import (
 "bytes"
 "context"
 "encoding/json"
 "errors"
 "fmt"
 "io"
 "net/http"
 "net/url"
 "strings"
 "time"
)

const maxResponseBytes = 64 << 10

// Probe checks the public, read-only JSON-RPC contract without sending a
// UserOperation. The caller owns endpoint trust and TLS configuration.
type Probe struct {
 Client *http.Client
 EntryPoint string
}

type Result struct {
 Endpoint string
 EntryPoint string
 Supported bool
 UnknownReceiptIsNull bool
}

func validAddress(raw string) bool {
 if len(raw)!=42||!strings.HasPrefix(raw,"0x"){return false}
 for _,r:=range raw[2:]{if !strings.ContainsRune("0123456789abcdefABCDEF",r){return false}}
 return raw!="0x0000000000000000000000000000000000000000"
}

func (p Probe) Check(ctx context.Context, rawURL string) (Result,error) {
 if !validAddress(p.EntryPoint){return Result{},errors.New("valid expected EntryPoint is required")}
 u,err:=url.Parse(rawURL)
 if err!=nil||u.Host==""||(u.Scheme!="https"&&u.Scheme!="http")||u.User!=nil||u.RawQuery!=""||u.Fragment!="" {return Result{},errors.New("invalid operator URL")}
 if u.Scheme=="http" && u.Hostname()!="localhost" && u.Hostname()!="127.0.0.1" && u.Hostname()!="::1" {return Result{},errors.New("operator endpoint requires HTTPS outside loopback")}
 client:=p.Client
 if client==nil {client=&http.Client{Timeout:5*time.Second}}
 call:=func(id int,method string,params any)(json.RawMessage,error){
  raw,err:=json.Marshal(map[string]any{"jsonrpc":"2.0","id":id,"method":method,"params":params})
  if err!=nil{return nil,err}
  request,err:=http.NewRequestWithContext(ctx,http.MethodPost,rawURL,bytes.NewReader(raw))
  if err!=nil{return nil,err}
  request.Header.Set("Content-Type","application/json")
  response,err:=client.Do(request)
  if err!=nil{return nil,err}
  defer response.Body.Close()
  if response.StatusCode!=http.StatusOK{return nil,fmt.Errorf("operator returned HTTP %d",response.StatusCode)}
  raw,err=io.ReadAll(io.LimitReader(response.Body,maxResponseBytes+1))
  if err!=nil{return nil,err}
  if len(raw)>maxResponseBytes{return nil,errors.New("operator response too large")}
  var envelope struct {JSONRPC string `json:"jsonrpc"`; ID json.RawMessage `json:"id"`; Result json.RawMessage `json:"result"`; Error json.RawMessage `json:"error"`}
  if err:=json.Unmarshal(raw,&envelope);err!=nil{return nil,errors.New("malformed operator JSON-RPC response")}
  if envelope.JSONRPC!="2.0"||string(envelope.ID)!=fmt.Sprint(id)||len(envelope.Error)!=0||len(envelope.Result)==0{return nil,errors.New("incompatible operator JSON-RPC envelope")}
  return envelope.Result,nil
 }
 supported,err:=call(1,"eth_supportedEntryPoints",[]any{})
 if err!=nil{return Result{},err}
 var points []string
 if err:=json.Unmarshal(supported,&points);err!=nil{return Result{},errors.New("operator returned malformed EntryPoint list")}
 expected:=strings.ToLower(p.EntryPoint)
 found:=false
 for _,point:=range points {if !validAddress(point){return Result{},errors.New("operator returned invalid EntryPoint")};if strings.ToLower(point)==expected{found=true}}
 if !found{return Result{},errors.New("operator does not support expected EntryPoint")}
 // A valid, never-submitted hash must produce JSON null, not a fabricated receipt.
 unknown:="0x"+strings.Repeat("00",31)+"01"
 receipt,err:=call(2,"eth_getUserOperationReceipt",[]any{unknown})
 if err!=nil{return Result{},err}
 if string(bytes.TrimSpace(receipt))!="null" {return Result{},errors.New("operator fabricated an unknown UserOperation receipt")}
 return Result{Endpoint:rawURL,EntryPoint:expected,Supported:true,UnknownReceiptIsNull:true},nil
}
