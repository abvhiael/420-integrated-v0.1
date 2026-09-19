package gasestimation

import (
	"bytes"
	"context"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"strings"
	"time"

	statussecurity "github.com/420integrated/420-integrated/status/security"
	"github.com/420integrated/420-integrated/bundler/simulation"
	"github.com/420integrated/420-integrated/bundler/userop"
)

const maxRPCResponseBytes = 1 << 20

type Estimate struct {
	PreVerificationGas string
	VerificationGasLimit string
	CallGasLimit string
}

type Estimator interface {
	Estimate(context.Context,userop.PackedUserOperation,string)(Estimate,error)
}

type RPC struct {
	url string
	from string
	client *http.Client
}

func NewRPC(rawURL,from string,timeout time.Duration)(*RPC,error){
	if err:=statussecurity.ValidateProbeURL(rawURL); err!=nil { return nil,fmt.Errorf("execution rpc: %w",err) }
	if from!="" && !address(from) { return nil,errors.New("invalid gas estimation sender") }
	if timeout<=0 { return nil,errors.New("request timeout must be positive") }
	return &RPC{url:rawURL,from:strings.ToLower(from),client:&http.Client{Timeout:timeout}},nil
}

type rpcRequest struct {
	JSONRPC string `json:"jsonrpc"`
	ID int `json:"id"`
	Method string `json:"method"`
	Params any `json:"params"`
}
type rpcResponse struct {
	Result json.RawMessage `json:"result"`
	Error *struct{Code int `json:"code"`; Message string `json:"message"`} `json:"error"`
}

func (r *RPC) Estimate(ctx context.Context,op userop.PackedUserOperation,entryPoint string)(Estimate,error){
	canonical,err:=op.Canonicalize()
	if err!=nil { return Estimate{},err }
	if !address(entryPoint) { return Estimate{},errors.New("invalid EntryPoint") }
	data,err:=simulation.EncodeHandleOp(op)
	if err!=nil { return Estimate{},err }

	tx:=map[string]any{"to":strings.ToLower(entryPoint),"value":"0x0","data":data}
	if r.from!="" { tx["from"]=r.from }
	var totalHex string
	if err:=r.call(ctx,"eth_estimateGas",[]any{tx},&totalHex); err!=nil { return Estimate{},err }
	total,err:=parseQuantity(totalHex)
	if err!=nil { return Estimate{},errors.New("invalid eth_estimateGas result") }

	packed:=new(big.Int).SetBytes(canonical.AccountGasLimits[:])
	verification:=new(big.Int).Rsh(new(big.Int).Set(packed),128)
	mask:=new(big.Int).Sub(new(big.Int).Lsh(big.NewInt(1),128),big.NewInt(1))
	callLimit:=new(big.Int).And(new(big.Int).Set(packed),mask)

	pre:=localPreVerificationGas(data)
	if canonical.PreVerificationGas.Cmp(pre)>0 { pre=new(big.Int).Set(canonical.PreVerificationGas) }

	// Preserve an explicit verification limit when the client supplied one.
	// Treat the node's full handleOp estimate as a conservative lower bound for call gas,
	// because standard eth_estimateGas does not expose account-abstraction phase splits.
	if callLimit.Cmp(total)<0 { callLimit=total }
	if verification.Sign()==0 {
		// No fabricated verifier benchmark: zero means "not separately measured".
		verification=big.NewInt(0)
	}

	return Estimate{
		PreVerificationGas:quantity(pre),
		VerificationGasLimit:quantity(verification),
		CallGasLimit:quantity(callLimit),
	},nil
}

func localPreVerificationGas(calldata string)*big.Int{
	raw,err:=hex.DecodeString(strings.TrimPrefix(calldata,"0x"))
	if err!=nil { return big.NewInt(21000) }
	var cost uint64=21000
	for _,b:=range raw {
		if b==0 { cost+=4 } else { cost+=16 }
	}
	return new(big.Int).SetUint64(cost)
}

func (r *RPC) call(ctx context.Context,method string,params any,out any) error {
	body,err:=json.Marshal(rpcRequest{JSONRPC:"2.0",ID:1,Method:method,Params:params})
	if err!=nil { return err }
	req,err:=http.NewRequestWithContext(ctx,http.MethodPost,r.url,bytes.NewReader(body))
	if err!=nil { return err }
	req.Header.Set("Content-Type","application/json")
	resp,err:=r.client.Do(req)
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

func parseQuantity(raw string)(*big.Int,error){
	if len(raw)<3 || !strings.HasPrefix(raw,"0x") { return nil,errors.New("invalid quantity") }
	digits:=raw[2:]
	if len(digits)>1 && digits[0]=='0' { return nil,errors.New("noncanonical quantity") }
	v:=new(big.Int)
	if _,ok:=v.SetString(digits,16); !ok || v.Sign()<0 || v.BitLen()>256 { return nil,errors.New("invalid quantity") }
	return v,nil
}
func quantity(v *big.Int) string {
	if v==nil || v.Sign()==0 { return "0x0" }
	return "0x"+v.Text(16)
}
func address(v string) bool {
	if len(v)!=42 || !strings.HasPrefix(v,"0x") { return false }
	for _,c:=range v[2:] { if !strings.ContainsRune("0123456789abcdefABCDEF",c) { return false } }
	return v!="0x0000000000000000000000000000000000000000"
}
