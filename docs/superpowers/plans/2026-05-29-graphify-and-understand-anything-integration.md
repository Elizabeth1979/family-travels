# Graphify + Understand-Anything Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Install Graphify (safishamsi/graphify) and Understand-Anything (Lum1104/Understand-Anything) as Claude Code skills/plugins, run both against the `family-travels` repo, and write a brief side-by-side comparison note.

**Architecture:** Both tools are user-scoped (skill files in `~/.claude/`, no project dependency). The only repo-tracked changes are two `.gitignore` lines and a Markdown note in `docs/superpowers/notes/`. Generated graph artifacts live in `graphify-out/` and `.understand-anything/` and are intentionally gitignored.

**Tech Stack:** Python 3.10+ (Graphify CLI), `pip` for package installation, Claude Code `/plugin` marketplace (for Understand-Anything), standard shell tools.

**Spec reference:** [`docs/superpowers/specs/2026-05-29-graphify-and-understand-anything-integration-design.md`](../specs/2026-05-29-graphify-and-understand-anything-integration-design.md)

---

## Executor notes (read first)

Three of the steps below require Claude Code slash commands (`/plugin marketplace add`, `/plugin install`, `/graphify .`, `/understand`). Those **cannot** be run from a subagent Bash shell. They must be run interactively in the main Claude Code session. When you hit one, pause and either:

1. (Subagent-driven mode) Return control with a status note like "ready for human/main-session to run `/plugin install understand-anything`", then resume after the user confirms.
2. (Inline mode) Type the slash command directly into the Claude Code session and wait for the result.

Do not try to work around this with `claude --headless`, scripted stdin, or hidden CLI flags — surface the constraint cleanly instead.

---

## File map

| File | Operation | Responsibility |
|---|---|---|
| `.gitignore` | Modify (append 2 lines) | Exclude both tools' output directories from version control |
| `docs/superpowers/notes/graphify-vs-understand-anything.md` | Create | Brief comparison after running both tools |
| `~/.claude/skills/graphify/SKILL.md` | Created by `graphify install` | User-scoped Graphify skill registration (not tracked in repo) |
| `~/.claude/plugins/.../understand-anything/` | Created by `/plugin install` | User-scoped Understand-Anything plugin (not tracked in repo) |
| `graphify-out/` | Created by `/graphify .` | Generated graph artifacts (gitignored) |
| `.understand-anything/` | Created by `/understand` | Generated knowledge graph artifacts (gitignored) |

---

## Task 1: Verify prerequisites

**Files:** none modified — verification only.

- [ ] **Step 1: Check Python version**

Run:
```bash
python3 --version
```

Expected: `Python 3.10.x` or higher (3.11, 3.12, 3.13 are all fine).

If lower: stop and report the version to the user. Do **not** attempt to install or upgrade Python.

- [ ] **Step 2: Check `pip` availability**

Run:
```bash
python3 -m pip --version
```

Expected: a version string. If missing, stop and report.

- [ ] **Step 3: Check git status is clean**

Run:
```bash
git status --short
```

Expected: empty output (no uncommitted changes). If dirty, stop and ask the user how to proceed — we don't want to mix install commits with unrelated work.

- [ ] **Step 4: Confirm we're at the repo root**

Run:
```bash
pwd && test -f package.json && test -f index.html && echo "OK: at family-travels root"
```

Expected: prints the repo path and `OK: at family-travels root`. If not, `cd` to `/Users/elizabeth/family-travels`.

---

## Task 2: Install Graphify

**Files:**
- Creates (outside repo): `~/.claude/skills/graphify/SKILL.md`

- [ ] **Step 1: Install the `graphifyy` package**

Run:
```bash
python3 -m pip install graphifyy
```

Expected: pip output ending with `Successfully installed graphifyy-<version>`. Note the version printed.

If the install fails with a permission error, retry with `--user`:
```bash
python3 -m pip install --user graphifyy
```

- [ ] **Step 2: Verify the `graphify` CLI is on PATH**

Run:
```bash
which graphify && graphify --version
```

