//go:build account420_integration

package account
import(
 "context"
 "errors"
 "strings"
 "sync"
 "testing"
)

func TestOptionalWalletLifecycleAndIsolation(t *testing.T){
 ctx:=context.Background()
 db:=sessionDB(t);db2:=sessionDB(t)
 a,mail:=sessionAuth(t,db,testOrigin,testRP)
 a2,_:=sessionAuth(t,db2,testOrigin,testRP)
 m:=sessionManager(t,a,"bong-goggles")
 m2:=sessionManager(t,a2,"bong-goggles")
 other:=sessionManager(t,a,"doobtube")
 w,e:=NewWalletLinkManager(m,420,nil);if e!=nil{t.Fatal(e)}
 w2,e:=NewWalletLinkManager(m2,420,nil);if e!=nil{t.Fatal(e)}
 if _,e=NewWalletLinkManager(nil,420,nil);!errors.Is(e,ErrInvalid){t.Fatal("nil authority")}
 if _,e=NewWalletLinkManager(m,0,nil);!errors.Is(e,ErrInvalid){t.Fatal("zero chain")}
 if e=w.Ready(ctx);e!=nil{t.Fatal("schema unavailable",e)}
 key:=walletTestKey(t);address:=key.Address()
 uid,_:=newID();email:=uid+"@example.org"
 p:=freshEmail(t,a,mail,email).Proof
 grant:=mustIssueSession(t,m,p)
 bind:=mustRandom(t);badBind:=mustRandom(t)
 if current,e:=w.Current(ctx,grant.Token);e!=nil||current!=nil{t.Fatal("wallet mandatory",e)}
 if _,e=w.Begin(ctx,grant.Token,address,"eoa",false,bind);!errors.Is(e,ErrInvalid){t.Fatal("consent bypass",e)}
 if _,e=w.Begin(ctx,grant.Token,address,"contract",true,bind);!errors.Is(e,ErrUnavailable){t.Fatal("unconfigured contract verifier accepted",e)}
 challenge,e:=w.Begin(ctx,grant.Token,address,"eoa",true,bind);if e!=nil{t.Fatal(e)}
 if challenge.ChainID!=420||challenge.Address!=address||!strings.Contains(challenge.Message,grant.Session.Subject.ID)||!strings.Contains(challenge.Message,grant.Session.ID){t.Fatal("unsigned challenge context")}
 signature:=walletTestSign(t,key,challenge.Message)
 if _,e=w.Complete(ctx,grant.Token,challenge.ChallengeID,signature,badBind);!errors.Is(e,ErrAuthentication){t.Fatal("browser substitution",e)}
 if _,e=w.Complete(ctx,grant.Token,challenge.ChallengeID,walletTestSign(t,key,challenge.Message+"modified"),bind);!errors.Is(e,ErrAuthentication){t.Fatal("signature substitution",e)}
 if current,e:=w.Current(ctx,grant.Token);e!=nil||current!=nil{t.Fatal("invalid signature linked",e)}
 linked,e:=w2.Complete(ctx,grant.Token,challenge.ChallengeID,signature,bind)
 if e!=nil||linked.Address!=address||linked.ChainID!=420||linked.Kind!="eoa"{t.Fatal("real proof rejected",linked,e)}
 if _,e=w.Complete(ctx,grant.Token,challenge.ChallengeID,signature,bind);!errors.Is(e,ErrAuthentication){t.Fatal("replayed proof accepted",e)}
 if _,e=w.Begin(ctx,grant.Token,address,"eoa",true,bind);!errors.Is(e,ErrConflict){t.Fatal("second active wallet allowed",e)}
 current,e:=w.Current(ctx,grant.Token)
 if e!=nil||current==nil||current.Address!=address{t.Fatal("durability across processes",e)}
 cross:=mustIssueSession(t,other,freshEmail(t,a,mail,email).Proof)
 if _,e=w.Begin(ctx,cross.Token,address,"eoa",true,bind);!errors.Is(e,ErrAuthentication){t.Fatal("other app forged session",e)}
 if _,e=w.Current(ctx,cross.Token);!errors.Is(e,ErrAuthentication){t.Fatal("other app read link",e)}
 if e=w2.Unlink(ctx,grant.Token);e!=nil{t.Fatal("unlink",e)}
 if current,e=w.Current(ctx,grant.Token);e!=nil||current!=nil{t.Fatal("unlink ineffective",e)}
 var history int
 if e=db.QueryRowContext(ctx,"SELECT count(*) FROM account420.wallet_links WHERE account_id=$1 AND unlinked_at IS NOT NULL",p.AccountID()).Scan(&history);e!=nil||history!=1{t.Fatal("history lost",e)}
 if e=w.Unlink(ctx,grant.Token);!errors.Is(e,ErrUnavailable){t.Fatal("double unlink",e)}
 challenge,e=w.Begin(ctx,grant.Token,address,"eoa",true,bind);if e!=nil{t.Fatal(e)}
 if _,e=w.Complete(ctx,grant.Token,challenge.ChallengeID,walletTestSign(t,key,challenge.Message),bind);e!=nil{t.Fatal("relink",e)}
 if e=w.Unlink(ctx,grant.Token);e!=nil{t.Fatal(e)}
 challenge,e=w.Begin(ctx,grant.Token,address,"eoa",true,bind);if e!=nil{t.Fatal(e)}
 fresh:=mustIssueSession(t,m,freshEmail(t,a,mail,email).Proof)
 if _,e=w.Complete(ctx,fresh.Token,challenge.ChallengeID,walletTestSign(t,key,challenge.Message),bind);!errors.Is(e,ErrAuthentication){t.Fatal("wrong valid session used old challenge",e)}
 if _,e=db.ExecContext(ctx,"UPDATE account420.wallet_link_challenges SET expires_at=clock_timestamp()-interval '1 second' WHERE id=$1",challenge.ChallengeID);e!=nil{t.Fatal(e)}
 if _,e=w.Complete(ctx,grant.Token,challenge.ChallengeID,walletTestSign(t,key,challenge.Message),bind);!errors.Is(e,ErrAuthentication){t.Fatal("expired challenge",e)}
 challenge,e=w.Begin(ctx,grant.Token,address,"eoa",true,bind);if e!=nil{t.Fatal(e)}
 if e=m.Logout(ctx,grant.Token);e!=nil{t.Fatal(e)}
 if _,e=w.Complete(ctx,grant.Token,challenge.ChallengeID,walletTestSign(t,key,challenge.Message),bind);!errors.Is(e,ErrAuthentication){t.Fatal("revoked session finalized",e)}
 if e=w.Purge(ctx);e!=nil{t.Fatal(e)}
}
func TestOptionalWalletActiveOwnershipRace(t *testing.T){
 ctx:=context.Background();db:=sessionDB(t);db2:=sessionDB(t)
 a,mail:=sessionAuth(t,db,testOrigin,testRP);a2,mail2:=sessionAuth(t,db2,testOrigin,testRP)
 m:=sessionManager(t,a,"bong-goggles");m2:=sessionManager(t,a2,"bong-goggles")
 w,_:=NewWalletLinkManager(m,420,nil);w2,_:=NewWalletLinkManager(m2,420,nil)
 key:=walletTestKeyNumber(t,0x43);bind:=mustRandom(t);id1,_:=newID();id2,_:=newID()
 g1:=mustIssueSession(t,m,freshEmail(t,a,mail,id1+"@example.org").Proof)
 g2:=mustIssueSession(t,m2,freshEmail(t,a2,mail2,id2+"@example.org").Proof)
 ch1,e:=w.Begin(ctx,g1.Token,key.Address(),"eoa",true,bind);if e!=nil{t.Fatal(e)}
 ch2,e:=w2.Begin(ctx,g2.Token,key.Address(),"eoa",true,bind);if e!=nil{t.Fatal(e)}
 sig1:=walletTestSign(t,key,ch1.Message);sig2:=walletTestSign(t,key,ch2.Message)
 type attempt struct{w *WalletLinkManager;g SessionGrant;ch WalletLinkChallenge;sig string}
 race:=[]attempt{{w,g1,ch1,sig1},{w2,g2,ch2,sig2}}
 var wg sync.WaitGroup;results:=make(chan error,2)
 for _,v:=range race{wg.Add(1);go func(v attempt){defer wg.Done()
  _,e:=v.w.Complete(ctx,v.g.Token,v.ch.ChallengeID,v.sig,bind);results<-e
 }(v)}
 wg.Wait();close(results);ok,conflicts:=0,0
 for e:=range results{if e==nil{ok++}else if errors.Is(e,ErrConflict){conflicts++}else{t.Fatal("unexpected race error",e)}}
 if ok!=1||conflicts!=1{t.Fatal("active wallet ownership collision",ok,conflicts)}
 var n int;if e:=db.QueryRowContext(ctx,"SELECT count(*) FROM account420.wallet_links WHERE chain_id=420 AND wallet_address=$1 AND unlinked_at IS NULL",key.Address()).Scan(&n);e!=nil||n!=1{t.Fatal("duplicate live wallet",n,e)}
}
