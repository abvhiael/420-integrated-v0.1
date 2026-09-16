package evidence

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"
)

type RPCClient struct {
	url    string
	client *http.Client
}

func NewRPCClient(url string) (*RPCClient, error) {
	if strings.TrimSpace(url) == "" { return nil, errors.New("rpc url is required") }
	return &RPCClient{url: url, client: &http.Client{Timeout: 20 * time.Second}}, nil
}

func (c *RPCClient) Acquire(ctx context.Context, address string, expectedChainID uint64) (DeploymentEvidence, error) {
	if !validAddress(address) { return DeploymentEvidence{}, errors.New("invalid contract address") }
	chainID, err := c.chainID(ctx); if err != nil { return DeploymentEvidence{}, err }
	if expectedChainID != 0 && chainID != expectedChainID { return DeploymentEvidence{}, fmt.Errorf("wrong chain: configured=%d actual=%d", expectedChainID, chainID) }
	latest, err := c.blockNumber(ctx); if err != nil { return DeploymentEvidence{}, err }
	code, err := c.codeAt(ctx, address, "latest"); if err != nil { return DeploymentEvidence{}, err }
	if code == "" || code == "0x" { return DeploymentEvidence{}, errors.New("address has no deployed runtime bytecode") }
	codeHash, err := c.codeHash(ctx, address); if err != nil { return DeploymentEvidence{}, err }
	observed, err := c.blockHeader(ctx, latest); if err != nil { return DeploymentEvidence{}, err }
	first, err := c.firstCodeBlock(ctx, address, latest); if err != nil { return DeploymentEvidence{}, err }
	firstHeader, err := c.blockHeader(ctx, first); if err != nil { return DeploymentEvidence{}, err }

	e := DeploymentEvidence{ChainID:chainID, Address:strings.ToLower(address), RuntimeBytecode:code, RuntimeCodeHash:codeHash, ObservedAt:observed, FirstCodeBlock:firstHeader, Provenance:"canonical_chain_state/rpc"}
	if first == 0 {
		e.MissingContextReason = MissingGenesisOrPredeploy
	} else if creation, ok, err := c.creationInBlock(ctx, address, first); err != nil {
		return DeploymentEvidence{}, err
	} else if ok {
		e.Creation = creation
	} else {
		e.MissingContextReason = MissingCreationTxUnresolved
	}
	if err := e.Validate(); err != nil { return DeploymentEvidence{}, err }
	return e, nil
}

// StorageAt exposes canonical eth_getStorageAt reads for proxy relationship resolution.
// The HTTP client timeout still bounds the request when callers use this context-free adapter.
func (c *RPCClient) StorageAt(address, slot, block string) (string, error) {
	if !validAddress(address) { return "", errors.New("invalid contract address") }
	if !validHash(slot) { return "", errors.New("invalid storage slot") }
	if strings.TrimSpace(block) == "" { return "", errors.New("block is required") }
	var out string
	if err := c.call(context.Background(), "eth_getStorageAt", []any{address, slot, block}, &out); err != nil { return "", err }
	if len(out) != 66 || !strings.HasPrefix(out, "0x") { return "", errors.New("eth_getStorageAt returned invalid storage word") }
	return strings.ToLower(out), nil
}

func (c *RPCClient) chainID(ctx context.Context) (uint64,error) { var out string; if err:=c.call(ctx,"eth_chainId",[]any{},&out); err!=nil{return 0,err}; return parseHexUint(out) }
func (c *RPCClient) blockNumber(ctx context.Context) (uint64,error) { var out string; if err:=c.call(ctx,"eth_blockNumber",[]any{},&out); err!=nil{return 0,err}; return parseHexUint(out) }
func (c *RPCClient) codeAt(ctx context.Context,address,block string)(string,error){var out string; if err:=c.call(ctx,"eth_getCode",[]any{address,block},&out); err!=nil{return "",err}; return out,nil}
func (c *RPCClient) codeHash(ctx context.Context,address string)(string,error){var out struct{CodeHash string `json:"codeHash"`}; if err:=c.call(ctx,"eth_getProof",[]any{address,[]any{},"latest"},&out); err!=nil{return "",err}; if !validHash(out.CodeHash){return "",errors.New("eth_getProof missing valid codeHash")}; return strings.ToLower(out.CodeHash),nil}

