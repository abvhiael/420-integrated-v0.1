import unittest
from consensus import SOURCE
from verify_native_scripts import validate_build_identity
class NativeIdentityTests(unittest.TestCase):
    def test_retained_or_new_source_verified_binary_identity(self):
        a={'source_commit':SOURCE,'source_modified':False,'consensus_library_sha256':'retained'}
        validate_build_identity(a,None,'retained')
        # A reproducible source build may differ in compiler/path-specific bytes.
        # Its own source-verified build receipt authenticates the actual artifact.
        b={'source':SOURCE,'modified_native_sources':False,'consensus_library_sha256':'new-build'}
        validate_build_identity(a,b,'new-build')
        with self.assertRaises(ValueError):validate_build_identity(a,None,'unapproved')
    def test_modified_or_mismatched_build_is_rejected(self):
        a={'source_commit':SOURCE,'source_modified':False,'consensus_library_sha256':'retained'}
        for b in [{'source':'wrong','modified_native_sources':False,'consensus_library_sha256':'new-build'},{'source':SOURCE,'modified_native_sources':True,'consensus_library_sha256':'new-build'},{'source':SOURCE,'modified_native_sources':False,'consensus_library_sha256':'wrong'}]:
            with self.assertRaises(ValueError):validate_build_identity(a,b,'new-build')
if __name__=='__main__':unittest.main()
