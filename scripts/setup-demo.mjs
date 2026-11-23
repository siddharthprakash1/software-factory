// Creates .factory/demo-repo: a throwaway git repository copied from examples/demo-repo,
// so the factory has something to work on out of the box.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT, DATA } from '../src/paths.mjs';

const target = path.join(DATA, 'demo-repo');
if (fs.existsSync(target)) {
  console.log(`Demo repo already exists at ${target}`);
  process.exit(0);
}

fs.cpSync(path.join(ROOT, 'examples', 'demo-repo'), target, { recursive: true });
const git = (...args) => execFileSync('git', args, { cwd: target, stdio: 'ignore' });
git('init', '-b', 'main');
git('add', '-A');
git('-c', 'user.name=demo', '-c', 'user.email=demo@localhost', 'commit', '-m', 'Initial demo library');
console.log(`Demo repo created at ${target}`);
