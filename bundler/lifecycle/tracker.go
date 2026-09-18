package lifecycle

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
	"sync"
	"time"

	statussecurity "github.com/420integrated/420-integrated/status/security"
)

const UserOperationHandledTopic = "0x112a8640ccbb4f7d6b7d89a235e0e74c02afd6a9f6a9dd27cee0ff1e874cf62a"
const maxRPCResponseBytes = 1 << 20

type Submission struct {
	UserOpHash string
	TransactionHash string
	EntryPoint string
	SubmittedAt time.Time
}

type Receipt struct {
	UserOpHash string `json:"userOpHash"`
	EntryPoint string `json:"entryPoint"`
	TransactionHash string `json:"transactionHash"`
	BlockHash string `json:"blockHash"`
	BlockNumber string `json:"blockNumber"`
	Success bool `json:"success"`
	Lifecycle string `json:"lifecycle"`
}

type Store struct {
	mu sync.RWMutex
	submissions map[string]Submission
}

func NewStore()*Store { return &Store{submissions:map[string]Submission{}} }

func (s *Store) RecordSubmission(userOpHash,txHash,entryPoint string,submittedAt time.Time) error {
	if !hash32(userOpHash) || !hash32(txHash) || !address(entryPoint) || submittedAt.IsZero() { return errors.New("invalid submission evidence") }
	s.mu.Lock()
	defer s.mu.Unlock()
	hash:=strings.ToLower(userOpHash)
	if existing,ok:=s.submissions[hash]; ok && existing.TransactionHash!=strings.ToLower(txHash) {
		return errors.New("conflicting submission transaction")
	}
	s.submissions[hash]=Submission{
		UserOpHash:hash,TransactionHash:strings.ToLower(txHash),EntryPoint:strings.ToLower(entryPoint),SubmittedAt:submittedAt.UTC(),
	}
	return nil
}

func (s *Store) Submission(userOpHash string)(Submission,bool) {
	s.mu.RLock(); defer s.mu.RUnlock()
	v,ok:=s.submissions[strings.ToLower(userOpHash)]
	return v,ok
}

type RPC struct {
	url string
	client *http.Client
	store *Store
}

func NewRPC(rawURL string,timeout time.Duration,store *Store)(*RPC,error){
	if err:=statussecurity.ValidateProbeURL(rawURL); err!=nil { return nil,fmt.Errorf("execution rpc: %w",err) }
	if timeout<=0 { return nil,errors.New("request timeout must be positive") }
	if store==nil { return nil,errors.New("lifecycle store is required") }
	return &RPC{url:rawURL,client:&http.Client{Timeout:timeout},store:store},nil
}

func (r *RPC) GetReceipt(ctx context.Context,userOpHash string)(Receipt,bool,error){
	if !hash32(userOpHash) { return Receipt{},false,errors.New("invalid UserOperation hash") }
	sub,ok:=r.store.Submission(userOpHash)
	if !ok { return Receipt{},false,nil }
	var rawReceipt *rpcReceipt
	if err:=r.call(ctx,"eth_getTransactionReceipt",[]any{sub.TransactionHash},&rawReceipt); err!=nil { return Receipt{},false,err }
	if rawReceipt==nil { return Receipt{},false,nil }
	if !hash32(rawReceipt.TransactionHash) || !hash32(rawReceipt.BlockHash) { return Receipt{},false,errors.New("malformed transaction receipt") }
	if strings.ToLower(rawReceipt.TransactionHash)!=sub.TransactionHash { return Receipt{},false,errors.New("receipt transaction hash mismatch") }
	if rawReceipt.Status!="0x1" { return Receipt{},false,errors.New("EntryPoint transaction reverted") }
	if _,err:=parseQuantity(rawReceipt.BlockNumber); err!=nil { return Receipt{},false,errors.New("malformed receipt block number") }

	matchCount:=0
	success:=false
	expectedHash:=strings.ToLower(userOpHash)
	for _,log:=range rawReceipt.Logs {
		if !strings.EqualFold(log.Address,sub.EntryPoint) || len(log.Topics)!=4 { continue }
		if strings.ToLower(log.Topics[0])!=UserOperationHandledTopic || strings.ToLower(log.Topics[1])!=expectedHash { continue }
		if !hash32(log.Topics[2]) || !hash32(log.Topics[3]) { return Receipt{},false,errors.New("malformed UserOperationHandled topics") }
		eventSuccess,err:=decodeHandledData(log.Data)
		if err!=nil { return Receipt{},false,err }
		matchCount++
		success=eventSuccess
	}
	if matchCount==0 { return Receipt{},false,nil }
	if matchCount!=1 { return Receipt{},false,errors.New("ambiguous UserOperationHandled evidence") }
	return Receipt{
		UserOpHash:expectedHash,EntryPoint:sub.EntryPoint,TransactionHash:sub.TransactionHash,
		BlockHash:strings.ToLower(rawReceipt.BlockHash),BlockNumber:strings.ToLower(rawReceipt.BlockNumber),
		Success:success,Lifecycle:"included",
	},true,nil
}

