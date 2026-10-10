package complianceauth
import("testing";"time")
func TestSourceChangeDetection(t *testing.T){
 now:=time.Date(2026,10,10,18,0,0,0,time.UTC)
 section:=func(loc,text string)SourceSection{return SourceSection{Locator:loc,Text:text,SourceDigest:Digest([]byte(text)),EffectiveFrom:now}}
 original:=SourceDocument{SourceID:"FED-ACT",URL:"https://laws-lois.justice.gc.ca",SnapshotDigest:Digest([]byte("raw1")),Available:true,Sections:[]SourceSection{section("s1","Prohibition on X")},Navigation:[]string{"menu1"}}
 cases:=[]struct{name string;change func(*SourceDocument);want string}{
 {"unchanged",func(*SourceDocument){},"NO_MEANINGFUL_CHANGE"},
 {"navigation only",func(x *SourceDocument){x.SnapshotDigest=Digest([]byte("raw2"));x.Navigation=[]string{"menu2"}},"NAVIGATION_ONLY_CHANGE"},
 {"silent amendment",func(x *SourceDocument){x.Sections=[]SourceSection{section("s1","Prohibition on Y")}},"SILENT_AMENDMENT"},
 {"effective date shift",func(x *SourceDocument){x.Sections[0].EffectiveFrom=now.Add(time.Hour)},"EFFECTIVE_DATE_SHIFT"},
 {"removed",func(x *SourceDocument){x.Sections=nil},"REMOVED"},
 {"relocated",func(x *SourceDocument){x.Sections=[]SourceSection{section("s2","Prohibition on X")}},"RELOCATED"},
 {"outage",func(x *SourceDocument){x.Available=false;x.Sections=nil},"SOURCE_OUTAGE"},
 }
 for _,tc:=range cases{t.Run(tc.name,func(t *testing.T){x:=original;x.Sections=append([]SourceSection{},original.Sections...);tc.change(&x);r,err:=DetectSourceChanges(original,x);if err!=nil{t.Fatal(err)};if r.PolicyActivated{t.Fatal("policy activation bypass")};if tc.want=="NO_MEANINGFUL_CHANGE"{if r.State!=tc.want{t.Fatalf("unexpected %v",r)}}else if len(r.Changes)==0||r.Changes[0].Type!=tc.want{t.Fatalf("expected %s got %+v",tc.want,r)}})}
 malformed:=original;malformed.Sections=[]SourceSection{section("s1","one"),section("s1","two")};if _,err:=DetectSourceChanges(original,malformed);err==nil{t.Fatal("duplicate sections accepted")}
 malformed=original;malformed.SourceID="attacker";if _,err:=DetectSourceChanges(original,malformed);err==nil{t.Fatal("cross-source change accepted")}
}
