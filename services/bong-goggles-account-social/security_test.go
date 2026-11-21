package social

import (
 "strings"
 "testing"
 "net/http"
)

func TestAUTH12RejectsCaseFoldedAndUnicodeSocialJSONKeys(t *testing.T){
 type input struct{ Body string `json:"body"`; ConsentAccepted bool `json:"consentAccepted"` }
 valid:=[]string{`{}`,`{"body":"Hello","consentAccepted":true}`,`{"Body":"case-insensitive field"}`}
 for _,v:=range valid{var decoded input;if e:=strictJSON(newJSONRequest(v),&decoded);e!=nil{t.Fatalf("valid JSON rejected: %s: %v",v,e)}}
 adversarial:=[]string{
  `{"body":"good","BODY":"override"}`,
  `{"body":"good","Body":"override"}`,
  `{"consentAccepted":false,"ConsentAccepted":true}`,
  `{"body":"safe","b\\u006fdy":"shadow"}`,
  `{"body":"safe","boɗy":"unicode"}`,
  `{"body":"safe","body":""}`,
  `{"body":"safe","extra":1}`,
  `{"body":"safe"}{"body":"second"}`,
  `[]`,
  `{"body":"`+strings.Repeat("x",4096)+`"}`,
 }
 for _,v:=range adversarial{var decoded input;if e:=strictJSON(newJSONRequest(v),&decoded);e==nil{t.Fatalf("ambiguous JSON accepted: %s",v[:min(len(v),80)])}}
}

func newJSONRequest(body string)*http.Request{
 req,_:=http.NewRequest("POST","https://bonggoggles.420integrated.org/social-api/v1/posts",strings.NewReader(body))
 req.Header.Set("Content-Type","application/json")
 return req
}
