#!/usr/bin/env python3
"""Minimal zipalign: rewrites an APK so every stored (uncompressed) entry starts on a 4-byte boundary
(.so files on 16 KB). Equivalent to `zipalign -p 4 in.apk out.apk` for APKs built by aapt2."""
import sys, zipfile

def align(src, dst):
    zin = zipfile.ZipFile(src)
    with open(dst, 'wb') as f:
        zout = zipfile.ZipFile(f, 'w')
        for info in zin.infolist():
            data = zin.read(info.filename)
            ni = zipfile.ZipInfo(info.filename, date_time=info.date_time)
            ni.compress_type = info.compress_type
            ni.external_attr = info.external_attr
            ni.create_system = info.create_system
            if info.compress_type == zipfile.ZIP_STORED:
                boundary = 16384 if info.filename.endswith('.so') else 4
                # local header = 30 bytes + name + extra; pad the extra field so data is aligned
                hdr = f.tell() + 30 + len(info.filename.encode('utf-8'))
                pad = (-hdr) % boundary
                ni.extra = b'\x00' * pad
            zout.writestr(ni, data)
        zout.close()

if __name__ == '__main__':
    align(sys.argv[1], sys.argv[2])
