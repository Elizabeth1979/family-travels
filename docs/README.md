# Repo memory — index of plans, specs, sessions & knowledge graphs

This is the single entry point to everything written *about* family-travels (as opposed
to the code itself). If you're picking up work or searching for "did we already decide X?",
start here. Keep this file current — see the convention at the bottom.

**Keywords:** memory, index, plans, specs, sessions, roadmap, Supabase, AI concierge, photo wall, admin, knowledge graph.

---

## 🟢 Active project state (read this first)

- **Backend migration → Supabase** is the current focus. Moving album/photo **metadata**
  to Supabase (Postgres + Auth + Storage); existing Drive photos are **not** migrated —
  a `photos` row keeps a URL pointing at Drive (legacy) or Supabase Storage (new uploads).
  **Blocked at Phase 0:** owner must authenticate the Supabase MCP server in-browser
  (`/mcp`) before Claude can build schema/import. Plan: [plans/2026-06-21-supabase-backend-captions.md](plans/2026-06-21-supabase-backend-captions.md) (has a live "▶ Resume point").
- **AI "talk to your app" roadmap** is speced and waiting on the migration. 4 rungs;
  Rung 1 (Concierge) builds first. Plan: [plans/2026-06-21-concierge-ai-map.md](plans/2026-06-21-concierge-ai-map.md).

---

## 📋 Plans (how-to-build, task-by-task)

- [plans/2026-06-21-supabase-backend-captions.md](plans/2026-06-21-supabase-backend-captions.md) — **active.** Staged move to a productizable Supabase backend with AI captions. Metadata-only migration; AI-drafted `caption`/`alt` fields; Apps Script retired in Phase 5.
- [plans/2026-06-21-concierge-ai-map.md](plans/2026-06-21-concierge-ai-map.md) — **saved for later.** Rung 1 "Concierge": ask in plain language (type or voice) → map surfaces matching albums. Backend-agnostic; reuses Gemini.
- [superpowers/plans/2026-06-21-photo-wall-gallery.md](superpowers/plans/2026-06-21-photo-wall-gallery.md) — replace the map page's 3D Gallery with a scrollable masonry "Photo Wall" of covers. Frontend only.
- [superpowers/plans/2026-05-29-admin-auto-publish-photos.md](superpowers/plans/2026-05-29-admin-auto-publish-photos.md) — auto-publish an album's private photos when the owner opens it in admin, so covers never break.
- [superpowers/plans/2026-05-29-graphify-and-understand-anything-integration.md](superpowers/plans/2026-05-29-graphify-and-understand-anything-integration.md) — install + run both knowledge-graph tools and write the comparison note (done; see Knowledge graphs below).

## 📐 Specs (what + why, design rationale)

- [superpowers/specs/2026-06-21-photo-wall-gallery-design.md](superpowers/specs/2026-06-21-photo-wall-gallery-design.md) — Photo Wall design. Approved, frontend-only, no redeploy.
- [superpowers/specs/2026-05-29-admin-auto-publish-photos-design.md](superpowers/specs/2026-05-29-admin-auto-publish-photos-design.md) — auto-publish design. Approved.
- [superpowers/specs/2026-05-29-graphify-and-understand-anything-integration-design.md](superpowers/specs/2026-05-29-graphify-and-understand-anything-integration-design.md) — design for the two-tool evaluation.

## 📓 Session logs (what happened & why, narrative)

- [sessions/2026-06-21-supabase-backend-productization.md](sessions/2026-06-21-supabase-backend-productization.md) — decided the productization architecture: hybrid Supabase backend (Auth + Postgres + Storage), metadata-only migration, split `caption`/`alt`, AI-drafted captions; wired `.mcp.json`, blocked on owner authenticating the Supabase MCP.
- [sessions/2026-06-21-ai-roadmap-brainstorm.md](sessions/2026-06-21-ai-roadmap-brainstorm.md) — brainstormed the 4-rung "talk to your app" AI roadmap; chose the Concierge to build first (after Supabase).

## 🗒️ Notes

- [superpowers/notes/graphify-vs-understand-anything.md](superpowers/notes/graphify-vs-understand-anything.md) — side-by-side of the two knowledge-graph tools on this repo. TL;DR: Graphify for refactor/archaeology, Understand-Anything for onboarding; the latter ages better.

## 📚 Reference guides (stable how-tos)

- [local-development.md](local-development.md) — run the static site locally before deploying to Vercel.
- [git-workflow.md](git-workflow.md) — branching, commits, collaboration conventions.
- [improvement-plan.md](improvement-plan.md) — older codebase cleanup checklist (baseline tooling, linting).

## 🧠 Knowledge graphs (code-comprehension, queryable)

Generated from the *code*, complementary to the project docs above. **Both are static-analysis
only** (reflect what the code looks like, not runtime behavior) and go stale as code changes —
regenerate after significant work.

- **Graphify** → `graphify-out/` (`graph.html` opens standalone; `GRAPH_REPORT.md`). Best for
  "where does X connect / what bridges these areas / what's duplicated." Query with `/graphify`.
- **Understand-Anything** → `.understand-anything/knowledge-graph.json`. 7 named architectural
  layers + a 15-step guided tour. Best for onboarding. Query with `/understand-chat`.
- ⚠️ **Last generated 2026-05-29** — predates the Supabase plan, AI roadmap, photo-wall, and
  recent admin/map fixes. Refresh before relying on them.

---

## Convention — keep this index current

When you add or meaningfully change a doc under `docs/`, add/update its one-line entry here in
the right section. New plans go in `docs/plans/`, session logs in `docs/sessions/` (see the
Session logs rule in `CLAUDE.md`). After significant code work, note that the knowledge graphs
are stale (or regenerate them). This index is the durable, grep-able counterpart to Claude's
private cross-session memory.
