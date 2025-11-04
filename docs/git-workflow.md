# Git Workflow & Branching Best Practices

This guide explains how to manage branches, commits, and collaboration in this repository.

## Table of Contents
- [Branch Management](#branch-management)
- [Deleting Branches](#deleting-branches)
- [Feature Size Guidelines](#feature-size-guidelines)
- [Debugging with Branches](#debugging-with-branches)
- [Branching Strategy](#branching-strategy)
- [Commit Best Practices](#commit-best-practices)
- [AI-Assisted Coding Tips](#ai-assisted-coding-tips)

## Branch Management

### Core Principle
**Keep `main` always deployable** - Never commit broken code directly to the main branch.

### Branch Naming Conventions

Use descriptive prefixes to categorize your work:

- `feature/description` - New functionality (e.g., `feature/album-search`)
- `fix/description` - Bug fixes (e.g., `fix/map-marker-alignment`)
- `refactor/description` - Code improvements without changing behavior
- `debug/description` - Experimental debugging (usually deleted after)
- `experiment/description` - Trying out ideas (might delete)
- `docs/description` - Documentation updates

### Creating a New Branch

```bash
git checkout main
git pull  # Make sure you're up to date
git checkout -b feature/new-gallery-view
```

## Deleting Branches

Don't be afraid to delete branches! They're just pointers to commits, so creating and deleting them is "cheap" in Git.

### If You Haven't Pushed to Remote

```bash
git checkout main
git branch -D feature-branch-name
```

### If You Already Pushed to Remote

```bash
git checkout main
git branch -D feature-branch-name  # Delete locally
git push origin --delete feature-branch-name  # Delete remotely
```

### When to Delete vs. Keep

- ✅ **Delete**: Experimental work that didn't pan out
- ✅ **Delete**: Debugging branches after the fix is merged
- 💾 **Keep**: Unfinished work you might return to
- ✅ **Merge then delete**: Completed features that passed testing

## Feature Size Guidelines

### Ideal Feature Branch Size

**One logical change per branch** - Each branch should represent one cohesive piece of work.

**Small enough to review**:
- Ideally reviewable in 30 minutes or less
- Roughly 200-400 lines of changes
- Can understand the full impact without excessive context-switching

**Large enough to be meaningful**:
- Should be a complete, testable unit of work
- Leave the codebase in a working state
- Deliver actual value (not half-implemented features)

### Breaking Down Large Features

Split large features into multiple branches:

```bash
feature/user-auth-database      # Database schema and models
feature/user-auth-api           # API endpoints
feature/user-auth-ui            # Login/signup forms
feature/user-auth-validation    # Input validation and security
```

Each branch should:
- Be mergeable independently (if using feature flags)
- Leave the codebase in a working state
- Build on previous branches when needed

### Examples for This Project

**Good feature sizes**:
- Add alt text support for images
- Implement search functionality for albums
- Refactor map initialization code
- Add keyboard navigation to gallery

**Too large** (should be split):
- Redesign entire UI and add admin panel
- Migrate to new backend and add authentication
- Rewrite all JavaScript to TypeScript

**Too small** (combine or commit directly):
- Fix typo in README
- Update one color variable
- Remove console.log statement

## Debugging with Branches

### Experimentation Workflow

1. **Create a debug branch**:
   ```bash
   git checkout -b debug/fix-map-markers
   ```

2. **Experiment freely** - Try different solutions without fear of breaking main

3. **Three possible outcomes**:
   - ✅ **Fix works**: Clean up commits, test thoroughly, merge to main
   - ❌ **Fix doesn't work**: Delete branch, no harm done
   - 🤔 **Partial progress**: Keep branch, document findings, come back later

### Best Practices for Bug Fixes

- **Always create a branch** - Even for small bugs (keeps main clean)
- **One bug per branch** - Unless bugs are tightly related
- **Test before merging** - Verify the fix works across browsers/devices
- **Document the issue** - Commit message should explain both problem and solution

Example workflow:
```bash
# Found a bug where map markers overlap
git checkout -b fix/overlapping-map-markers

# Try solution 1... doesn't work
git add .
git commit -m "WIP: attempt marker clustering"

# Try solution 2... works!
git add .
git commit -m "fix: prevent map marker overlap with offset calculation"

# Clean up commits if needed
git rebase -i main  # Optional: squash WIP commits

# Merge back
git checkout main
git merge fix/overlapping-map-markers
git branch -d fix/overlapping-map-markers
```

## Branching Strategy

### Typical Development Workflow

```bash
# 1. Start from main
git checkout main
git pull

# 2. Create feature branch
git checkout -b feature/album-filters

# 3. Make changes
# ... edit files ...

# 4. Commit regularly
git add .
git commit -m "feat: add filter UI components"

# 5. Push to remote (creates backup and enables PR)
git push -u origin feature/album-filters

# 6. When ready, merge to main
git checkout main
git merge feature/album-filters

# 7. Clean up
git branch -d feature/album-filters
git push origin --delete feature/album-filters
```

### When Working Solo vs. Team

**Solo development** (like this project):
- Can commit directly to main for very small changes
- Still beneficial to use branches for features/experiments
- Less formal review process

**Team development**:
- Always use branches
- Never commit directly to main
- Require pull request reviews before merging
- Use protected branches

## Commit Best Practices

### Commit Message Format

Use conventional commit format:

```
<type>: <short description>

[optional longer description]
[optional footer with issue references]
```

**Types**:
- `feat:` - New feature
- `fix:` - Bug fix
- `refactor:` - Code change that neither fixes bug nor adds feature
- `docs:` - Documentation changes
- `style:` - Formatting, missing semicolons, etc.
- `test:` - Adding tests
- `chore:` - Updating build tasks, package manager configs, etc.

**Examples**:
```bash
git commit -m "feat: add keyboard navigation to gallery"
git commit -m "fix: resolve map marker z-index issue"
git commit -m "refactor: extract map utilities to separate file"
git commit -m "docs: update git workflow guide"
```

### How Often to Commit

- **Commit frequently** - After completing a logical unit of work
- **Not too small** - "fix typo" for every typo is excessive
- **Not too large** - Don't bundle multiple unrelated changes
- **Commit before switching tasks** - Save your work before context-switching

### What NOT to Commit

- Sensitive data (API keys, passwords, tokens)
- Large binary files (unless necessary)
- Generated files (build outputs, dependencies)
- Personal config files (.env.local, IDE settings)
- Temporary debugging code

Check `.gitignore` to see what's excluded from this project.

## AI-Assisted Coding Tips

When working with AI coding assistants (like Claude Code):

### Use Branches for AI Experiments

```bash
# Let AI try different approaches in separate branches
git checkout -b experiment/ai-gallery-refactor
```

If the AI's approach works, merge it. If not, delete the branch and try again.

### Review Before Merging

- **Always review changes** - Understand what the AI modified
- **Test thoroughly** - AI-generated code can have subtle bugs
- **Check for consistency** - Ensure it matches your coding style
- **Verify security** - Don't blindly trust AI-generated security code

### Commit Frequently

When iterating with AI assistance:

```bash
# After each successful change
git add .
git commit -m "feat: AI-assisted gallery refactor - step 1"
```

This makes it easy to revert specific changes if the AI makes a mistake later.

### Document AI-Generated Code

If AI generates complex logic, add comments explaining:
- What the code does
- Why this approach was chosen
- Any edge cases or limitations

## Common Scenarios

### Scenario: Trying Multiple Solutions

```bash
# Create branch
git checkout -b fix/photo-loading

# Try solution 1
# ... make changes ...
git add .
git commit -m "WIP: try lazy loading approach"

# Doesn't work, try solution 2
# ... make changes ...
git add .
git commit -m "WIP: try intersection observer approach"

# This works! Clean up commits
git rebase -i HEAD~2  # Squash the WIP commits
# Edit commit message to: "fix: implement lazy loading for photos"

# Merge to main
git checkout main
git merge fix/photo-loading
```

### Scenario: Feature Takes Longer Than Expected

```bash
# Started work on feature
git checkout -b feature/admin-panel

# Realized it's too big, split it up
git checkout -b feature/admin-panel-ui
# ... implement UI only ...
git checkout main
git merge feature/admin-panel-ui

git checkout -b feature/admin-panel-api
# ... implement API only ...
git checkout main
git merge feature/admin-panel-api

# Delete the original branch since we split it
git branch -D feature/admin-panel
```

### Scenario: Found Bug While Working on Feature

```bash
# Currently on feature/gallery-redesign
# Discovered unrelated bug

# Commit current work
git add .
git commit -m "WIP: gallery redesign in progress"

# Switch to main and fix bug
git checkout main
git checkout -b fix/broken-map-markers
# ... fix bug ...
git add .
git commit -m "fix: map markers not showing correct location"
git checkout main
git merge fix/broken-map-markers

# Return to feature work
git checkout feature/gallery-redesign
```

## Quick Reference

### Common Commands

```bash
# Create and switch to new branch
git checkout -b branch-name

# Switch branches
git checkout branch-name

# List all branches
git branch -a

# Delete local branch
git branch -D branch-name

# Delete remote branch
git push origin --delete branch-name

# See what changed
git status
git diff

# Commit changes
git add .
git commit -m "message"

# Push to remote
git push

# Pull latest from remote
git pull

# See commit history
git log --oneline --graph
```

### Before You Commit Checklist

- [ ] Code works and is tested
- [ ] No console.log or debug code left behind
- [ ] No commented-out code (delete it instead)
- [ ] Commit message is clear and follows conventions
- [ ] No sensitive data in the changes
- [ ] Files are properly formatted (run `npm run format`)
- [ ] No linting errors (run `npm run lint`)

## Questions?

If you're unsure about whether to create a branch or how to structure your work, err on the side of creating a branch. They're easy to create and delete, so there's no harm in being cautious.

When in doubt:
1. Create a branch
2. Make your changes
3. Test thoroughly
4. Decide whether to merge or delete
