//go:build account420_integration

package account

import (
 "context"
 "encoding/json"
 "errors"
 "strings"
 "sync"
 "testing"
 "time"
)
type identityNamesFixture struct{
 mu sync.Mutex
 unavailable bool
 stale bool
}
func (f *identityNamesFixture) Verify(_ context.Context,chain int64,wallet,profileID,labelHash string)(OnChainIdentityDisplay,error){
 f.mu.Lock();defer f.mu.Unlock()
 if f.unavailable{return OnChainIdentityDisplay{},ErrUnavailable}
 result:=OnChainIdentityDisplay{
  IdentityProfileID:profileID,NameLabelHash:labelHash,ChainID:chain,
  WalletAddress:wallet,IdentityActive:true,BilateralNameVerified:labelHash!="",
  FinalizedBlockHash:"0x"+strings.Repeat("a",64),VerifiedAt:time.Now().UTC(),
 }
 if f.stale{result.IdentityActive=false}
 return result,nil
}
func TestIdentityNamesPreferenceRequiresLinkedWalletAndFreshChain(t *testing.T){
 ctx:=context.Background();db:=sessionDB(t);db2:=sessionDB(t)
 a,mail:=sessionAuth(t,db,testOrigin,testRP);a2,_:=sessionAuth(t,db2,testOrigin,testRP)
 s:=sessionManager(t,a,"bong-goggles");s2:=sessionManager(t,a2,"bong-goggles")
 w,_:=NewWalletLinkManager(s,420,nil);w2,_:=NewWalletLinkManager(s2,420,nil)
 fixture:=&identityNamesFixture{}
 manager,e:=NewIdentityNamesManager(s,w,fixture);if e!=nil{t.Fatal(e)}
 second,e:=NewIdentityNamesManager(s2,w2,fixture);if e!=nil{t.Fatal(e)}
 if _,e:=NewIdentityNamesManager(nil,w,fixture);!errors.Is(e,ErrInvalid){t.Fatal("nil authority accepted")}
 if _,e:=NewIdentityNamesManager(s,w,nil);!errors.Is(e,ErrInvalid){t.Fatal("missing verifier accepted")}
 if e=manager.Ready(ctx);e!=nil{t.Fatal("migration 007 unreadable",e)}
 uid,_:=newID();email:=uid+"@example.org"
 grant:=mustIssueSession(t,s,freshEmail(t,a,mail,email).Proof)
 profile:="0x"+strings.Repeat("1",64)
 label:="0x"+strings.Repeat("2",64)
 if current,e:=manager.Current(ctx,grant.Token);e!=nil||current!=nil{t.Fatal("identity mandatory",e)}
 if _,e=manager.Preview(ctx,grant.Token,profile,label);!errors.Is(e,ErrUnavailable){t.Fatal("verification without wallet",e)}
 if _,e=manager.Save(ctx,grant.Token,profile,label,false,0);!errors.Is(e,ErrInvalid){t.Fatal("no consent",e)}
 key:=walletTestKeyNumber(t,0x66);binding:=mustRandom(t)
 challenge,e:=w.Begin(ctx,grant.Token,key.Address(),"eoa",true,binding);if e!=nil{t.Fatal(e)}
 if _,e=w.Complete(ctx,grant.Token,challenge.ChallengeID,walletTestSign(t,key,challenge.Message),binding);e!=nil{t.Fatal(e)}
 verified,e:=manager.Preview(ctx,grant.Token,profile,label)
 if e!=nil||!verified.BilateralNameVerified||!verified.IdentityActive{t.Fatal("bilateral verification",e)}
 pref,e:=manager.Save(ctx,grant.Token,profile,label,true,0)
 if e!=nil||pref.Revision!=1{t.Fatal("saved preference",pref,e)}
 otherSession:=mustIssueSession(t,s2,freshEmail(t,a,mail,email).Proof)
 got,e:=second.Current(ctx,otherSession.Token)
 if e!=nil||got==nil||got.Revision!=1||got.NameLabelHash!=label{t.Fatal("cross-instance stored preference",got,e)}
 if _,e=manager.Save(ctx,grant.Token,profile,label,true,0);!errors.Is(e,ErrConflict){t.Fatal("stale revision accepted",e)}
 if _,e=manager.Save(ctx,grant.Token,zero32,label,true,1);!errors.Is(e,ErrInvalid){t.Fatal("zero identity accepted",e)}
 if _,e=manager.Save(ctx,grant.Token,profile,zero32,true,1);!errors.Is(e,ErrInvalid){t.Fatal("zero name accepted",e)}
 raw,e:=json.Marshal(pref);if e!=nil||strings.Contains(string(raw),email)||strings.Contains(string(raw),grant.Token)||strings.Contains(string(raw),string(grant.Session.ID)){t.Fatal("private session leaked",e)}
 fixture.mu.Lock();fixture.unavailable=true;fixture.mu.Unlock()
 if _,e=manager.Current(ctx,grant.Token);!errors.Is(e,ErrUnavailable){t.Fatal("unavailable chain promoted cached identity",e)}
 fixture.mu.Lock();fixture.unavailable=false;fixture.stale=true;fixture.mu.Unlock()
 if _,e=manager.Current(ctx,grant.Token);!errors.Is(e,ErrAuthentication){t.Fatal("invalidated on-chain claim presented",e)}
 fixture.mu.Lock();fixture.stale=false;fixture.mu.Unlock()
 // Concurrent revisions cannot clobber another app session's preference.
 errorsSeen:=make(chan error,2);var wg sync.WaitGroup
 for _,actor:=range []struct{m *IdentityNamesManager;token string}{{manager,grant.Token},{second,otherSession.Token}}{
  wg.Add(1);go func(actor struct{m *IdentityNamesManager;token string}){defer wg.Done()
   _,e:=actor.m.Save(ctx,actor.token,profile,"",true,1);errorsSeen<-e
  }(actor)
 }
 wg.Wait();close(errorsSeen);wins,conflicts:=0,0
 for e:=range errorsSeen{if e==nil{wins++}else if errors.Is(e,ErrConflict){conflicts++}else{t.Fatal("revision race",e)}}
 if wins!=1||conflicts!=1{t.Fatal("optimistic update race",wins,conflicts)}
 got,e=manager.Current(ctx,grant.Token);if e!=nil||got==nil||got.Revision!=2||got.BilateralNameVerified{t.Fatal("updated association",got,e)}
 if e=w.Unlink(ctx,grant.Token);e!=nil{t.Fatal(e)}
 if _,e=manager.Current(ctx,grant.Token);!errors.Is(e,ErrUnavailable){t.Fatal("unlinked address presented as verified",e)}
 if e=manager.Clear(ctx,grant.Token);e!=nil{t.Fatal("clear without wallet",e)}
 if got,e=second.Current(ctx,otherSession.Token);e!=nil||got!=nil{t.Fatal("cleared association still present",got,e)}
 // The private preference does not change any on-chain controller or Names record.
}

