package account

import "testing"

func TestAUTH12RejectsAmbiguousAndUnicodeJSONKeys(t *testing.T){
 valid:=[]string{
  `{}`,
  `{"consentAccepted":true,"expectedVersion":0,"rewardOptIn":false}`,
  `{"ConsentAccepted":true,"expectedVersion":0}`,
 }
 for _,v:=range valid{if !uniqueObject([]byte(v)){t.Fatalf("valid JSON rejected: %s",v)}}
 adversarial:=[]string{
  `{"consentAccepted":false,"ConsentAccepted":true}`,
  `{"rewardOptIn":true,"REWARDOPTIN":false}`,
  `{"token":"first","Token":"second"}`,
  `{"consentAccepted":false,"conſentAccepted":true}`,
  `{"consentAccepted":false,"consentAcceptéd":true}`,
  `{"code":"one","c\\u006fde":"two"}`,
  `{"consentAccepted":true,"consentAccepted":false}`,
  `{"unexpected-identifier":true}`,
  `{"consentAccepted":true}{"consentAccepted":false}`,
  `[]`,
 }
 for _,v:=range adversarial{if uniqueObject([]byte(v)){t.Fatalf("ambiguous JSON accepted: %s",v)}}
}
