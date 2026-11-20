//go:build account420_integration
package account
import("context";"encoding/json";"errors";"strings";"sync";"testing")
func profileUpdate(username,display,visibility string,rev int64)ProfileUpdate{
 return ProfileUpdate{Username:username,DisplayName:display,Bio:"From Saskatchewan",Visibility:visibility,ExpectedRevision:rev}
}
func TestUniversalProfilesAcrossApps(t *testing.T){
 ctx:=context.Background();db:=sessionDB(t);db2:=sessionDB(t)
 a,mail:=sessionAuth(t,db,testOrigin,testRP);a2,_:=sessionAuth(t,db2,testOrigin,testRP)
 bg:=sessionManager(t,a,"bong-goggles");bg2:=sessionManager(t,a2,"bong-goggles");other:=sessionManager(t,a,"doobtube")
 unique,_:=newID();email:=unique+"@example.org";first:=freshEmail(t,a,mail,email)
 user:=mustIssueSession(t,bg,first.Proof)
 universal:=mustIssueSession(t,other,freshEmail(t,a,mail,email).Proof)
 empty,e:=bg.MyProfile(ctx,user.Token)
 if e!=nil||empty.Revision!=0||empty.Visibility!="private"||empty.ProfileID!=""{t.Fatal("not private by default",empty,e)}
 if _,e:=bg.LookupPublicProfile(ctx,"prairie420");!errors.Is(e,ErrUnavailable){t.Fatal("unknown name discovered",e)}
 if _,e:=other.MyProfile(ctx,user.Token);!errors.Is(e,ErrAuthentication){t.Fatal("cross-app token",e)}
 original,e:=bg.UpdateMyProfile(ctx,user.Token,profileUpdate("Prairie420","Prairie Friend","private",0))
 if e!=nil||original.Revision!=1||original.Username!="prairie420"||!validID(original.ProfileID){t.Fatal("profile create",original,e)}
 if original.ProfileID==string(first.Proof.AccountID())||original.ProfileID==user.Session.Subject.ID{t.Fatal("identifier reuse")}
 saved,e:=other.MyProfile(ctx,universal.Token);if e!=nil||saved!=original{t.Fatal("universal profile",saved,e)}
 if _,e:=other.LookupPublicProfile(ctx,"prairie420");!errors.Is(e,ErrUnavailable){t.Fatal("private disclosed",e)}
 if _,e:=bg.UpdateMyProfile(ctx,user.Token,profileUpdate("prairie420","Stale","public",0));!errors.Is(e,ErrConflict){t.Fatal("stale revision",e)}
 posted,e:=other.UpdateMyProfile(ctx,universal.Token,profileUpdate("prairie420","Prairie Public","public",1))
 if e!=nil||posted.Revision!=2||posted.ProfileID!=original.ProfileID{t.Fatal("public opt-in",posted,e)}
 found,e:=bg2.LookupPublicProfile(ctx,"PRAIRIE420");if e!=nil||found!=posted{t.Fatal("public lookup",found,e)}
 raw,e:=json.Marshal(found)
 if e!=nil||strings.Contains(string(raw),string(first.Proof.AccountID()))||strings.Contains(string(raw),email)||strings.Contains(string(raw),user.Token){t.Fatal("private identity leaked",e)}
 successes:=make(chan UniversalProfile,2);var wg sync.WaitGroup
 for _,m:=range []*SessionManager{bg,bg2}{wg.Add(1);go func(m *SessionManager){defer wg.Done()
  v,e:=m.UpdateMyProfile(ctx,user.Token,profileUpdate("prairie420","Concurrent","public",2))
  if e==nil{successes<-v}else if !errors.Is(e,ErrConflict){t.Errorf("write race: %v",e)}
 }(m)}
 wg.Wait();close(successes);n:=0;for range successes{n++};if n!=1{t.Fatal("stale write raced",n)}
 third,_:=newID();foreign:=mustIssueSession(t,bg,freshEmail(t,a,mail,third+"@example.org").Proof)
 if _,e:=bg.UpdateMyProfile(ctx,foreign.Token,profileUpdate("PRAIRIE420","Impostor","public",0));!errors.Is(e,ErrConflict){t.Fatal("username stolen",e)}
 current,e:=bg.MyProfile(ctx,user.Token);if e!=nil{t.Fatal(e)}
 if _,e:=bg.UpdateMyProfile(ctx,user.Token,profileUpdate("prairie_next","Changed","public",current.Revision));!errors.Is(e,ErrConflict){t.Fatal("rename cooldown",e)}
 if _,e=db.ExecContext(ctx,"UPDATE account420.profiles SET username_changed_at=clock_timestamp()-interval '31 days' WHERE profile_id=$1",original.ProfileID);e!=nil{t.Fatal(e)}
 renamed,e:=bg.UpdateMyProfile(ctx,user.Token,profileUpdate("prairie_next","Renamed","public",current.Revision))
 if e!=nil{t.Fatal("rename",e)}
 if _,e:=bg.LookupPublicProfile(ctx,"prairie420");!errors.Is(e,ErrUnavailable){t.Fatal("old username visible",e)}
 if _,e:=bg.UpdateMyProfile(ctx,foreign.Token,profileUpdate("prairie420","Impostor","public",0));!errors.Is(e,ErrConflict){t.Fatal("former username stolen",e)}
 if _,e:=other.LookupPublicProfile(ctx,"prairie_next");e!=nil{t.Fatal("current username missing",e)}
 private,e:=bg.UpdateMyProfile(ctx,user.Token,profileUpdate("prairie_next","Hidden","private",renamed.Revision))
 if e!=nil||private.Visibility!="private"{t.Fatal("privacy revoked",e)}
 if _,e:=other.LookupPublicProfile(ctx,"prairie_next");!errors.Is(e,ErrUnavailable){t.Fatal("private exposed after revocation",e)}
 rotated,e:=bg.Renew(ctx,user.Token);if e!=nil{t.Fatal(e)}
 if _,e:=bg.MyProfile(ctx,user.Token);!errors.Is(e,ErrAuthentication){t.Fatal("rotated bearer accepted",e)}
 if got,e:=bg.MyProfile(ctx,rotated.Token);e!=nil||got.ProfileID!=original.ProfileID{t.Fatal("rotation lost profile",e)}
 if _,e:=a.store.Transition(ctx,first.Proof.AccountID(),1,Suspended);e!=nil{t.Fatal(e)}
 if _,e:=bg.MyProfile(ctx,rotated.Token);!errors.Is(e,ErrAuthentication){t.Fatal("suspended profile read",e)}
 if _,e:=bg.UpdateMyProfile(ctx,rotated.Token,profileUpdate("prairie_next","Tampered","public",private.Revision));!errors.Is(e,ErrAuthentication){t.Fatal("suspended profile write",e)}
 if _,e:=a.store.Transition(ctx,first.Proof.AccountID(),2,Active);e!=nil{t.Fatal(e)}
 if _,e:=bg.MyProfile(ctx,rotated.Token);!errors.Is(e,ErrAuthentication){t.Fatal("old revision revived",e)}
 fresh:=mustIssueSession(t,bg,freshEmail(t,a,mail,email).Proof)
 after,e:=bg.MyProfile(ctx,fresh.Token);if e!=nil||after.ProfileID!=original.ProfileID||after.Username!="prairie_next"{t.Fatal("lost profile",e)}
 if e=bg.Logout(ctx,fresh.Token);e!=nil{t.Fatal(e)}
 if _,e=bg.MyProfile(ctx,fresh.Token);!errors.Is(e,ErrAuthentication){t.Fatal("revoked profile read",e)}
}
func TestUniversalConcurrentClaims(t *testing.T){
 ctx:=context.Background();db:=sessionDB(t);db2:=sessionDB(t)
 a,m1:=sessionAuth(t,db,testOrigin,testRP);a2,m2:=sessionAuth(t,db2,testOrigin,testRP)
 first,_:=newID();second,_:=newID()
 one:=mustIssueSession(t,sessionManager(t,a,"bong-goggles"),freshEmail(t,a,m1,first+"@example.org").Proof)
 two:=mustIssueSession(t,sessionManager(t,a2,"bong-goggles"),freshEmail(t,a2,m2,second+"@example.org").Proof)
 name:="u"+strings.ReplaceAll(first,"-","")[:18]
 var wg sync.WaitGroup;results:=make(chan error,2)
 for i,v:=range []struct{m *SessionManager;token string}{{sessionManager(t,a,"bong-goggles"),one.Token},{sessionManager(t,a2,"bong-goggles"),two.Token}}{
  _=i;wg.Add(1);go func(m *SessionManager,token string){defer wg.Done()
   _,e:=m.UpdateMyProfile(ctx,token,profileUpdate(name,"Competing","public",0));results<-e
  }(v.m,v.token)
 }
 wg.Wait();close(results);wins,conflicts:=0,0
 for e:=range results{if e==nil{wins++}else if errors.Is(e,ErrConflict){conflicts++}else{t.Fatal(e)}}
 if wins!=1||conflicts!=1{t.Fatal("username uniqueness race",wins,conflicts)}
 var count int
 if e:=db.QueryRowContext(ctx,"SELECT count(*) FROM account420.profiles WHERE username=$1",name).Scan(&count);e!=nil||count!=1{t.Fatal("duplicate claim",count,e)}
}
