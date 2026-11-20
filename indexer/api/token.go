package api
import (
 "errors"
 "net/http"
 "strconv"
 "strings"
 "github.com/420integrated/420-integrated/indexer/model"
 "github.com/420integrated/420-integrated/indexer/tokenread"
)
type tokenSnapshotStore interface{TokenSnapshot(uint64,string,[]string)(model.ChainCheckpoint,[]model.LogRecord,error)}
type tokenBackend interface{TokenDeployment(uint64,string)(tokenread.Projection,error)}
func(b *StoreBackend) ConfigureToken(raw string)error{binding,err:=tokenread.ParseBinding(raw);if err!=nil{return err};b.tokenBinding=&binding;return nil}
func(b *StoreBackend) TokenDeployment(chain uint64,token string)(tokenread.Projection,error){
 if !tokenread.ValidAddress(token){return tokenread.Projection{},tokenread.ErrInvalid}
 if b.tokenBinding==nil||b.tokenBinding.ChainID!=chain{return tokenread.Projection{},tokenread.ErrUnavailable}
 if issue,_:=b.runtimeHealth.snapshot();issue!=""{return tokenread.Projection{},tokenread.ErrUnavailable}
 reader,ok:=b.store.(tokenSnapshotStore);if !ok{return tokenread.Projection{},tokenread.ErrUnavailable}
 cp,logs,err:=reader.TokenSnapshot(chain,b.tokenBinding.GenesisHash,b.tokenBinding.Addresses());if err!=nil{return tokenread.Projection{},tokenread.ErrUnavailable}
 return tokenread.Project(*b.tokenBinding,cp,token,logs)
}
func(s *Server) tokenDeployment(w http.ResponseWriter,r *http.Request){
 w.Header().Set("Cache-Control","no-store")
 token:=strings.ToLower(r.PathValue("token"));q:=r.URL.Query()["chainId"]
 fail:=func(status int,code,message string){writeJSON(w,status,map[string]any{"apiVersion":"v1","error":map[string]string{"code":code,"message":message}})}
 if len(q)!=1||!tokenread.ValidAddress(token){fail(400,"invalid_request","Invalid Token chain or address");return}
 chain,err:=strconv.ParseUint(q[0],10,64);if err!=nil||chain==0||q[0]!=strconv.FormatUint(chain,10){fail(400,"invalid_request","Invalid Token chain");return}
 backend,ok:=s.backend.(tokenBackend);if !ok{fail(503,"unavailable","Token projection unavailable");return}
 p,err:=backend.TokenDeployment(chain,token);if err!=nil{if errors.Is(err,tokenread.ErrNotFound){fail(404,"not_found","Token deployment not observed")}else{fail(503,"unavailable","Token projection unavailable")};return}
 if err=p.Validate(chain,token);err!=nil{fail(503,"unavailable","Token projection unavailable");return}
 writeJSON(w,200,map[string]any{"apiVersion":"v1","data":p})
}
