package social

import "testing"

// BC-1.4 calls out exact publicly visible running counts, even when the
// engine immediately resets to zero or advances into the next round.
func TestBC14AwardCarriesOriginalPeggingCount(t *testing.T){
 for _,count:=range []int{15,18,31}{
  f:=RuleFrame{SeatCount:2,Scores:[]int64{100,86},Phase:"peg"}
  d:=cribbageData{Count:count}
  cribbageScore(&f,&d,0,6,"+triple")
  if len(d.Awards)!=1||d.Awards[0].Count!=count||
   d.Awards[0].Points!=6||d.Awards[0].Total!=106||f.Scores[0]!=106{
   t.Fatalf("lost count/score in public award at %d: %+v, %+v",count,d.Awards,f.Scores)
  }
  cribbageReset(&d)
  if d.Count!=0||d.Awards[0].Count!=count{
   t.Fatalf("reset destroyed historical public count at %d: %+v",count,d.Awards)
  }
 }
}
