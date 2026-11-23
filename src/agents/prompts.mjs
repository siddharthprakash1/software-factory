const issueBlock = (issue) => `<issue>
Title: ${issue.title}

${issue.body}
</issue>`;

export const triagePrompt = (issue) => `You are the triage agent of a software factory. You are in a checkout of the repository the issue is about. Read the relevant code, then decide how the issue should be handled. Do not change any files.

${issueBlock(issue)}

Decide one of:
- "automate": the change is clear and small enough for an agent to implement and for tests to verify.
- "needs_spec": the goal is clear but the scope or design needs a written spec that a human approves first.
- "park": the issue is ambiguous, not reproducible, or not something to act on. Say what information is missing.

Also rate complexity: "low" (one obvious edit), "medium" (several files or some design), "high" (cross-cutting or risky).

End your answer with exactly one fenced json block:
\`\`\`json
{"decision": "automate|needs_spec|park", "complexity": "low|medium|high", "reason": "one or two sentences", "plan": "the files to touch and the approach, or the questions for a human"}
\`\`\``;

export const specPrompt = (issue, triage) => `You are the spec agent of a software factory. You are in a checkout of the repository. Read the relevant code and write a short implementation spec for the issue below. Do not change any files; your whole answer is the spec, in markdown.

${issueBlock(issue)}

Triage notes: ${triage.reason} ${triage.plan}

The spec must cover: the behaviour change, the files and functions to change, the tests to add, and what is out of scope. List open questions for the human reviewer at the end.`;

export const implementPrompt = (issue, { plan, spec, feedback, verify }) => `You are the implementation agent of a software factory. You are in a git worktree on a branch created for this issue. Make the change the issue asks for, including tests.

${issueBlock(issue)}

${spec ? `<approved_spec>\n${spec}\n</approved_spec>` : `Triage plan: ${plan}`}
${feedback ? `\n<feedback_on_previous_attempt>\n${feedback}\n</feedback_on_previous_attempt>\nYour earlier work is already in this worktree. Address every point of the feedback.\n` : ''}
Rules:
- Keep the change as small as the issue allows. Follow the conventions of the surrounding code.
- Add or update tests that would have failed before your change.
- These checks will be run after you finish, so run them yourself first: ${verify.join(' ; ') || '(none configured)'}
- Do not commit, push, or switch branches. The factory commits for you.

Finish with a short summary of what you changed and why.`;

export const reviewPrompt = (issue, diff) => `You are the code review agent of a software factory. You did not write this change. You are in the worktree that contains it, so read surrounding code where the diff alone is not enough. Do not change any files.

${issueBlock(issue)}

<diff>
${diff}
</diff>

Check that the change does what the issue asks, is correct, has meaningful tests, and touches nothing unrelated. Only request changes for real defects, not style preferences.

End your answer with exactly one fenced json block:
\`\`\`json
{"verdict": "approve|request_changes", "summary": "one or two sentences", "comments": ["specific, actionable problem", "..."]}
\`\`\``;
