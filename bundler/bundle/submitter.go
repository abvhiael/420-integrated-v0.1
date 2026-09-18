package bundle

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	statussecurity "github.com/420integrated/420-integrated/status/security"
	"github.com/420integrated/420-integrated/bundler/simulation"
	"github.com/420integrated/420-integrated/bundler/userop"
)

const maxRPCResponseBytes = 1 << 20

type RPCSubmitter struct {
	url string
	from string
	client *http.Client
}

func NewRPCSubmitter(rawURL,from string,timeout time.Duration)(*RPCSubmitter,error){
	if err:=statussecurity.ValidateProbeURL(rawURL); err!=nil { return nil,fmt.Errorf("execution rpc: %w",err) }
	if !address(from) { return nil,errors.New("valid submitter address is required") }
	if timeout<=0 { return nil,errors.New("request timeout must be positive") }
	return &RPCSubmitter{url:rawURL,from:strings.ToLower(from),client:&http.Client{Timeout:timeout}},nil
}

type rpcRequest struct {
	JSONRPC string `json:"jsonrpc"`
	ID int `json:"id"`
	Method string `json:"method"`
	Params any `json:"params"`
}

type rpcResponse struct {
	Result json.RawMessage `json:"result"`
	Error *struct{
		Code int `json:"code"`
		Message string `json:"message"`
	} `json:"error"`
}

func (s *RPCSubmitter) Submit(ctx context.Context,entryPoint string,op userop.PackedUserOperation)(string,error){
	data,err:=simulation.EncodeHandleOp(op)
	if err!=nil { return "",err }
	tx:=map[string]any{"from":s.from,"to":strings.ToLower(entryPoint),"value":"0x0","data":data}
	body,err:=json.Marshal(rpcRequest{JSONRPC:"2.0",ID:1,Method:"eth_sendTransaction",Params:[]any{tx}})
	if err!=nil { return "",err }
	req,err:=http.NewRequestWithContext(ctx,http.MethodPost,s.url,bytes.NewReader(body))
	if err!=nil { return "",err }
	req.Header.Set("Content-Type","application/json")
	resp,err:=s.client.Do(req)
	if err!=nil { return "",err }
	defer resp.Body.Close()
	if resp.StatusCode!=http.StatusOK { return "",fmt.Errorf("rpc status %d",resp.StatusCode) }
	raw,err:=io.ReadAll(io.LimitReader(resp.Body,maxRPCResponseBytes+1))
	if err!=nil { return "",err }
	if len(raw)>maxRPCResponseBytes { return "",errors.New("rpc response too large") }
	var decoded rpcResponse
	if err:=json.Unmarshal(raw,&decoded); err!=nil { return "",errors.New("malformed rpc response") }
	if decoded.Error!=nil { return "",fmt.Errorf("rpc error %d: %s",decoded.Error.Code,decoded.Error.Message) }
	var hash string
	if err:=json.Unmarshal(decoded.Result,&hash); err!=nil || !hash32(hash) { return "",errors.New("invalid transaction hash") }
	return strings.ToLower(hash),nil
}

func address(v string) bool {
	if len(v)!=42 || !strings.HasPrefix(v,"0x") { return false }
	for _,c:=range v[2:] { if !strings.ContainsRune("0123456789abcdefABCDEF",c) { return false } }
	return v!="0x0000000000000000000000000000000000000000"
}
func hash32(v string) bool {
	if len(v)!=66 || !strings.HasPrefix(v,"0x") { return false }
	for _,c:=range v[2:] { if !strings.ContainsRune("0123456789abcdefABCDEF",c) { return false } }
	return true
}
