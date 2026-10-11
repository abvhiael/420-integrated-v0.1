package complianceauth

import (
 "context"
 "bytes"
 "encoding/json"
 "errors"
 "io"
 "net/http"
 "strconv"
 "strings"
)

const ComplianceAPIVersion = "v1"
const maxC051Body = 16 << 10
const maxC051Page = 50

type C051DecisionRequest struct {
 TenantID string `json:"tenant_id"`
 OperationRef string `json:"operation_ref"`
 Stage string `json:"stage"`
 Action string `json:"action"`
 PolicyDigest string `json:"policy_digest"`
 FactsDigest string `json:"facts_digest"`
}
type C051Decision struct {
 Outcome string `json:"outcome"`
 Reason string `json:"reason"`
 PolicyDigest string `json:"policy_digest,omitempty"`
}
type C051Guidance struct {
 Region string `json:"region"`
 Message string `json:"message"`
 PolicyDigest string `json:"policy_digest,omitempty"`
}
type C051PolicyStatus struct {
 Scope string `json:"scope"`
 Status string `json:"status"`
 PolicyDigest string `json:"policy_digest,omitempty"`
}
type C051ListPage[T any] struct {
 Items []T `json:"items"`
 NextOffset int `json:"next_offset,omitempty"`
}
type C051Backend interface {
 Evaluate(context.Context,C051DecisionRequest)(C051Decision,error)
 Guidance(context.Context,string,int,int)(C051ListPage[C051Guidance],error)
 PolicyStatuses(context.Context,string,int,int)(C051ListPage[C051PolicyStatus],error)
}
type C051Authenticator interface { AuthorizeEvaluation(context.Context,string,string)(context.Context,error) }
type C051API struct{ Backend C051Backend; Auth C051Authenticator }
func c051JSON(w http.ResponseWriter,code int,v any) {
 w.Header().Set("Content-Type","application/json")
 w.Header().Set("Cache-Control","no-store")
 w.Header().Set("X-Content-Type-Options","nosniff")
 w.WriteHeader(code)
 _=json.NewEncoder(w).Encode(v)
}
func c051Fail(w http.ResponseWriter,code int){c051JSON(w,code,map[string]string{"error":"request_unavailable"})}
func c051Page(r *http.Request)(int,int,bool){
 q:=r.URL.Query()
 for name:=range q {if name!="limit"&&name!="offset"&&name!="region"&&name!="scope"{return 0,0,false}}
 limit,offset:=20,0
 if xs,ok:=q["limit"];ok {if len(xs)!=1{return 0,0,false};i,e:=strconv.Atoi(xs[0]);if e!=nil||i<1||i>maxC051Page{return 0,0,false};limit=i}
 if xs,ok:=q["offset"];ok {if len(xs)!=1{return 0,0,false};i,e:=strconv.Atoi(xs[0]);if e!=nil||i<0||i>100000{return 0,0,false};offset=i}
 return limit,offset,true
}
func c051Scope(s string)bool {
 if len(s)==0||len(s)>128||s!=strings.TrimSpace(s){return false}
 for _,r:=range s {if !(r>='a'&&r<='z'||r>='A'&&r<='Z'||r>='0'&&r<='9'||r=='-'||r=='_'||r=='/'||r=='.'){return false}}
 return true
}
func (api C051API) ServeHTTP(w http.ResponseWriter,r *http.Request){
 if api.Backend==nil||r==nil {c051Fail(w,http.StatusServiceUnavailable);return}
 if r.Header.Get("Accept")!=""&&!strings.Contains(r.Header.Get("Accept"),"application/json")&&!strings.Contains(r.Header.Get("Accept"),"*/*"){c051Fail(w,http.StatusNotAcceptable);return}
 switch r.URL.Path {
 case "/api/v1/evaluate":
  if r.Method!=http.MethodPost {w.Header().Set("Allow","POST");c051Fail(w,http.StatusMethodNotAllowed);return}
  if api.Auth==nil {c051Fail(w,http.StatusServiceUnavailable);return}
  auth:=r.Header.Get("Authorization")
  if !strings.HasPrefix(auth,"Bearer ")||len(auth)<=7||len(auth)>4096 {c051Fail(w,http.StatusUnauthorized);return}
  if ct:=r.Header.Get("Content-Type");ct!="application/json" {c051Fail(w,http.StatusUnsupportedMediaType);return}
  r.Body=http.MaxBytesReader(w,r.Body,maxC051Body)
  d:=json.NewDecoder(r.Body);d.DisallowUnknownFields()
  var request C051DecisionRequest
  if e:=d.Decode(&request);e!=nil {c051Fail(w,http.StatusBadRequest);return}
  var trailing any
  if e:=d.Decode(&trailing);!errors.Is(e,io.EOF){c051Fail(w,http.StatusBadRequest);return}
  if !c051Scope(request.TenantID)||!c051Scope(request.OperationRef)||!c051Scope(request.Stage)||!c051Scope(request.Action)||!digestValid(request.PolicyDigest)||!digestValid(request.FactsDigest) {c051Fail(w,http.StatusBadRequest);return}
  ctx,e:=api.Auth.AuthorizeEvaluation(r.Context(),auth[7:],request.TenantID)
  if e!=nil||ctx==nil||ctx.Err()!=nil {c051Fail(w,http.StatusForbidden);return}
  result,e:=api.Backend.Evaluate(ctx,request)
  if e!=nil||result.Outcome!="DENY"&&result.Outcome!="REVIEW_REQUIRED"&&result.Outcome!="ALLOW"||result.Outcome=="ALLOW"&&result.PolicyDigest!=request.PolicyDigest {c051Fail(w,http.StatusServiceUnavailable);return}
  c051JSON(w,http.StatusOK,result)
 case "/api/v1/guidance","/api/v1/policies/status":
  if r.Method!=http.MethodGet {w.Header().Set("Allow","GET");c051Fail(w,http.StatusMethodNotAllowed);return}
  limit,offset,ok:=c051Page(r);if !ok {c051Fail(w,http.StatusBadRequest);return}
  if r.URL.Path=="/api/v1/guidance" {
   if _,present:=r.URL.Query()["scope"];present {c051Fail(w,http.StatusBadRequest);return}
   region:=r.URL.Query().Get("region")
   if !c051Scope(region) {c051Fail(w,http.StatusBadRequest);return}
   page,e:=api.Backend.Guidance(r.Context(),region,limit,offset)
   if e!=nil||len(page.Items)>limit||page.NextOffset<0 {c051Fail(w,http.StatusServiceUnavailable);return}
   c051JSON(w,http.StatusOK,page)
  }else{
   if _,present:=r.URL.Query()["region"];present {c051Fail(w,http.StatusBadRequest);return}
   scope:=r.URL.Query().Get("scope")
   if !c051Scope(scope) {c051Fail(w,http.StatusBadRequest);return}
   page,e:=api.Backend.PolicyStatuses(r.Context(),scope,limit,offset)
   if e!=nil||len(page.Items)>limit||page.NextOffset<0 {c051Fail(w,http.StatusServiceUnavailable);return}
   c051JSON(w,http.StatusOK,page)
  }
 default:c051Fail(w,http.StatusNotFound)
 }
}

