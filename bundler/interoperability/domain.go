package interoperability

import (
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

// DomainResult is an observation of a 420 Bundler operator's noncanonical
// /readyz endpoint. It does not attest to operator ownership or chain finality.
type DomainResult struct {
 ChainID uint64 `json:"chain_id"`
 EntryPoint string `json:"entry_point"`
 Ready bool `json:"ready"`
}

// CheckDomain qualifies the configured chain and EntryPoint of a 420 Bundler
// operator using its read-only readiness endpoint. Third-party implementations
// that do not expose /readyz require a separately evidenced chain-identity
// adapter; a successful JSON-RPC wire probe alone must not qualify the domain.
func (p Probe) CheckDomain(ctx context.Context, rawURL string, expectedChainID uint64) (DomainResult,error) {
 if expectedChainID==0 {return DomainResult{},errors.New("expected chain ID must be nonzero")}
 if !validAddress(p.EntryPoint) {return DomainResult{},errors.New("valid expected EntryPoint is required")}
 u,err:=url.Parse(rawURL)
 if err!=nil||u.Host==""||(u.Scheme!="https"&&u.Scheme!="http")||u.User!=nil||u.RawQuery!=""||u.Fragment!="" {return DomainResult{},errors.New("invalid operator URL")}
 host:=strings.ToLower(u.Hostname())
 if u.Scheme=="http"&&host!="localhost"&&host!="127.0.0.1"&&host!="::1" {return DomainResult{},errors.New("operator endpoint requires HTTPS outside loopback")}
 u.Path="/readyz";u.RawPath="";u.RawQuery="";u.Fragment=""
 client:=p.Client
 if client==nil {client=&http.Client{Timeout:5*time.Second}}
 request,err:=http.NewRequestWithContext(ctx,http.MethodGet,u.String(),nil)
 if err!=nil{return DomainResult{},err}
 response,err:=client.Do(request)
 if err!=nil{return DomainResult{},err}
 defer response.Body.Close()
 if response.StatusCode!=http.StatusOK {return DomainResult{},fmt.Errorf("operator readiness returned HTTP %d",response.StatusCode)}
 raw,err:=io.ReadAll(io.LimitReader(response.Body,maxResponseBytes+1))
 if err!=nil{return DomainResult{},err}
 if len(raw)>maxResponseBytes {return DomainResult{},errors.New("operator readiness response too large")}
 var result DomainResult
 if err:=json.Unmarshal(raw,&result);err!=nil{return DomainResult{},errors.New("malformed operator readiness response")}
 if !result.Ready {return DomainResult{},errors.New("operator is not ready")}
 if result.ChainID!=expectedChainID {return DomainResult{},fmt.Errorf("operator chain mismatch: expected %d, got %d",expectedChainID,result.ChainID)}
 if !validAddress(result.EntryPoint)||strings.ToLower(result.EntryPoint)!=strings.ToLower(p.EntryPoint){return DomainResult{},errors.New("operator EntryPoint mismatch")}
 result.EntryPoint=strings.ToLower(result.EntryPoint)
 return result,nil
}

// DomainOperatorResult records independent wire and chain-domain observations.
type DomainOperatorResult struct {
 Endpoint string `json:"endpoint"`
 WireQualified bool `json:"wire_qualified"`
 DomainQualified bool `json:"domain_qualified"`
 Error string `json:"error,omitempty"`
}

type DomainMatrix struct {
 Operators []DomainOperatorResult `json:"operators"`
 AllQualified bool `json:"all_qualified"`
 // DistinctOrigins is network separation, NOT evidence of independent ownership.
 DistinctOrigins int `json:"distinct_origins"`
 IndependentOwnershipVerified bool `json:"independent_ownership_verified"`
}

// CheckOperatorsForChain applies the read-only wire probe and then checks the
// claimed network domain of every configured 420 Bundler endpoint. Never send
// or retry a signed operation based on this report.
func (p Probe) CheckOperatorsForChain(ctx context.Context,endpoints []string,chainID uint64)(DomainMatrix,error){
 if chainID==0{return DomainMatrix{},errors.New("expected chain ID must be nonzero")}
 wire,err:=p.CheckOperators(ctx,endpoints)
 if err!=nil{return DomainMatrix{},err}
 out:=DomainMatrix{Operators:make([]DomainOperatorResult,0,len(endpoints)),AllQualified:true}
 origins:=make(map[string]struct{})
 for _,record:=range wire.Operators {
  item:=DomainOperatorResult{Endpoint:record.Endpoint,WireQualified:record.Error==""}
  if record.Error!="" {item.Error=record.Error} else if _,err:=p.CheckDomain(ctx,record.Endpoint,chainID);err!=nil {item.Error=err.Error()} else {item.DomainQualified=true}
  if !item.WireQualified||!item.DomainQualified {out.AllQualified=false}
  u,_:=url.Parse(record.Endpoint)
  origins[strings.ToLower(u.Scheme+"://"+u.Host)]=struct{}{}
  out.Operators=append(out.Operators,item)
 }
 out.DistinctOrigins=len(origins)
 // Endpoint count, network origin and self-reported metadata cannot prove
 // separately controlled infrastructure or external-client acceptance.
 return out,nil
}
