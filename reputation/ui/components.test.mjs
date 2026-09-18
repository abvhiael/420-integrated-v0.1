import test from "node:test";
import assert from "node:assert/strict";
import {
  ratingSummary,ratingHistogram,reviewCard,reviewComposer,reportControl,
  reputationPanel,policyDisclosure,loadingState,errorState,emptyState
} from "./components.mjs";

test("summary renders visible and verified counts",()=>{
  const html=ratingSummary({averageRating:4.5,visibleReviewCount:2,verifiedReviewCount:1,unverifiedReviewCount:1});
  assert.match(html,/4\.5/);
  assert.match(html,/2 visible reviews/);
  assert.match(html,/1 verified · 1 unverified/);
});

test("histogram exposes accessible meter values",()=>{
  const html=ratingHistogram({five:3,four:1});
  assert.match(html,/aria-valuenow="75"/);
  assert.match(html,/5 star reviews: 3/);
});

test("review card distinguishes verified interaction and moderation status",()=>{
  const html=reviewCard({
    id:"r1",rating:5,verification:"VERIFIED_INTERACTION",status:"HIDDEN",
    author:{id:"buyer"},bodyRef:"storage://review"
  },{bodyRef:"storage://response"});
  assert.match(html,/verified interaction/);
  assert.match(html,/review status: HIDDEN/);
  assert.match(html,/response from subject/);
});

test("composer respects domains that forbid unverified opinions",()=>{
  const html=reviewComposer({domain:"FREELANCER",subjectType:"PROFILE",subjectId:"worker",allowUnverified:false});
  assert.doesNotMatch(html,/UNVERIFIED_OPINION/);
  assert.match(html,/VERIFIED_INTERACTION/);
});

test("report control contains canonical reasons",()=>{
  const html=reportControl("r1");
  for(const reason of ["SPAM","CONFLICT_OF_INTEREST","HARASSMENT","FRAUD","DUPLICATE","IRRELEVANT","PERSONAL_INFORMATION","RIGHTS_VIOLATION"]) {
    assert.match(html,new RegExp(reason));
  }
});

test("panel carries policy disclosure and no universal score semantics",()=>{
  const html=reputationPanel({
    domain:"CLASSIFIEDS",
    summary:{averageRating:5,visibleReviewCount:1,verifiedReviewCount:1,unverifiedReviewCount:0,ratingDistribution:{five:1},policyVersion:"420-reputation-genesis-v1"},
    reviews:[{id:"r1",rating:5,verification:"VERIFIED_INTERACTION",status:"ACTIVE",author:{id:"buyer"}}]
  });
  assert.match(html,/420-reputation-genesis-v1/);
  assert.match(html,/not a universal score/);
});

test("state components expose status and alert semantics",()=>{
  assert.match(loadingState(),/role="status"/);
  assert.match(errorState(),/role="alert"/);
  assert.match(emptyState(),/No reviews yet/);
});

test("user-provided values are escaped",()=>{
  const html=reviewCard({id:'"><script>',rating:5,verification:"UNVERIFIED_OPINION",status:"ACTIVE",author:{id:"<img>"}});
  assert.doesNotMatch(html,/<script>/);
  assert.doesNotMatch(html,/<img>/);
  assert.match(html,/&lt;img&gt;/);
});

test("policy disclosure names application scope",()=>{
  const html=policyDisclosure("v1");
  assert.match(html,/domain-scoped application reputation/);
});
