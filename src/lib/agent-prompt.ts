import type { ResolvedAppConfig, SiteMetadata } from './types.js';

export function buildAgentPrompt(config: ResolvedAppConfig, metadata: SiteMetadata): string {
  const lines = [
    'You are working inside the repository of an existing web app.',
    'Create a desktop app wrapper for that app using appbun.',
    '',
    'Project inputs:',
    `- Web app URL to package: ${config.url}`,
    `- App name: ${config.name}`,
    `- Window title: ${config.title}`,
    `- Description: ${config.description}`,
    `- Package name: ${config.packageName}`,
    `- Bundle identifier: ${config.identifier}`,
    `- Default window size: ${config.width}x${config.height}`,
    `- Titlebar preset: ${config.titlebar}`,
    `- Theme color: ${config.themeColor}`,
    `- Desktop wrapper output directory: ${config.outDir}`,
    `- Source metadata title: ${metadata.title ?? config.name}`,
    `- Source metadata description: ${metadata.description ?? config.description}`,
    '',
    'Rules:',
    '- Treat the current repository as the source web app project.',
    '- Use `appbun@latest`; do not hand-roll the wrapper unless appbun output needs a specific fix.',
    '- Keep the generated project inspectable and editable.',
    '- Preserve site branding and icon metadata when available.',
    '- If the URL points to a local dev server, make sure the dev server is running and reachable before packaging.',
    '- If the local dev server is already running but the URL is unclear, prefer `appbun dev` to auto-detect common ports.',
    '- Prefer an output directory outside the source web app repo, for example `../appbun-output/<app-slug>` or another dedicated workspace.',
    '- If the wrapper must live in this repo, commit or back up the source app before installing or building the wrapper.',
    '- If the output directory already exists, prefer a safe non-destructive path or explicit confirmation.',
    '- Run create, install, build, and DMG packaging as separate steps; do not combine scaffolding and packaging unless the source repo is safely backed up.',
    '- After generation, use `appbun doctor --project` and `appbun package` commands inside the generated project when possible.',
    '',
    'Execution plan:',
    '1. If needed, start the current repo web app and verify the target URL responds in a browser.',
    `2. Run: npx -y appbun@latest ${shellQuote(config.url)} --name ${shellQuote(config.name)} --out-dir ${shellQuote(config.outDir)} --titlebar ${config.titlebar} --width ${config.width} --height ${config.height} --theme-color ${shellQuote(config.themeColor)} --yes`,
    `3. Change into the generated wrapper directory: cd ${shellQuote(config.outDir)}`,
    '4. Run: npx -y appbun@latest doctor --project',
    '5. Run: npx -y appbun@latest package --install',
    '6. On macOS, run `npx -y appbun@latest package --dmg` only after the normal build succeeds and the source repo is backed up.',
    '7. For signed or notarized distribution, use `package --dmg --sign` or `package --notarize` only when the required Apple environment variables are available.',
    '8. If the repo needs it, add a short README section explaining how to rebuild the desktop wrapper.',
    '',
    'Expected result:',
    `- A generated Electrobun project in ${config.outDir}`,
    '- Buildable macOS, Windows, and Linux wrapper project output',
    '- macOS DMG output when packaging is requested',
    '',
    'When you reply, include:',
    '- what command you ran',
    '- where the generated project was written',
    '- what metadata or icons were detected',
    '- what still needs manual attention, if anything',
  ];

  return `${lines.join('\n')}\n`;
}

function shellQuote(value: string): string {
  if (/^[a-zA-Z0-9_./:-]+$/.test(value)) {
    return value;
  }
  return JSON.stringify(value);
}
