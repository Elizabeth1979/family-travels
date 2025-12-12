# Local Development Guide

Run the static site locally to verify changes before deploying to Vercel.

## Prerequisites
- Node.js 18 or newer (installs tooling and runs the local server)
- npm 9 or newer
- Optional: Python 3 (alternative lightweight server)

## First-Time Setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the development server:
   ```bash
   npm start
   ```
3. Open `http://localhost:4173` in your browser. The command serves the repository root so both `index.html` and `album.html` work as expected.

The server runs without a build step, so stopping it (`Ctrl+C`) is enough to apply changes after editing files. Restart when you add new dependencies.

## Alternative: Python HTTP Server
If you only need a quick preview and don't want to install npm packages yet, use Python's built-in server:
```bash
python -m http.server 4173
```
> Note: This approach skips the linting toolchain and does not set the headers Vercel adds in production. Use `npm start` for the full development experience.

## Linting & Formatting
- `npm run lint` runs both JavaScript (`eslint`) and CSS (`stylelint`) checks.
- `npm run lint:js` runs JavaScript linting only.
- `npm run lint:css` runs Stylelint only.
- `npm run format` formats JS, CSS, HTML, JSON, and Markdown files with Prettier.

Linting should pass locally before opening a pull request or deploying.
