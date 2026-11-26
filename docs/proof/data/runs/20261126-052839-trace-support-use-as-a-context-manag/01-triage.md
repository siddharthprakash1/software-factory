This is a small, clear feature. `Trace` in `src/surety/trace/jsonl.py` only opens the file in `__init__` and closes it in `close()`, so adding `__enter__` and `__exit__` is one obvious edit. The test file already shows the pattern to follow, and the change stays within the two files the issue allows.

**Plan**

- `src/surety/trace/jsonl.py`: add `__enter__`, which returns `self`, and `__exit__`, which calls `self.close()` and returns `None` so exceptions propagate. Keep `close()` as is.
- `tests/test_trace.py`: add a test that writes one row inside `with Trace(path) as t:`, then checks that the row is in the file and that `t.f.closed` is true afterwards. Optionally add a second test where the block raises, to confirm the file is still closed and the exception still propagates.

```json
{"decision": "automate", "complexity": "low", "kind": "feature", "reason": "Trace is a 17-line class that opens its file in __init__ and closes it in close(), so adding __enter__ and __exit__ is a single obvious edit. The issue names the only two files to touch, and the test file shows the existing style to follow.", "plan": "In src/surety/trace/jsonl.py, add __enter__ (returns self) and __exit__ (calls self.close(), returns None so exceptions propagate). In tests/test_trace.py, add a test that uses `with Trace(path) as t:` to record one row, then asserts the row is in the file and t.f.closed is True. Optionally add a test where the block raises, asserting the file is closed and the exception propagates."}
```