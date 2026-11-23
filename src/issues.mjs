import fs from 'node:fs';
import path from 'node:path';
import { getIssue } from './github.mjs';
import { repoByGithub } from './config.mjs';

// Text from issues and comments ends up in agent prompts. Remove what a person reading the page
// would not see: HTML comments and invisible characters are the usual hiding places for injected
// instructions.
export const sanitize = (text) =>
  String(text ?? '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/g, '');

// An issue is a markdown file (first line is the title), `gh:owner/repo#123`, or `<repo-name>#123`.
export function loadIssue(config, ref) {
  const m = ref.match(/^(?:gh:)?([^#\s]+)#(\d+)$/);
  if (m) {
    const slug = config.repos?.[m[1]]?.github ?? m[1];
    const repoName = repoByGithub(config, slug);
    if (!repoName) throw new Error(`no entry in config.repos has github: "${slug}"`);
    const issue = getIssue(slug, m[2]);
    return { ...issue, title: sanitize(issue.title), body: sanitize(issue.body), source: `gh:${slug}#${m[2]}`, repoName };
  }
  const text = fs.readFileSync(ref, 'utf8');
  const [first, ...rest] = text.trim().split(/\r?\n/);
  return { source: path.resolve(ref), title: first.replace(/^#+\s*/, '').trim(), body: rest.join('\n').trim() };
}
