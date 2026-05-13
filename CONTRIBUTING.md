# Contributing to @yudiel/react-qr-scanner

Thanks for your interest in contributing! This document explains how to set up
the project locally, the conventions we follow, and the PR process.

## Local setup

Requirements:

- Node.js >= 18 (CI uses Node 22; match it if you can)
- npm >= 9

```bash
git clone https://github.com/yudielcurbelo/react-qr-scanner.git
cd react-qr-scanner
npm install
```

The `prepare` script installs Husky hooks. The `pre-commit` hook runs Biome on
staged files via `lint-staged`.

## Common commands

```bash
# Run Storybook (visual development environment)
npm run storybook

# Build the library (CJS + ESM + .d.ts)
npm run build

# Lint and format with Biome
npm run biome:check    # writes fixes
npm run biome:lint     # lint only

# Type-check
npm run typecheck

# Tests
npm test               # one-shot
npm run test:watch     # watch mode
npm run test:coverage  # with coverage report

# Bundle size check (after `npm run build`)
npm run size
```

## Code style

- **Formatter**: Biome. Tabs for indentation, single quotes. The repo's
  `biome.json` is the source of truth. VS Code uses Biome via `.vscode/settings.json`.
- **TypeScript**: strict mode is on. No `any` unless unavoidable; prefer typed
  generics or `unknown` + narrowing.
- **Comments**: only add comments where the *why* is non-obvious (a workaround,
  a hidden constraint, a surprising invariant). Don't restate what the code
  does.
- **Tests**: utilities and hooks should have unit tests. Tests live next to the
  code under test as `*.test.ts` / `*.test.tsx`.

## Project layout

```
src/
  assets/         # SVG icon components and base64 audio asset
  components/     # Scanner.tsx, Finder.tsx, OnOff.tsx, Torch.tsx, Zoom.tsx
  hooks/          # useCamera, useScanner, useDevices
  misc/           # default constraints/components/styles, tracker overlays
  types/          # all exported TypeScript types and global augmentations
  utilities/      # deepEqual, isObject, createScannerError, ...
stories/          # Storybook stories
```

See [`CLAUDE.md`](./CLAUDE.md) for a deeper architecture overview of the hook
layering and constraint-management pattern.

## Branching

- Fork the repo and create a feature branch from `main`.
- Branch naming: `<type>/<short-description>` where `<type>` is one of `feat`,
  `fix`, `chore`, `docs`, `refactor`, `perf`, `test`. Example:
  `fix/camera-cleanup-race`.

## Commit messages

Conventional Commits style is encouraged (but not yet enforced). Examples:

```
fix: clone merged constraints before deleting facingMode
feat: forward ref on Scanner to expose video element and stream
test: cover useDevices devicechange refresh
```

## Pull requests

1. Open an issue first for non-trivial changes so we can agree on the approach.
2. Make sure `npm run build`, `npm run typecheck`, `npm run biome:check`, and
   `npm test` all pass locally.
3. Update `README.md` if you change a public API or add a new prop/hook. For
   breaking changes, call them out clearly in the PR description.
4. Submit the PR using the template. Fill in *what changed*, *why*, and
   *how to test*.
5. Be prepared to test on a real device (iOS Safari and Android Chrome) for any
   camera-behavior change. The emulator and Chrome fake-device flag don't catch
   everything.

## Releases

Releases are cut by maintainers from GitHub Releases. The `Publish to NPM`
workflow (in `.github/workflows/`) publishes with OIDC provenance on Release
publication; tagged pre-releases publish to the `beta` dist-tag.

## Reporting issues

Use the issue template. The camera ecosystem is browser-, device-, and
permission-dependent, so a reproducible Storybook/CodeSandbox link and the
debug-info JSON from the bug report template are essential.

## Code of Conduct

By participating, you agree to abide by the [Code of Conduct](./CODE_OF_CONDUCT.md).