Expected: a path (e.g. `/usr/local/bin/graphify` or `~/.local/bin/graphify`) and a version string.

If `which graphify` returns nothing but the install succeeded, the binary is likely in `~/.local/bin`. Add it to PATH for this shell:
```bash
export PATH="$HOME/.local/bin:$PATH"
which graphify
```

If still missing, stop and report.

- [ ] **Step 3: Run the Claude Code skill installer**

Run:
```bash
graphify install
```

Expected: output indicating the skill was written to `~/.claude/skills/graphify/SKILL.md` (or similar). Capture the exact path it reports.

- [ ] **Step 4: Verify the skill file landed**

Run:
```bash
ls -la ~/.claude/skills/graphify/SKILL.md
```

Expected: file exists, non-zero size.

- [ ] **Step 5: No commit — this is a user-home change, not a repo change.**

Skip to Task 3. (There is nothing to commit because Graphify's install only modifies `~/.claude/`, not the repo.)

---

## Task 3: Install Understand-Anything

**Files:**
- Creates (outside repo): files under `~/.claude/plugins/.../understand-anything/`

> **Slash-command task.** Steps 1 and 2 are Claude Code slash commands. Run them interactively in the main Claude Code session.

- [ ] **Step 1: Add the marketplace source**

In the Claude Code session, type:
```
/plugin marketplace add Lum1104/Understand-Anything
```

Expected: a confirmation that the marketplace was added. If it asks for confirmation, accept.

If the command errors with "already added", that's fine — proceed.

- [ ] **Step 2: Install the plugin**

In the Claude Code session, type:
```
/plugin install understand-anything
```

Expected: install confirmation and a list of new slash commands now available: `/understand`, `/understand-dashboard`, `/understand-chat`, `/understand-diff`.

- [ ] **Step 3: Verify the slash commands are registered**

Look for `/understand` in Claude Code's slash-command autocomplete (start typing `/un` and confirm it appears). If autocomplete doesn't list them, run:
```bash
ls ~/.claude/plugins/ 2>/dev/null || ls ~/.config/claude/plugins/ 2>/dev/null
```

Expected: a directory entry containing `understand-anything` somewhere under `~/.claude/`.

- [ ] **Step 4: No commit — this is a user-home change, not a repo change.**

Skip to Task 4.

---

## Task 4: Update `.gitignore` and commit

**Files:**
- Modify: `.gitignore` (append 2 entries)

- [ ] **Step 1: Inspect current `.gitignore`**

Run:
```bash
cat .gitignore
```

Capture the existing contents so the appended block is consistent with the file's style.

- [ ] **Step 2: Append the new entries**

Append the following block to `.gitignore` (preserve a trailing newline):

```gitignore

# Code-comprehension tools (Graphify, Understand-Anything) — generated artifacts
graphify-out/
.understand-anything/
```

Do not remove or reorder any existing entries.

- [ ] **Step 3: Verify the entries are present**

Run:
```bash
tail -n 4 .gitignore
```

Expected: shows the comment line and the two new path entries.

- [ ] **Step 4: Verify gitignore actually ignores them**

Run:
```bash
mkdir -p graphify-out .understand-anything
touch graphify-out/.probe .understand-anything/.probe
git status --short
```

Expected: `git status --short` shows nothing new (no `??` entries for either directory). If either appears, the `.gitignore` entries are wrong — fix and re-check.

Clean up the probes:
```bash
rm -rf graphify-out .understand-anything
```

- [ ] **Step 5: Commit**

Run:
```bash
git add .gitignore
git commit -m "$(cat <<'EOF'
Gitignore code-comprehension tool outputs

Excludes graphify-out/ and .understand-anything/ ahead of running both
tools against the repo. Per design spec, generated artifacts are not
tracked.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Expected: a commit on `main` with one file changed, two additions plus the comment line.

---

## Task 5: Run Graphify against the repo

**Files:**
- Creates (untracked): `graphify-out/graph.html`, `graphify-out/graph.json`, `graphify-out/GRAPH_REPORT.md`, `graphify-out/cache/`, plus optional `graphify-out/obsidian/` and `graphify-out/wiki/` subtrees.

> **Slash-command task.** Run in the main Claude Code session.

- [ ] **Step 1: Confirm working directory**

Run:
```bash
pwd
```

Expected: `/Users/elizabeth/family-travels`. If not, `cd` there first.

- [ ] **Step 2: Invoke Graphify on the repo root**

In the Claude Code session, type:
```
/graphify .
```

Expected: progress output as it analyzes files. The README claims local Tree-sitter parsing for code (no LLM calls) plus LLM calls for the semantic graph. Expect this to take several minutes and consume LLM tokens.

If it asks for an LLM backend choice, accept the default (whatever Claude Code is already authenticated against).

If it fails with a missing dependency error (e.g. `tree-sitter` for an exotic language), capture the error and continue — partial output is still useful. Do not install extra parsers unless the user asks.

- [ ] **Step 3: Verify output landed**

Run:
```bash
ls graphify-out/
test -f graphify-out/graph.html && echo "graph.html: OK"
test -f graphify-out/graph.json && echo "graph.json: OK"
test -f graphify-out/GRAPH_REPORT.md && echo "GRAPH_REPORT.md: OK"
```

Expected: all three `OK` lines print.

If any are missing, note which and continue — capture this gap for the comparison note.

- [ ] **Step 4: Skim the report**

Run:
```bash
head -100 graphify-out/GRAPH_REPORT.md
```

Read the output. Capture (mentally or in a scratch file) 2–3 observations about what Graphify surfaced — e.g., which files cluster together, what relationships it inferred, anything surprising about the family-travels code structure.

- [ ] **Step 5: Optionally open the interactive graph**

Run:
```bash
open graphify-out/graph.html
```

Optional but recommended — it's the main UX win of the tool. Spend a couple minutes clicking around.

- [ ] **Step 6: Verify gitignore still holds**

Run:
```bash
git status --short
```

Expected: empty (or shows only files unrelated to graphify-out/). `graphify-out/` must not appear.

- [ ] **Step 7: No commit — outputs are gitignored.**

---

## Task 6: Run Understand-Anything against the repo

**Files:**
- Creates (untracked): `.understand-anything/knowledge-graph.json`, `.understand-anything/intermediate/`, optionally `.understand-anything/diff-overlay.json`.

> **Slash-command task.** Run in the main Claude Code session.

- [ ] **Step 1: Confirm working directory**

Run:
```bash
pwd
```

Expected: `/Users/elizabeth/family-travels`.

- [ ] **Step 2: Invoke `/understand`**

In the Claude Code session, type:
```
/understand
```

Expected: analyzer progress output. Similar token consumption to Graphify.

If it prompts for a persona (the README mentions "persona-adaptive UI"), pick whichever feels most relevant — there is no wrong answer for this comparison.

- [ ] **Step 3: Verify output landed**

Run:
```bash
ls -la .understand-anything/
test -f .understand-anything/knowledge-graph.json && echo "knowledge-graph.json: OK"
```

Expected: `OK` line prints; directory contains at least `knowledge-graph.json`. Note any other files for the comparison.

- [ ] **Step 4: Open the dashboard**

In the Claude Code session, type:
```
/understand-dashboard
```

Expected: instructions for opening the dashboard (likely a local URL like `http://localhost:<port>`). Open it and spend a couple minutes navigating.

If the dashboard fails to launch, capture the failure mode for the comparison note and continue.

- [ ] **Step 5: Optionally try one query**

In the Claude Code session, type:
```
/understand-chat what does map.js do?
```

Capture the response quality — concrete, vague, accurate, hallucinated? This is useful for the comparison note.

- [ ] **Step 6: Verify gitignore still holds**

Run:
```bash
git status --short
```

Expected: `.understand-anything/` must not appear.

- [ ] **Step 7: No commit — outputs are gitignored.**

---

## Task 7: Write the comparison note

**Files:**
- Create: `docs/superpowers/notes/graphify-vs-understand-anything.md`

- [ ] **Step 1: Sanity check the notes directory exists**

Run:
```bash
test -d docs/superpowers/notes && echo "OK"
```

Expected: `OK`. If missing, `mkdir -p docs/superpowers/notes`.

- [ ] **Step 2: Author the note**

Write the file with this structure (replace bracketed placeholders with concrete observations from Tasks 5 and 6):

```markdown
# Graphify vs. Understand-Anything on family-travels

**Date:** 2026-05-29
**Spec:** [docs/superpowers/specs/2026-05-29-graphify-and-understand-anything-integration-design.md](../specs/2026-05-29-graphify-and-understand-anything-integration-design.md)

## What Graphify surfaced

[2–4 bullets: which clusters, what relationships, what felt useful vs. noisy. Mention specific files from family-travels — e.g., did it correctly link `album.js` ↔ `album.html` ↔ the album data flow? Did it pick up the React 3D-gallery boundary?]

## What Understand-Anything surfaced

[2–4 bullets: dashboard quality, query response quality (from `/understand-chat`), guided tour quality if you tried one. Same rule — be specific to family-travels code.]

## Side-by-side

| Question | Graphify | Understand-Anything |
|---|---|---|
| Static analysis quality (Tree-sitter accuracy) | [verdict] | [verdict] |
| Semantic clustering quality | [verdict] | [verdict] |
| Browse UX (graph.html vs. dashboard) | [verdict] | [verdict] |
| Q&A / chat quality | [n/a or verdict] | [verdict] |
| Install friction | [verdict] | [verdict] |
| Time to first useful insight | [minutes] | [minutes] |

## Recommendation for this repo

[One paragraph: which tool to reach for when, or whether to keep both. Be honest if neither is worth the token cost on a codebase this small.]

## Rough edges hit

[Bullet list of any install errors, missing-feature surprises, or output quirks.]
```

Word target: 150–250 words of actual prose. Tables and headings don't count against the budget — they're scaffolding.

- [ ] **Step 3: Verify the file exists and is non-trivial**

Run:
```bash
wc -w docs/superpowers/notes/graphify-vs-understand-anything.md
```

Expected: ≥150 words. If under, the note is too thin — go back and add more concrete observations.

- [ ] **Step 4: Commit**

Run:
```bash
git add docs/superpowers/notes/graphify-vs-understand-anything.md
git commit -m "$(cat <<'EOF'
Add Graphify vs. Understand-Anything comparison note

Side-by-side observations from running both tools against family-travels,
per the integration design spec. Captures which tool to reach for when
and any rough edges hit during install or run.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Expected: commit lands on `main` with one new file.

- [ ] **Step 5: Final verification — all success criteria met**

Run:
```bash
# Criterion 1: both slash commands installed (manual check in Claude Code)
# Criterion 2: .gitignore excludes both output dirs
grep -E '^(graphify-out/|\.understand-anything/)' .gitignore && echo "gitignore OK"

# Criterion 3: both tools produced non-empty output
test -s graphify-out/graph.json && echo "graphify output OK"
test -s .understand-anything/knowledge-graph.json && echo "understand-anything output OK"

# Criterion 4: comparison note exists and is committed
git log --oneline -2
```

Expected:
- `gitignore OK` prints.
- Both `graphify output OK` and `understand-anything output OK` print.
- Most recent commit is the comparison note; one before it is the `.gitignore` change.

---

## Self-review (already performed during plan authoring)

- **Spec coverage:** Every section of the spec maps to a task — prerequisites → T1; Graphify install → T2; Understand-Anything install → T3; gitignore → T4; run Graphify → T5; run Understand-Anything → T6; comparison note → T7. Success criteria are explicitly checked in T7.5.
- **Placeholder scan:** No "TBD" / "implement later" / "appropriate error handling" patterns. The only `[bracketed]` content is in the comparison-note template (T7.2), where the bracketed slots are explicitly the *output* the executor produces from Tasks 5 and 6, not unfilled plan placeholders.
- **Type consistency:** No types or function signatures to keep consistent. File paths are spelled the same way every time: `graphify-out/`, `.understand-anything/`, `docs/superpowers/notes/graphify-vs-understand-anything.md`.
- **Spec gaps:** None found.
