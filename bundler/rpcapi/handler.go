package rpcapi

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/420integrated/420-integrated/bundler/userop"
)

const maxRequestBytes = 1 << 20

type GasEstimate struct {
	PreVerificationGas string `json:"preVerificationGas"`
	VerificationGasLimit string `json:"verificationGasLimit"`
	CallGasLimit string `json:"callGasLimit"`
}

type Backend interface {
	SendUserOperation(context.Context, userop.PackedUserOperation, string) (string, error)
	GetUserOperationReceipt(context.Context, string) (any, bool, error)
	EstimateUserOperationGas(context.Context, userop.PackedUserOperation, string) (GasEstimate, error)
	SupportedEntryPoints(context.Context) ([]string, error)
}

type Error struct {
	Code int
	Message string
	Data any
}

func (e *Error) Error() string { return e.Message }

type Handler struct { backend Backend }

func NewHandler(backend Backend) (*Handler, error) {
	if backend == nil { return nil, errors.New("bundler rpc backend is required") }
	return &Handler{backend:backend}, nil
}

type request struct {
	JSONRPC string `json:"jsonrpc"`
	ID json.RawMessage `json:"id"`
	Method string `json:"method"`
	Params json.RawMessage `json:"params"`
}

type response struct {
	JSONRPC string `json:"jsonrpc"`
	ID json.RawMessage `json:"id"`
	Result any `json:"result,omitempty"`
	Error *responseError `json:"error,omitempty"`
}

type responseError struct {
	Code int `json:"code"`
	Message string `json:"message"`
	Data any `json:"data,omitempty"`
}

func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.Header().Set("Allow", http.MethodPost)
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if ct:=r.Header.Get("Content-Type"); ct!="" && !strings.HasPrefix(strings.ToLower(ct),"application/json") {
		http.Error(w,"content type must be application/json",http.StatusUnsupportedMediaType)
		return
	}
	raw,err:=io.ReadAll(io.LimitReader(r.Body,maxRequestBytes+1))
	if err!=nil { h.write(w,nil,nil,&Error{Code:-32700,Message:"parse error"}); return }
	if len(raw)>maxRequestBytes { h.write(w,nil,nil,&Error{Code:-32600,Message:"request too large"}); return }
	raw=bytes.TrimSpace(raw)
	if len(raw)==0 || raw[0]=='[' {
		h.write(w,nil,nil,&Error{Code:-32600,Message:"invalid request"})
		return
	}
	var req request
	if err:=json.Unmarshal(raw,&req); err!=nil {
		h.write(w,nil,nil,&Error{Code:-32700,Message:"parse error"})
		return
	}
	if req.JSONRPC!="2.0" || len(req.ID)==0 || strings.TrimSpace(req.Method)=="" {
		h.write(w,req.ID,nil,&Error{Code:-32600,Message:"invalid request"})
		return
	}
	result,rpcErr:=h.dispatch(r.Context(),req)
	h.write(w,req.ID,result,rpcErr)
}

func (h *Handler) dispatch(ctx context.Context, req request) (any,*Error) {
	switch req.Method {
	case "eth_supportedEntryPoints":
		if err:=requireNoParams(req.Params); err!=nil { return nil,err }
		points,err:=h.backend.SupportedEntryPoints(ctx)
		if err!=nil { return nil,mapBackendError(err) }
		return points,nil
	case "eth_sendUserOperation":
		op,entry,err:=decodeOperationParams(req.Params)
		if err!=nil { return nil,err }
		hash,backendErr:=h.backend.SendUserOperation(ctx,op,entry)
		if backendErr!=nil { return nil,mapBackendError(backendErr) }
		if !isHash(hash) { return nil,&Error{Code:-32603,Message:"backend returned invalid user operation hash"} }
		return strings.ToLower(hash),nil
	case "eth_estimateUserOperationGas":
		op,entry,err:=decodeOperationParams(req.Params)
		if err!=nil { return nil,err }
		estimate,backendErr:=h.backend.EstimateUserOperationGas(ctx,op,entry)
		if backendErr!=nil { return nil,mapBackendError(backendErr) }
		return estimate,nil
	case "eth_getUserOperationReceipt":
		var params []json.RawMessage
		if err:=json.Unmarshal(req.Params,&params); err!=nil || len(params)!=1 {
			return nil,&Error{Code:-32602,Message:"invalid params"}
		}
		var hash string
		if err:=json.Unmarshal(params[0],&hash); err!=nil || !isHash(hash) {
			return nil,&Error{Code:-32602,Message:"invalid user operation hash"}
		}
		receipt,found,backendErr:=h.backend.GetUserOperationReceipt(ctx,strings.ToLower(hash))
		if backendErr!=nil { return nil,mapBackendError(backendErr) }
		if !found { return nil,nil }
		return receipt,nil
	default:
		return nil,&Error{Code:-32601,Message:"method not found"}
	}
}

func decodeOperationParams(raw json.RawMessage) (userop.PackedUserOperation,string,*Error) {
	var params []json.RawMessage
	if err:=json.Unmarshal(raw,&params); err!=nil || len(params)!=2 {
		return userop.PackedUserOperation{},"",&Error{Code:-32602,Message:"invalid params"}
	}
	var op userop.PackedUserOperation
	if err:=json.Unmarshal(params[0],&op); err!=nil {
		return userop.PackedUserOperation{},"",&Error{Code:-32602,Message:"invalid UserOperation"}
	}
	if _,err:=op.Canonicalize(); err!=nil {
		return userop.PackedUserOperation{},"",&Error{Code:-32602,Message:"invalid UserOperation",Data:err.Error()}
	}
	var entry string
	if err:=json.Unmarshal(params[1],&entry); err!=nil || !isAddress(entry) {
		return userop.PackedUserOperation{},"",&Error{Code:-32602,Message:"invalid EntryPoint"}
	}
	return op,strings.ToLower(entry),nil
}

func requireNoParams(raw json.RawMessage) *Error {
	if len(raw)==0 || string(raw)=="null" { return nil }
	var params []json.RawMessage
	if err:=json.Unmarshal(raw,&params); err!=nil || len(params)!=0 {
		return &Error{Code:-32602,Message:"invalid params"}
	}
	return nil
}

func mapBackendError(err error) *Error {
	var rpcErr *Error
	if errors.As(err,&rpcErr) { return rpcErr }
	return &Error{Code:-32603,Message:"internal error"}
}

func isAddress(v string) bool {
	if len(v)!=42 || !strings.HasPrefix(v,"0x") { return false }
	for _,c:=range v[2:] {
		if !strings.ContainsRune("0123456789abcdefABCDEF",c) { return false }
	}
	return v!="0x0000000000000000000000000000000000000000"
}

func isHash(v string) bool {
	if len(v)!=66 || !strings.HasPrefix(v,"0x") { return false }
	for _,c:=range v[2:] {
		if !strings.ContainsRune("0123456789abcdefABCDEF",c) { return false }
	}
	return true
}

func (h *Handler) write(w http.ResponseWriter,id json.RawMessage,result any,rpcErr *Error) {
	w.Header().Set("Content-Type","application/json")
	w.WriteHeader(http.StatusOK)
	if len(id)==0 { id=json.RawMessage("null") }
	resp:=response{JSONRPC:"2.0",ID:id,Result:result}
	if rpcErr!=nil {
		resp.Result=nil
		resp.Error=&responseError{Code:rpcErr.Code,Message:rpcErr.Message,Data:rpcErr.Data}
	}
	if err:=json.NewEncoder(w).Encode(resp); err!=nil { _=fmt.Errorf("encode response: %w",err) }
}
