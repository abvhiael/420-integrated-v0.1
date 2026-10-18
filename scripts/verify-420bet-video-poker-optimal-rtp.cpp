// SPDX-License-Identifier: GPL-3.0
// Exact 9/6 Jacks-or-Better optimal hold/draw RTP, full 52-choose-5 universe.
// Compile: g++ -std=c++17 -O3 -Wall -Wextra verify-420bet-video-poker-optimal-rtp.cpp -o /tmp/vp
// Computes subset payout sums for all 2,598,960 final hands, applies Boolean
// superset Moebius inversion to exclude each initial hand's discarded cards,
// then maximizes exact conditional expectation over all 32 legal holds.
// No simulation, floating-point choice, or strategy approximation.
#include <algorithm>
#include <array>
#include <cstdint>
#include <iostream>
#include <numeric>
#include <stdexcept>
#include <string>
#include <vector>
using u64=std::uint64_t;
using u128=unsigned __int128;
using Hand=std::array<int,5>;
static u64 choose[53][6];
static std::array<std::vector<u64>,6> baseSums,royalCounts;
static constexpr u64 TOTAL=2598960;
static u64 counts[10]={};
static std::string decimal(u128 n){
  if(!n)return "0";
  std::string s;
  while(n){s.push_back(char('0'+n%10));n/=10;}
  std::reverse(s.begin(),s.end());return s;
}
static u128 gcd128(u128 a,u128 b){while(b){u128 t=a%b;a=b;b=t;}return a;}
static int category(const Hand& cards){
  int ranks[14]={}, firstSuit=cards[0]/13;
  bool flush=true;
  for(int card:cards){
    if(card<0||card>=52)throw std::runtime_error("card out of range");
    flush &= card/13==firstSuit;
    int rank=card%13; ++ranks[rank==0?1:rank+1];
  }
  int pairs=0;bool highPair=false,trips=false,quads=false;
  for(int rank=1;rank<=13;++rank){
    if(ranks[rank]==4)quads=true;
    if(ranks[rank]==3)trips=true;
    if(ranks[rank]==2){++pairs;highPair|=rank==1||rank>=11;}
  }
  bool royal=ranks[1]&&ranks[10]&&ranks[11]&&ranks[12]&&ranks[13];
  bool straight=royal;
  for(int start=1;start<=9;++start){
    bool ok=true;for(int x=0;x<5;++x)ok &= ranks[start+x]==1;
    straight|=ok;
  }
  if(flush&&straight)return royal?9:8;
  if(quads)return 7;
  if(trips&&pairs==1)return 6;
  if(flush)return 5;
  if(straight)return 4;
  if(trips)return 3;
  if(pairs==2)return 2;
  if(pairs==1&&highPair)return 1;
  return 0;
}
template<typename F> static void allHands(F&& fn){
  Hand h;
  for(h[0]=0;h[0]<48;++h[0])
  for(h[1]=h[0]+1;h[1]<49;++h[1])
  for(h[2]=h[1]+1;h[2]<50;++h[2])
  for(h[3]=h[2]+1;h[3]<51;++h[3])
  for(h[4]=h[3]+1;h[4]<52;++h[4])fn(h);
}
static void indices(const Hand& h,std::array<unsigned,32>& size,std::array<u64,32>& index){
  size.fill(0);index.fill(0);
  for(unsigned mask=1;mask<32;++mask){
    unsigned last=31u-__builtin_clz(mask);
    unsigned rest=mask^(1u<<last);
    size[mask]=size[rest]+1;
    index[mask]=index[rest]+choose[h[last]][size[mask]];
  }
}
static void invert(std::array<std::int64_t,32>& vals){
  for(unsigned bit=0;bit<5;++bit)
    for(unsigned mask=0;mask<32;++mask)
      if(!(mask&(1u<<bit)))vals[mask]-=vals[mask|(1u<<bit)];
}
int main(){
  choose[0][0]=1;
  for(int n=1;n<=52;++n){
    choose[n][0]=1;
    for(int k=1;k<=5;++k)choose[n][k]=choose[n-1][k]+choose[n-1][k-1];
  }
  if(choose[52][5]!=TOTAL)throw std::runtime_error("incorrect deck count");
  for(int k=0;k<=5;++k){
    baseSums[k].resize(choose[52][k]);
    royalCounts[k].resize(choose[52][k]);
  }
  const int pays[10]={0,1,2,3,4,6,9,25,50,250};
  u64 generated=0;
  allHands([&](const Hand& h){
    ++generated;
    int cat=category(h);++counts[cat];
    std::array<unsigned,32> sizes;
    std::array<u64,32> ranks;
    indices(h,sizes,ranks);
    for(unsigned mask=0;mask<32;++mask){
      baseSums[sizes[mask]][ranks[mask]]+=pays[cat];
      if(cat==9)++royalCounts[sizes[mask]][ranks[mask]];
    }
  });
  constexpr u64 expected[10]={2062860,337920,123552,54912,10200,5108,3744,624,36,4};
  if(generated!=TOTAL)throw std::runtime_error("incomplete deal universe");
  for(int i=0;i<10;++i)if(counts[i]!=expected[i])
    throw std::runtime_error("hand distribution mismatch at category "+std::to_string(i));
  u64 denominator[6],scale=1;
  for(int k=0;k<=5;++k){
    denominator[k]=choose[47][5-k];
    scale=std::lcm(scale,denominator[k]);
  }
  u128 summed[2]={};
  u64 processed=0,changedChoice=0;
  allHands([&](const Hand& h){
    ++processed;
    std::array<unsigned,32> sizes;
    std::array<u64,32> ranks;
    indices(h,sizes,ranks);
    std::array<std::int64_t,32> avg={},royal={};
    for(unsigned mask=0;mask<32;++mask){
      avg[mask]=static_cast<std::int64_t>(baseSums[sizes[mask]][ranks[mask]]);
      royal[mask]=static_cast<std::int64_t>(royalCounts[sizes[mask]][ranks[mask]]);
    }
    invert(avg);invert(royal);
    u64 bestNum[2]={},bestDen[2]={1,1};
    unsigned bestMask[2]={};
    for(unsigned mask=0;mask<32;++mask){
      if(avg[mask]<0||royal[mask]<0)throw std::runtime_error("negative excluded total");
      u64 den=denominator[sizes[mask]];
      u64 num0=static_cast<u64>(avg[mask]);
      u64 num1=num0+550*static_cast<u64>(royal[mask]);
      u64 num[2]={num0,num1};
      for(int mode=0;mode<2;++mode){
        if(u128(num[mode])*bestDen[mode]>u128(bestNum[mode])*den){
          bestNum[mode]=num[mode];bestDen[mode]=den;bestMask[mode]=mask;
        }
      }
    }
    if(bestMask[0]!=bestMask[1])++changedChoice;
    for(int mode=0;mode<2;++mode)
      summed[mode]+=u128(bestNum[mode])*(scale/bestDen[mode]);
  });
  if(processed!=TOTAL)throw std::runtime_error("incomplete optimal strategy universe");
  const u128 bottom=u128(scale)*TOTAL;
  std::cout<<"protocol=420bet-video-poker-jacks-or-better-9-6-v1\n";
  std::cout<<"deals="<<processed<<" holds_per_deal=32 replacement_pool=47\n";
  std::cout<<"categories=2062860,337920,123552,54912,10200,5108,3744,624,36,4\n";
  std::cout<<"denominator_lcm="<<scale<<" strategic_choice_differences="<<changedChoice<<"\n";
  for(int mode=0;mode<2;++mode){
    u128 g=gcd128(summed[mode],bottom);
    std::cout<<(mode==0?"credits=1..4":"credits=5")
             <<" optimal_gross_rtp_exact="<<decimal(summed[mode]/g)<<"/"<<decimal(bottom/g)
             <<" house_edge_exact="<<decimal((bottom-summed[mode])/g)<<"/"<<decimal(bottom/g)<<"\n";
  }
  if(summed[0]>=bottom||summed[1]>=bottom||summed[1]<=summed[0])
    throw std::runtime_error("RTP bounds or royal bonus inconsistent");
  std::cout<<"PASS: exhaustive exact rational optimal 32-hold strategy analysis; independent economic approval pending\n";
}