// C051Client is the Go SDK for v1. Credentials come from a caller-owned,
// securely configured HTTP client; no private keys or policy approvals here.
type C051Client struct { BaseURL string; HTTP *http.Client; Token string }
func(c C051Client) GetGuidance(ctx context.Context,region string)([]C051Guidance,error){
 if c.HTTP==nil||!strings.HasPrefix(c.BaseURL,"https://")||!c051Scope(region){return nil,ErrUnavailable}
 req,e:=http.NewRequestWithContext(ctx,http.MethodGet,c.BaseURL+"/api/v1/guidance?region="+region,nil);if e!=nil{return nil,e}
 req.Header.Set("Accept","application/json")
 resp,e:=c.HTTP.Do(req);if e!=nil{return nil,e};defer resp.Body.Close()
 if resp.StatusCode!=200{return nil,ErrUnavailable}
 var page C051ListPage[C051Guidance]
 e=json.NewDecoder(io.LimitReader(resp.Body,maxC051Body)).Decode(&page)
 if e!=nil||len(page.Items)>maxC051Page{return nil,ErrUnavailable}
 return page.Items,nil
}

func(c C051Client) Evaluate(ctx context.Context,request C051DecisionRequest)(C051Decision,error){
 var result C051Decision
 if c.HTTP==nil||!strings.HasPrefix(c.BaseURL,"https://")||c.Token==""||!c051Scope(request.TenantID)||!c051Scope(request.OperationRef)||!c051Scope(request.Stage)||!c051Scope(request.Action)||!digestValid(request.PolicyDigest)||!digestValid(request.FactsDigest){return result,ErrUnauthorized}
 body,e:=json.Marshal(request);if e!=nil{return result,e}
 req,e:=http.NewRequestWithContext(ctx,http.MethodPost,c.BaseURL+"/api/v1/evaluate",bytes.NewReader(body));if e!=nil{return result,e}
 req.Header.Set("Content-Type","application/json");req.Header.Set("Accept","application/json");req.Header.Set("Authorization","Bearer "+c.Token)
 resp,e:=c.HTTP.Do(req);if e!=nil{return result,e};defer resp.Body.Close()
 if resp.StatusCode!=200{return result,ErrUnavailable}
 e=json.NewDecoder(io.LimitReader(resp.Body,maxC051Body)).Decode(&result)
 if e!=nil||result.Outcome!="DENY"&&result.Outcome!="REVIEW_REQUIRED"&&result.Outcome!="ALLOW"||result.Outcome=="ALLOW"&&result.PolicyDigest!=request.PolicyDigest{return C051Decision{},ErrUnavailable}
 return result,nil
}
func(c C051Client) PolicyStatus(ctx context.Context,scope string)([]C051PolicyStatus,error){
 if c.HTTP==nil||!strings.HasPrefix(c.BaseURL,"https://")||!c051Scope(scope){return nil,ErrUnavailable}
 req,e:=http.NewRequestWithContext(ctx,http.MethodGet,c.BaseURL+"/api/v1/policies/status?scope="+scope,nil);if e!=nil{return nil,e}
 req.Header.Set("Accept","application/json")
 resp,e:=c.HTTP.Do(req);if e!=nil{return nil,e};defer resp.Body.Close()
 if resp.StatusCode!=200{return nil,ErrUnavailable}
 var page C051ListPage[C051PolicyStatus]
 e=json.NewDecoder(io.LimitReader(resp.Body,maxC051Body)).Decode(&page)
 if e!=nil||len(page.Items)>maxC051Page{return nil,ErrUnavailable}
 return page.Items,nil
}
