"""Constrained public 420Travel destination resolver: not a booking or legal authority."""
import json
import os
import re
from urllib.parse import urlencode, urlsplit
from urllib.request import Request, build_opener, HTTPRedirectHandler

class NoTravelRedirect(HTTPRedirectHandler):
    def redirect_request(self,req,fp,code,msg,headers,newurl):
        raise TravelLocationUnavailable('TRAVEL_REDIRECT_FORBIDDEN')

class TravelLocationUnavailable(Exception):
    pass

def resolve_public_place(place_id: str, *, base_url=None, fetch=None):
    if not re.fullmatch(r"[A-Za-z0-9_-]{1,128}",place_id):
        raise ValueError("INVALID_PLACE_ID")
    base=(base_url if base_url is not None else os.getenv("BNB_TRAVEL_PUBLIC_URL","")).strip().rstrip("/")
    if not base:
        raise TravelLocationUnavailable("TRAVEL_NOT_CONFIGURED")
    parsed=urlsplit(base)
    if parsed.scheme!="https" or not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment or parsed.path not in ("","/"):
        raise TravelLocationUnavailable("TRAVEL_ENDPOINT_NOT_TRUSTED")
    endpoint=base+"/travel/api/v1/places?"+urlencode({"destination":""})
    try:
        if fetch is None:
            with build_opener(NoTravelRedirect()).open(Request(endpoint,headers={"Accept":"application/json","Cache-Control":"no-store"}),timeout=4) as response:
                if response.status!=200:raise TravelLocationUnavailable("TRAVEL_UNAVAILABLE")
                raw=response.read(262145)
        else:
            raw=fetch(endpoint)
        if len(raw)>262144:raise TravelLocationUnavailable("TRAVEL_RESPONSE_TOO_LARGE")
        document=json.loads(raw)
        if not isinstance(document,dict) or document.get("state") not in ("ready","empty") or not isinstance(document.get("places",[]),list):
            raise TravelLocationUnavailable("TRAVEL_INVALID_RESPONSE")
        matches=[p for p in document.get("places",[]) if isinstance(p,dict) and p.get("id")==place_id]
        if len(matches)!=1:raise TravelLocationUnavailable("PUBLIC_PLACE_NOT_AVAILABLE")
        item=matches[0]
        for key in ("id","name","region","country"):
            if not isinstance(item.get(key),str) or len(item[key])>128:raise TravelLocationUnavailable("TRAVEL_INVALID_PLACE")
        if type(item.get("approximate")) is not bool:raise TravelLocationUnavailable("TRAVEL_INVALID_PRECISION")
        if not item["region"].strip() or not item["country"].strip():raise TravelLocationUnavailable("TRAVEL_NO_REGION")
        return {"place_id":item["id"],"name":item["name"],"region":item["region"],"country":item["country"],"approximate":item["approximate"],"latitude":None,"longitude":None}
    except (OSError,ValueError,TypeError,KeyError,UnicodeDecodeError) as exc:
        raise TravelLocationUnavailable("TRAVEL_UNAVAILABLE") from exc
