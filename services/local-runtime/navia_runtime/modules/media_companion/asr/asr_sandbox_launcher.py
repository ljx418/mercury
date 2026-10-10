from __future__ import annotations

import ctypes
import errno
import os
import resource
import sys
from pathlib import Path


LOW_RESOURCE_MEMORY_BYTES = 8 * 1024**3
NETWORK_SYSCALLS = (
    "socket", "socketpair", "connect", "accept", "accept4", "bind", "listen",
    "sendto", "recvfrom", "sendmsg", "recvmsg", "shutdown",
)


def apply_limits() -> None:
    resource.setrlimit(resource.RLIMIT_AS, (LOW_RESOURCE_MEMORY_BYTES, LOW_RESOURCE_MEMORY_BYTES))
    try:
        available = sorted(os.sched_getaffinity(0))
        os.sched_setaffinity(0, set(available[:8]))
    except (AttributeError, OSError):
        pass

    library = ctypes.CDLL("libseccomp.so.2", use_errno=True)
    library.seccomp_init.restype = ctypes.c_void_p
    library.seccomp_syscall_resolve_name.argtypes = [ctypes.c_char_p]
    context = library.seccomp_init(ctypes.c_uint32(0x7FFF0000))
    if not context:
        raise OSError("seccomp_init failed")
    try:
        deny = ctypes.c_uint32(0x00050000 | errno.EPERM)
        for name in NETWORK_SYSCALLS:
            number = library.seccomp_syscall_resolve_name(name.encode("ascii"))
            if number < 0 or library.seccomp_rule_add(context, deny, number, 0) != 0:
                raise OSError(f"seccomp rule failed: {name}")
        if library.seccomp_load(context) != 0:
            raise OSError("seccomp_load failed")
    finally:
        library.seccomp_release(context)


def main() -> int:
    if len(sys.argv) < 2:
        return 125
    executable = Path(sys.argv[1])
    if not executable.is_absolute() or not executable.is_file() or executable.is_symlink():
        return 125
    try:
        apply_limits()
    except OSError:
        return 126
    os.execve(str(executable), [str(executable), *sys.argv[2:]], dict(os.environ))
    return 127


if __name__ == "__main__":
    raise SystemExit(main())
