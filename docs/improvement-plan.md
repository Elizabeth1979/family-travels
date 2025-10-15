# Family Travels Codebase Improvement Plan

## 1. Establish Baseline & Tooling

This step ensures every developer can run the site locally and has core linting/formatting tools in place before tackling deeper cleanup work.
- [x] Document a lightweight local setup guide for running the static site with a simple HTTP server (e.g., `npm serve` or `python -m http.server`).
- [x] Add a `package.json` (or update existing docs) with convenient scripts: `start` for local preview, `lint:css` and `lint:js` once the tooling is in place.
- [x] Introduce a basic automated formatting/linting toolchain (Stylelint for CSS, ESLint + Prettier for JS) configured to respect the existing style choices while flagging cascade/duplication issues.
- [x] Wire the lint commands into CI (Netlify build hook or GitHub Actions) after verifying they pass locally.

## 2. CSS Architecture & Cleanup (Preserve Visual Identity)

Here we reorganize the existing CSS so it keeps the current look and animations while becoming easier to navigate, reuse, and extend.
- [ ] Audit `styles.css` to map existing sections (global, header, map, album) and group rules into logical modules/partials for future maintainability (e.g., using a `styles/` folder with `base.css`, `layout.css`, `components.css`).
- [ ] Replace the universal `*` reset with a small modern reset applied via `:where` selectors to avoid specificity inflation while keeping layout consistent.
- [ ] Ensure CSS variables declared in `:root` are consistently used; remove hard-coded color values that duplicate them.
- [ ] Normalize spacing and typography scales using utility classes or shared component classes instead of per-element overrides.
- [ ] Remove inline styles added from JavaScript (e.g., popup content in `map.js`) by introducing dedicated CSS classes and applying them via `classList`.
- [ ] Review transitions/animations to ensure they share easing/duration tokens, avoid redundant `transition: all`, and include `prefers-reduced-motion` fallbacks while keeping hover/interaction feedback.
- [ ] Improve cascade usage: leverage parent context classes (e.g., `.album-container`) to style nested elements instead of repeating selectors for each element.
- [ ] Review responsive breakpoints; ensure sidebar, gallery grid, and floating button adapt gracefully for tablet/mobile without collapsing the intended visual style.

## 3. Component-Level Enhancements

In this step we align the header, map, popups, and albums so they share consistent styling, behavior, and accessibility support without changing the visual theme.
- [ ] **Header & Navigation:** Extract header styling into reusable classes, ensure proper focus styles, and consider adding skip links for accessibility.
- [ ] **Map & Sidebar:**
  - Move map height/width settings into CSS and provide fallbacks for small screens (e.g., convert sidebar to bottom sheet under specific width).
  - Optimize the sliding menu animation (use `transform: translateX` instead of toggling `right` to keep transitions smooth).
  - Add subtle shadow/blur tokens shared across components via CSS variables.
- [ ] **Popups:** Create `.map-popup`, `.popup-cover`, `.popup-actions` classes in CSS and update `map.js` to reference them, ensuring consistent typography and spacing.
- [ ] **Album Page:**
  - Use CSS grid template utilities for `.gallery`; define responsive columns with `repeat(auto-fit, minmax(...))`.
  - Standardize `.gallery-item`, `.gallery-media`, `.video-label`, `.play-icon` styles within CSS to remove inline fallback styling.
  - Improve loading and error states with shared alert/info classes.

## 4. JavaScript Structure & Data Handling

We restructure the JavaScript so data flow and UI behavior are easier to maintain, reducing duplication while keeping the existing interactions intact.
- [ ] Convert duplicated fetch logic into a small data layer (e.g., `data/albums.js`) that gracefully falls back to `albums.json` when Apps Script data is unavailable.
- [ ] Wrap network requests with user-friendly error messages and retry prompts; log details to console for debugging.
- [ ] Replace repeated DOM style manipulations with class toggles (e.g., `.is-loading`, `.has-error`).
- [ ] Introduce utility helpers for creating DOM elements to reduce inline styling and repeated attributes.
- [ ] Consider splitting `album.js` into modules (`album-map.js`, `gallery.js`) if build tooling allows, or at least group related functions for readability.

## 5. Accessibility & UX Improvements

This step makes sure the interface stays usable with keyboards, assistive tech, and reduced-motion settings while preserving the current colors and hover effects.
- [ ] Ensure all interactive elements (menu toggle, gallery items, PhotoSwipe controls) have appropriate ARIA attributes and focus states maintained by CSS.
- [ ] Provide keyboard shortcuts or trap focus when the sidebar/lightbox is open.
- [ ] Add `prefers-reduced-motion` queries to tone down animations for users who opt out, while preserving default visuals.
- [ ] Audit color contrast using existing palette; adjust gradients subtly if any text falls below WCAG AA when placed on gradient backgrounds.
- [ ] Verify semantic HTML structure (headings order, landmark roles) and adjust templates accordingly.

## 6. Performance & Loading Optimizations

Here we optimize loading behavior so assets arrive quickly, animations remain smooth, and the site feels responsive on slower connections.
- [ ] Lazy-load Leaflet/PhotoSwipe assets conditionally (e.g., defer PhotoSwipe on map page, load map JS only on relevant pages).
- [ ] Implement responsive image handling for album thumbnails (consider caching Google Drive thumbnail URLs, add `srcset` where possible).
- [ ] Add skeleton/loading shimmer using CSS gradients for gallery items to keep perceived performance high without new design language.
- [ ] Introduce basic service worker or caching headers (via Netlify config) for static assets once verified.

## 7. Content & Data Management

In this phase we document and validate the project data sources so content updates are predictable and do not disrupt the existing features.
- [ ] Formalize the structure of `albums.json` with a JSON schema (document required fields) and add validation tooling during development.
- [ ] Document how to update Google Apps Script endpoints, expected permissions, and fallback behavior when offline.
- [ ] Add sample data for local development to avoid hitting live APIs during testing.

## 8. Testing & QA Strategy

This step adds manual and automated checks that confirm the map, galleries, and popups continue to behave and animate correctly after future changes.
- [ ] Create manual test checklists covering map interactions, sidebar toggling, album gallery navigation, and PhotoSwipe usage on desktop/mobile.
- [ ] Add automated smoke tests using Playwright or Cypress (at least for navigation between map and album pages, opening sidebar, and gallery item click).
- [ ] Include accessibility linting (e.g., axe-core integration in tests) targeting key pages.

## 9. Deployment & Monitoring

Here we update deployment workflows to run the new checks automatically and add lightweight monitoring to understand site usage after releases.
- [ ] Review `netlify.toml` to ensure build commands align with new tooling (lint/tests before deploy).
- [ ] Configure Netlify previews to run the lint/test suite.
- [ ] Add simple logging/analytics (privacy-respecting) to gauge feature usage (e.g., how often the sidebar is opened) to guide future improvements.

## 10. Documentation & Maintenance

This final step keeps architecture, style conventions, and change history documented so the improved setup remains sustainable over time.
- [ ] Update `README.md` with architecture overview, CSS conventions (naming, cascade strategy), and contribution guidelines.
- [ ] Maintain a changelog noting visual tweaks, new animations, and tooling updates.
- [ ] Schedule periodic audits (quarterly) for dependency updates and accessibility regressions.

---

This plan retains the current aesthetic (gradients, hover animations, color palette) while improving maintainability, accessibility, and performance in manageable iterations.
