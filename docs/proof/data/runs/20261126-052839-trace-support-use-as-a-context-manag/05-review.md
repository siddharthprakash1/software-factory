The change does what the issue asks. `__enter__` returns the trace, and `__exit__` calls `close()` and returns `None`, so exceptions from the block still propagate. The first new test covers the write and the close on normal exit. The second covers the close when the block raises, and checks that the exception is not swallowed. Both tests exercise the requested behaviour, and nothing outside the two named files changed.

```json
{"verdict": "approve", "summary": "Adds __enter__ and __exit__ to Trace so it can be used in a with block, closing the file on exit including when the block raises. Two tests cover the normal path (row written, file closed) and the exception path (file closed, exception propagated, row written).", "comments": [], "out_of_scope": []}
```