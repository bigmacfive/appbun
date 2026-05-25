import type { ResolvedAppConfig } from "../types.js";

export function generatedReleaseWorkflow(config: ResolvedAppConfig): string {
  const installCommand = config.packageManager === "bun" ? "bun install" : "npm install";
  const stableBuildCommand = config.packageManager === "bun" ? "bun run build:stable" : "npm run build:stable";
  const dmgBuildCommand = config.packageManager === "bun" ? "bun run build:dmg" : "npm run build:dmg";

  return `name: Build desktop artifacts

on:
  workflow_dispatch:
  release:
    types:
      - published

jobs:
  build:
    name: Build \${{ matrix.target }}
    runs-on: \${{ matrix.os }}
    strategy:
      fail-fast: false
      matrix:
        include:
          - target: macos
            os: macos-latest
          - target: windows
            os: windows-latest
          - target: linux
            os: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: ${installCommand}
      - name: Build stable app
        run: ${stableBuildCommand}
      - name: Build macOS DMG
        if: matrix.target == 'macos'
        run: ${dmgBuildCommand}
        env:
          APPLE_SIGN_IDENTITY: \${{ secrets.APPLE_SIGN_IDENTITY }}
      - uses: actions/upload-artifact@v4
        with:
          name: ${config.slug}-\${{ matrix.target }}
          path: |
            build/**
          if-no-files-found: error
`;
}
