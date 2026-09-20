// BG-20.2: pure operator-side evaluation of pre-aggregated telemetry.
// This module does not collect browser events, transmit telemetry, page anyone,
// or approve a launch. A qualified server collector must enforce these schemas
// BEFORE aggregation; this consumer rejects extra fields and labels.
const ENVIRONMENTS=new Set(['testnet','staging','production']);
const METRICS=Object.freeze(['requests','errors','p95LatencyMs','indexLagBlocks','finalityLagBlocks','authorizationDenials','moderationPolicyFailures','privacyIncidents','authBoundaryFailures','reorgConsistencyFailures']);
const KEYS=new Set(['environment','releaseId','windowStartMs','windowEndMs',...METRICS]);
const NUMERIC=new Set(METRICS);
const EVENT_COUNTERS=new Set(['requests','errors','authorizationDenials','moderationPolicyFailures','privacyIncidents','authBoundaryFailures','reorgConsistencyFailures']);
const safeInt=n=>Number.isSafeInteger(n)&&n>=0;
const finite=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.size&&Object.keys(value).every(key=>keys.has(key));
const invalid=reason=>Object.freeze({state:'blocked',reasons:Object.freeze([reason]),alerts:Object.freeze([]),operatorActionRequired:true});
const alert=(code,severity,owner)=>Object.freeze({code,severity,owner});

/** A validated aggregate window has NO user IDs, wallet addresses, IPs,
 * tokens, endpoint URLs, resource IDs, freeform labels, event payloads or
 * message content. Reject unknown fields rather than silently redacting them.
 */
export function validateAggregateWindow(window){
 if(!exact(window,KEYS)||!ENVIRONMENTS.has(window.environment)||
   typeof window.releaseId!=='string'||!/^[-a-zA-Z0-9_.]{1,80}$/.test(window.releaseId)||
   !safeInt(window.windowStartMs)||!safeInt(window.windowEndMs)||
   window.windowEndMs<=window.windowStartMs||window.windowEndMs-window.windowStartMs>3_600_000)return false;
 for(const key of NUMERIC)if(!(EVENT_COUNTERS.has(key)?safeInt(window[key]):finite(window[key])))return false;
 return window.errors<=window.requests;
}

/** Configuration is provided by authenticated operations control-plane code.
 * The named owner is a static team alias, NOT an email or account identifier.
 * No alert sender is included; a separately qualified pager must consume the
 * returned fixed-code alerts. Fail closed on missing, stale or invalid data.
 */
export function evaluateObservability({window,policy,nowMs}={}){
 if(!validateAggregateWindow(window))return invalid('invalid_aggregate_window');
 const required=new Set(['environment','releaseId','ownerTeam','retentionHours','maxWindowAgeMs','minRequests','maxErrorRate','maxP95LatencyMs','maxIndexLagBlocks','maxFinalityLagBlocks']);
 if(!exact(policy,required)||policy.environment!==window.environment||policy.releaseId!==window.releaseId||
   typeof policy.ownerTeam!=='string'||! /^[a-z][a-z0-9-]{1,39}$/.test(policy.ownerTeam)||
   !safeInt(policy.retentionHours)||policy.retentionHours<1||policy.retentionHours>168||
   !safeInt(policy.maxWindowAgeMs)||policy.maxWindowAgeMs<1||policy.maxWindowAgeMs>3_600_000||
   !safeInt(policy.minRequests)||policy.minRequests<1||!finite(policy.maxErrorRate)||policy.maxErrorRate>1||
   !finite(policy.maxP95LatencyMs)||policy.maxP95LatencyMs<=0||
   !safeInt(policy.maxIndexLagBlocks)||!safeInt(policy.maxFinalityLagBlocks))return invalid('invalid_observability_policy');
 if(!safeInt(nowMs)||window.windowEndMs>nowMs||nowMs-window.windowEndMs>policy.maxWindowAgeMs)return invalid('missing_or_stale_measurement');
 const alerts=[];
 if(window.privacyIncidents>0)alerts.push(alert('privacy_incident','critical',policy.ownerTeam));
 if(window.authBoundaryFailures>0)alerts.push(alert('authorization_boundary_failure','critical',policy.ownerTeam));
 if(window.moderationPolicyFailures>0)alerts.push(alert('moderation_policy_failure','critical',policy.ownerTeam));
 if(window.reorgConsistencyFailures>0)alerts.push(alert('reorg_consistency_failure','critical',policy.ownerTeam));
 if(window.indexLagBlocks>policy.maxIndexLagBlocks)alerts.push(alert('index_lag_exceeded','warning',policy.ownerTeam));
 if(window.finalityLagBlocks>policy.maxFinalityLagBlocks)alerts.push(alert('finality_lag_exceeded','warning',policy.ownerTeam));
 if(window.p95LatencyMs>policy.maxP95LatencyMs)alerts.push(alert('latency_exceeded','warning',policy.ownerTeam));
 if(window.requests<policy.minRequests)return Object.freeze({state:'blocked',reasons:Object.freeze(['insufficient_sample']),alerts:Object.freeze(alerts),operatorActionRequired:true});
 if(window.errors/window.requests>policy.maxErrorRate)alerts.push(alert('error_rate_exceeded','warning',policy.ownerTeam));
 return Object.freeze({state:alerts.some(item=>item.severity==='critical')?'critical':alerts.length?'warning':'within_declared_limits',reasons:Object.freeze([]),alerts:Object.freeze(alerts),operatorActionRequired:alerts.length>0});
}