type rpcRequest struct { JSONRPC string `json:"jsonrpc"`; ID int `json:"id"`; Method string `json:"method"`; Params any `json:"params"` }
type rpcResponse struct { Result json.RawMessage `json:"result"`; Error *struct{Code int `json:"code"`; Message string `json:"message"`} `json:"error"` }
type rpcReceipt struct {
	TransactionHash string `json:"transactionHash"`
	BlockHash string `json:"blockHash"`
	BlockNumber string `json:"blockNumber"`
	Status string `json:"status"`
	Logs []struct{
		Address string `json:"address"`
		Topics []string `json:"topics"`
		Data string `json:"data"`
	} `json:"logs"`
}

func decodeHandledData(data string)(bool,error){
	if len(data)!=130 || !strings.HasPrefix(data,"0x") { return false,errors.New("malformed UserOperationHandled data") }
	successWord:=data[66:130]
	if successWord==strings.Repeat("0",64) { return false,nil }
	if successWord==strings.Repeat("0",63)+"1" { return true,nil }
	return false,errors.New("malformed UserOperationHandled success value")
}

func (r *RPC) call(ctx context.Context,method string,params any,out any) error {
	body,err:=json.Marshal(rpcRequest{JSONRPC:"2.0",ID:1,Method:method,Params:params}); if err!=nil{return err}
	req,err:=http.NewRequestWithContext(ctx,http.MethodPost,r.url,bytes.NewReader(body)); if err!=nil{return err}
	req.Header.Set("Content-Type","application/json")
	resp,err:=r.client.Do(req); if err!=nil{return err}
	defer resp.Body.Close()
	if resp.StatusCode!=http.StatusOK{return fmt.Errorf("rpc status %d",resp.StatusCode)}
	raw,err:=io.ReadAll(io.LimitReader(resp.Body,maxRPCResponseBytes+1)); if err!=nil{return err}
	if len(raw)>maxRPCResponseBytes{return errors.New("rpc response too large")}
	var decoded rpcResponse
	if err:=json.Unmarshal(raw,&decoded);err!=nil{return errors.New("malformed rpc response")}
	if decoded.Error!=nil{return fmt.Errorf("rpc error %d: %s",decoded.Error.Code,decoded.Error.Message)}
	if string(decoded.Result)=="null"{ return json.Unmarshal([]byte("null"),out) }
	return json.Unmarshal(decoded.Result,out)
}

func parseQuantity(v string)(uint64,error){
	if len(v)<3 || !strings.HasPrefix(v,"0x"){return 0,errors.New("invalid quantity")}
	if len(v)>3 && v[2]=='0'{return 0,errors.New("noncanonical quantity")}
	return strconv.ParseUint(v[2:],16,64)
}
func address(v string)bool{
	if len(v)!=42 || !strings.HasPrefix(v,"0x"){return false}
	for _,c:=range v[2:]{if !strings.ContainsRune("0123456789abcdefABCDEF",c){return false}}
	return v!="0x0000000000000000000000000000000000000000"
}
func hash32(v string)bool{
	if len(v)!=66 || !strings.HasPrefix(v,"0x"){return false}
	for _,c:=range v[2:]{if !strings.ContainsRune("0123456789abcdefABCDEF",c){return false}}
	return true
}
