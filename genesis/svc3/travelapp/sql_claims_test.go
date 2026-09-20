package travelapp

import (
 "context"
 "errors"
 "testing"
)

func TestSQLClaimsRequireTrustedDependencies(t *testing.T) {
 if _,err:=NewSQLClaimRepository(nil,nil,nil);!errors.Is(err,ErrClaimUnavailable){t.Fatalf("unconfigured claim SQL store: %v",err)}
 var store *SQLClaimRepository
 if _,err:=store.Submit(context.Background(),"alice",sampleClaim());!errors.Is(err,ErrClaimUnavailable){t.Fatalf("unconfigured submission: %v",err)}
 if _,err:=store.GetOwned(context.Background(),"alice","claim-1");!errors.Is(err,ErrClaimUnavailable){t.Fatalf("unconfigured private read: %v",err)}
 if _,err:=store.Decide(context.Background(),"reviewer","claim-1",ClaimApproved);!errors.Is(err,ErrClaimUnavailable){t.Fatalf("unconfigured reviewer decision: %v",err)}
}
