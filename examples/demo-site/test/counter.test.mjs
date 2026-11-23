import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCounter } from '../src/counter.mjs';

test('increments and decrements', () => {
  const c = createCounter();
  c.increment();
  c.increment();
  c.decrement();
  assert.equal(c.value, 1);
});