func TestIdentityNamesCrossAppAndSuspendedAccount(t *testing.T){
 ctx:=context.Background();db:=sessionDB(t)
 a,mail:=sessionAuth(t,db,testOrigin,testRP)
 s:=sessionManager(t,a,"bong-goggles")
 cross:=sessionManager(t,a,"doobtube")
 w,_:=NewWalletLinkManager(s,420,nil)
 manager,_:=NewIdentityNamesManager(s,w,&identityNamesFixture{})
 uid,_:=newID();email:=uid+"@example.org"
 p:=freshEmail(t,a,mail,email).Proof
 local:=mustIssueSession(t,s,p)
 crossGrant:=mustIssueSession(t,cross,freshEmail(t,a,mail,email).Proof)
 if _,e:=manager.Current(ctx,crossGrant.Token);!errors.Is(e,ErrAuthentication){t.Fatal("cross app token accepted",e)}
 if _,e:=manager.Save(ctx,crossGrant.Token,"0x"+strings.Repeat("1",64),"",true,0);!errors.Is(e,ErrAuthentication){t.Fatal("cross app write accepted",e)}
 if _,e:=a.store.Transition(ctx,p.AccountID(),1,Suspended);e!=nil{t.Fatal(e)}
 if _,e:=manager.Current(ctx,local.Token);!errors.Is(e,ErrAuthentication){t.Fatal("suspended session accepted",e)}
 if _,e:=a.store.Transition(ctx,p.AccountID(),2,Active);e!=nil{t.Fatal(e)}
 if _,e:=manager.Current(ctx,local.Token);!errors.Is(e,ErrAuthentication){t.Fatal("old revision revived",e)}
}
