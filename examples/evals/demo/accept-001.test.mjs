import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatDuration } from '../src/duration.mjs';

test('zero is 0s', () => assert.equal(formatDuration(0), '0s'));
test('days', () => {
  assert.equal(formatDuration(90061), '1d 1h 1m 1s');
  assert.equal(formatDuration(86400), '1d');
  assert.equal(formatDuration(172800 + 59), '2d 59s');
});
test('existing output unchanged', () => assert.equal(formatDuration(3909), '1h 5m 9s'));
test('rejects bad input', () => {
  assert.throws(() => formatDuration(-1), RangeError);
  assert.throws(() => formatDuration(1.5), RangeError);
});
