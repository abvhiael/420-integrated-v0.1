package simulation

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	statussecurity "github.com/420integrated/420-integrated/status/security"
	"github.com/420integrated/420-integrated/bundler/userop"
)

const maxRPCResponseBytes = 1 << 20

type RPCSimulator struct {
	url string
	client *http.Client
}

func NewRPCSimulator(rawURL string,timeout time.Duration)(*RPCSimulator,error){
	if err:=statussecurity.ValidateProbeURL(rawURL); err!=nil { return nil,fmt.Errorf("execution rpc: %w",err) }
	if timeout<=0 { return nil,errors.New("request timeout must be positive") }
	return &RPCSimulator{url:rawURL,client:&http.Client{Timeout:timeout}},nil
}

type rpcRequest struct {
	JSONRPC string `json:"jsonrpc"`
	ID int `json:"id"`
	Method string `json:"method"`
	Params any `json:"params"`
}

type rpcResponse struct {
	Result json.RawMessage `json:"result"`
	Error *struct {
		Code int `json:"code"`
		Message string `json:"message"`
	} `json:"error"`
}

func (s *RPCSimulator) call(ctx context.Context,method string,params any,out any) error {
	body,err:=json.Marshal(rpcRequest{JSONRPC:"2.0",ID:1,Method:method,Params:params})
	if err!=nil { return err }
	req,err:=http.NewRequestWithContext(ctx,http.MethodPost,s.url,bytes.NewReader(body))
	if err!=nil { return err }
	req.Header.Set("Content-Type","application/json")
	resp,err:=s.client.Do(req)
	if err!=nil { return err }
	defer resp.Body.Close()
	if resp.StatusCode!=http.StatusOK { return fmt.Errorf("rpc status %d",resp.StatusCode) }
	raw,err:=io.ReadAll(io.LimitReader(resp.Body,maxRPCResponseBytes+1))
	if err!=nil { return err }
	if len(raw)>maxRPCResponseBytes { return errors.New("rpc response too large") }
	var decoded rpcResponse
	if err:=json.Unmarshal(raw,&decoded); err!=nil { return errors.New("malformed rpc response") }
	if decoded.Error!=nil { return fmt.Errorf("rpc error %d: %s",decoded.Error.Code,decoded.Error.Message) }
	if len(decoded.Result)==0 || string(decoded.Result)=="null" { return errors.New("rpc result missing") }
	return json.Unmarshal(decoded.Result,out)
}

func (s *RPCSimulator) SimulateHandleOp(ctx context.Context,entryPoint string,op userop.PackedUserOperation)(Result,error){
	data,err:=EncodeHandleOp(op)
	if err!=nil { return Result{},err }

	var block struct {
		Number string `json:"number"`
		Hash string `json:"hash"`
		Timestamp string `json:"timestamp"`
	}
	if err:=s.call(ctx,"eth_getBlockByNumber",[]any{"latest",false},&block); err!=nil {
		return Result{},fmt.Errorf("latest block: %w",err)
	}
	number,err:=parseHexUint64("block number",block.Number)
	if err!=nil || number==0 { return Result{},errors.New("invalid simulation block number") }
	timestamp,err:=parseHexUint64("block timestamp",block.Timestamp)
	if err!=nil { return Result{},errors.New("invalid simulation block timestamp") }
	if !hash32(block.Hash) { return Result{},errors.New("invalid simulation block hash") }

	blockTag:="0x"+strconv.FormatUint(number,16)
	var raw string
	tx:=map[string]any{"to":strings.ToLower(entryPoint),"value":"0x0","data":data}
	if err:=s.call(ctx,"eth_call",[]any{tx,blockTag},&raw); err!=nil {
		return Result{},err
	}
	ok,err:=DecodeHandleOpResult(raw)
	if err!=nil { return Result{},err }
	return Result{
		ReturnData:strings.ToLower(raw),
		ExecutionSucceeded:ok,
		Snapshot:Snapshot{
			BlockNumber:number,BlockHash:strings.ToLower(block.Hash),
			ObservedAt:time.Unix(int64(timestamp),0).UTC(),
		},
	},nil
}

func parseHexUint64(name,raw string)(uint64,error){
	if len(raw)<3 || !strings.HasPrefix(raw,"0x") { return 0,fmt.Errorf("%s must be hex quantity",name) }
	digits:=raw[2:]
	if len(digits)>1 && digits[0]=='0' { return 0,fmt.Errorf("%s is not canonical",name) }
	v,err:=strconv.ParseUint(digits,16,64)
	if err!=nil { return 0,fmt.Errorf("%s invalid",name) }
	return v,nil
}
