"""R02.5 trusted ingress and read-only Travel/Maps response facade.

Only a server-owned verifier may supply session, credentials, policy and geofence.
The projection API exposes no courier locations, counts, identifiers or writes.
"""
from dataclasses import asdict
from datetime import datetime, timedelta, timezone
from uuid import UUID
from .auth import Denied
from .courier import verify_courier
from .region_presence import Presence, project_region

def ingest_presence(*, connect, session, courier_id, region_id, jurisdiction,
                    carrier_class, vehicle_ref, credentials, credential_authority,
                    courier_policy, region_policy_authority, capacity, latitude,
                    longitude, at=None, lifetime_seconds=90):
    at=at or datetime.now(timezone.utc)
    if (at.tzinfo is None or not 1<=lifetime_seconds<=120
        or type(capacity) is not int or not 0<=capacity<=100
        or type(latitude) not in (float,int) or type(longitude) not in (float,int)
        or not -90<=latitude<=90 or not -180<=longitude<=180
        or session.revoked or session.expires_at<=at or session.actor_id!=courier_id
        or not session.tenant_id):
        raise Denied("invalid or unauthenticated courier update")
    try:
        tenant_id=str(UUID(session.tenant_id))
        courier_id=str(UUID(courier_id))
        region_id=str(UUID(region_id))
        eligible=verify_courier(tenant_id=tenant_id,courier_id=courier_id,
            carrier_class=carrier_class,jurisdiction=jurisdiction,
            vehicle_ref=vehicle_ref,credentials=credentials,
            authority=credential_authority,policy=courier_policy,at=at)
        p=region_policy_authority.verify(tenant_id=tenant_id,region_id=region_id,at=at)
        if (not p.approved or p.region_id!=region_id or p.expires_at.tzinfo is None
            or p.expires_at<=at or not p.version or p.anonymity_floor<3):
            raise Denied("420Compliance region not approved")
        with connect() as db:
            with db.transaction():
                with db.cursor() as c:
                    c.execute("SELECT set_config('doobr.tenant_id', %s, true)",(tenant_id,))
                    c.execute("""SELECT state FROM doobr_private.actors
                                  WHERE tenant_id=%s AND actor_id=%s AND kind='COURIER'
                                  FOR UPDATE""",(tenant_id,courier_id))
                    if c.fetchone()!=("ACTIVE",):
                        raise Denied("courier account inactive")
                    c.execute("""SELECT ST_Covers(boundary, ST_SetSRID(ST_Point(%s,%s),4326)),
                                         country_code,province_code,municipality_ref
                                  FROM doobr_private.service_regions
                                  WHERE tenant_id=%s AND region_id=%s""",
                              (longitude,latitude,tenant_id,region_id))
                    r=c.fetchone()
                    if r is None or r[0] is not True:
                        raise Denied("courier outside approved geofence")
                    # Jurisdiction is not client authority; it must match the stored area.
                    if jurisdiction!=f"{r[1]}-{r[2]}-{r[3]}":
                        raise Denied("jurisdiction/region mismatch")
                    c.execute("""INSERT INTO doobr_private.courier_region_presence
                                  (tenant_id,courier_id,region_id,capacity,eligibility_verified_at,
                                   updated_at,expires_at)
                                  VALUES (%s,%s,%s,%s,%s,%s,%s)
                                  ON CONFLICT (tenant_id,courier_id) DO UPDATE SET
                                  region_id=EXCLUDED.region_id,capacity=EXCLUDED.capacity,
                                  eligibility_verified_at=EXCLUDED.eligibility_verified_at,
                                  updated_at=EXCLUDED.updated_at,expires_at=EXCLUDED.expires_at
                                  WHERE doobr_private.courier_region_presence.updated_at<=EXCLUDED.updated_at""",
                              (tenant_id,courier_id,region_id,capacity,at,at,
                               min(at+timedelta(seconds=lifetime_seconds),p.expires_at)))
                    if c.rowcount!=1:
                        raise Denied("stale or replayed presence")
        return eligible.checked_at
    except Denied:
        raise
    except Exception as exc:
        raise Denied("trusted presence ingestion unavailable") from exc

def read_travel_maps_region(*, load_region, tenant_id, region_id, policy_authority, at=None):
    """Private trusted caller provides tenant+region. No HTTP endpoint/credentials invented."""
    at=at or datetime.now(timezone.utc)
    try:
        region_code,presence=load_region(tenant_id=tenant_id,region_id=region_id,at=at)
        result=project_region(tenant_id=tenant_id,region_id=region_id,
            region_code=region_code,presence=presence,policy_authority=policy_authority,at=at)
        return {"schema":"doobr-region/v1",**asdict(result)}
    except Denied:
        raise
    except Exception as exc:
        raise Denied("coarse regional projection unavailable") from exc
