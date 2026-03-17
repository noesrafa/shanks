/**
 * PR Review Script for Shanks
 *
 * Flow:
 *  1. Fetch the PR diff from GitHub
 *  2. Send to Claude for code review (structured JSON output)
 *  3. Post a PR review on GitHub (request changes or approve)
 *  4. If issues found → create a Paperclip task for the Founding Engineer
 *  5. If clean → merge the PR
 *
 * Required secrets (GitHub repo settings → Secrets and variables → Actions):
 *   ANTHROPIC_API_KEY              – Claude API key
 *   PAPERCLIP_API_URL              – e.g. https://your-paperclip.com
 *   PAPERCLIP_API_KEY              – long-lived agent key for the reviewer bot
 *   PAPERCLIP_COMPANY_ID           – Paperclip company UUID
 *   PAPERCLIP_FOUNDING_ENGINEER_AGENT_ID – UUID of the Founding Engineer agent
 *
 * GITHUB_TOKEN is provided automatically by GitHub Actions.
 */

const {
  GITHUB_TOKEN,
  ANTHROPIC_API_KEY,
  PAPERCLIP_API_URL,
  PAPERCLIP_API_KEY,
  PAPERCLIP_COMPANY_ID,
  PAPERCLIP_FOUNDING_ENGINEER_AGENT_ID,
  PR_NUMBER,
  PR_TITLE,
  PR_HEAD_SHA,
  REPO,
} = process.env;

// ─── Helpers ───────────────────────────────────────────────────────────────

async function ghFetch(path, options = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`GitHub API ${path} → ${res.status}: ${text}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function claudeReview(diff) {
  const systemPrompt = `You are a senior software engineer reviewing a pull request for "Shanks" — a prediction engine built with SvelteKit, TypeScript, Supabase (Drizzle ORM), and LLM agents.

Review the diff and return a JSON object with exactly this shape:
{
  "approved": boolean,           // true = no blocking issues, false = needs fixes
  "summary": string,             // 1-2 sentence overall assessment
  "issues": [                    // empty array if approved
    {
      "severity": "error" | "warning",
      "file": string,
      "description": string,
      "suggestion": string
    }
  ]
}

Guidelines:
- Flag real bugs, type errors, security issues, broken logic, missing error handling.
- Warn about code smells, unnecessary complexity, or violations of the OASIS/MiroFish architecture.
- Do NOT flag cosmetic style preferences (whitespace, naming conventions).
- Be concise — one focused issue per item.
- If the diff is trivial or clean, set approved=true and issues=[].`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Here is the pull request diff to review:\n\n\`\`\`diff\n${diff}\n\`\`\`\n\nReturn only the JSON object, no markdown wrapping.`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const raw = data.content[0].text.trim();
  // Strip accidental markdown code fences
  const json = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  return JSON.parse(json);
}

async function postGitHubReview(event, body) {
  // event: "APPROVE" | "REQUEST_CHANGES" | "COMMENT"
  return ghFetch(`/repos/${REPO}/pulls/${PR_NUMBER}/reviews`, {
    method: 'POST',
    body: JSON.stringify({ commit_id: PR_HEAD_SHA, event, body }),
  });
}

async function mergePR() {
  return ghFetch(`/repos/${REPO}/pulls/${PR_NUMBER}/merge`, {
    method: 'PUT',
    body: JSON.stringify({
      commit_title: `Merge PR #${PR_NUMBER}: ${PR_TITLE}`,
      merge_method: 'squash',
    }),
  });
}

