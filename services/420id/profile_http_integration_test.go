//go:build account420_integration

package account

import (
 "context"
 "encoding/json"
 "net/http"
 "net/http/httptest"
 "strings"
 "testing"
)

func TestRestrictedUniversalProfileHTTP(t *testing.T){
 ctx:=context.Background()
 db:=sessionDB(t);a,mail:=sessionAuth(t,db,testOrigin,testRP)
 id,_:=newID();email:=id+"@example.org"
 base:=AcceptanceConfig{Emails:[]string{email},RateKey:mustRandom(t),SessionApp:"bong-goggles"}
 old,e:=NewAcceptanceHandler(a,base);if e!=nil{t.Fatal(e)}
 if h,e:=NewAcceptanceHandler(a,AcceptanceConfig{Emails:base.Emails,RateKey:base.RateKey,ProfileMode:true});e==nil||h!=nil{t.Fatal("profile mode without session app")}
 cfg:=base;cfg.ProfileMode=true
 h,e:=NewAcceptanceHandler(a,cfg);if e!=nil{t.Fatal(e)}
 if e=h.profileReady(ctx);e!=nil{t.Fatal("profile schema/grants missing in test",e)}
 page:=acceptRequest(h,"GET","/","","",nil)
 if page.Code!=200||!strings.Contains(page.Body.String(),"Universal 420ID profile"){t.Fatal("profile page not served")}
 flow:=page.Result().Cookies()[0]
 if w:=acceptRequest(old,"GET","/","","",nil);w.Code!=200||strings.Contains(w.Body.String(),"profile-heading"){t.Fatal("AUTH-3 page changed")}
 for _,path:=range []string{"/profile-session.mjs","/profile-ui.mjs"}{
  if w:=acceptRequest(old,"GET",path,"","",nil);w.Code!=404{t.Fatal("AUTH-3 exposes profile script",path,w.Code)}
  if w:=acceptRequest(h,"GET",path,"","",nil);w.Code!=200||w.Body.Len()==0{t.Fatal("AUTH-4 script missing",path)}
 }
 post:=func(handler http.Handler,path string,v any,session *http.Cookie,origin string,flowCookie *http.Cookie)*httptest.ResponseRecorder{
  r:=httptest.NewRequest("POST",testOrigin+path,strings.NewReader(jsonBody(t,v)))
  r.RemoteAddr="127.0.0.6:12345"
  r.Header.Set("Content-Type","application/json")
  r.Header.Set("Origin",origin)
  if flowCookie!=nil{r.AddCookie(flowCookie)}
  if session!=nil{r.AddCookie(session)}
  w:=httptest.NewRecorder();handler.ServeHTTP(w,r);return w
 }
 empty:=struct{}{}
 if w:=post(old,"/v1/profile/me",empty,nil,testOrigin,flow);w.Code!=404{t.Fatal("AUTH-3 endpoint exposed")}
 if w:=post(h,"/v1/profile/me",empty,nil,testOrigin,flow);w.Code!=401{t.Fatal("guest profile read",w.Code)}
 var start EmailStart
 readResult(t,post(h,"/v1/email/start",map[string]string{"email":email},nil,testOrigin,flow),&start)
 verified:=post(h,"/v1/email/finish",map[string]string{"challengeId":start.ChallengeID,"secret":mail.secret},nil,testOrigin,flow)
 if verified.Code!=200{t.Fatal("email did not create session",verified.Code)}
 sessions:=verified.Result().Cookies()
 if len(sessions)!=1||sessions[0].Name!=sessionCookie{t.Fatal("missing session cookie")}
 token:=sessions[0]
 if w:=post(h,"/v1/profile/me",empty,token,"https://attacker.example.org",flow);w.Code!=403{t.Fatal("CSRF accepted",w.Code)}
 if w:=post(h,"/v1/profile/me",empty,token,testOrigin,nil);w.Code!=403{t.Fatal("browser binding not required",w.Code)}
 var result struct{Profile UniversalProfile}
 readResult(t,post(h,"/v1/profile/me",empty,token,testOrigin,flow),&result)
 if result.Profile.Revision!=0||result.Profile.Visibility!="private"{t.Fatal("profile created on read",result.Profile)}
 input:=profileUpdate("TestProfile","Display","private",0)
 if w:=post(h,"/v1/profile/update",map[string]any{"app":"doobtube","expectedRevision":0},token,testOrigin,flow);w.Code!=400{t.Fatal("client-selected app accepted",w.Code)}
 if w:=post(h,"/v1/profile/update",map[string]any{"username":"alice","Username":"bob"},token,testOrigin,flow);w.Code!=400{t.Fatal("ambiguous username JSON accepted")}
 if w:=post(h,"/v1/profile/update",profileUpdate("admin","Impostor","public",0),token,testOrigin,flow);w.Code!=400{t.Fatal("reserved name accepted")}
 if w:=post(h,"/v1/profile/update",ProfileUpdate{Username:"newname",AvatarRef:"http://169.254.0.1/a",Visibility:"public"},token,testOrigin,flow);w.Code!=400{t.Fatal("unsafe avatar URL accepted")}
 updated:=post(h,"/v1/profile/update",input,token,testOrigin,flow)
 readResult(t,updated,&result)
 profile:=result.Profile
 if profile.Revision!=1||profile.Username!="testprofile"||!validID(profile.ProfileID){t.Fatal("first update",profile)}
 if strings.Contains(updated.Body.String(),token.Value)||strings.Contains(updated.Body.String(),email){t.Fatal("private data in HTTP response")}
 if w:=post(h,"/v1/profile/lookup",map[string]string{"username":"testprofile"},token,testOrigin,flow);w.Code!=404{t.Fatal("private profile disclosed",w.Code)}
 if w:=post(h,"/v1/profile/update",input,token,testOrigin,flow);w.Code!=409{t.Fatal("stale write accepted",w.Code)}
 readResult(t,post(h,"/v1/profile/update",profileUpdate("testprofile","Public Display","public",1),token,testOrigin,flow),&result)
 if result.Profile.Revision!=2{t.Fatal("public update")}
 response:=post(h,"/v1/profile/lookup",map[string]string{"username":"TESTPROFILE"},token,testOrigin,flow)
 readResult(t,response,&result)
 if result.Profile.Visibility!="public"||result.Profile.DisplayName!="Public Display"{t.Fatal("public lookup",result.Profile)}
 if strings.Contains(response.Body.String(),email)||strings.Contains(response.Body.String(),token.Value){t.Fatal("public projection leaked secret")}
 readResult(t,post(h,"/v1/profile/update",profileUpdate("testprofile","Hidden","private",2),token,testOrigin,flow),&result)
 if w:=post(h,"/v1/profile/lookup",map[string]string{"username":"testprofile"},token,testOrigin,flow);w.Code!=404{t.Fatal("retracted profile disclosed")}
 if w:=post(h,"/v1/profile/lookup",map[string]string{"username":"administrator"},token,testOrigin,flow);w.Code!=400{t.Fatal("reserved handle lookup",w.Code)}
 if w:=post(h,"/v1/profile/lookup",map[string]string{"username":"unknownhandle"},token,testOrigin,flow);w.Code!=404{t.Fatal("not found handling",w.Code)}
 if w:=post(h,"/v1/profile/lookup",map[string]any{"username":"testprofile","accountId":id},token,testOrigin,flow);w.Code!=400{t.Fatal("account injection",w.Code)}
 logout:=post(h,"/v1/session/logout",empty,token,testOrigin,flow)
 if logout.Code!=200{t.Fatal("session logout",logout.Code)}
 if w:=post(h,"/v1/profile/me",empty,token,testOrigin,flow);w.Code!=401{t.Fatal("revoked session read",w.Code)}
 var n int
 if e=db.QueryRowContext(ctx,"SELECT count(*) FROM account420.profiles WHERE username='testprofile'").Scan(&n);e!=nil||n!=1{t.Fatal("profile not durable",n,e)}
 var claims int
 if e=db.QueryRowContext(ctx,"SELECT count(*) FROM account420.profile_username_claims WHERE username='testprofile'").Scan(&claims);e!=nil||claims!=1{t.Fatal("username claim missing",claims,e)}
 raw,_:=json.Marshal(result.Profile);if strings.Contains(string(raw),"@example.org"){t.Fatal("PII in profile")}
}