func (c *RPCClient) firstCodeBlock(ctx context.Context,address string,latest uint64)(uint64,error){
	lo, hi := uint64(0), latest
	for lo < hi {
		mid := lo + (hi-lo)/2
		code, err := c.codeAt(ctx,address,fmt.Sprintf("0x%x",mid)); if err!=nil{return 0,err}
		if code != "" && code != "0x" { hi = mid } else { lo = mid + 1 }
	}
	return lo,nil
}

func (c *RPCClient) blockHeader(ctx context.Context,n uint64)(BlockContext,error){var out struct{Number string `json:"number"`; Hash string `json:"hash"`}; if err:=c.call(ctx,"eth_getBlockByNumber",[]any{fmt.Sprintf("0x%x",n),false},&out); err!=nil{return BlockContext{},err}; parsed,err:=parseHexUint(out.Number); if err!=nil{return BlockContext{},err}; if !validHash(out.Hash){return BlockContext{},errors.New("block missing hash")}; return BlockContext{Number:parsed,Hash:strings.ToLower(out.Hash)},nil}

type blockTx struct { Hash string `json:"hash"`; To *string `json:"to"`; Input string `json:"input"` }
type fullBlock struct { Transactions []blockTx `json:"transactions"` }
type receipt struct { TransactionHash string `json:"transactionHash"`; BlockHash string `json:"blockHash"`; ContractAddress *string `json:"contractAddress"` }

func (c *RPCClient) creationInBlock(ctx context.Context,address string,n uint64)(*CreationContext,bool,error){
	var block fullBlock
	if err:=c.call(ctx,"eth_getBlockByNumber",[]any{fmt.Sprintf("0x%x",n),true},&block); err!=nil{return nil,false,err}
	for _,tx := range block.Transactions {
		if tx.To != nil { continue }
		var r receipt
		if err:=c.call(ctx,"eth_getTransactionReceipt",[]any{tx.Hash},&r); err!=nil{return nil,false,err}
		if r.ContractAddress != nil && strings.EqualFold(*r.ContractAddress,address) {
			return &CreationContext{TransactionHash:strings.ToLower(tx.Hash),ReceiptBlockHash:strings.ToLower(r.BlockHash),CreationBytecode:tx.Input},true,nil
		}
	}
	return nil,false,nil
}

func parseHexUint(v string)(uint64,error){v=strings.TrimPrefix(v,"0x"); if v==""{return 0,errors.New("empty hex uint")}; return strconv.ParseUint(v,16,64)}

func (c *RPCClient) call(ctx context.Context,method string,params []any,out any) error {
	body,_:=json.Marshal(map[string]any{"jsonrpc":"2.0","id":1,"method":method,"params":params})
	req,err:=http.NewRequestWithContext(ctx,http.MethodPost,c.url,bytes.NewReader(body)); if err!=nil{return err}; req.Header.Set("Content-Type","application/json")
	res,err:=c.client.Do(req); if err!=nil{return err}; defer res.Body.Close(); if res.StatusCode!=http.StatusOK{return fmt.Errorf("rpc status %d",res.StatusCode)}
	var env struct{Result json.RawMessage `json:"result"`; Error *struct{Code int `json:"code"`; Message string `json:"message"`} `json:"error"`}
	if err:=json.NewDecoder(res.Body).Decode(&env); err!=nil{return err}; if env.Error!=nil{return fmt.Errorf("rpc %d: %s",env.Error.Code,env.Error.Message)}; if len(env.Result)==0||string(env.Result)=="null"{return errors.New("rpc response missing result")}; return json.Unmarshal(env.Result,out)
}
