package storage420

import ("encoding/json"; "os"; "testing")
func TestResourceIdentifierVectors(t *testing.T) {
 var v struct {
 Identifiers []struct {Name,Preimage,Kind,Hash string}
 Scopes []struct {Kind,Hash string; IDs []string}
 }
 b,e:=os.ReadFile("testdata/resource_identifier_vectors.json");if e!=nil {t.Fatal(e)}
 if e=json.Unmarshal(b,&v);e!=nil {t.Fatal(e)}
 if len(v.Identifiers)!=len(resourceIdentifiers)||len(v.Scopes)!=4 {t.Fatal("vector coverage")}
 scopes:=map[string][]string{}; hashes:=map[string]string{}
 for _,s:=range v.Scopes {got,e:=ResourceScopeHash(s.Kind,s.IDs...);if e!=nil||got!=s.Hash {t.Fatalf("scope %s: %s %v",s.Kind,got,e)};scopes[s.Kind]=s.IDs;hashes[s.Kind]=s.Hash}
 count:=0
 for _,i:=range v.Identifiers {got,e:=ResourceIdentifier(i.Name);if e!=nil||got!=i.Hash {t.Fatalf("identifier %s: %s %v",i.Name,got,e)}
 if i.Kind!="" {count++;g,e:=DeriveResourceGrant(i.Name,scopes[i.Kind]...);if e!=nil||g.CapabilityID!=i.Hash||g.ScopeHash!=hashes[i.Kind]||g.ScopeKind!=i.Kind {t.Fatalf("grant %s: %v %v",i.Name,g,e)}}}
 if count!=15 {t.Fatal("action coverage")}
 if _,e:=DeriveResourceGrant("ResourceIds420.ACTION_OPEN_SESSION",scopes["session"]...);e==nil {t.Fatal("retired action accepted")}
 if _,e:=ResourceScopeHash("node",scopes["provider"]...);e==nil {t.Fatal("wrong arity")}
 if _,e:=ResourceScopeHash("provider","0x"+string(make([]byte,64)));e==nil {t.Fatal("malformed id")}
}
