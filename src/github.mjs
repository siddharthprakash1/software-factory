import { execFileSync } from 'node:child_process';

// Every comment the factory posts carries this marker so it never reacts to its own words.
export const MARKER = '<!-- software-factory -->';

const gh = (args, input) =>
  execFileSync('gh', args, { encoding: 'utf8', input, stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 32 * 1024 * 1024 }).trim();
const api = (route) => JSON.parse(gh(['api', '--paginate', route]) || '[]');

export function getIssue(slug, number) {
  const { title, body, url } = JSON.parse(gh(['issue', 'view', String(number), '--repo', slug, '--json', 'title,body,url']));
  return { title, body: body ?? '', url, github: slug, number: Number(number) };
}

export const listLabeledIssues = (slug, label) =>
  JSON.parse(gh(['issue', 'list', '--repo', slug, '--label', label, '--state', 'open', '--limit', '50', '--json', 'number,title']));

export const listOpenIssueTitles = (slug) =>
  JSON.parse(gh(['issue', 'list', '--repo', slug, '--state', 'open', '--limit', '100', '--json', 'title'])).map((i) => i.title);

export function createIssue(slug, title, body, labels = []) {
  const args = ['issue', 'create', '--repo', slug, '--title', title, '--body-file', '-'];
  for (const l of labels) args.push('--label', l);
  return gh(args, body);
}

export function ensureLabel(slug, name, description) {
  try {
    gh(['label', 'create', name, '--repo', slug, '--description', description, '--color', '5319e7']);
  } catch {} // already exists
}

// Works for issues and pull requests alike.
export const comment = (slug, number, body) =>
  gh(['issue', 'comment', String(number), '--repo', slug, '--body-file', '-'], `${body}\n\n${MARKER}`);

// Human comments on an issue or PR made after `since` (ISO time): conversation, inline review, review summaries.
export function humanCommentsSince(slug, number, since, { isPr = false } = {}) {
  const items = api(`repos/${slug}/issues/${number}/comments`).map((c) => ({ at: c.created_at, body: c.body }));
  if (isPr) {
    for (const c of api(`repos/${slug}/pulls/${number}/comments`)) {
      items.push({ at: c.created_at, body: `On \`${c.path}\`${c.line ? ` line ${c.line}` : ''}: ${c.body}` });
    }
    for (const r of api(`repos/${slug}/pulls/${number}/reviews`)) {
      if (r.body) items.push({ at: r.submitted_at, body: r.body });
    }
  }
  return items
    .filter((c) => c.body && !c.body.includes(MARKER) && (!since || c.at > since))
    .sort((a, b) => a.at.localeCompare(b.at));
}

export function createPr(slug, { head, base, title, body, cwd }) {
  return execFileSync('gh', ['pr', 'create', '--repo', slug, '--head', head, '--base', base, '--title', title, '--body-file', '-'], {
    cwd,
    encoding: 'utf8',
    input: body,
  }).trim();
}

export const prState = (slug, number) =>
  JSON.parse(gh(['pr', 'view', String(number), '--repo', slug, '--json', 'state'])).state; // OPEN | MERGED | CLOSED

export const prNumber = (url) => Number(url.match(/\/pull\/(\d+)/)?.[1]);

export function failedCiRuns(slug, limit = 3) {
  try {
    const runs = JSON.parse(gh(['run', 'list', '--repo', slug, '--status', 'failure', '--limit', String(limit), '--json', 'databaseId,name,headBranch,createdAt']));
    return runs.map((r) => {
      let log = '';
      try {
        log = gh(['run', 'view', String(r.databaseId), '--repo', slug, '--log-failed']).slice(-4000);
      } catch {}
      return { ...r, log };
    });
  } catch {
    return [];
  }
}
