"""Fail-closed private ingress admission controls, no externally exposed listener."""
from collections import defaultdict,deque
from threading import Lock
from time import monotonic
from .auth import Denied

class RateLimiter:
 def __init__(self,*,max_requests=20,window_seconds=60,clock=monotonic):
  self.max_requests=max_requests;self.window_seconds=window_seconds
  self.clock=clock;self.lock=Lock();self.events=defaultdict(deque)
 def check(self,key):
  if not isinstance(key,str) or not key:raise Denied("missing admission key")
  with self.lock:
   now=self.clock();q=self.events[key]
   while q and now-q[0]>=self.window_seconds:q.popleft()
   if len(q)>=self.max_requests:raise Denied("rate limited")
   q.append(now)

class PrivateTransport:
 """Enforce trusted TLS termination and externally verified device proof.

 A verifier MUST inspect signed proxy metadata or mutual TLS proofs and require
 unspoofable header stripping at proxy ingress; without verifier it fails closed.
 """
 def __init__(self,*,verifier,limiter):
  self.verifier=verifier;self.limiter=limiter
 def authenticate(self,*,environ):
  claims=self.verifier.verify_connection(environ=environ)
  if not isinstance(claims,dict):raise Denied("untrusted connection")
  if set(claims)!={"tenant_id","device_id","bearer_token","origin_ok","device_ok","csrf_ok"}:
   raise Denied("incomplete private identity")
  if not all(claims[x] is True for x in ("origin_ok","device_ok","csrf_ok")):
   raise Denied("private admission denied")
  self.limiter.check(str(claims["tenant_id"])+":"+str(claims["device_id"]))
  return claims
