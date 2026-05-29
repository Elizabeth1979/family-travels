# Design: Add Graphify and Understand-Anything as code-comprehension tools

**Date:** 2026-05-29
**Author:** Elizabeth (with Claude)
**Status:** Approved (variant A)

## Goal

Install Graphify (safishamsi/graphify) and Understand-Anything (Lum1104/Understand-Anything) as Claude Code skills/plugins, run both against the `family-travels` repo, and produce a brief side-by-side note on what each surfaces best — so the right tool can be reached for next time.

Both tools transform a codebase into an interactive knowledge graph for developer navigation. They are dev-time aids only — neither is a runtime dependency of the travel site itself.

## Non-goals

- No new runtime feature in the travel site (no graph view inside the album/map UI).
- No CI integration, no pre-commit hook to regenerate graphs.
- No Neo4j export, Obsidian vault wiring, or other extras either tool ships.
- No per-tool config tuning (LLM backend, model overrides) on first pass — accept defaults; revisit only if results disappoint.
- No commitment to keep both long-term. The comparison note is meant to inform a future "which one stays" decision.

## Constraints and context

- Project is a small static site (Vite + vanilla JS + some React for the 3D gallery). Codebase fits comfortably in either tool's scope.
- Owner is already running Claude Code with several plugins installed. Plugin-based install is the smoothest path.
- Owner does not want generated artifacts tracked in git — they go stale fast and bloat the repo.

## Plan (variant A: install + run + compare in one pass)

1. **Verify prerequisites.** Confirm Python 3.10+ is available (Graphify requirement) and that `/plugin marketplace add` works for an arbitrary GitHub source (Understand-Anything install path). If either check fails, surface the error rather than working around it.
2. **Install Graphify.** Run `pip install graphifyy && graphify install`. This writes `~/.claude/skills/graphify/SKILL.md` and makes `/graphify` available in Claude Code. User-scoped; no repo changes.
3. **Install Understand-Anything.** Run `/plugin marketplace add Lum1104/Understand-Anything` then `/plugin install understand-anything`. Makes `/understand`, `/understand-dashboard`, `/understand-chat`, and `/understand-diff` available. User-scoped.
4. **Update `.gitignore`.** Append two entries to the repo's `.gitignore`:
   - `graphify-out/`
   - `.understand-anything/`
   This is the only change to the repo's source files.
5. **Run Graphify.** Invoke `/graphify .` against the repo root. Let it analyze the full project (JS, HTML, CSS, MD, the `api/` and `src/` folders). Skim the generated `graphify-out/graph.html` and `GRAPH_REPORT.md`.
6. **Run Understand-Anything.** Invoke `/understand`. Skim the generated `.understand-anything/knowledge-graph.json` and, if useful, open the dashboard via `/understand-dashboard`.
7. **Write the comparison note.** Save to `docs/superpowers/notes/graphify-vs-understand-anything.md` (~150–250 words). Cover: what each tool surfaced, where each was more useful for this repo specifically, which to use when, and any rough edges hit during install or run. Commit this file.

## What gets committed vs. not

| Artifact | Committed? |
|---|---|
| `.gitignore` additions | Yes |
| `docs/superpowers/specs/2026-05-29-graphify-and-understand-anything-integration-design.md` | Yes (this file) |
| `docs/superpowers/notes/graphify-vs-understand-anything.md` | Yes (authored prose) |
| `graphify-out/` (all contents) | No (gitignored) |
| `.understand-anything/` (all contents) | No (gitignored) |
| `~/.claude/skills/graphify/SKILL.md` and the Understand-Anything plugin | N/A (lives in user's home, not repo) |

## Error handling

- If `pip install graphifyy` fails because of a missing or older Python: stop and report the version found. Do not attempt to install Python or modify the user's Python environment.
- If `/plugin marketplace add Lum1104/Understand-Anything` fails: report the error verbatim, do not retry with workarounds.
- If a tool runs but produces empty or obviously broken output: capture the error in the comparison note rather than masking it.
- If LLM rate limits or token budgets get hit during a run: stop the run, note it in the comparison, and let the user decide whether to retry or move on.

## Success criteria

1. Both `/graphify` and `/understand` are invokable from this Claude Code session.
2. `.gitignore` excludes both tools' output directories.
3. Both tools have produced non-empty output for `family-travels` at least once.
4. `docs/superpowers/notes/graphify-vs-understand-anything.md` exists, is committed, and answers the "which to use when" question concretely for this repo.

## Open questions

None at design time. Anything that comes up during install (e.g., a prompt for an API key that the docs don't mention) gets surfaced to the user rather than auto-answered.
