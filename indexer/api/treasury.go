package api

import (
 "encoding/json"
 "errors"
 "net/http"
 "strconv"
 "strings"

 "github.com/420integrated/420-integrated/indexer/model"
 "github.com/420integrated/420-integrated/indexer/treasuryread"
)

var errTreasuryUnavailable=errors.New("Treasury deployment or canonical snapshot unavailable")
type treasurySnapshotStore interface{TreasurySnapshot(uint64,string,[]string)([]model.LogRecord,error)}
type treasuryBackend interface{TreasuryRead(uint64,string,string)(json.RawMessage,error)}

// ConfigureTreasury accepts only the chain/genesis-bound deployment addresses
// obtained by the operator from verified deployment/Registry evidence.
func (b *StoreBackend) ConfigureTreasury(raw string)error{
 binding,err:=treasuryread.ParseBinding(raw);if err!=nil{return err};b.treasuryBinding=&binding;return nil
}
func (b *StoreBackend) TreasuryRead(chain uint64,kind,id string)(json.RawMessage,error){
 if !treasuryread.ValidID(kind,id){return nil,treasuryread.ErrInvalid}
 if b.treasuryBinding==nil{return nil,errTreasuryUnavailable}
 if chain!=b.treasuryBinding.ChainID{return nil,treasuryread.ErrWrongChain}
 if issue,_:=b.runtimeHealth.snapshot();issue!=""{return nil,errTreasuryUnavailable}
 reader,ok:=b.store.(treasurySnapshotStore);if !ok{return nil,errTreasuryUnavailable}
 addresses:=make([]string,0,3);for _,a:=range b.treasuryBinding.Addresses{addresses=append(addresses,a)}
 logs,err:=reader.TreasurySnapshot(chain,b.treasuryBinding.GenesisHash,addresses);if err!=nil{return nil,errTreasuryUnavailable}
 return treasuryread.Project(*b.treasuryBinding,kind,id,logs)
}
func (s *Server) treasury(w http.ResponseWriter,r *http.Request){
 kind,id:=r.PathValue("kind"),strings.ToLower(r.PathValue("id"))
 q:=r.URL.Query()["chainId"];var chain uint64;var err error
 if len(q)==1{chain,err=strconv.ParseUint(q[0],10,64)}
 fail:=func(status int,code,message string){writeJSON(w,status,map[string]any{"apiVersion":"v1","error":map[string]string{"code":code,"message":message}})}
 if len(q)!=1||err!=nil||chain!=420||q[0]!=strconv.FormatUint(chain,10)||!treasuryread.ValidID(kind,id){fail(http.StatusBadRequest,"invalid_request","Invalid Treasury chain, kind or identifier");return}
 backend,ok:=s.backend.(treasuryBackend);if !ok{fail(http.StatusServiceUnavailable,"not_ready","Treasury projection unavailable");return}
 data,err:=backend.TreasuryRead(chain,kind,id)
 if err!=nil{if errors.Is(err,errTreasuryUnavailable){fail(http.StatusServiceUnavailable,"not_ready","Treasury projection unavailable")}else{fail(http.StatusInternalServerError,"internal_error","Treasury projection unavailable")};return}
 if data==nil{fail(http.StatusNotFound,"not_found","Treasury projection not found");return}
 writeJSON(w,http.StatusOK,map[string]any{"apiVersion":"v1","data":data})
}
