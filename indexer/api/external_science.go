package api

import (
 "errors"
 "net/http"
 "strconv"
 "time"
)

var ErrScienceSourceUnavailable=errors.New("external scientific observations unavailable")

type ScienceObservation struct {
 ChainID string `json:"chainId"`
 Provider string `json:"provider"`
 Project string `json:"project"`
 WorkKey string `json:"workKey"`
 CreditUnit string `json:"creditUnit"`
 CreditedEvent string `json:"creditedEvent"`
 ObservedAt int64 `json:"observedAt"`
 Stale bool `json:"stale"`
 Eligibility string `json:"eligibility"`
 Finality string `json:"finality"`
 Authoritative bool `json:"authoritative"`
 RewardEligible bool `json:"rewardEligible"`
 Amount420 *string `json:"amount420"`
}
type SciencePage struct {
 SchemaVersion string `json:"schemaVersion"`
 ChainID string `json:"chainId"`
 Items []ScienceObservation `json:"items"`
 Total int `json:"total"`
 Authoritative bool `json:"authoritative"`
 RewardEligible bool `json:"rewardEligible"`
}
type scienceReader interface { ExternalScience(chainID string,limit uint32) (SciencePage,error) }

func (s *Server) externalScience(w http.ResponseWriter,r *http.Request){
 w.Header().Set("Cache-Control","no-store")
 origin:=r.Header.Get("Origin")
 if origin=="https://compute.420integrated.org" { w.Header().Set("Access-Control-Allow-Origin",origin);w.Header().Set("Vary","Origin") }
 raw:=r.URL.Query().Get("chainId")
 n,err:=strconv.ParseUint(raw,10,64)
 if err!=nil||n==0||strconv.FormatUint(n,10)!=raw {writeError(w,http.StatusBadRequest,errors.New("valid chainId required"));return}
 limit:=uint64(50)
 if v:=r.URL.Query().Get("limit");v!="" {
  limit,err=strconv.ParseUint(v,10,32)
  if err!=nil||limit==0||limit>100 {writeError(w,http.StatusBadRequest,errors.New("invalid science page limit"));return}
 }
 reader,ok:=s.backend.(scienceReader)
 if !ok {writeError(w,http.StatusServiceUnavailable,ErrScienceSourceUnavailable);return}
 p,err:=reader.ExternalScience(raw,uint32(limit))
 if err!=nil {writeError(w,http.StatusServiceUnavailable,ErrScienceSourceUnavailable);return}
 if p.SchemaVersion!="420-science-read-v1"||p.ChainID!=raw||p.Authoritative||p.RewardEligible||p.Items==nil||len(p.Items)>int(limit)||p.Total<len(p.Items) {writeError(w,http.StatusServiceUnavailable,ErrScienceSourceUnavailable);return}
 for _,v:=range p.Items {
  if v.ChainID!=raw||v.Authoritative||v.RewardEligible||v.Amount420!=nil||v.ObservedAt<=0||v.ObservedAt>time.Now().Add(5*time.Minute).UnixMilli()||!(v.Provider=="BOINC"||v.Provider=="FOLDING_AT_HOME")||!(v.Eligibility=="UNVERIFIED"||v.Eligibility=="PENDING"||v.Eligibility=="VERIFIED"||v.Eligibility=="REVOKED")||!(v.Finality=="FINALIZED"||v.Finality=="UNFINALIZED") {
   writeError(w,http.StatusServiceUnavailable,ErrScienceSourceUnavailable);return
  }
 }
 writeJSON(w,http.StatusOK,ReadResponse[SciencePage]{Data:p,CanonicalAuthority:false})
}
