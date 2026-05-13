---
allowed-tools:
description: Create Commit Message
---

Your task is to help the user to generate a commit message and commit the changes using git.

## Guidelines

- DO NOT add any ads such as "Generated with [Claude Code]".
- Don't add any files using `git add`. The user will decide what to add.
- If there are unrelated changes across multiple files, provide separate commit messages for each logical group.
- Follow the rules below for the commit message.

## Format

```
<type>:<space><message title>

<bullet points summarizing what was updated>
```

## Example Titles

```
feat: add JWT login flow
fix: handle null pointer in sidebar
refactor: split user controller logic
docs: add usage section
```

# Example with Title and Body

```
feat: add JWT login flow

- Implemented JWT token validation logic
- Added documentation for the validation component
```

## Rules

* title is lowercase, no period at the end.
* Title should be a clear summary, max 50 characters.
* Use the body (optional) to explain *why*, not just *what*.
* Bullet points should be concise and high-level.

Avoid

* Vague titles like: "update", "fix stuff"
* Overly long or unfocused titles
* Excessive detail in bullet points

## Allowed Types

| Type     | Description                           |
|----------|---------------------------------------|
| feat     | New feature                           |
| fix      | Bug fix                               |
| chore    | Maintenance (e.g., tooling, deps)     |
| docs     | Documentation changes                 |
| refactor | Code restructure (no behavior change) |
| test     | Adding or refactoring tests           |
| style    | Code formatting (no logic change)     |
| perf     | Performance improvements              |

## Linking Sentry Issues

When a commit fixes a Sentry issue, append a footer line so Sentry auto-resolves
the issue once the commit lands on the release branch. The frontend project slug
is `nextjs`, so issue short IDs look like `NEXTJS-Q`, `NEXTJS-1A`, etc. Copy
the short ID from the Sentry issue page header or the issue URL.

Use one of the following keywords (case-insensitive): `Fixes`, `Closes`, `Resolves`.

```
fix: skip sentry capture for transient signalr negotiation failures

- Filter known auto-recovering errors out of phase=start captureException
- Toast and onclose path unchanged

Fixes NEXTJS-Q
Fixes NEXTJS-R
```

Multiple issues can be referenced one per line. Only use these keywords when the
commit actually resolves the issue. Do not link merely related work.