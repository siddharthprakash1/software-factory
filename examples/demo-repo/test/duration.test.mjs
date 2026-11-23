import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatDuration } from '../src/duration.mjs';

test('formats hours, minutes and seconds', () => {
  assert.equal(formatDuration(3909), '1h 5m 9s');
});

test('omits zero units', () => {
  assert.equal(formatDuration(3600), '1h');
});
