`Trace` now works as a context manager, and the full suite passes (`uv run pytest -q`: 185 passed, 1 skipped).

**Changes**

- **`src/surety/trace/jsonl.py`**: added `__enter__`, which returns the trace, and `__exit__`, which calls `close()` and returns `None` so exceptions from the block still propagate.
- **`tests/test_trace.py`**: added two tests.
  - The first uses `with Trace(path) as t:` to record one row, then checks the row is in the file and `t.f.closed` is True.
  - The second raises inside the block and checks the exception propagates, the file is closed, and the row was written.

Before the change, both new tests fail with `AttributeError` on `__enter__`, so they cover the new behaviour. I did not commit or switch branches.