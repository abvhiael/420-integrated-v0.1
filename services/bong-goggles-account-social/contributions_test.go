package social

import (
 "strings"
 "testing"
)
func TestXPPolicyV1BoundedAndNoSelfReplies(t *testing.T){
 if p,c:=eligibleXP("post","Short",false);p!=0||c!=0{t.Fatal("short post earned XP")}
 if p,c:=eligibleXP("post",strings.Repeat("a",25),false);p!=5||c!=3{t.Fatal("post policy",p,c)}
 if p,c:=eligibleXP("comment",strings.Repeat("z",15),false);p!=2||c!=10{t.Fatal("comment policy",p,c)}
 if p,c:=eligibleXP("comment",strings.Repeat("z",15),true);p!=0||c!=0{t.Fatal("self-comment awarded",p,c)}
 for _,kind:=range []string{"like","follow","message","game","reward","wager","wallet"}{
  if p,c:=eligibleXP(kind,strings.Repeat("a",50),false);p!=0||c!=0{t.Fatal("unapproved source XP",kind)}
 }
 if digestContribution("  Sample POST  ")!=digestContribution("sample post"){t.Fatal("duplicate digest normalized inconsistently")}
 if digestContribution("first") == digestContribution("second"){t.Fatal("distinct contributions collide")}
 if _,e:=NewContributions(nil);e==nil{t.Fatal("missing XP store accepted")}
 if _,e:=NewContributions(&Store{});e==nil{t.Fatal("nil DB authority accepted")}
}
