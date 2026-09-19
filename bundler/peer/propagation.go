package peer

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
	"github.com/420integrated/420-integrated/bundler/mempool"
	"github.com/420integrated/420-integrated/bundler/simulation"
	"github.com/420integrated/420-integrated/bundler/userop"
)

const maxPeerRequestBytes = 1 << 20
const maxPeers = 32

type Validator interface {
	ValidateAndSimulate(context.Context,userop.PackedUserOperation,time.Time)(simulation.Evidence,error)
}

type Pool interface {
	Add(userop.PackedUserOperation,simulation.Evidence,time.Time)(mempool.AddResult,error)
}

type Envelope struct {
	ChainID uint64 `json:"chainId"`
	EntryPoint string `json:"entryPoint"`
	UserOpHash string `json:"userOpHash"`
	UserOperation userop.PackedUserOperation `json:"userOperation"`
}

type Handler struct {
	chainID uint64
	entryPoint string
	validator Validator
	pool Pool
	now func()time.Time
}

func NewHandler(chainID uint64,entryPoint string,validator Validator,pool Pool)(*Handler,error){
	if chainID==0{return nil,errors.New("chain id must be non-zero")}
	if !address(entryPoint){return nil,errors.New("valid EntryPoint is required")}
	if validator==nil || pool==nil{return nil,errors.New("validator and pool are required")}
	return &Handler{chainID:chainID,entryPoint:strings.ToLower(entryPoint),validator:validator,pool:pool},nil
}

func (h *Handler) SetNow(now func()time.Time){ h.now=now }

func (h *Handler) ServeHTTP(w http.ResponseWriter,r *http.Request){
	if r.Method!=http.MethodPost{
		w.Header().Set("Allow",http.MethodPost)
		http.Error(w,"method not allowed",http.StatusMethodNotAllowed)
		return
	}
	raw,err:=io.ReadAll(io.LimitReader(r.Body,maxPeerRequestBytes+1))
	if err!=nil || len(raw)>maxPeerRequestBytes{
		http.Error(w,"invalid peer request",http.StatusBadRequest)
		return
	}
	var env Envelope
	if err:=json.Unmarshal(raw,&env);err!=nil{
		http.Error(w,"invalid peer envelope",http.StatusBadRequest)
		return
	}
	if env.ChainID!=h.chainID || !strings.EqualFold(env.EntryPoint,h.entryPoint){
		http.Error(w,"peer domain mismatch",http.StatusConflict)
		return
	}
	if _,err:=env.UserOperation.Canonicalize();err!=nil{
		http.Error(w,"invalid UserOperation",http.StatusBadRequest)
		return
	}
	expected,err:=userop.Hash(h.chainID,h.entryPoint,env.UserOperation)
	if err!=nil || !hash32(env.UserOpHash) || strings.ToLower(expected)!=strings.ToLower(env.UserOpHash){
		http.Error(w,"peer UserOperation hash mismatch",http.StatusBadRequest)
		return
	}
	now:=time.Now().UTC()
	if h.now!=nil{now=h.now().UTC()}
	evidence,err:=h.validator.ValidateAndSimulate(r.Context(),env.UserOperation,now)
	if err!=nil{
		http.Error(w,"peer UserOperation rejected",http.StatusUnprocessableEntity)
		return
	}
	admitted,err:=h.pool.Add(env.UserOperation,evidence,now)
	if err!=nil{
		switch {
		case errors.Is(err,mempool.ErrNonceConflict):
			http.Error(w,"peer nonce conflict",http.StatusConflict)
		case errors.Is(err,mempool.ErrFull),errors.Is(err,mempool.ErrSenderLimit):
			http.Error(w,"peer admission capacity exceeded",http.StatusTooManyRequests)
		default:
			http.Error(w,"peer admission failed",http.StatusInternalServerError)
		}
		return
	}
	w.Header().Set("Content-Type","application/json")
	w.WriteHeader(http.StatusAccepted)
	_ = json.NewEncoder(w).Encode(map[string]any{"userOpHash":admitted.Hash,"duplicate":admitted.Duplicate})
}

type Broadcaster struct {
	chainID uint64
	entryPoint string
	peers []string
	client *http.Client
}

func NewBroadcaster(chainID uint64,entryPoint string,peers []string,timeout time.Duration)(*Broadcaster,error){
	if chainID==0{return nil,errors.New("chain id must be non-zero")}
	if !address(entryPoint){return nil,errors.New("valid EntryPoint is required")}
	if timeout<=0{return nil,errors.New("timeout must be positive")}
	if len(peers)>maxPeers{return nil,fmt.Errorf("peer count exceeds %d",maxPeers)}
	normalized:=make([]string,0,len(peers))
	seen:=map[string]bool{}
	for _,raw:=range peers{
		raw=strings.TrimSpace(raw)
		if raw==""{continue}
		if err:=statussecurity.ValidateProbeURL(raw);err!=nil{return nil,fmt.Errorf("peer url: %w",err)}
		raw=strings.TrimRight(raw,"/")
		if seen[raw]{continue}
		seen[raw]=true
		normalized=append(normalized,raw)
	}
	return &Broadcaster{chainID:chainID,entryPoint:strings.ToLower(entryPoint),peers:normalized,client:&http.Client{Timeout:timeout}},nil
}

func (b *Broadcaster) Broadcast(ctx context.Context,op userop.PackedUserOperation)(int,error){
	if len(b.peers)==0{return 0,nil}
	hash,err:=userop.Hash(b.chainID,b.entryPoint,op)
	if err!=nil{return 0,err}
	env:=Envelope{ChainID:b.chainID,EntryPoint:b.entryPoint,UserOpHash:strings.ToLower(hash),UserOperation:op}
	payload,err:=json.Marshal(env);if err!=nil{return 0,err}
	type outcome struct{accepted bool}
	results:=make(chan outcome,len(b.peers))
	for _,base:=range b.peers{
		base:=base
		go func(){
			req,err:=http.NewRequestWithContext(ctx,http.MethodPost,base+"/peer/v1/user-operation",bytes.NewReader(payload))
			if err!=nil{results<-outcome{};return}
			req.Header.Set("Content-Type","application/json")
			resp,err:=b.client.Do(req)
			if err!=nil{results<-outcome{};return}
			_,_=io.Copy(io.Discard,io.LimitReader(resp.Body,4096))
			resp.Body.Close()
			results<-outcome{accepted:resp.StatusCode==http.StatusAccepted}
		}()
	}
	successes:=0
	for range b.peers{if (<-results).accepted{successes++}}
	if successes==0{return 0,errors.New("no peer accepted UserOperation")}
	return successes,nil
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
