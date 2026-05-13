## Summary

<!-- What does this PR do, in one or two sentences? -->

## Why

<!-- The motivation: bug report, feature request, performance issue, refactor, etc. Link related issues with #N. -->

## How to test

<!-- Steps a reviewer can follow to verify the change locally. -->

- [ ] `npm run build` succeeds
- [ ] `npm run biome:check` is clean
- [ ] `npm run typecheck` is clean
- [ ] `npm test` passes
- [ ] Manual check in Storybook (`npm run storybook`)
- [ ] Verified on a real device (iOS Safari and/or Android Chrome) if camera behavior changed

## Checklist

- [ ] No new dependencies added (or new deps are justified in the PR description)
- [ ] Breaking change? If yes, called out in the description below
- [ ] Documentation (README / JSDoc) updated for any public API change
- [ ] Bundle size impact considered (`npm run size` after `npm run build`)

## Breaking changes

<!-- List any, or write "None". -->
