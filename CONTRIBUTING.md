# Contributing

Read [docs/pake-grade-goal.md](docs/pake-grade-goal.md) first. It explains the product bar behind appbun's roadmap.

## Setup

```bash
bun install
bun run build
node ./bin/appbun.js doctor
bun run check
bun run test
```

## What to work on

Useful contribution areas:

- icon extraction quality
- generated shell polish
- Windows and Linux packaging
- generated app ergonomics
- built-in recipes for popular web apps
- docs, examples, and onboarding

## Adding a recipe

Built-in recipes live in `src/lib/recipes.ts`. Keep them boring and reliable:

- use public URLs that are stable over time
- prefer apps people already recognize
- include a useful `themeColor`, and only set `titlebar`, `width`, or `height` when the default is not a good fit
- add an alias only when people naturally type it, such as `ytmusic` for `youtube-music`
- add `concepts` that help people discover the recipe with `appbun discover`, such as `ai`, `design`, `docs`, `music`, or `work`

## Before opening a PR

- keep changes focused
- run `bun run check`
- run `bun run test`
- update docs if behavior changes
- prefer improving generated output over adding flags unless the behavior truly needs to vary

## Design bar

`appbun` should feel closer to a productized generator than a thin script.

That means:

- generated apps should look intentional
- defaults should be clean enough to ship
- packaging flows should reduce manual work
- README and examples should help new contributors move fast
