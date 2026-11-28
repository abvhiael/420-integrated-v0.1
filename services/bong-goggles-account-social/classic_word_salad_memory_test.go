package social

import("testing";"runtime";"runtime/debug";"sync";"reflect")

func TestWordSaladMemoryQualification(t *testing.T){
 oldLimit:=debug.SetMemoryLimit(384<<20);defer debug.SetMemoryLimit(oldLimit)
 constructors:=[]func()(*RulesAdapter,error){NewLegacyProductionWordSaladRulesAdapter,NewPreviousProductionWordSaladRulesAdapter,NewProductionWordSaladRulesAdapter}
 adapters:=make([]*RulesAdapter,3);policies:=make([]ClassicBotPolicies,3)
 for i,ctor:=range constructors{a,e:=ctor();if e!=nil{t.Fatal(e)};adapters[i]=a;p,e:=NewWordSaladBotPolicies(a);if e!=nil{t.Fatal(e)};policies[i]=p}
 a,b:=policies[1].Hard.(saladBotPolicy).lex,policies[2].Hard.(saladBotPolicy).lex
 if &a.general.words[0]!=&b.general.words[0]||&a.union.words[0]!=&b.union.words[0]{t.Fatal("duplicate identical index")}
 if reflect.ValueOf(a.rules.general).Pointer()!=reflect.ValueOf(b.rules.general).Pointer(){t.Fatal("duplicate identical dictionary")}
 for _,p:=range policies{l:=p.Hard.(saladBotPolicy).lex;for w:=range l.rules.general{if !l.general.advance(w).terminal()||!l.union.advance(w).terminal(){t.Fatal("lost English word",w)}};for w:=range l.rules.cannabis{if !l.union.advance(w).terminal(){t.Fatal("lost cannabis word",w)}}}
 runtime.GC();var m runtime.MemStats;runtime.ReadMemStats(&m);t.Logf("retained heap: %d bytes; runtime Sys: %d",m.HeapAlloc,m.Sys);if m.HeapAlloc>128<<20{t.Fatal("dictionary heap budget exceeded")}
 for round:=0;round<3;round++{var wg sync.WaitGroup;for worker:=0;worker<2;worker++{i:=(round+worker)%3;wg.Add(1);go func(i int){defer wg.Done();result,e:=QualifyBotMatch(adapters[i],[32]byte{byte(i+1)},[]string{"easy","medium"},policies[i]);if e!=nil{t.Error("concurrent complete match",e);return};if len(result.Trace)==0{t.Error("empty match")}}(i)};wg.Wait();runtime.GC();runtime.ReadMemStats(&m);t.Logf("round %d heap %d sys %d",round,m.HeapAlloc,m.Sys);if m.HeapAlloc>128<<20{t.Fatal("retained heap exceeded")}}
}
