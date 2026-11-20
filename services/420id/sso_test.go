package account

import (
 "crypto/sha256"
 "errors"
 "strings"
 "testing"
)

func ssoUnitManager(t *testing.T)*SSOManager{
 t.Helper()
 a:=&Auth{origin:"https://auth.420integrated.org",rp:"auth.420integrated.org",store:&Store{apps:map[string]struct{}{"bong-goggles":{},"doobtube":{},"420town":{}}}}
 secret:=encodeBytes(make([]byte,32))
 sm,e:=NewSSOManager(&SessionManager{auth:a,app:"bong-goggles"},[]SSOClient{
  {App:"doobtube",Name:"DoobTube",RedirectURI:"https://doobtube.420integrated.org/auth/420id/callback",Secret:secret},
  {App:"420town",Name:"420Town",RedirectURI:"https://town.420integrated.org/auth/420id/callback",Secret:encodeBytes([]byte(strings.Repeat("q",32)))},
 })
 if e!=nil{t.Fatal(e)}
 return sm
}
func ssoUnitRequest(t *testing.T,client ssoClient)(SSORequest,string){
 t.Helper()
 verifier:=encodeBytes([]byte(strings.Repeat("v",32)))
 digest:=sha256.Sum256([]byte(verifier))
 return SSORequest{App:client.app,RedirectURI:client.redirect,State:encodeBytes([]byte(strings.Repeat("s",32))),CodeChallenge:encodeBytes(digest[:])},verifier
}
func TestSSOClientAndRequestValidation(t *testing.T){
 s:=ssoUnitManager(t)
 c,e:=s.CheckClient("doobtube",encodeBytes(make([]byte,32)));if e!=nil||c.app!="doobtube"{t.Fatal("registered confidential client",e)}
 for _,item:=range []struct{app,secret string}{{"unknown",encodeBytes(make([]byte,32))},{"doobtube","invalid"},{"doobtube",encodeBytes([]byte(strings.Repeat("x",32)))},{"420town",encodeBytes(make([]byte,32))}}{
  if _,e:=s.CheckClient(item.app,item.secret);!errors.Is(e,ErrAuthentication){t.Fatal("invalid client accepted",item,e)}
 }
 request,_:=ssoUnitRequest(t,c)
 if info,e:=s.ValidateRequest(request);e!=nil||info.App!=c.app||info.Name!="DoobTube"{t.Fatal("registered request rejected",e)}
 bad:=[]SSORequest{}
 add:=func(changed SSORequest){bad=append(bad,changed)}
 b:=request;b.App="unknown";add(b)
 b=request;b.RedirectURI="https://evil.example.org/callback";add(b)
 b=request;b.RedirectURI+="?next=https://evil.example.org";add(b)
 b=request;b.State=encodeBytes(make([]byte,31));add(b)
 b=request;b.State="not-a-state";add(b)
 b=request;b.CodeChallenge="not-a-challenge";add(b)
 for i,v:=range bad{if _,e:=s.ValidateRequest(v);!errors.Is(e,ErrInvalid){t.Fatalf("invalid request %d accepted",i)}}
 for _,uri:=range []string{
  "http://doobtube.420integrated.org/callback",
  "https://evil.org/callback",
  "https://doobtube.420integrated.org",
  "https://doobtube.420integrated.org:444/callback",
  "https://evil.org@doobtube.420integrated.org/callback",
  "https://doobtube.420integrated.org/callback?next=1",
  "https://doobtube.420integrated.org/callback#fragment",
  "https://doobtube.420integrated.org/%2e%2e/other",
  "https://127.0.0.1/callback",
 }{if validClientRedirect(uri){t.Fatal("unsafe redirect registered",uri)}}
 a:=s.source
 secret:=encodeBytes(make([]byte,32))
 if _,e:=NewSSOManager(a,[]SSOClient{{App:a.app,Name:"Self",RedirectURI:c.redirect,Secret:secret}});e==nil{t.Fatal("self-target SSO accepted")}
 if _,e:=NewSSOManager(a,[]SSOClient{{App:"nonexistent",Name:"Unknown",RedirectURI:c.redirect,Secret:secret}});e==nil{t.Fatal("unapproved app accepted")}
 if _,e:=NewSSOManager(a,[]SSOClient{{App:"doobtube",Name:"A",RedirectURI:c.redirect,Secret:secret},{App:"doobtube",Name:"B",RedirectURI:c.redirect,Secret:secret}});e==nil{t.Fatal("duplicate client accepted")}
 if _,e:=NewSSOManager(a,[]SSOClient{{App:"doobtube",Name:"A",RedirectURI:c.redirect,Secret:"short"}});e==nil{t.Fatal("weak client secret accepted")}
 if _,e:=NewSSOManager(a,[]SSOClient{
  {App:"doobtube",Name:"A",RedirectURI:c.redirect,Secret:secret},
  {App:"420town",Name:"B",RedirectURI:"https://town.420integrated.org/auth/callback",Secret:secret},
 });e==nil{t.Fatal("shared confidential client secret accepted")}
}
func TestSSOAuthorizationQueryStrictParsing(t *testing.T){
 s:=ssoUnitManager(t);client,_:=s.client("doobtube")
 r,_:=ssoUnitRequest(t,client)
 query:="app="+r.App+"&redirect_uri=https%3A%2F%2Fdoobtube.420integrated.org%2Fauth%2F420id%2Fcallback"+
  "&state="+r.State+"&code_challenge="+r.CodeChallenge+"&code_challenge_method=S256"
 if got,e:=parseSSOQuery(query);e!=nil||got!=r{t.Fatal("valid handoff rejected",got,e)}
 for _,variant:=range []string{query+"&app=420town",query+"&extra=1",strings.Replace(query,"S256","plain",1),query+"&state=extra",strings.Replace(query,"app=doobtube","app=unknown",1),""}{
  parsed,e:=parseSSOQuery(variant)
  if e==nil{
   if _,e=s.ValidateRequest(parsed);e==nil{t.Fatal("invalid handoff accepted",variant)}
  }
 }
}
