// Creates throwaway git repositories under .factory/ from the examples, so the factory has
// something to work on out of the box: demo-repo (a library) and demo-site (a page with a UI).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT, DATA } from '../src/paths.mjs';

for (const name of ['demo-repo', 'demo-site']) {
  const target = path.join(DATA, name);
  if (fs.existsSync(target)) {
    console.log(`${name} already exists at ${target}`);
    continue;
  }
  fs.cpSync(path.join(ROOT, 'examples', name), target, { recursive: true });
  const git = (...args) => execFileSync('git', args, { cwd: target, stdio: 'ignore' });
  git('init', '-b', 'main');
  git('add', '-A');
  git('-c', 'user.name=demo', '-c', 'user.email=demo@localhost', 'commit', '-m', `Initial ${name}`);
  console.log(`${name} created at ${target}`);
}
