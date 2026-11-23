import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

// An issue is either a markdown file (first line is the title) or `gh:owner/repo#123`.
export function loadIssue(ref) {
  const gh = ref.match(/^gh:([^#]+)#(\d+)$/);
  if (gh) {
    const out = execFileSync('gh', ['issue', 'view', gh[2], '--repo', gh[1], '--json', 'title,body,url'], { encoding: 'utf8' });
    const { title, body, url } = JSON.parse(out);
    return { source: ref, url, title, body: body ?? '' };
  }
  const text = fs.readFileSync(ref, 'utf8');
  const [first, ...rest] = text.trim().split(/\r?\n/);
  return { source: path.resolve(ref), title: first.replace(/^#+\s*/, '').trim(), body: rest.join('\n').trim() };
}
