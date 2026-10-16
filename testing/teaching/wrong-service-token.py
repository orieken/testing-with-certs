"""Create one disposable SPNEGO token for the deliberately wrong lesson service.

Stdout is a credential transport to the test process, never a log/report stream.
No keytab or administrator secret is needed; only the service-only ticket cache.
"""
import base64
import ctypes as c
import os
import sys

if os.environ.get('KRB5CCNAME') != 'FILE:/tickets/wrong-service-cache':
    raise SystemExit('Wrong-service fixture cache required')

class Buffer(c.Structure):
    _fields_ = [('length', c.c_size_t), ('value', c.c_void_p)]

class Oid(c.Structure):
    _fields_ = [('length', c.c_uint32), ('elements', c.c_void_p)]

lib = c.CDLL('libgssapi_krb5.so.2')
minor = c.c_uint32()
name = c.c_void_p()
context = c.c_void_p()
raw = c.create_string_buffer(b'HTTP@wrong.magic.test')
source = Buffer(len(raw.value), c.cast(raw, c.c_void_p))
name_type = c.c_void_p.in_dll(lib, 'gss_nt_service_name')
lib.gss_import_name.argtypes = [c.POINTER(c.c_uint32), c.POINTER(Buffer), c.c_void_p, c.POINTER(c.c_void_p)]
lib.gss_import_name.restype = c.c_uint32
if lib.gss_import_name(c.byref(minor), c.byref(source), name_type, c.byref(name)) != 0:
    raise SystemExit('Wrong-service GSS name initialization failed')
spnego_bytes = c.create_string_buffer(b'\x2b\x06\x01\x05\x05\x02')
spnego = Oid(6, c.cast(spnego_bytes, c.c_void_p))
output = Buffer()
lib.gss_init_sec_context.argtypes = [c.POINTER(c.c_uint32), c.c_void_p, c.POINTER(c.c_void_p), c.c_void_p,
    c.POINTER(Oid), c.c_uint32, c.c_uint32, c.c_void_p, c.c_void_p, c.c_void_p,
    c.POINTER(Buffer), c.c_void_p, c.c_void_p]
lib.gss_init_sec_context.restype = c.c_uint32
status = lib.gss_init_sec_context(c.byref(minor), None, c.byref(context), name,
    c.byref(spnego), 0, 0, None, None, None, c.byref(output), None, None)
if status not in (0, 1) or not 1 <= output.length <= 65536:
    raise SystemExit('Wrong-service GSS token creation failed')
# Process termination releases the single short-lived GSS context and buffers.
sys.stdout.write(base64.b64encode(c.string_at(output.value, output.length)).decode('ascii'))
