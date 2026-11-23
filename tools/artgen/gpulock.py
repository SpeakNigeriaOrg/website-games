"""One GPU job at a time: two image or vision models loaded together would run the 24 GB card out of memory.

    from gpulock import gpu_lock
    with gpu_lock():
        ... load the model and run ...

The lock is a file created exclusively; a lock older than 2 hours is treated as abandoned."""
import os
import time
from contextlib import contextmanager
from pathlib import Path

LOCK = Path(__file__).with_name(".gpu.lock")


@contextmanager
def gpu_lock(poll=10):
    while True:
        try:
            fd = os.open(LOCK, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
            os.write(fd, str(os.getpid()).encode())
            os.close(fd)
            break
        except FileExistsError:
            if time.time() - LOCK.stat().st_mtime > 7200:
                LOCK.unlink(missing_ok=True)
                continue
            print("waiting for the GPU lock...", flush=True)
            time.sleep(poll)
    try:
        yield
    finally:
        LOCK.unlink(missing_ok=True)
