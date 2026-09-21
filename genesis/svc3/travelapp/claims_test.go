package travelapp

import (
 "context"
 "errors"
 "testing"
)

type claimVerifier struct { allow bool; err error; calls int }
func (v *claimVerifier) VerifyPlaceClaim(_ context.Context, claimant,place,registry,evidence string)(bool,error){v.calls++;return v.allow,v.err}
func sampleClaim() PlaceClaim{return PlaceClaim{ID:"claim-1",PlaceID:"public-place",ClaimantID:"forged-owner",RegistryRecordID:"registry-1",EvidenceRef:"proof-1",Status:ClaimApproved}}

func TestPlaceClaimFailClosedAndIdentityScoped(t *testing.T){
 ctx:=context.Background()
 if _,err:=NewClaimStore(nil).Submit(ctx,"alice",sampleClaim());!errors.Is(err,ErrClaimUnavailable){t.Fatalf("unconfigured verifier: %v",err)}
 verifier:=&claimVerifier{allow:false}
 store:=NewClaimStore(verifier)
 if _,err:=store.Submit(ctx,"alice",sampleClaim());!errors.Is(err,ErrClaimUnavailable){t.Fatalf("unverified claimant: %v",err)}
 verifier.allow=true
 c,err:=store.Submit(ctx,"alice",sampleClaim());if err!=nil{t.Fatal(err)}
 if c.ClaimantID!="alice"||c.Status!=ClaimPending||c.CreatedAt.IsZero(){t.Fatalf("untrusted input escalated claim: %+v",c)}
 if _,err:=store.GetOwned(ctx,"bob",c.ID);!errors.Is(err,ErrClaimNotFound){t.Fatalf("cross-owner data disclosure: %v",err)}
 if _,err:=store.GetOwned(ctx,"",c.ID);!errors.Is(err,ErrClaimUnauthorized){t.Fatalf("anonymous access: %v",err)}
 if _,err:=store.Submit(ctx,"alice",sampleClaim());!errors.Is(err,ErrClaimConflict){t.Fatalf("duplicate pending claim: %v",err)}
 if _,err:=store.Decide(ctx,"alice",c.ID,true);!errors.Is(err,ErrClaimUnauthorized){t.Fatalf("self-approval: %v",err)}
 verifier.allow=false
 if _,err:=store.Decide(ctx,"reviewer",c.ID,true);!errors.Is(err,ErrClaimUnavailable){t.Fatalf("revoked provenance approved: %v",err)}
 pending,err:=store.GetOwned(ctx,"alice",c.ID);if err!=nil||pending.Status!=ClaimPending{t.Fatalf("failed approval changed status: %+v %v",pending,err)}
 verifier.allow=true
 approved,err:=store.Decide(ctx,"reviewer",c.ID,true);if err!=nil||approved.Status!=ClaimApproved||verifier.calls<3{t.Fatalf("approval without re-verification: %+v %v calls=%d",approved,err,verifier.calls)}
 if _,err:=store.Decide(ctx,"another-reviewer",c.ID,false);!errors.Is(err,ErrClaimConflict){t.Fatalf("already decided claim changed: %v",err)}
}

func TestPlaceClaimRejectionAndInputBounds(t *testing.T){
 ctx:=context.Background();v:=&claimVerifier{allow:true};store:=NewClaimStore(v)
 invalid:=sampleClaim();invalid.PlaceID="invalid!"
 if _,err:=store.Submit(ctx,"alice",invalid);!errors.Is(err,ErrClaimInvalid)||v.calls!=0{t.Fatalf("invalid place accepted or verified: %v",err)}
 if _,err:=store.Submit(ctx,"",sampleClaim());!errors.Is(err,ErrClaimUnauthorized){t.Fatalf("anonymous claim: %v",err)}
 c,err:=store.Submit(ctx,"alice",sampleClaim());if err!=nil{t.Fatal(err)}
 rejected,err:=store.Decide(ctx,"reviewer",c.ID,false);if err!=nil||rejected.Status!=ClaimRejected{t.Fatalf("rejection: %+v %v",rejected,err)}
 if _,err:=store.GetOwned(ctx,"alice","missing");!errors.Is(err,ErrClaimNotFound){t.Fatalf("missing claim: %v",err)}
 // Rejected claim does not authorize any place edit or ownership transition.
 if _,err:=store.Decide(ctx,"reviewer",c.ID,true);!errors.Is(err,ErrClaimConflict){t.Fatalf("rejected claim revived: %v",err)}
}
