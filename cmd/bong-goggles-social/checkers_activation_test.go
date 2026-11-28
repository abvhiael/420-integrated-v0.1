package main
import "testing"
func TestCheckersActivationFailsClosed(t *testing.T){
 for _,mode:=range []string{"","disabled"}{if e:=configureCheckers(mode);e!=nil{t.Fatal(e)}}
 for _,mode:=range []string{"true","production","restricted-acceptance"}{if e:=configureCheckers(mode);e==nil{t.Fatal("unqualified Checkers activation accepted")}}
}
