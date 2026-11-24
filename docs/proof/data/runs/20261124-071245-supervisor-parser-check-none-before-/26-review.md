The change does what the issue asks: `NONE` is checked before any candidate id, ids outside `state.options` are dropped from the allowed set, the hyphen case parses, and the parametrized test covers each named case plus the HTTP error path. Both new parser tests fail on the old code, so they guard the fixes. Nothing unrelated is touched; only the supervisor module and its test file change.

One behaviour change to be aware of, which the issue implies: on the reasoning-fallback path, an uppercase `NONE` anywhere in the 200-character tail now forces abstention even if a valid id appears later. That matches "NONE must win", so I am not requesting a change.

```json
{"verdict": "approve", "summary": "The parser now checks NONE first, rejects candidate ids that are not in state.options, accepts a hyphen-preceded id such as -E1, and adds a parametrized test covering E1 vs E12, trailing punctuation, the three parser fixes and the HTTP error path. The change is confined to the supervisor module and its tests.", "comments": [], "out_of_scope": []}
```