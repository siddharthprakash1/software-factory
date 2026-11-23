import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatDuration } from '../src/duration.mjs';

test('keeps the largest units', () => {
  assert.equal(formatDuration(3909, { maxUnits: 2 }), '1h 5m');
  assert.equal(formatDuration(3909, { maxUnits: 1 }), '1h');
  assert.equal(formatDuration(3609, { maxUnits: 2 }), '1h 9s');
  assert.equal(formatDuration(3909, { maxUnits: 5 }), '1h 5m 9s');
});
test('default unchanged', () => assert.equal(formatDuration(3909), '1h 5m 9s'));
test('rejects bad maxUnits', () => {
  assert.throws(() => formatDuration(10, { maxUnits: 0 }), RangeError);
  assert.throws(() => formatDuration(10, { maxUnits: 1.5 }), RangeError);
});
