import { test } from 'node:test';
import assert from 'node:assert/strict';
import { world, reply } from './helpers.mjs';

const happy = { triage: [reply.automate()], implement: [reply.write('fixed\n')], review: [reply.approve()] };

test('an issue goes from triage to a committed branch', (t) => {
  const w = world(happy);
  t.after(w.cleanup);
  const { code, out } = w.factory('run', w.issueFile);
  assert.equal(code, 0, out);
  const run = w.run();
  assert.equal(run.status, 'ready_for_review');
  assert.deepEqual(w.stages(run), ['triage', 'implement', 'verify', 'review', 'deliver']);
  assert.equal(run.iteration, 1);
  assert.equal(w.git(w.target, 'show', `${run.branch}:app.txt`), 'fixed');
  assert.equal(w.git(w.target, 'show', 'main:app.txt'), 'original', 'main is untouched');
  assert.ok(Math.abs(run.costUsd - 0.03) < 1e-9, 'three agent calls at 0.01 each');
});

test('a failing check sends its output back to implement, and the lesson is saved', (t) => {
  const w = world({
    ...happy,
    implement: [reply.write('still broken\n'), reply.write('fixed\n')],
    learn: [{ text: '- Run node check.mjs before finishing.' }],
  });
  t.after(w.cleanup);
  w.factory('run', w.issueFile);
  const run = w.run();
  assert.equal(run.status, 'ready_for_review');
  assert.equal(run.iteration, 2);
  assert.deepEqual(w.stages(run), ['triage', 'implement', 'verify', 'implement', 'verify', 'review', 'deliver', 'learn']);
  const second = w.calls('implement')[1].prompt;
  assert.match(second, /feedback_on_previous_attempt/);
  assert.match(second, /app\.txt is not fixed/);
  assert.match(w.memory(), /Run node check\.mjs/);
});

test('lessons from memory reach later runs', (t) => {
  const w = world({ ...happy, implement: [reply.write('nope\n'), reply.write('fixed\n')], learn: [{ text: '- Remember the check.' }] });
  t.after(w.cleanup);
  w.factory('run', w.issueFile);
  w.factory('run', w.issueFile);
  for (const stage of ['triage', 'implement', 'review']) {
    assert.match(w.calls(stage).at(-1).prompt, /Remember the check/, `${stage} prompt carries the lesson`);
  }
});

test('review comments send the change back to implement', (t) => {
  const w = world({ ...happy, review: [reply.reject('handle the empty case'), reply.approve()], learn: [{ text: 'NO_CHANGE' }] });
  t.after(w.cleanup);
  w.factory('run', w.issueFile);
  const run = w.run();
  assert.equal(run.status, 'ready_for_review');
  assert.equal(run.iteration, 2);
  assert.match(w.calls('implement')[1].prompt, /handle the empty case/);
  assert.equal(w.memory(), null, 'NO_CHANGE leaves memory alone');
});

test('the reviewer is told which checks already passed', (t) => {
  const w = world(happy);
  t.after(w.cleanup);
  w.factory('run', w.issueFile);
  assert.match(w.calls('review')[0].prompt, /already ran these checks.*node check\.mjs/s);
});

test('the implement model follows triage complexity', (t) => {
  const w = world({ ...happy, triage: [reply.automate('high')] });
  t.after(w.cleanup);
  w.factory('run', w.issueFile);
  assert.equal(w.calls('implement')[0].model, 'opus');
});

test('a run that keeps failing stops and asks for a person', (t) => {
  const w = world({ ...happy, implement: [reply.write('broken\n')] });
  t.after(w.cleanup);
  w.factory('run', w.issueFile);
  const run = w.run();
  assert.equal(run.status, 'needs_human');
  assert.equal(run.iteration, 3);
  assert.match(run.note, /still failing after 3 attempts/);
});

test('a stuck run can be resumed with guidance', (t) => {
  const w = world({ ...happy, implement: [reply.write('broken\n'), reply.write('broken\n'), reply.write('broken\n'), reply.write('fixed\n')] });
  t.after(w.cleanup);
  w.factory('run', w.issueFile);
  const { out } = w.factory('resume', w.run().id, '--feedback', 'write the word fixed');
  const run = w.run();
  assert.equal(run.status, 'ready_for_review', out);
  assert.match(w.calls('implement').at(-1).prompt, /write the word fixed/);
});

test('the budget stops a run before the next agent call', (t) => {
  const w = world(happy, { config: { budgetUsd: 0.015 } });
  t.after(w.cleanup);
  w.factory('run', w.issueFile);
  const run = w.run();
  assert.equal(run.status, 'needs_human');
  assert.match(run.note, /budget/);
  assert.equal(w.calls('review').length, 0);
});

test('a vague issue is parked, and an answer re-triages it', (t) => {
  const w = world({ ...happy, triage: [reply.park(), reply.automate()] });
  t.after(w.cleanup);
  w.factory('run', w.issueFile);
  assert.equal(w.run().status, 'parked');
  assert.equal(w.calls('implement').length, 0);
  w.factory('resume', w.run().id, '--feedback', 'it is the settings screen');
  assert.equal(w.run().status, 'ready_for_review');
  assert.match(w.calls('triage')[1].prompt, /it is the settings screen/);
});

test('an issue needing a spec waits for approval before any code is written', (t) => {
  const w = world({ ...happy, triage: [reply.needsSpec()], spec: [{ text: '# Spec\nDo the thing.' }] });
  t.after(w.cleanup);
  w.factory('run', w.issueFile);
  assert.equal(w.run().status, 'awaiting_spec_approval');
  assert.equal(w.calls('implement').length, 0);
  w.factory('resume', w.run().id);
  assert.equal(w.run().status, 'ready_for_review');
  assert.match(w.calls('implement')[0].prompt, /approved_spec[\s\S]*Do the thing/);
});

test('an agent error pauses the run instead of crashing it', (t) => {
  const w = world({ ...happy, implement: [{ text: 'rate limited', error: true }] });
  t.after(w.cleanup);
  const { code } = w.factory('run', w.issueFile);
  assert.equal(code, 0);
  assert.equal(w.run().status, 'needs_human');
  assert.match(w.run().note, /implement agent failed/);
});

test('an agent that changes nothing is told so', (t) => {
  const w = world({ ...happy, implement: [{ text: 'nothing to do' }, reply.write('fixed\n')] });
  t.after(w.cleanup);
  w.factory('run', w.issueFile);
  assert.equal(w.run().status, 'ready_for_review');
  assert.match(w.calls('implement')[1].prompt, /without changing any files/);
});

test('two runs started in the same second get different ids', (t) => {
  const w = world(happy);
  t.after(w.cleanup);
  for (let i = 0; i < 4; i++) assert.equal(w.factory('run', w.issueFile).code, 0);
  assert.equal(new Set(w.runs().map((r) => r.id)).size, 4);
  assert.ok(w.runs().every((r) => r.status === 'ready_for_review'));
});

test('retro counts what sent work back and asks for proposals', (t) => {
  const w = world({
    ...happy,
    implement: [reply.write('broken\n'), reply.write('fixed\n')],
    learn: [{ text: 'NO_CHANGE' }],
    retro: [{ text: '1. Tell implement to run the check first.' }],
  });
  t.after(w.cleanup);
  w.factory('run', w.issueFile);
  const { out } = w.factory('retro');
  assert.match(out, /1 needed retries/);
  assert.match(out, /- checks: 1/);
  assert.match(out, /Tell implement to run the check first/);
  assert.match(w.calls('retro')[0].prompt, /app\.txt is not fixed/);
});