async function createPaperclipTask(reviewResult) {
  if (!PAPERCLIP_API_URL || !PAPERCLIP_API_KEY || !PAPERCLIP_COMPANY_ID || !PAPERCLIP_FOUNDING_ENGINEER_AGENT_ID) {
    console.warn('Paperclip env vars not set — skipping task creation.');
    return null;
  }

  const issueList = reviewResult.issues
    .map((i) => `- **[${i.severity.toUpperCase()}]** \`${i.file}\`: ${i.description}\n  > ${i.suggestion}`)
    .join('\n');

  const description = `## PR Review: Issues Found

**PR:** [#${PR_NUMBER} — ${PR_TITLE}](https://github.com/${REPO}/pull/${PR_NUMBER})
**Commit:** \`${PR_HEAD_SHA?.slice(0, 7)}\`

### Summary
${reviewResult.summary}

### Issues to Fix
${issueList}

---
_Once you've addressed all issues, push the fixes to the PR branch. The reviewer will re-run automatically on the next push._`;

  const res = await fetch(`${PAPERCLIP_API_URL}/api/companies/${PAPERCLIP_COMPANY_ID}/issues`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${PAPERCLIP_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: `Fix PR #${PR_NUMBER}: ${PR_TITLE}`,
      description,
      status: 'todo',
      priority: reviewResult.issues.some((i) => i.severity === 'error') ? 'high' : 'medium',
      assigneeAgentId: PAPERCLIP_FOUNDING_ENGINEER_AGENT_ID,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.warn(`Failed to create Paperclip task: ${res.status} ${err}`);
    return null;
  }

  return res.json();
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Reviewing PR #${PR_NUMBER} (${PR_HEAD_SHA?.slice(0, 7)})…`);

  // 1. Fetch diff
  const diff = await ghFetch(`/repos/${REPO}/pulls/${PR_NUMBER}`, {
    headers: { Accept: 'application/vnd.github.v3.diff' },
  });

  if (!diff || diff.trim().length === 0) {
    console.log('Empty diff — nothing to review.');
    await postGitHubReview('COMMENT', 'No changes detected in this PR.');
    return;
  }

  // Truncate very large diffs to avoid token limits (keep first 40k chars)
  const truncated = typeof diff === 'string' && diff.length > 40000
    ? diff.slice(0, 40000) + '\n\n[...diff truncated for review...]'
    : diff;

  // 2. Claude review
  console.log('Sending diff to Claude for review…');
  let review;
  try {
    review = await claudeReview(truncated);
  } catch (err) {
    console.error('Claude review failed:', err.message);
    await postGitHubReview(
      'COMMENT',
      `⚠️ Automated review failed: ${err.message}\n\nManual review required.`,
    );
    process.exit(1);
  }

  console.log('Review result:', JSON.stringify(review, null, 2));

  // 3. Post GitHub review
  if (review.approved) {
    const approvalBody = [
      `## ✅ Automated Review: Approved`,
      '',
      review.summary,
      '',
      '_No blocking issues found. Auto-merging…_',
    ].join('\n');

    await postGitHubReview('APPROVE', approvalBody);
    console.log('PR approved.');

    // 4. Auto-merge
    try {
      await mergePR();
      console.log(`PR #${PR_NUMBER} merged.`);
    } catch (err) {
      console.error('Merge failed:', err.message);
      // Not fatal — PR is approved; human can merge manually
    }
  } else {
    const errorItems = review.issues.filter((i) => i.severity === 'error');
    const warnItems = review.issues.filter((i) => i.severity === 'warning');

    const formatItems = (items) =>
      items.map((i) => `- **\`${i.file}\`**: ${i.description}\n  > 💡 ${i.suggestion}`).join('\n');

    const reviewBody = [
      `## 🔍 Automated Review: Changes Requested`,
      '',
      review.summary,
      '',
      errorItems.length > 0 ? `### ❌ Errors (must fix)\n${formatItems(errorItems)}` : '',
      warnItems.length > 0 ? `### ⚠️ Warnings (consider fixing)\n${formatItems(warnItems)}` : '',
      '',
      '_The Founding Engineer has been notified via Paperclip to address these issues._',
    ]
      .filter((l) => l !== '')
      .join('\n');

    await postGitHubReview('REQUEST_CHANGES', reviewBody);
    console.log('Changes requested.');

    // 5. Create Paperclip task for the Founding Engineer
    const task = await createPaperclipTask(review);
    if (task) {
      console.log(`Paperclip task created: ${task.identifier ?? task.id}`);
    }
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
