# Graphify vs. Understand-Anything on family-travels

**Date:** 2026-05-29
**Spec:** [docs/superpowers/specs/2026-05-29-graphify-and-understand-anything-integration-design.md](../specs/2026-05-29-graphify-and-understand-anything-integration-design.md)

Both tools were run against this repo (40–45 files, ~26K words, vanilla JS + React/Vite + Tailwind). What follows is what each *actually surfaced* for this codebase.

## What Graphify surfaced

- **395 nodes / 553 edges / 37 communities** (247 AST-extracted code symbols + 153 LLM-extracted semantic nodes). Graphify pulls *every* function and class via Tree-sitter, not just the "significant" ones, so the graph reflects code granularity instead of file granularity.
- **God nodes correctly identified the real bridges:** `loadAlbumsAndMarkers()`, `renderLeafletMarkers`, `doGet` / `doPost` (Apps Script endpoints), `switchMapType()`. The most useful was `loadAlbumsAndMarkers` — Graphify flagged it as the seam between the Admin Panel and the Album Page communities, which is exactly the function to handle carefully when refactoring the admin → public flow.
- **Hyperedges captured real fan-outs:** the admin write flow (6 handlers funnelling through `doPost`), the album-schema fan-out to all three frontends, the React-into-vanilla mount bridge in `main.jsx`. These are 3+-node patterns that pairwise edges can't express.
- **Custom edge relations** — `rationale_for`, `semantically_similar_to`, `shares_data_with`, `conceptually_related_to` — captured intent and parallels beyond imports/calls. Notable: it linked the PRD's Stage 1 to the README's "zero-backend" model with 0.95 confidence.
- **Token reduction benchmark:** 15.4× fewer tokens per query vs. naive corpus scan.

## What Understand-Anything surfaced

- **136 nodes / 192 edges / 7 named layers / 15-step tour.** More conservative on per-symbol nodes (89 functions vs. Graphify's hundreds) but much more *named* in its structuring.
- **Architectural layers nailed the hybrid stack:** correctly identified that this repo is *two coexisting stacks* — Legacy Frontend Logic (vanilla JS map/album/admin) and React UI Components (src/ Vite stack) — and refused to merge them, because they have no import edges between each other. That's a real architectural insight you'd otherwise have to explain to a new contributor.
- **Edge vocabulary matches developer intuition:** `configures`, `deploys`, `triggers`, `documents`, `depends_on` — these match how you talk about the project (`vercel.json` *deploys* `index.html`; `tailwind.config.js` *configures* `src/index.css`; `ci.yml` *triggers* `package.json` scripts). Graphify's vocabulary is less project-shaped.
- **15-step guided tour** is a Graphify-doesn't-have-this artifact: README → landing page → config/utils → map → album → Apps Script → admin → React 3D gallery → UI primitives → OG handler → build → linting → CI → roadmap. Each step includes a "language lesson" explaining the local idiom (Vite multi-page builds, R3F + window-mount interop, the shadcn `cn()` pattern, Vercel filesystem routing).
- **`tested_by` linker** ran on this repo but produced no edges because there are no tests in family-travels yet — a useful negative signal worth recording.

## Side-by-side

| Question | Graphify | Understand-Anything |
|---|---|---|
| Static analysis quality (Tree-sitter accuracy) | Excellent — extracts every symbol | Good — only "significant" functions (10+ lines) |
| Semantic clustering quality | Leiden communities (37) — too many singletons for a small repo | 7 named architectural layers — well-sized |
| Browse UX | `graph.html` self-contained, no server | Dashboard requires `pnpm dev` of the plugin's React app |
| Q&A / chat quality | `/graphify query` does BFS/DFS traversal with token budget | `/understand-chat` uses graph for retrieval (not exercised yet) |
| Install friction | Low — `pipx install graphifyy && graphify install`, immediate `/graphify` skill | High — `/plugin install`, then **session restart**, then `pnpm install` failed twice on pnpm 11 strict-build defaults until I patched `pnpm-workspace.yaml`'s placeholder `allowBuilds:` strings to actual booleans |
| Time to first useful insight | ~3 min (single subagent dispatch + cluster) | ~15 min (plugin build + 7-phase pipeline w/ 9 subagent dispatches) |
| Output footprint | `graphify-out/` ~300 KB (HTML + JSON + obsidian-style vault) | `.understand-anything/` ~150 KB (JSON + fingerprints baseline) |
| Pedagogical artifacts | Suggested questions + report | Guided tour, layer descriptions, language lessons |

## Recommendation for this repo

**Use Graphify for refactor / archaeology questions** ("where does X connect?", "what bridges these two areas?", "what code is doing the same thing"). Its god-node + community detection + custom edge relations (`rationale_for`, `semantically_similar_to`) are well-suited to the "I'm changing this — what else moves?" question.

**Use Understand-Anything when onboarding a new contributor.** The 7 named layers + 15-step tour with language lessons is exactly what you'd want a new family member or collaborator to walk through before touching the code. It also gives you a structured representation that's easier to embed in tooling (dashboards, IDE plugins) because the edge vocabulary maps to how developers actually talk about systems.

For a repo this small (~40 files), both are arguably overkill — but the comparison note itself is the artifact of value. If only one stays long-term, **Understand-Anything's layer/tour output ages better** because it doesn't reference specific symbols by name. Graphify's report goes stale faster as the code churns.

## Rough edges hit

- **PEP 668 blocked `pip install graphifyy`** on Homebrew Python 3.14. Worked around with `pipx`, which is what the user wanted in the first place.
- **Graphify silently created a global `~/.claude/CLAUDE.md`** during `graphify install`, adding itself as a user-global rule. Not destructive, but uninvited.
- **Understand-Anything's `/plugin install` did not auto-register slash commands** in the running Claude Code session — required a full session restart. Documented in spec; cost us one tooling round-trip.
- **Understand-Anything's `pnpm-workspace.yaml` shipped with placeholder strings** (`esbuild: set this to true or false`) instead of booleans, so `pnpm install` left build scripts unrun and `pnpm 11` treated that as a fatal precondition. Fixed locally; should be an upstream issue.
- **Graphify's 37 communities include many singletons** (single-node config files) — visually noisy at this corpus size. A `--min-cluster-size 2` flag would help.
- **Neither tool actually inspected the deployed site behavior** — both are static-analysis-only. Useful caveat: they reflect what the code *looks like*, not what it *does at runtime*.
