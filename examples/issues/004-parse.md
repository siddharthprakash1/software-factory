# Add parseDuration, the inverse of formatDuration

We need a `parseDuration("1d 2h")` that returns seconds. The accepted grammar is not decided yet (unit order, repeated units, whitespace, uppercase, decimals), so this needs a written spec approved by a maintainer before any code is written.
