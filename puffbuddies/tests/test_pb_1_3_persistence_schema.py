import pathlib,sys,unittest
ROOT=pathlib.Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT))
from puffbuddies.persistence.schema import *

class PB13SchemaTests(unittest.TestCase):
 def test_required_private_state_classes_exist(self):
  self.assertEqual(set(TABLES),{"profile","eligibility_projection","preferences","visibility","verification","entitlement","relationship","safety","lifecycle","location","cannabis","matching_input"})
 def test_no_public_or_external_authority_tables(self):
  self.assertFalse(PUBLIC_TABLES);self.assertFalse(EXTERNAL_CANONICAL_TABLES)
  self.assertTrue(all(t.owner=="puffbuddies" for t in TABLES.values()))
 def test_identity_source_evidence_not_persisted(self):
  e=TABLES["eligibility_projection"];self.assertNotIn("date_of_birth",e.fields);self.assertNotIn("raw_identity_evidence",e.fields);self.assertIn("decision",e.fields)
 def test_wallet_profile_link_not_schema_field(self):
  for t in TABLES.values(): self.assertNotIn("wallet_address",t.fields);self.assertNotIn("public_wallet_link",t.fields)
 def test_relationship_graph_is_private(self):
  self.assertEqual(TABLES["relationship"].sensitivity,Sensitivity.HIGHLY_SENSITIVE);self.assertIn("public_match_graph",DERIVED_ONLY)
 def test_location_does_not_expose_precise_coordinates(self):
  l=TABLES["location"];self.assertNotIn("latitude",l.fields);self.assertNotIn("longitude",l.fields);self.assertNotIn("raw_gps_history",l.fields)
 def test_safety_retention_requires_purpose(self):
  s=TABLES["safety"];self.assertEqual(s.delete_class,DeleteClass.PURPOSE_LIMITED_RETENTION);self.assertIn("retention_reason",s.fields)
 def test_ordinary_private_state_is_deletable(self):
  for n in ("profile","eligibility_projection","preferences","visibility","verification","entitlement","relationship","lifecycle","location","cannabis","matching_input"):
   self.assertEqual(TABLES[n].delete_class,DeleteClass.ORDINARY_DELETE)
 def test_entitlement_is_private_and_excludes_payment_or_interpersonal_authority(self):
  e=TABLES["entitlement"]
  self.assertEqual(e.sensitivity,Sensitivity.PRIVATE)
  for field in ("payment_ref","invoice_ref","payer_ref","wallet_address","receipt_hash","settlement_amount",
                "block_override","messaging_authorized","private_profile_access"):
   self.assertIn(field,e.forbidden_fields);self.assertNotIn(field,e.fields)
 def test_verification_is_private_and_excludes_raw_or_scored_material(self):
  v=TABLES["verification"]
  self.assertEqual(v.sensitivity,Sensitivity.HIGHLY_SENSITIVE)
  for field in ("proof_bytes","credential_payload","government_id_image","biometric_template","wallet_address",
                "reputation_score","trust_score","desirability_score","report_count","block_count","risk_score"):
   self.assertIn(field,v.forbidden_fields);self.assertNotIn(field,v.fields)
 def test_cannabis_remains_private(self): self.assertEqual(TABLES["cannabis"].sensitivity,Sensitivity.HIGHLY_SENSITIVE)
 def test_version_fields_support_stale_invalidation(self):
  for n,t in TABLES.items(): self.assertTrue("version" in t.fields or "visibility_version" in t.fields or n=="eligibility_projection")
 def test_forbidden_secret_and_public_identity_material(self):
  for t in TABLES.values():
   self.assertTrue(COMMON_FORBIDDEN.issubset(t.forbidden_fields));self.assertTrue(t.fields.isdisjoint(t.forbidden_fields))

if __name__=="__main__":unittest.main()
