import unittest,tempfile
from pathlib import Path
from hashlib import sha256
from acquire import validate_cached
class AcquisitionTests(unittest.TestCase):
    def test_cached_raw_requires_exact_bytes_not_just_size(self):
        with tempfile.TemporaryDirectory() as folder:
            path=Path(folder)/'blk00000.dat';path.write_bytes(b'authentic');validate_cached(path,9,sha256(b'authentic').hexdigest())
            path.write_bytes(b'forged!!!')
            with self.assertRaises(ValueError):validate_cached(path,9,sha256(b'authentic').hexdigest())
            with self.assertRaises(ValueError):validate_cached(path,10,sha256(b'forged!!!').hexdigest())
if __name__=='__main__':unittest.main()
