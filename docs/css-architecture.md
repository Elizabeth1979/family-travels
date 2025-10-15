# CSS Architecture Audit

This audit documents the legacy structure of the single-file `styles.css` (captured before the split) and proposes a roadmap for modularising the styles while preserving the existing visual identity. The styles now live in `styles/base.css`, `styles/layout.css`, `styles/components.css`, and `styles/utilities.css`.

## Current File Map

Previously, `styles.css` (≈690 lines) was organised with comment blocks. Rough line markers:

- 1–32 — Global styles (`*` reset, `:root` tokens, body typography/background)
- 33–44 — Focus outlines
- 45–172 — Header, back link, map layout, floating action button
- 173–291 — Sidebar/album list (animated background, close button, list items)
- 292–359 — Album page scaffolding (hero, metadata, map card)
- 360–520 — Gallery grid, media cards, hover transitions, video placeholder
- 521–557 — Error states, PhotoSwipe tweaks
- 558–646 — Responsive breakpoints and print overrides
- 647–690 — Motion preferences, animation keyframes, custom scrollbars

## Key Observations

- **Reset approach:** A universal `*` reset sets margin/padding/box-sizing, escalating specificity for later overrides.
- **Token usage:** Core gradients/tints are centralised in `:root`, but plenty of rgba() declarations repeat raw values (e.g., `rgba(0, 0, 0, 0.25)` shadows) that could leverage shared tokens.
- **Mixed responsibilities:** Layout primitives, component styles, and utilities co-exist in one file, making reuse harder.
- **Inline style reliance:** Several UI elements rely on inline styles via JavaScript (`map.js` popups, gallery dimensions) that duplicate styling logic.
- **Responsive rules:** Breakpoints are clustered at the bottom but mix layout shifts with component tweaks; extracting them will clarify cascade order.

## Proposed Module Breakdown

1. **`styles/base.css`**
   - Modern reset using `:where` selectors and logical properties
   - Root variables, typography defaults, accessibility outlines, utility helpers
2. **`styles/layout.css`**
   - Page-level layout: header, map/album grids, sidebar positioning, album hero
3. **`styles/components.css`**
   - Reusable UI pieces: floating action button, album list entries, gallery cards, buttons, error banners
4. **`styles/utilities.css`**
   - Animation keyframes, responsive breakpoints, reduced-motion fallbacks, scrollbars/print styles

HTML will load the modules in the order above to preserve the cascade.

## Immediate Next Steps

- Replace the universal `*` reset with a scoped `:where` reset to reduce specificity.
- Split the existing CSS into the module files listed, keeping selectors intact for now.
- Introduce classes for inline-styled UI (starting with map popups) so JavaScript toggles classes instead of setting styles directly.
- Normalise shadow/gradient tokens as follow-up work once the file split is stable.
